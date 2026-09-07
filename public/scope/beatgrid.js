/* Beat grid detection.
 *
 * The fitter is a port of timeline_pipeline/beatgrid.py (itself a
 * reconstruction of TimelineCore.BeatgridFitter): octave resolution, comb
 * refinement against the activation curve, weighted circular phase, iterated
 * least squares grid regression, and support/inlier acceptance. Same
 * constants, same acceptance rules.
 *
 * In the pipeline the candidate beats come from the detector's neural beat
 * head (postprocess.beatgrid_from_prediction peak-picks it). There is no model
 * in the browser, so the front end here is a spectral flux onset envelope,
 * peak-picked the same way and passed in as the activation curve. Everything
 * downstream of that is the ported fitter.
 */
const BeatGrid = (() => {
  "use strict";
  const { getFFT, hann, clamp } = DSP;

  // Onset analysis. Audio is decimated to ~11 kHz first: flux only needs the
  // percussive band, and the frame count is what costs.
  const ANALYSIS_SR = 11025;
  const NFFT = 512;
  const HOP = 128;              // 11.6 ms, 86 fps

  const tick = () => new Promise((r) => setTimeout(r, 0));

  /* --- front end --------------------------------------------------------- */

  function movingAverage(a, radius) {
    const n = a.length;
    const out = new Float32Array(n);
    let sum = 0;
    for (let i = 0; i < Math.min(radius, n); i++) sum += a[i];
    for (let i = 0; i < n; i++) {
      const add = i + radius;
      const drop = i - radius - 1;
      if (add < n) sum += a[add];
      if (drop >= 0) sum -= a[drop];
      const lo = Math.max(0, i - radius);
      const hi = Math.min(n - 1, i + radius);
      out[i] = sum / (hi - lo + 1);
    }
    return out;
  }

  /* Spectral flux plus the low/mid/high band energies the overview waveform
     colours itself with (same 250 Hz / 2500 Hz splits as webui's
     _colored_waveform). One pass, both outputs. */
  async function onsetAnalysis(mono, sr, onProgress) {
    const decim = Math.max(1, Math.round(sr / ANALYSIS_SR));
    const asr = sr / decim;
    const n = Math.floor(mono.length / decim);
    // half a window of leading zeros, so frame t is centred on sample t*HOP and
    // peak times need no correction (librosa's center=True convention)
    const x = new Float32Array(n + NFFT);
    const pad = NFFT >> 1;
    for (let i = 0; i < n; i++) {           // box decimation doubles as anti-alias
      let s = 0;
      const b = i * decim;
      for (let d = 0; d < decim; d++) s += mono[b + d];
      x[pad + i] = s / decim;
    }

    const fft = getFFT(NFFT);
    const win = hann(NFFT);
    const half = NFFT >> 1;
    const frames = Math.max(0, Math.floor(n / HOP) + 1);
    const fps = asr / HOP;
    const flux = new Float32Array(frames);
    const fluxLow = new Float32Array(frames);   // kick evidence, see shouldDouble
    const low = new Float32Array(frames);
    const mid = new Float32Array(frames);
    const high = new Float32Array(frames);
    const re = new Float64Array(NFFT);
    const im = new Float64Array(NFFT);
    let prev = new Float32Array(half + 1);
    let cur = new Float32Array(half + 1);
    const binHz = asr / NFFT;
    const kLow = Math.min(half, Math.round(250 / binHz));
    const kMid = Math.min(half, Math.round(2500 / binHz));

    for (let t = 0; t < frames; t++) {
      const b = t * HOP;
      for (let i = 0; i < NFFT; i++) { re[i] = x[b + i] * win[i]; im[i] = 0; }
      fft.run(re, im, false);
      let f = 0, fLow = 0, lo = 0, md = 0, hi = 0;
      for (let k = 0; k <= half; k++) {
        const a = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const m = Math.log1p(8 * a);        // compression, so loud parts do not own the flux
        cur[k] = m;
        const d = m - prev[k];
        if (d > 0) { f += d; if (k < kLow) fLow += d; }
        if (k < kLow) lo += a; else if (k < kMid) md += a; else hi += a;
      }
      flux[t] = f;
      fluxLow[t] = fLow;
      low[t] = lo; mid[t] = md; high[t] = hi;
      const swap = prev; prev = cur; cur = swap;
      if ((t & 1023) === 1023) { onProgress?.(t / frames); await tick(); }
    }

    // Local baseline removal, then unit scale. Peaks are what matter, not level.
    const norm = (a) => {
      const base = movingAverage(a, Math.round(0.35 * fps));
      let sum = 0;
      for (let i = 0; i < frames; i++) {
        a[i] = Math.max(0, a[i] - base[i]);
        sum += a[i] * a[i];
      }
      const rms = Math.sqrt(sum / Math.max(1, frames)) || 1;
      for (let i = 0; i < frames; i++) a[i] /= rms;
    };
    norm(flux);
    norm(fluxLow);

    return { env: flux, envLow: fluxLow, fps, bands: { low, mid, high } };
  }

  /* Candidate beats: local maxima standing clear of their neighbourhood.
     Mirrors postprocess._activation_peaks (threshold plus minimum distance),
     with the threshold made local because flux has no fixed scale. */
  function pickPeaks(env, fps, minSepSec = 0.09, thresh = 0.5) {
    const w = Math.max(1, Math.round(0.03 * fps));
    const mean = movingAverage(env, Math.max(w + 1, Math.round(0.25 * fps)));
    const minSep = Math.max(1, Math.round(minSepSec * fps));
    let sum = 0;
    for (let i = 0; i < env.length; i++) sum += env[i] * env[i];
    const std = Math.sqrt(sum / Math.max(1, env.length)) || 1;

    const times = [], strengths = [];
    let lastFrame = -1e9;
    for (let i = w; i < env.length - w; i++) {
      const v = env[i];
      if (v <= 0 || v < mean[i] + thresh * std) continue;
      let isMax = true;
      for (let j = i - w; j <= i + w; j++) if (env[j] > v) { isMax = false; break; }
      if (!isMax) continue;
      if (i - lastFrame < minSep) {
        if (times.length && v > strengths[strengths.length - 1]) {
          times[times.length - 1] = i / fps;
          strengths[strengths.length - 1] = v;
          lastFrame = i;
        }
        continue;
      }
      times.push(i / fps);
      strengths.push(v);
      lastFrame = i;
    }
    return { times: Float64Array.from(times), strengths: Float64Array.from(strengths) };
  }

  // Log-normal plausibility prior centred at 120 BPM.
  const tempoPrior = (bpm) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));

  /* Autocorrelation tempo estimate with the plausibility prior. This is the
     bpm_hint fit_beatgrid takes; without it the fitter starts from the median
     onset interval, which sits on eighths as often as beats. */
  function estimateTempo(env, fps, minBpm = 70, maxBpm = 190) {
    const minLag = Math.max(2, Math.floor((60 / maxBpm) * fps));
    const maxLag = Math.ceil((60 / minBpm) * fps);
    let best = -Infinity, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag];
      const score = (s / (env.length - lag)) * tempoPrior((60 * fps) / lag);
      if (score > best) { best = score; bestLag = lag; }
    }
    return bestLag ? (60 * fps) / bestLag : null;
  }

  /* --- fitter (port of timeline_pipeline/beatgrid.py) --------------------- */

  const nearestGrid = (t, ibi, phase) => phase + Math.round((t - phase) / ibi) * ibi;

  // Weighted circular mean of phases (mod period).
  function fastCircularCenter(times, ibi, weights) {
    let s = 0, c = 0;
    for (let i = 0; i < times.length; i++) {
      const angle = (2 * Math.PI * (((times[i] % ibi) + ibi) % ibi)) / ibi;
      s += weights[i] * Math.sin(angle);
      c += weights[i] * Math.cos(angle);
    }
    if (s === 0 && c === 0) return 0;
    let f = Math.atan2(s, c) / (2 * Math.PI);
    f = ((f % 1) + 1) % 1;
    return f * ibi;
  }

  const median = (arr) => {
    const a = Float64Array.from(arr).sort();
    const n = a.length;
    if (!n) return 0;
    return n % 2 ? a[(n - 1) >> 1] : 0.5 * (a[n / 2 - 1] + a[n / 2]);
  };

  // Median of wrapped phases, robust to a few wild peaks.
  function circularMedian(times, ibi) {
    if (!times.length) return 0;
    const ones = new Float64Array(times.length).fill(1);
    const center = fastCircularCenter(times, ibi, ones);
    const wrapped = new Float64Array(times.length);
    for (let i = 0; i < times.length; i++) {
      const p = ((times[i] % ibi) + ibi) % ibi;
      wrapped[i] = (((p - center + ibi / 2) % ibi) + ibi) % ibi - ibi / 2;
    }
    return (((center + median(wrapped)) % ibi) + ibi) % ibi;
  }

  function scoreFor(beatTimes, cand, tolerance, weights) {
    const phase = fastCircularCenter(beatTimes, cand, weights);
    let score = 0, count = 0;
    for (let i = 0; i < beatTimes.length; i++) {
      if (Math.abs(beatTimes[i] - nearestGrid(beatTimes[i], cand, phase)) <= tolerance) {
        score += weights[i];
        count++;
      }
    }
    return [score, count];
  }

  /* Peak pickers over-firing on eighth notes bias the interval estimate fast,
     so slower octaves are the ones that need testing; each must win by a clear
     margin over the incumbent. */
  function resolveOctave(beatTimes, ibi, tolerance, weights, maxIbi, minIbi) {
    let bestIbi = ibi;
    let best = scoreFor(beatTimes, ibi, tolerance, weights);
    for (const factor of [2, 3]) {
      const cand = ibi * factor;
      if (cand > maxIbi) continue;
      const [score, count] = scoreFor(beatTimes, cand, tolerance, weights);
      if (score > best[0] * 1.15 && count >= best[1] * 0.6) { best = [score, count]; bestIbi = cand; }
    }
    if (ibi < 0.4) {
      const cand = ibi * 0.5;
      if (cand >= minIbi) {
        const [score, count] = scoreFor(beatTimes, cand, tolerance, weights);
        if (score > best[0] * 1.3) { best = [score, count]; bestIbi = cand; }
      }
    }
    return bestIbi;
  }

  const interpAt = (curve, p) => {
    if (p <= 0) return curve[0];
    if (p >= curve.length - 1) return curve[curve.length - 1];
    const i = Math.floor(p);
    const f = p - i;
    return curve[i] * (1 - f) + curve[i + 1] * f;
  };

  /* Comb-filter polish of the inter-beat interval against the raw activation.
     The phase is derived from the peaks rather than searched freely: peak
     positions carry the true phase, and a free phase search rewards grids that
     park inside high-activation regions regardless of beat alignment. */
  function refineGridLogitScore(logits, beatTimes, weights, fps, initialIbi, tolerance,
                                searchBand = 0.03, steps = 61) {
    const n = logits.length;
    if (n < 4 || initialIbi <= 0 || beatTimes.length < 2) return [initialIbi, 0];
    let bestScore = -Infinity, bestIbi = initialIbi, bestPhase = 0;
    for (let s = 0; s < steps; s++) {
      const ibi = initialIbi * (1 - searchBand) +
        ((initialIbi * 2 * searchBand) * s) / (steps - 1);
      const phase = fastCircularCenter(beatTimes, ibi, weights);
      const kMax = Math.floor((n / fps) / ibi);
      if (kMax < 2) continue;
      let activation = 0;
      for (let k = 0; k <= kMax; k++) activation += interpAt(logits, (phase + k * ibi) * fps);
      activation /= kMax + 1;
      let inl = 0;
      for (let i = 0; i < beatTimes.length; i++) {
        if (Math.abs(beatTimes[i] - nearestGrid(beatTimes[i], ibi, phase)) <= tolerance) inl++;
      }
      const score = activation * (0.5 + 0.5 * (inl / beatTimes.length));
      if (score > bestScore) { bestScore = score; bestIbi = ibi; bestPhase = phase; }
    }
    return [bestIbi, bestPhase];
  }

  /* Returns null when the candidate peaks do not support a coherent uniform
     grid. Acceptance is on grid support (fraction of grid positions with a peak
     nearby), not on the inlier fraction of peaks: a weak beat head that misses
     beats still yields a correct grid. */
  function fitBeatgrid(beatTimes, beatLogits, fps, opts = {}) {
    const {
      downbeatTimes = null, beatConfidences = null, timeSig = "4/4", bpmHint = null,
      tolerance = 0.06, minBpm = 60, maxBpm = 220, minSupport = 0.35, minInliers = 4,
    } = opts;

    if (beatTimes.length < 4) return null;
    let weights = beatConfidences && beatConfidences.length === beatTimes.length
      ? Float64Array.from(beatConfidences)
      : new Float64Array(beatTimes.length).fill(1);
    let wsum = 0;
    for (const w of weights) wsum += w;
    wsum = Math.max(wsum, 1e-9);
    weights = weights.map((w) => w / wsum);

    const minIbi = 60 / maxBpm;
    const maxIbi = 60 / minBpm;

    // 1. initial tempo
    let initialIbi;
    if (bpmHint && bpmHint > 0) {
      initialIbi = 60 / bpmHint;
    } else {
      const plausible = [];
      for (let i = 1; i < beatTimes.length; i++) {
        const d = beatTimes[i] - beatTimes[i - 1];
        if (d >= minIbi && d <= maxIbi) plausible.push(d);
      }
      if (!plausible.length) return null;
      initialIbi = median(plausible);
    }

    // 2. octave resolution + comb refinement
    let ibi = resolveOctave(beatTimes, initialIbi, tolerance, weights, maxIbi, minIbi);
    let phase = fastCircularCenter(beatTimes, ibi, weights);
    if (beatLogits && fps > 0) {
      [ibi, phase] = refineGridLogitScore(beatLogits, beatTimes, weights, fps, ibi, tolerance);
      ibi = Math.min(maxIbi, Math.max(minIbi, ibi));
    }

    // 3. phase polish: circular median of the inlier residuals
    const inlierTimes = [];
    for (let i = 0; i < beatTimes.length; i++) {
      const r = (((beatTimes[i] - phase + ibi / 2) % ibi) + ibi) % ibi - ibi / 2;
      if (Math.abs(r) <= tolerance) inlierTimes.push(beatTimes[i]);
    }
    if (inlierTimes.length >= 2) phase = circularMedian(inlierTimes, ibi);

    // 3b. weighted least squares grid regression, iterated to convergence. The
    // comb works at frame resolution, leaving ~1 frame of interval error that
    // accumulates over a long track; each pass widens the inlier span.
    for (let pass = 0; pass < 4; pass++) {
      let sw = 0, sk = 0, skk = 0, st = 0, skt = 0, count = 0;
      for (let i = 0; i < beatTimes.length; i++) {
        const r = (((beatTimes[i] - phase + ibi / 2) % ibi) + ibi) % ibi - ibi / 2;
        if (Math.abs(r) > tolerance) continue;
        const k = Math.round((beatTimes[i] - phase) / ibi);
        const w = weights[i], t = beatTimes[i];
        sw += w; sk += w * k; skk += w * k * k; st += w * t; skt += w * k * t;
        count++;
      }
      if (count < 2) break;
      const denom = sw * skk - sk * sk;
      if (Math.abs(denom) < 1e-12) break;
      const newIbi = (sw * skt - sk * st) / denom;
      const newPhase = (st - newIbi * sk) / sw;
      if (!(newIbi >= minIbi && newIbi <= maxIbi) || Math.abs(newIbi - ibi) > 0.1 * ibi) break;
      const converged = Math.abs(newIbi - ibi) < 1e-5;
      ibi = newIbi;
      phase = ((newPhase % ibi) + ibi) % ibi;
      if (converged) break;
    }

    // 4. fit quality
    let numInliers = 0, devSum = 0;
    for (let i = 0; i < beatTimes.length; i++) {
      const d = Math.abs(beatTimes[i] - nearestGrid(beatTimes[i], ibi, phase));
      if (d <= tolerance) { numInliers++; devSum += d; }
    }
    if (numInliers < minInliers) return null;

    // 5. materialize the grid, snapping both ends to the nearest grid index
    const firstK = Math.round(-phase / ibi);
    const lastK = Math.round((beatTimes[beatTimes.length - 1] - phase) / ibi);
    if (lastK <= firstK) return null;
    const gridTimes = new Float64Array(lastK - firstK + 1);
    for (let k = firstK; k <= lastK; k++) gridTimes[k - firstK] = phase + k * ibi;

    // support: fraction of grid positions covered by a peak (two pointer)
    let covered = 0, j = 0;
    for (let i = 0; i < gridTimes.length; i++) {
      const t = gridTimes[i];
      while (j + 1 < beatTimes.length && Math.abs(beatTimes[j + 1] - t) <= Math.abs(beatTimes[j] - t)) j++;
      if (Math.abs(beatTimes[j] - t) <= tolerance) covered++;
    }
    const support = covered / gridTimes.length;
    if (support < minSupport) return null;

    // 6. bar alignment: the downbeat offset with the most evidence
    const beatsPerBar = Math.max(1, parseInt(timeSig.split("/")[0], 10) || 4);
    const offsetScores = new Float64Array(beatsPerBar);
    if (downbeatTimes && downbeatTimes.length) {
      for (let off = 0; off < beatsPerBar; off++) {
        let hits = 0;
        for (let i = off; i < gridTimes.length; i += beatsPerBar) {
          let best = Infinity;
          for (let d = 0; d < downbeatTimes.length; d++) {
            const dist = Math.abs(gridTimes[i] - downbeatTimes[d]);
            if (dist < best) best = dist;
          }
          if (best <= tolerance) hits++;
        }
        offsetScores[off] = hits;
      }
    } else {
      for (let i = 0; i < beatTimes.length; i++) {
        const k = Math.round((beatTimes[i] - phase) / ibi);
        if (Math.abs(beatTimes[i] - (phase + k * ibi)) > tolerance) continue;
        offsetScores[((k % beatsPerBar) + beatsPerBar) % beatsPerBar] += weights[i];
      }
    }
    let bestOffset = 0;
    for (let o = 1; o < beatsPerBar; o++) if (offsetScores[o] > offsetScores[bestOffset]) bestOffset = o;
    const downbeatGrid = [];
    for (let i = bestOffset; i < gridTimes.length; i += beatsPerBar) downbeatGrid.push(gridTimes[i]);

    return {
      startPos: phase,
      beatInterval: ibi,
      bpm: 60 / ibi,
      numBeats: gridTimes.length,
      numInliers,
      inlierFraction: numInliers / beatTimes.length,
      meanDeviationMs: (devSum / numInliers) * 1000,
      timeSig,
      beatTimes: gridTimes,
      downbeatTimes: Float64Array.from(downbeatGrid),
      confidence: support,
      barOffset: bestOffset,
      beatsPerBar,
    };
  }

  /* Half tempo check.
     Autocorrelation cannot tell a beat from two beats: a kick on every beat and
     a kick on every other beat correlate the same way, so the fit can land an
     octave low. Total onset strength does not separate the two, because a
     backbeat makes alternate beats stronger anyway. Low band flux does: the
     onsets halfway between the grid beats are either kicks, in which case they
     are beats and the tempo should double, or hats and offbeat noise, which
     carry no bottom end.  */
  // peak low band flux within tolerance of t
  function lowAt(envLow, fps, t, tolerance) {
    const a = Math.max(0, Math.round((t - tolerance) * fps));
    const b = Math.min(envLow.length - 1, Math.round((t + tolerance) * fps));
    let m = 0;
    for (let i = a; i <= b; i++) if (envLow[i] > m) m = envLow[i];
    return m;
  }

  /* Mean low band onset strength along the grid. Two tempo hypotheses can both
     land on onsets (eighths at 150 BPM are beats at 100) and then support and
     deviation cannot separate them, but the grid that lands on the kicks is the
     one that is right. Relative between hypotheses, so material with no bottom
     end simply scores flat and the term drops out. */
  function kickSupport(fit, envLow, fps, tolerance) {
    if (!envLow) return 0;
    let sum = 0, n = 0;
    for (let i = 0; i < fit.beatTimes.length; i++) {
      const t = fit.beatTimes[i];
      if (t < 0 || t * fps >= envLow.length) continue;
      sum += lowAt(envLow, fps, t, tolerance);
      n++;
    }
    return n ? sum / n : 0;
  }

  function shouldDouble(fit, peaks, envLow, fps, tolerance, maxBpm) {
    if (!envLow || fit.bpm * 2 > maxBpm) return false;
    const { times } = peaks;
    if (times.length < 8) return false;
    let j = 0;
    const hasPeak = (t) => {
      while (j > 0 && times[j] > t) j--;
      while (j + 1 < times.length && Math.abs(times[j + 1] - t) <= Math.abs(times[j] - t)) j++;
      return Math.abs(times[j] - t) <= tolerance;
    };
    const grid = fit.beatTimes;
    const last = times[times.length - 1];
    let on = 0, onN = 0, between = 0, betweenN = 0, hits = 0;
    for (let i = 0; i < grid.length; i++) {
      const g = grid[i];
      const mid = g + fit.beatInterval / 2;
      if (g < times[0] || mid > last) continue;
      on += lowAt(envLow, fps, g, tolerance); onN++;
      between += lowAt(envLow, fps, mid, tolerance); betweenN++;
      if (hasPeak(mid)) hits++;
    }
    if (onN < 4 || betweenN < 4) return false;
    const onMean = on / onN;
    if (onMean < 1e-3) return false;
    return hits / betweenN > 0.8 && between / betweenN > 0.6 * onMean;
  }

  /* --- transient band ----------------------------------------------------- */

  /* Finds the band that best shows attacks over a stretch of audio, and the
     attack times inside the band currently on screen.

     Per bin, flux is how much of the energy arrives as a rise and level is how
     much is there in total, so flux^2/level rewards bins that are both loud and
     percussive: a sustained pad scores near zero however loud it is, a hat
     scores high, a kick scores high in the bottom octaves only. The band is
     then the contiguous run of sixth octave bins scoring above the average,
     between a third of an octave and three octaves wide.

     The attack times come from an onset detection function evaluated inside
     the current band, chosen by `method` (see ODF below), baseline removed and
     peak picked. The band finder does not depend on the method.

     `read(dst, startSample)` fills dst with FFT_N samples, so the caller keeps
     ownership of where the audio comes from. Frames are centred on their
     nominal time, so the attack times come back needing no correction. */
  const TB_FFT = 1024;
  const TB_BANDS = 60;              // sixth of an octave each, 20 Hz to 20 kHz
  const TB_MIN_W = 2, TB_MAX_W = 18;
  const bandHz = (b) => 20 * Math.pow(2, b / 6);
  const hzBand = (f) => clamp(Math.floor(Math.log2(Math.max(20, f) / 20) * 6), 0, TB_BANDS - 1);

  /* Onset detection functions, per frame, summed over the bins the band mask
     lets through. All are amplitude linear so one peak picker serves them all.

     level   in band magnitude. What is there; the baseline removal afterwards
             turns it into what just arrived. Blind to an attack that is no
             louder than what it interrupts.
     flux    spectral flux (Masri 1996, Dixon 2006): half wave rectified rise
             in log compressed magnitude per bin. A rise in one bin counts even
             when another bin is decaying, so a new note under a sustained one
             still registers. Differenced over 10 ms, the hop the method was
             defined at; at the shorter hops used here a one frame difference
             peaks on the steepest part of the rise rather than at the attack,
             and fires on noise.
     sflux   SuperFlux (Bock and Widmer 2013): flux against a maximum filtered
             frame from ~20 ms earlier, the filter a quarter tone wide, so a
             partial that only moved (vibrato, glide, pitch bend) lands on its
             own earlier energy and produces no flux. For sung and bowed
             material, and for 808s with pitch envelopes.
     hfc     high frequency content (Masri 1996): magnitude weighted by bin
             number, so the broadband edge of an attack outweighs the tonal
             body of the note. Square root of Masri's energy sum to keep it
             amplitude linear. Favours clicks, hats, snare wires, consonants.
     phase   weighted phase deviation (Bello 2003, Dixon 2006): the second
             difference of each bin's phase, weighted by its magnitude. A
             steady partial advances its phase at a constant rate, so this
             sits at zero through sustained notes however loud, and fires on
             anything that breaks the phase continuity, which includes soft
             onsets that barely change the magnitude.
     cplx    rectified complex domain (Duxbury 2003, Dixon 2006): distance
             between each bin and where a steady partial would have put it
             (previous magnitude, phase extrapolated), counted only when the
             magnitude rose. Magnitude and phase evidence in one number; the
             usual best all rounder.

     Two more ignore the band and judge the whole spectrum, for when the band
     is the thing being looked for rather than something already known:

     superflux  sflux over every bin. The strongest hand crafted onset function
             in the published evaluations; only a trained model beats it.
     perc    percussive energy after harmonic/percussive separation (Fitzgerald
             2010, Driedger 2014): a median over time keeps what is steady, a
             median over frequency keeps what is broadband, and a soft mask
             from the two leaves only the vertical ridges, which is what an
             attack looks like in a spectrogram. Sustained sound vanishes
             however loud it is. Runs on the whole spectrogram after the frame
             loop, so it costs a few ms more than the others. */
  const ODF = {
    level: { phase: false },
    flux: { phase: false, lagSec: 0.01 },
    sflux: { phase: false, lagSec: 0.02 },
    hfc: { phase: false },
    phase: { phase: true },
    cplx: { phase: true },
    superflux: { phase: false, lagSec: 0.02, full: true },
    perc: { phase: false, full: true, spec: true },
  };
  const ODF_NAMES = Object.keys(ODF);
  /* The full spectrum methods also say where each attack was: the range that
     contributed most to the detection function at its frame. Six ranges,
     splitting the FOCUS thirds in two: low low, high low, low mid, high mid,
     low high, high high. */
  const RANGE_EDGES = [20, 100, 300, 1000, 3000, 8000, Infinity];
  const RANGE_NAMES = ["LL", "HL", "LM", "HM", "LH", "HH"];
  const NR = RANGE_NAMES.length;
  const wrapPi = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
  const SFLUX_MAX_SLOTS = 8;
  const HPSS_FREQ_HALF = 8;          // 17 bins, 730 Hz at 44.1k: wider than a partial
  const HPSS_TIME_SEC = 0.1;         // longer than an attack

  /* Sliding median along one axis of a row major array: element i of the line
     sits at src[off + i * stride], the window is [i - half, i + half] clipped
     to the line. Keeps the window sorted and moves one element per step;
     plain shift loops, since the window is short enough that call overhead
     is the cost. */
  const medWin = new Float64Array(64);
  function medianLine(src, dst, off, stride, n, half) {
    const w = medWin;
    let count = 0;
    for (let i = 0; i < n; i++) {
      // bring in the leading edge: the first half on the first step, then one
      const top = Math.min(n - 1, i + half);
      for (let j = i === 0 ? 0 : top; j <= top && (i === 0 || i + half < n); j++) {
        const v = src[off + j * stride];
        let p = count;
        while (p > 0 && w[p - 1] > v) { w[p] = w[p - 1]; p--; }
        w[p] = v;
        count++;
      }
      if (i - half - 1 >= 0) {
        const v = src[off + (i - half - 1) * stride];
        let p = 0;
        while (w[p] !== v) p++;
        count--;
        while (p < count) { w[p] = w[p + 1]; p++; }
      }
      dst[off + i * stride] = count & 1
        ? w[count >> 1]
        : 0.5 * (w[(count >> 1) - 1] + w[count >> 1]);
    }
  }

  /* Percussive energy per frame from a [frames x stride] log spectrogram,
     total into env and per range into renv ([frames x NR]). */
  let hpssH = new Float32Array(0), hpssP = new Float32Array(0);
  function percussiveEnergy(spec, frames, stride, fps, env, renv, rangeOf) {
    if (hpssH.length < spec.length) { hpssH = new Float32Array(spec.length); hpssP = new Float32Array(spec.length); }
    const tHalf = Math.max(1, Math.min(31, Math.round((HPSS_TIME_SEC * fps) / 2)));
    for (let k = 0; k < stride; k++) medianLine(spec, hpssH, k, stride, frames, tHalf);
    for (let t = 0; t < frames; t++) medianLine(spec, hpssP, t * stride, 1, stride, HPSS_FREQ_HALF);
    for (let t = 0; t < frames; t++) {
      let v = 0;
      const o = t * stride;
      for (let k = 1; k < stride; k++) {
        const h = hpssH[o + k], p = hpssP[o + k];
        const e = (spec[o + k] * p * p) / (h * h + p * p + 1e-9);
        v += e;
        if (rangeOf[k] >= 0) renv[t * NR + rangeOf[k]] += ((Math.exp(spec[o + k]) - 1) / 8) * (p * p) / (h * h + p * p + 1e-9);
      }
      env[t] = v;
    }
  }

  const tbBuf = new Float32Array(TB_FFT);
  const tbRe = new Float64Array(TB_FFT);
  const tbIm = new Float64Array(TB_FFT);
  const tbPrev = new Float32Array((TB_FFT >> 1) + 1);       // magnitude, one frame back
  const tbPh1 = new Float32Array((TB_FFT >> 1) + 1);        // phase, one frame back
  const tbPh2 = new Float32Array((TB_FFT >> 1) + 1);        // phase, two frames back
  const tbLog = new Float32Array((TB_FFT >> 1) + 1);        // log magnitude, this frame
  const tbLogHist = new Float32Array(SFLUX_MAX_SLOTS * ((TB_FFT >> 1) + 1)); // ring of past log frames
  let tbSpec = new Float32Array(0);                          // whole log spectrogram, perc only
  const tbFlux = new Float64Array(TB_BANDS);
  const tbLevel = new Float64Array(TB_BANDS);
  const tbRank = new Float64Array(TB_BANDS);
  let tbBin = null, tbBinSr = 0;
  let tbRange = null, tbRangeSr = 0;
  let tbRenv = new Float32Array(0);                           // per range ODF, full methods only

  function binRanges(sr) {
    if (tbRange && tbRangeSr === sr) return tbRange;
    const half = TB_FFT >> 1;
    tbRange = new Int8Array(half + 1).fill(-1);
    for (let k = 1; k <= half; k++) {
      const f = (k * sr) / TB_FFT;
      if (f < RANGE_EDGES[0]) continue;
      let r = 0;
      while (f >= RANGE_EDGES[r + 1]) r++;
      tbRange[k] = r;
    }
    tbRangeSr = sr;
    return tbRange;
  }

  function binBands(sr) {
    if (tbBin && tbBinSr === sr) return tbBin;
    const half = TB_FFT >> 1;
    tbBin = new Int8Array(half + 1).fill(-1);
    for (let k = 1; k <= half; k++) {
      const f = (k * sr) / TB_FFT;
      if (f < 20) continue;
      tbBin[k] = hzBand(f);
    }
    tbBinSr = sr;
    return tbBin;
  }

  function transientBand(read, opts) {
    const {
      sr, start, frames, hop, curLo, curHi,
      minHz = 20, maxHz = Infinity, thresh = 0.2, minSep = 0.04, floor = 0.25, method = "level",
    } = opts;
    if (frames < 8) return null;
    const odf = ODF[method] || ODF.level;
    const fft = getFFT(TB_FFT);
    const win = hann(TB_FFT);
    const half = TB_FFT >> 1;
    const band = binBands(sr);
    const mask = DSP.bandMask(TB_FFT, sr, curLo, curHi);
    const env = new Float32Array(frames);
    const fps = sr / hop;
    // the flux methods difference against a frame lagSec back, at least one frame
    const lag = odf.lagSec ? clamp(Math.round(odf.lagSec * fps), 1, SFLUX_MAX_SLOTS - 1) : 1;
    const stride = half + 1;
    if (odf.spec && tbSpec.length < frames * stride) tbSpec = new Float32Array(frames * stride);
    const rangeOf = odf.full ? binRanges(sr) : null;
    if (odf.full) {
      if (tbRenv.length < frames * NR) tbRenv = new Float32Array(frames * NR);
      tbRenv.fill(0, 0, frames * NR);
    }
    tbFlux.fill(0);
    tbLevel.fill(0);
    tbPrev.fill(0);
    tbPh1.fill(0);
    tbPh2.fill(0);
    tbLogHist.fill(0);

    for (let t = 0; t < frames; t++) {
      read(tbBuf, Math.round(start + t * hop) - (TB_FFT >> 1));
      for (let i = 0; i < TB_FFT; i++) { tbRe[i] = tbBuf[i] * win[i]; tbIm[i] = 0; }
      fft.run(tbRe, tbIm, false);
      const lagged = tbLogHist.subarray(((t + SFLUX_MAX_SLOTS - lag) % SFLUX_MAX_SLOTS) * stride);
      let v = 0;
      for (let k = 1; k <= half; k++) {
        const a = Math.sqrt(tbRe[k] * tbRe[k] + tbIm[k] * tbIm[k]);
        const b = band[k];
        if (b >= 0) {
          const d = a - tbPrev[k];
          if (d > 0) tbFlux[b] += d;
          tbLevel[b] += a;
        }
        const g = odf.full ? 1 : mask[k];
        const m = Math.log1p(8 * a);        // compression, so loud parts do not own the flux
        const ph = odf.phase ? Math.atan2(tbIm[k], tbRe[k]) : 0;
        tbLog[k] = m;
        if (g > 0) {
          switch (method) {
            case "flux": {
              const d = m - lagged[k];
              if (d > 0) v += d * g;
              break;
            }
            case "sflux":
            case "superflux": {
              // max over the lagged frame within a quarter tone (3%) of this bin,
              // never under two bins: a partial's main lobe is two bins wide, so
              // a one bin filter lets its skirt through as it moves
              const w = Math.max(2, Math.round(0.03 * k));
              let mx = 0;
              for (let j = Math.max(1, k - w); j <= Math.min(half, k + w); j++) if (lagged[j] > mx) mx = lagged[j];
              const d = m - mx;
              if (d > 0) {
                v += d * g;
                if (rangeOf && rangeOf[k] >= 0) tbRenv[t * NR + rangeOf[k]] += (Math.exp(m) - Math.exp(mx)) / 8;
              }
              break;
            }
            case "hfc": v += k * a * a * g; break;
            case "phase":
              v += a * Math.abs(wrapPi(ph - 2 * tbPh1[k] + tbPh2[k])) * g;
              break;
            case "cplx": {
              const a1 = tbPrev[k];
              if (a >= a1) {
                // |X - a1 e^{j(2ph1 - ph2)}| by the cosine rule
                const dev2 = a * a + a1 * a1 - 2 * a * a1 * Math.cos(ph - (2 * tbPh1[k] - tbPh2[k]));
                v += Math.sqrt(Math.max(0, dev2)) * g;
              }
              break;
            }
            default: v += a * g;
          }
        }
        if (odf.phase) { tbPh2[k] = tbPh1[k]; tbPh1[k] = ph; }
        tbPrev[k] = a;
      }
      tbLogHist.set(tbLog, (t % SFLUX_MAX_SLOTS) * stride);
      if (odf.spec) tbSpec.set(tbLog, t * stride);
      env[t] = method === "hfc" ? Math.sqrt(v) : v;
    }
    if (method === "perc") percussiveEnergy(tbSpec, frames, stride, fps, env, tbRenv, rangeOf);

    let total = 0;
    for (let b = 0; b < TB_BANDS; b++) total += tbFlux[b];
    if (total < 1e-6) return null;

    let mean = 0;
    for (let b = 0; b < TB_BANDS; b++) {
      tbRank[b] = (tbFlux[b] * tbFlux[b]) / (tbLevel[b] + 1e-9);
      mean += tbRank[b];
    }
    mean /= TB_BANDS;

    // focus limits the search to a slice of the spectrum, so the mode can be
    // pointed at the kick or the hats rather than at whatever is loudest
    const from = hzBand(minHz);
    const to = Math.min(TB_BANDS - 1, hzBand(Math.min(maxHz, sr / 2)));
    let best = -Infinity, bi = from, bj = Math.min(to, from + TB_MIN_W - 1);
    for (let i = from; i <= to; i++) {
      let sum = 0;
      for (let j = i; j <= Math.min(to, i + TB_MAX_W - 1); j++) {
        sum += tbRank[j] - mean;
        if (j - i + 1 >= TB_MIN_W && sum > best) { best = sum; bi = i; bj = j; }
      }
    }

    // attacks inside the band the scope is showing
    const base = movingAverage(env, Math.round(0.25 * fps));
    let sum = 0;
    for (let i = 0; i < frames; i++) {
      env[i] = Math.max(0, env[i] - base[i]);
      sum += env[i] * env[i];
    }
    const rms = Math.sqrt(sum / frames) || 1;
    for (let i = 0; i < frames; i++) env[i] /= rms;

    /* The picker is scale free (unit RMS, local mean plus a fraction of a
       standard deviation), which is right for finding candidates but marks
       ripple whenever nothing louder is near. Three gates decide what is an
       attack:
       - it rose fast: at least half its height inside 20 ms. Vibrato,
         tremolo and swells rise over tens to hundreds of ms.
       - it rose by a meaningful amount next to what was already there. Noise
         and steady tones fluctuate by a few percent of their own level; an
         attack is at least a fifth of it.
       - it is within `floor` of the loudest attack in the section, which is
         what SENS sets. */
    const picked = pickPeaks(env, fps, minSep, thresh);
    const rise = Math.max(2, Math.round(0.02 * fps));
    const cand = [];
    for (let i = 0; i < picked.times.length; i++) {
      const p = Math.round(picked.times[i] * fps);
      let from = env[p];
      for (let u = Math.max(0, p - rise); u < p; u++) if (env[u] < from) from = env[u];
      if (env[p] - from < 0.5 * env[p]) continue;
      if (env[p] * rms < 0.2 * base[p]) continue;
      cand.push({ t: picked.times[i], s: picked.strengths[i] });
    }
    let maxS = 0;
    for (const c of cand) if (c.s > maxS) maxS = c.s;
    const transients = cand.filter((c) => c.s >= floor * maxS).map((c) => c.t);

    // which range each attack came from: the largest baseline removed linear
    // amplitude around its frame. Linear rather than the log compressed values
    // the detection ran on, since compression plus bin count would let
    // seventeen bins of leakage outvote two bins of kick. Baseline removal
    // matters because the noise floor sits on far more bins up high.
    let ranges = null;
    if (odf.full) {
      const rb = new Float32Array(frames);
      for (let r = 0; r < NR; r++) {
        for (let t = 0; t < frames; t++) rb[t] = tbRenv[t * NR + r];
        const base = movingAverage(rb, Math.round(0.25 * fps));
        for (let t = 0; t < frames; t++) tbRenv[t * NR + r] = Math.max(0, rb[t] - base[t]);
      }
      ranges = transients.map((time) => {
        const t = Math.round(time * fps);
        let best = -1, bestV = 0;
        for (let r = 0; r < NR; r++) {
          let v = 0;
          for (let u = Math.max(0, t - 1); u <= Math.min(frames - 1, t + 1); u++) v += tbRenv[u * NR + r];
          if (v > bestV) { bestV = v; best = r; }
        }
        return best;
      });
    }

    return {
      lo: bandHz(bi),
      hi: bandHz(bj + 1),
      transients,
      ranges,                      // per transient, index into RANGE_NAMES, or null
      span: (frames * hop) / sr,
      fftSize: TB_FFT,
      method,
    };
  }

  /* Whole-file detection: onset envelope, tempo, peaks, then the fitter. */
  async function detect(mono, sr, onProgress) {
    const { env, envLow, fps, bands } = await onsetAnalysis(mono, sr, (p) => onProgress?.(p * 0.85));
    onProgress?.(0.9);
    const bpmHint = estimateTempo(env, fps);
    // A fixed 90 ms separation, not the tempo-derived spacing the pipeline uses:
    // the tempo estimate can itself be an octave out, and deriving the peak
    // spacing from it would then hide the very onsets that reveal the error.
    const peaks = pickPeaks(env, fps);
    await tick();
    // The autocorrelation peak can be a metrical relative of the true tempo
    // rather than the tempo. Fit each candidate and keep the grid that actually
    // lands on the onsets: a wrong hypothesis shows up as poor grid support and
    // a large mean deviation, both of which the fitter already reports.
    const hints = bpmHint ? [bpmHint, bpmHint * 2, bpmHint / 2, bpmHint * 1.5, bpmHint * (2 / 3)] : [null];
    const cands = [];
    for (const h of hints) {
      if (h !== null && (h < 60 || h > 220)) continue;
      const f = fitBeatgrid(peaks.times, env, fps, { bpmHint: h, beatConfidences: peaks.strengths });
      if (!f) continue;
      cands.push({ fit: f, kick: kickSupport(f, envLow, fps, 0.06) });
    }
    const maxKick = Math.max(1e-9, ...cands.map((c) => c.kick));
    let fit = null, bestScore = -Infinity;
    for (const c of cands) {
      const f = c.fit;
      const score = (f.confidence / (1 + f.meanDeviationMs / 10)) * tempoPrior(f.bpm) *
        (0.5 + 0.5 * (c.kick / maxKick));
      if (score > bestScore) { bestScore = score; fit = f; }
    }
    if (fit && shouldDouble(fit, peaks, envLow, fps, 0.06, 220)) {
      const doubled = fitBeatgrid(peaks.times, env, fps, {
        bpmHint: fit.bpm * 2,
        beatConfidences: peaks.strengths,
      });
      if (doubled) fit = doubled;
    }
    onProgress?.(1);
    return { fit, env, envLow, fps, bands, peaks, bpmHint };
  }

  return { detect, onsetAnalysis, pickPeaks, movingAverage, estimateTempo, fitBeatgrid, tempoPrior, transientBand, ODF_NAMES, RANGE_NAMES, RANGE_EDGES };
})();

if (typeof module !== "undefined") module.exports = BeatGrid;
