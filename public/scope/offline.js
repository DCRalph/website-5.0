/* Offline transient analysis: the whole file at once, no real time budget.
 *
 * One pipeline, chosen for accuracy rather than cost:
 *
 * - 200 frames a second, two window sizes. The long window (2048) gives the
 *   bass its frequency resolution and the vibrato filter something to work
 *   with; the short one (512) puts the peak on the attack for clicks and hats.
 * - a 24 band per octave log filterbank on each, as in the SuperFlux paper,
 *   so a quarter tone is one band at every pitch instead of one bin at 5 kHz
 *   and half an octave at 100 Hz.
 * - SuperFlux (Bock and Widmer 2013) on each resolution: rectified rise in
 *   log magnitude against a frame 20 ms back that has been maximum filtered
 *   over two bands either side, so a partial that only moved lands on its
 *   own earlier energy. Summed over the two resolutions, per band.
 * - non causal peak picking with local normalisation: the curve is scaled by
 *   its own RMS over the surrounding eight seconds, so a quiet intro and a
 *   loud drop are judged by the same rule, then the same three gates as the
 *   scope (rose fast, rose by enough, within SENS of the loudest nearby).
 * - each onset gets the range that carried most of its amplitude rise, and
 *   is then refined to the sample: the envelope of that range around the
 *   frame, and the steepest 2 ms of its rise.
 *
 * With a model loaded (onsetcnn.js, madmom's CNN onset detector) the
 * detection curve is the network's onset probability instead of SuperFlux,
 * picked the way madmom picks it. Everything after that is shared: the
 * sample accurate refinement and the instrument labels.
 *
 * analyse() is the expensive part and depends only on the audio; pick() is
 * cheap and depends on SENS, so a sensitivity change never re-analyses.
 * Loads in node for the tests: `global.DSP = require("./dsp.js")` first. */
const Offline = (() => {
  "use strict";
  const { getFFT, hann, bandGain } = DSP;
  const CNN = typeof OnsetCNN !== "undefined" ? OnsetCNN : null;

  const HOP_SEC = 0.005;
  const RES = [2048, 512];
  const BANDS_PER_OCT = 24;
  const FB_LO = 30, FB_HI = 17000;
  const COMP = 8;                     // log1p(COMP * amplitude)
  const LAG_SEC = 0.02;
  const MAXF = 2;                     // max filter half width, bands
  const RANGE_EDGES = [20, 100, 300, 1000, 3000, 8000, Infinity];
  const RANGE_NAMES = ["LL", "HL", "LM", "HM", "LH", "HH"];
  const NR = RANGE_NAMES.length;
  const rangeOf = (f) => { let r = 0; while (f >= RANGE_EDGES[r + 1]) r++; return r; };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  function movingAverage(a, radius) {
    const n = a.length;
    const out = new Float32Array(n);
    let sum = 0;
    for (let i = 0; i < Math.min(radius, n); i++) sum += a[i];
    for (let i = 0; i < n; i++) {
      const add = i + radius, drop = i - radius - 1;
      if (add < n) sum += a[add];
      if (drop >= 0) sum -= a[drop];
      out[i] = sum / (Math.min(n - 1, i + radius) - Math.max(0, i - radius) + 1);
    }
    return out;
  }

  /* Triangular filters on a log axis, area normalised. Filters that would
     land on the same bins as their neighbour are dropped (there are more
     bands than bins below a few hundred Hz), and a filter thin enough to
     miss every bin centre takes the nearest bin whole. */
  function filterbank(n, sr) {
    const half = n >> 1, binHz = sr / n;
    const top = Math.min(FB_HI, sr / 2);
    const nb = Math.floor(Math.log2(top / FB_LO) * BANDS_PER_OCT);
    const fc = (b) => FB_LO * Math.pow(2, b / BANDS_PER_OCT);
    const filters = [];
    let prevKey = "";
    for (let b = 0; b < nb; b++) {
      const l = fc(b - 1), c = fc(b), r = fc(b + 1);
      let k0 = Math.ceil(l / binHz), k1 = Math.floor(r / binHz);
      if (k1 < k0) k0 = k1 = Math.round(c / binHz);
      if (k0 < 1 || k1 > half) continue;
      const key = k0 + ":" + k1;
      if (key === prevKey) continue;
      prevKey = key;
      const w = new Float32Array(k1 - k0 + 1);
      let sum = 0;
      for (let k = k0; k <= k1; k++) {
        const f = k * binHz;
        w[k - k0] = Math.max(0, f <= c ? (f - l) / (c - l) : (r - f) / (r - c));
        sum += w[k - k0];
      }
      if (sum <= 0) { w.fill(0); w[Math.round(c / binHz) - k0] = 1; sum = 1; }
      for (let i = 0; i < w.length; i++) w[i] /= sum;
      filters.push({ k0, w, hz: c, log2hz: Math.log2(c), range: rangeOf(c) });
    }
    return filters;
  }

  function readInto(dst, src, start) {
    dst.fill(0);
    const a = Math.max(0, start), b = Math.min(src.length, start + dst.length);
    if (b > a) dst.set(src.subarray(a, b), a - start);
  }

  /* The detection curve and the per range amplitude rises, for the whole
     file. Chunked so a page stays live; onProgress gets 0..1. */
  async function analyse(mono, sr, onProgress) {
    const hop = Math.round(HOP_SEC * sr), fps = sr / hop;
    const lag = Math.max(1, Math.round(LAG_SEC * fps));
    const frames = Math.floor(mono.length / hop) + 1;
    const res = RES.map((n) => {
      const fb = filterbank(n, sr);
      return {
        n, fb, B: fb.length, fft: getFFT(n), win: hann(n),
        re: new Float64Array(n), im: new Float64Array(n), buf: new Float32Array(n),
        mag: new Float32Array((n >> 1) + 1),
        // ring of lag + 1 frames of band log magnitude and amplitude
        hist: Array.from({ length: lag + 1 }, () => ({ L: new Float32Array(fb.length), A: new Float32Array(fb.length) })),
      };
    });
    const odf = new Float32Array(frames);
    const rise = new Float32Array(frames * NR);
    // colour tracks for the waveform: log frequency centroid as 0..1 over
    // 40 Hz to 16 kHz, and level, both per frame from the long window
    const hue = new Float32Array(frames);
    const level = new Float32Array(frames);
    const HUE_LO = Math.log2(40), HUE_SPAN = Math.log2(16000) - HUE_LO;

    for (let t = 0; t < frames; t++) {
      let v = 0;
      for (const r of res) {
        const { n, fb, B, re, im, buf, mag } = r;
        readInto(buf, mono, t * hop - (n >> 1));
        for (let i = 0; i < n; i++) { re[i] = buf[i] * r.win[i]; im[i] = 0; }
        r.fft.run(re, im, false);
        for (let k = 0; k <= n >> 1; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const cur = r.hist[t % (lag + 1)];
        const old = r.hist[(t + 1) % (lag + 1)];      // frame t - lag
        for (let b = 0; b < B; b++) {
          const { k0, w } = fb[b];
          let a = 0;
          for (let i = 0; i < w.length; i++) a += w[i] * mag[k0 + i];
          cur.A[b] = a;
          cur.L[b] = Math.log1p(COMP * a);
        }
        let s = 0;
        for (let b = 0; b < B; b++) {
          let mx = 0;
          for (let j = Math.max(0, b - MAXF); j <= Math.min(B - 1, b + MAXF); j++) if (old.L[j] > mx) mx = old.L[j];
          const d = cur.L[b] - mx;
          if (d > 0) s += d;
        }
        v += s / B;
        if (n === RES[0]) {
          let wsum = 0, lsum = 0;
          for (let b = 0; b < B; b++) {
            const d = cur.A[b] - old.A[b];
            if (d > 0) rise[t * NR + fb[b].range] += d;
            wsum += cur.A[b];
            lsum += cur.A[b] * fb[b].log2hz;
          }
          level[t] = wsum;
          hue[t] = wsum > 0 ? Math.min(1, Math.max(0, (lsum / wsum - HUE_LO) / HUE_SPAN)) : 0;
        }
      }
      odf[t] = v;
      if ((t & 511) === 511) { onProgress?.(t / frames); await tick(); }
    }
    onProgress?.(1);
    return { odf, rise, hue, level, fps, hop, sr, frames };
  }

  /* --- the CNN path ------------------------------------------------------- */

  // fetch the weights; null when they cannot be had (file:// pages, offline)
  async function loadModel(jsonUrl, binUrl) {
    if (!CNN) return null;
    const [manifest, bin] = await Promise.all([
      fetch(jsonUrl).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(binUrl).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    ]);
    return CNN.loadWeights(manifest, bin);
  }

  /* The network's onset probability per frame as the detection curve, plus
     the same side tracks analyse() makes (per range rise, hue, level) from
     the 2048 point Mel amplitudes the front end already has. 44.1 kHz only:
     the model was trained at that rate, so the caller resamples.

     The network says whether; the SuperFlux curve says when. Its peak sits
     up to two frames early on short bright hits (the 93 ms window sees them
     coming) and 10 ms frames are coarse anyway, so each detection is snapped
     to the nearest SuperFlux peak within 25 ms before the sample accurate
     refinement, which then works at the flux curve's 5 ms hop. `flux` may be
     passed in when the caller has already computed it. */
  async function analyseCNN(mono, sr, weights, onProgress, flux = null) {
    if (!CNN) throw new Error("onsetcnn.js is not loaded");
    if (sr !== CNN.SR) throw new Error(`the CNN needs ${CNN.SR} Hz audio, got ${sr}`);
    if (!flux) flux = await analyse(mono, sr, (p) => onProgress?.(0.1 * p));
    const fe = await CNN.frontend(mono, (p) => onProgress?.(0.1 + 0.25 * p));
    const odf = await CNN.activate(weights, fe.feat, fe.frames, (p) => onProgress?.(0.35 + 0.65 * p));
    const { frames, mel2048, melHz } = fe;
    const fps = CNN.FPS, NBm = CNN.NB, lag = Math.max(1, Math.round(LAG_SEC * fps));
    const rise = new Float32Array(frames * NR);
    const hue = new Float32Array(frames);
    const level = new Float32Array(frames);
    const HUE_LO = Math.log2(40), HUE_SPAN = Math.log2(16000) - HUE_LO;
    const bandRange = melHz.map(rangeOf), bandLog = melHz.map(Math.log2);
    for (let t = 0; t < frames; t++) {
      let wsum = 0, lsum = 0;
      for (let b = 0; b < NBm; b++) {
        const a = mel2048[t * NBm + b];
        if (t >= lag) { const d = a - mel2048[(t - lag) * NBm + b]; if (d > 0) rise[t * NR + bandRange[b]] += d; }
        wsum += a;
        lsum += a * bandLog[b];
      }
      level[t] = wsum;
      hue[t] = wsum > 0 ? Math.min(1, Math.max(0, (lsum / wsum - HUE_LO) / HUE_SPAN)) : 0;
    }
    onProgress?.(1);
    return { odf, rise, hue, level, fps, hop: CNN.HOP, sr, frames, model: "cnn", flux, timingHop: flux.hop };
  }

  // move each CNN detection onto the strongest SuperFlux peak within 25 ms
  function snapToFlux(an, cands) {
    const { odf, fps } = an.flux;
    const base = movingAverage(odf, Math.round(0.1 * fps));
    const win = Math.round(0.025 * fps);
    for (const c of cands) {
      const f0 = Math.round(c.t * fps);
      let best = -1, bestV = 0;
      for (let f = Math.max(1, f0 - win); f <= Math.min(odf.length - 2, f0 + win); f++) {
        const v = odf[f] - base[f];
        if (v > bestV && odf[f] >= odf[f - 1] && odf[f] >= odf[f + 1]) { bestV = v; best = f; }
      }
      if (best >= 0) c.t = best / fps;
    }
    return cands;
  }

  // the largest baseline removed amplitude rise around each candidate frame
  function attributeRanges(an, cands) {
    const { rise, fps, frames } = an;
    const rb = new Float32Array(frames);
    const riseB = new Float32Array(frames * NR);
    for (let r = 0; r < NR; r++) {
      for (let t = 0; t < frames; t++) rb[t] = rise[t * NR + r];
      const b = movingAverage(rb, Math.round(0.1 * fps));
      for (let t = 0; t < frames; t++) riseB[t * NR + r] = Math.max(0, rb[t] - b[t]);
    }
    for (const c of cands) {
      let best = 0, bestV = -1;
      for (let r = 0; r < NR; r++) {
        let v = 0;
        for (let u = Math.max(0, c.frame - 1); u <= Math.min(frames - 1, c.frame + 1); u++) v += riseB[u * NR + r];
        if (v > bestV) { bestV = v; best = r; }
      }
      c.range = best;
      c.t = c.frame / fps;
    }
    return cands;
  }

  /* Onsets from the analysis at a given sensitivity. With the CNN, SENS is
     the probability threshold (madmom's default 0.54 sits near the middle of
     the slider) and the picking is madmom's; the gates below are for the
     SuperFlux curve, which has no absolute scale. */
  function pick(an, sens = 0.65) {
    if (an.model === "cnn") return snapToFlux(an, attributeRanges(an, CNN.pickPeaks(an.odf, 0.85 - 0.5 * sens, an.fps)));
    const { rise, fps, frames } = an;
    // 15 ms smoothing: an attack spans several 5 ms frames as it crosses the
    // windows, a noise spike is one frame, so this costs the attack nothing
    // and takes the spike down by three
    const odf = movingAverage(an.odf, Math.max(1, Math.round(0.0075 * fps)));
    const base = movingAverage(odf, Math.round(0.1 * fps));
    const d = new Float32Array(frames);
    const d2 = new Float32Array(frames);
    let g = 0;
    for (let i = 0; i < frames; i++) { d[i] = Math.max(0, odf[i] - base[i]); d2[i] = d[i] * d[i]; g += d2[i]; }
    g = Math.sqrt(g / Math.max(1, frames)) || 1;
    const local = movingAverage(d2, Math.round(4 * fps));
    const dn = new Float32Array(frames);
    for (let i = 0; i < frames; i++) dn[i] = d[i] / Math.max(Math.sqrt(local[i]), 0.05 * g);

    const thresh = 0.5 - 0.4 * sens;
    // gentler than the scope's floor: a whole song has breakdowns a few
    // seconds from drops, and the gates already hold noise and ripple back
    const floor = 0.4 * (1 - sens);
    const w = Math.max(1, Math.round(0.015 * fps));
    const rg = Math.max(2, Math.round(0.02 * fps));
    const minSep = Math.max(1, Math.round(0.03 * fps));

    // candidates: local maxima above threshold that rose fast and by enough
    const cand = [];
    for (let i = w; i < frames - w; i++) {
      const v = dn[i];
      if (v < thresh) continue;
      let isMax = true;
      for (let j = i - w; j <= i + w; j++) if (dn[j] > v || (dn[j] === v && j < i)) { isMax = false; break; }
      if (!isMax) continue;
      let from = v;
      for (let u = i - rg; u < i; u++) if (dn[u] < from) from = dn[u];
      if (v - from < 0.5 * v) continue;
      if (d[i] < 0.2 * base[i]) continue;
      cand.push({ frame: i, strength: v });
    }

    // within SENS of the loudest attack in the surrounding eight seconds
    const span = Math.round(4 * fps);
    const kept = [];
    let lo = 0;
    for (let i = 0; i < cand.length; i++) {
      while (cand[lo].frame < cand[i].frame - span) lo++;
      let mx = 0;
      for (let j = lo; j < cand.length && cand[j].frame <= cand[i].frame + span; j++) if (cand[j].strength > mx) mx = cand[j].strength;
      if (cand[i].strength >= floor * mx) kept.push(cand[i]);
    }

    // minimum separation, the stronger wins
    const sep = [];
    for (const c of kept) {
      const last = sep[sep.length - 1];
      if (last && c.frame - last.frame < minSep) { if (c.strength > last.strength) sep[sep.length - 1] = c; }
      else sep.push(c);
    }

    return attributeRanges(an, sep);
  }

  /* Sample accurate onset times: the envelope of the onset's range around
     its frame (analytic signal of the band passed chunk), and the centre of
     the steepest 2 ms of its rise within half a frame plus 6 ms of it. Not
     wider: a held note sharing the band beats against the attack and can
     move the steepest point. */
  const RN = 4096;
  const rRe = new Float64Array(RN), rIm = new Float64Array(RN), rBuf = new Float32Array(RN), rEnv = new Float32Array(RN);
  function refine(mono, sr, onsets, an = null) {
    const fft = getFFT(RN);
    const half = RN >> 1;
    // half a frame of quantisation plus a little either side: the frame's
    // centre can sit that far from the attack
    const hop = an?.timingHop ?? an?.hop ?? Math.round(HOP_SEC * sr);
    const search = Math.round(0.006 * sr) + (hop >> 1);
    const dt = Math.max(1, Math.round(0.001 * sr));
    const masks = new Map();
    for (const o of onsets) {
      let m = masks.get(o.range);
      if (!m) {
        const lo = RANGE_EDGES[o.range], hi = Math.min(RANGE_EDGES[o.range + 1], 0.45 * sr);
        m = new Float32Array(half + 1);
        for (let k = 0; k <= half; k++) m[k] = bandGain((k * sr) / RN, lo, hi);
        masks.set(o.range, m);
      }
      const start = Math.round(o.t * sr) - half;
      readInto(rBuf, mono, start);
      for (let i = 0; i < RN; i++) { rRe[i] = rBuf[i]; rIm[i] = 0; }
      fft.run(rRe, rIm, false);
      // analytic: positive frequencies doubled, negative zeroed, band masked
      for (let k = 0; k <= half; k++) { const g = m[k] * (k === 0 || k === half ? 1 : 2); rRe[k] *= g; rIm[k] *= g; }
      for (let k = half + 1; k < RN; k++) { rRe[k] = 0; rIm[k] = 0; }
      fft.run(rRe, rIm, true);
      for (let i = 0; i < RN; i++) rEnv[i] = Math.sqrt(rRe[i] * rRe[i] + rIm[i] * rIm[i]);
      const sm = movingAverage(rEnv, dt >> 1);
      let best = half, bestSlope = -Infinity;
      for (let i = half - search; i <= half + search; i++) {
        const slope = sm[i + dt] - sm[i - dt];
        if (slope > bestSlope) { bestSlope = slope; best = i; }
      }
      o.t = (start + best) / sr;
    }
    onsets.sort((a, b) => a.t - b.t);
    // refinement can pull two frames onto one attack; keep the stronger
    const out = [];
    for (const o of onsets) {
      const last = out[out.length - 1];
      if (last && o.t - last.t < 0.03) { if (o.strength > last.strength) out[out.length - 1] = o; }
      else out.push(o);
    }
    return out;
  }

  /* --- instruments ------------------------------------------------------- */

  /* Which instrument each onset is, by rule rather than by model.

     The spectrum of what appeared: power just after the onset minus power
     just before, rectified, so a hat over a held bass note looks like a hat
     and not like bass. That spectrum is split into three groups (low to
     250 Hz, mid to 2.5 kHz, high above) and each group is measured for its
     share, its tonal or noisy character (spectral flatness), how fast it
     decays and whether it sustains. A group counts if it is a real part of
     this onset and comparable to the loudest such group nearby, so an onset
     can carry more than one label: a kick and a hat on the same beat come
     out as both.

     KICK   low group, sub bass heavy or decaying   TOM    low, tonal, slow decay
     BASS   low, tonal, sustained                   SNARE  mid, noisy, with body
     CLAP   mid, noisy, no body                     TONAL  mid, tonal (stabs, keys, voice)
     HAT    high, bright, short                     OPEN   high, bright, long (open hat, cymbal)
     PERC   anything else that was percussive */
  const INSTRUMENTS = ["KICK", "SNARE", "CLAP", "TOM", "HAT", "OPEN", "BASS", "TONAL", "PERC"];
  const I = Object.fromEntries(INSTRUMENTS.map((n, i) => [n, i]));
  const CN = 2048;
  const cRe = new Float64Array(CN), cIm = new Float64Array(CN), cBuf = new Float32Array(CN);
  const cPre = new Float32Array(CN >> 1), cPost = new Float32Array(CN >> 1), cNew = new Float32Array(CN >> 1);
  const DN = 2048;                    // decay frames: long enough to keep adjacent harmonics from beating
  const dRe = new Float64Array(DN), dIm = new Float64Array(DN), dBuf = new Float32Array(DN);
  const dPre = new Float32Array(DN >> 1), dCur = new Float32Array(DN >> 1);

  function powerSpectrum(mono, sr, centreSec, n, re, im, buf, out) {
    const fft = getFFT(n), win = hann(n);
    readInto(buf, mono, Math.round(centreSec * sr) - (n >> 1));
    for (let i = 0; i < n; i++) { re[i] = buf[i] * win[i]; im[i] = 0; }
    fft.run(re, im, false);
    for (let k = 0; k < n >> 1; k++) out[k] = re[k] * re[k] + im[k] * im[k];
  }

  // spectral flatness of a bin range, with a floor so the rectified zeros do
  // not pin the geometric mean at nothing
  function flatness(p, k0, k1) {
    let mean = 0;
    for (let k = k0; k < k1; k++) mean += p[k];
    mean /= Math.max(1, k1 - k0);
    if (mean <= 0) return 0;
    const eps = 1e-3 * mean;
    let lg = 0;
    for (let k = k0; k < k1; k++) lg += Math.log(p[k] + eps);
    return Math.exp(lg / Math.max(1, k1 - k0)) / mean;
  }

  const GROUPS = [[30, 250], [250, 2500], [2500, 16000], [9000, 16000]];   // the fourth is the hat band, decay only
  const SUB = [30, 100], UPPER = [100, 250];

  /* Band weights per bin: the fraction of each bin's width inside [lo, hi).
     The low bands are only a handful of bins wide, so whole bin rounding
     would make the sub bass share depend on the sample rate. */
  const bandCache = new Map();
  function bandWeights(n, sr, lo, hi) {
    const key = `${n}:${sr}:${lo}:${hi}`;
    let w = bandCache.get(key);
    if (w) return w;
    const half = n >> 1, binHz = sr / n;
    w = { k0: half, k1: 0, w: new Float32Array(half), bins: 0 };
    for (let k = 1; k < half; k++) {
      const a = (k - 0.5) * binHz, b = (k + 0.5) * binHz;
      const f = Math.max(0, Math.min(b, hi) - Math.max(a, lo)) / binHz;
      if (f <= 0) continue;
      w.w[k] = f;
      w.bins += f;
      if (k < w.k0) w.k0 = k;
      if (k + 1 > w.k1) w.k1 = k + 1;
    }
    bandCache.set(key, w);
    return w;
  }

  function features(mono, sr, t, nextT) {
    const binHz = sr / CN;
    powerSpectrum(mono, sr, t - 0.03, CN, cRe, cIm, cBuf, cPre);
    powerSpectrum(mono, sr, t + 0.02, CN, cRe, cIm, cBuf, cPost);
    // group sizes are magnitude sums, not power: a partial concentrates its
    // power in two bins and would otherwise outweigh a noise burst spread
    // over six hundred, and the noise is the part that names the drum
    // a bin counts as appeared only if its power at least doubled: a held
    // note wobbles a few dB between the two windows and that is not an onset
    let total = 0;
    for (let k = 0; k < CN >> 1; k++) { cNew[k] = cPost[k] > 2 * cPre[k] ? cPost[k] - cPre[k] : 0; total += Math.sqrt(cNew[k]); }
    const bandSum = (bw) => { let e = 0; for (let k = bw.k0; k < bw.k1; k++) e += bw.w[k] * Math.sqrt(cNew[k]); return e; };
    const g = GROUPS.slice(0, 3).map(([lo, hi]) => {
      const bw = bandWeights(CN, sr, lo, hi);
      let e = 0, c = 0;
      for (let k = bw.k0; k < bw.k1; k++) { const m = bw.w[k] * Math.sqrt(cNew[k]); e += m; c += m * k * binHz; }
      return { e, density: e / Math.max(1, bw.bins), centroid: e > 0 ? c / e : 0, flat: flatness(cNew, bw.k0, bw.k1) };
    });
    const sub = bandSum(bandWeights(CN, sr, SUB[0], SUB[1]));
    const top = bandSum(bandWeights(CN, sr, GROUPS[3][0], GROUPS[3][1]));

    // decay per group: energy of the new content in 10 ms steps after the
    // onset, until it is 15 dB under its peak, the next onset, or 400 ms.
    // Whether it sustains at all is the 60 to 90 ms energy over the 10 to
    // 40 ms energy, averaged because adjacent harmonics beat inside a short
    // window and a single frame wobbles.
    const dw = GROUPS.map(([lo, hi]) => bandWeights(DN, sr, lo, hi));
    const upW = bandWeights(DN, sr, UPPER[0], UPPER[1]);
    powerSpectrum(mono, sr, t - 0.025, DN, dRe, dIm, dBuf, dPre);
    const cap = Math.min(0.4, (nextT ?? Infinity) - t - 0.01);
    const peak = [0, 0, 0, 0], decay = [cap, cap, cap, cap], early = [0, 0, 0, 0], late = [0, 0, 0, 0];
    const done = [false, false, false, false];
    let hatDecay10 = cap, upEarly = 0, upLate = 0;
    let step = 0;
    for (let tau = 0.01; tau <= cap + 1e-9; tau += 0.01, step++) {
      powerSpectrum(mono, sr, t + tau, DN, dRe, dIm, dBuf, dCur);
      for (let gi = 0; gi < 4; gi++) {
        let e = 0, up = 0;
        const bw = dw[gi];
        for (let k = bw.k0; k < bw.k1; k++) {
          const d = dCur[k] > 2 * dPre[k] ? dCur[k] - dPre[k] : 0;
          e += bw.w[k] * d;
          if (gi === 0) up += upW.w[k] * d;
        }
        if (e > peak[gi]) peak[gi] = e;
        if (step < 4) early[gi] += e;
        else if (step >= 5 && step < 9) late[gi] += e;
        // the 100 to 250 Hz part of the low group is tracked on its own: a
        // kick's sweep has left it by 60 ms while a bass note's harmonics
        // stay, and it is clear of a held sub the kick can land on
        if (gi === 0) { if (step < 4) upEarly += up; else if (step >= 5 && step < 9) upLate += up; }
        if (!done[gi] && peak[gi] > 0 && e < peak[gi] * 0.0316) { decay[gi] = tau; done[gi] = true; }
        // the hat band also gets a 10 dB time: a snare's residual up there
        // can hold the band above 15 dB after the hat itself is gone
        if (gi === 3 && hatDecay10 === cap && peak[3] > 0 && e < peak[3] * 0.1) hatDecay10 = tau;
      }
    }
    for (let gi = 0; gi < 3; gi++) {
      g[gi].decay = decay[gi];
      g[gi].decayed = done[gi];
      g[gi].sustain = early[gi] > 0 && cap >= 0.09 ? late[gi] / early[gi] : 0;
    }
    if (upEarly > 0.1 * early[0] && cap >= 0.09) g[0].sustain = upLate / upEarly;
    // a hat's decay is read above 9 kHz, where a snare's own noise has faded
    g[2].hatDecay = hatDecay10;
    // hat band density against the rest of the high group: a hat is as dense
    // above 9 kHz as below it, a snare's noise has mostly gone by there
    const topBins = bandWeights(CN, sr, GROUPS[3][0], GROUPS[3][1]).bins;
    const lowerBins = bandWeights(CN, sr, GROUPS[2][0], GROUPS[3][0]).bins;
    const topDensity = top / Math.max(1, topBins), lowerDensity = (g[2].e - top) / Math.max(1, lowerBins);
    return { total, g, top, topRatio: lowerDensity > 0 ? topDensity / lowerDensity : 0, subShare: g[0].e > 0 ? sub / g[0].e : 0 };
  }

  // cache: Map from onset time to features, so a SENS change only measures
  // the onsets it added
  function classify(mono, sr, onsets, cache = null) {
    const feats = onsets.map((o, i) => {
      const key = Math.round(o.t * 1e4) * 16 + Math.min(15, Math.round(((onsets[i + 1]?.t ?? 9) - o.t) * 20));
      let f = cache?.get(key);
      if (!f) { f = features(mono, sr, o.t, onsets[i + 1]?.t); cache?.set(key, f); }
      return f;
    });
    // per group, the loudest such group within four seconds among onsets
    // that are mostly that group. Leakage (a hat's skirt in the mid, a
    // kick's click up high) never anchors a label that way, while a quiet
    // hat under a kick still counts as long as hats also play on their own.
    const localMax = onsets.map((o, i) => {
      const m = [0, 0, 0, 0];               // three groups and the hat band
      for (let j = 0; j < onsets.length; j++) {
        if (Math.abs(onsets[j].t - o.t) > 4) continue;
        const fj = feats[j];
        for (let gi = 0; gi < 3; gi++) if (fj.g[gi].e >= 0.1 * fj.total && fj.g[gi].e > m[gi]) m[gi] = fj.g[gi].e;
        if (fj.top >= 0.1 * fj.total && fj.top > m[3]) m[3] = fj.top;
      }
      return m;
    });
    onsets.forEach((o, i) => {
      const f = feats[i], [low, mid, high] = f.g;
      const rel = f.g.map((gr, gi) => (localMax[i][gi] > 0 ? gr.e / localMax[i][gi] : 0));
      // against the loudest anchor nearby: 0.08 for the mid and high, since
      // a hat in the last bars before a drop is 10 dB under the hats in the
      // drop and is still a hat; 0.15 for the low, where two partials
      // beating can fake a small event that has no drum behind it
      const sig = f.g.map((gr, gi) => rel[gi] >= (gi === 0 ? 0.15 : 0.08) && gr.e >= 0.003 * f.total);
      // a group is not its louder neighbour's skirt: a hat's noise and a
      // kick's click reach into the mid at under half the hat's density per
      // bin, and a drum with a body of its own is denser than that
      if (sig[2] && mid.density < 0.6 * high.density) sig[1] = false;
      if (sig[1] && low.density < 0.4 * mid.density) sig[0] = false;
      const topRel = localMax[i][3] > 0 ? f.top / localMax[i][3] : 0;
      const labels = [];
      const add = (name, gi) => labels.push({ name, score: rel[gi] });
      const has = (name) => labels.some((l) => l.name === name);

      // low first: a sustained low sound is the bass whatever its spectrum,
      // since no drum holds level for 80 ms
      if (sig[0]) {
        // a sustained low sound is a bass note when it is a big low event;
        // a small one is two nearby partials beating, which is nothing
        if (low.sustain >= 0.85) { if (rel[0] >= 0.25) add("BASS", 0); }
        else if (f.subShare >= 0.35) add("KICK", 0);
        else if (low.flat < 0.08 && low.decay >= 0.2) add("TOM", 0);
        else add("KICK", 0);
      }
      if (sig[1]) {
        if (mid.flat >= 0.08) {
          // noisy mid with a low body that is not a kick is a snare; the
          // body then belongs to the snare, not to a drum of its own
          if (sig[0] && f.subShare < 0.35 && !has("BASS")) {
            const body = labels.findIndex((l) => l.name === "KICK" || l.name === "TOM");
            if (body >= 0) labels.splice(body, 1);
            add("SNARE", 1);
          } else add(sig[0] && has("KICK") ? "SNARE" : "CLAP", 1);
        } else if (!has("BASS")) add(mid.decay >= 0.1 ? "TONAL" : "PERC", 1);   // a bass note's own harmonics are not a second instrument
      }
      if (sig[2]) {
        const sizzle = has("SNARE") || has("CLAP");
        // with a snare in the way, the hat band above 9 kHz decides: a hat
        // is there if that band is comparable to a hat playing on its own
        if (!sizzle || (topRel >= 0.08 && f.topRatio >= 0.42)) add(high.hatDecay < 0.1 ? "HAT" : "OPEN", 2);
      }
      if (!labels.length) labels.push({ name: "PERC", score: 1 });
      labels.sort((a, b) => b.score - a.score);
      o.labels = labels.map((l) => I[l.name]);
      o.inst = o.labels[0];
    });
    return onsets;
  }

  // the whole thing: analyse once (CNN when weights are given), then pick,
  // refine and label at a sensitivity
  async function detect(mono, sr, sens, onProgress, weights = null) {
    const an = weights ? await analyseCNN(mono, sr, weights, onProgress) : await analyse(mono, sr, onProgress);
    return { analysis: an, onsets: classify(mono, sr, refine(mono, sr, pick(an, sens), an)) };
  }

  return { analyse, analyseCNN, loadModel, pick, refine, classify, features, detect, filterbank, RANGE_NAMES, RANGE_EDGES, INSTRUMENTS, HOP_SEC };
})();

if (typeof module !== "undefined") module.exports = Offline;
