/* madmom's CNN onset detector (Schluter and Bock 2014), ported to run in the
 * browser. The weights are madmom's own `onsets_cnn.pkl`, exported to
 * onsets-cnn.bin with a JSON manifest; the front end and every layer follow
 * madmom's code so the activations match its reference output.
 *
 * Front end, per frame at 100 fps on 44.1 kHz audio: three STFTs (2048,
 * 1024, 4096 point, symmetric Hann, frames centred on the hop), each through
 * an 80 band Mel filterbank from 27.5 Hz to 16 kHz (triangles on nearest
 * bins, area one), then a natural log. Stacked as 80 x 3.
 *
 * Network: batch norm, 7x3 conv with 10 maps (tanh), max pool over 3 bands,
 * 3x3 conv with 20 maps (tanh), max pool over 3 bands, 7 frames strided into
 * one vector, dense 256 (sigmoid), dense 1 (sigmoid). Fifteen frames of
 * context in, one onset probability per frame out.
 *
 * Licence: the model is from github.com/CPJKU/madmom_models and is released
 * under CC BY-NC-SA 4.0, so it is for non commercial use with attribution. */
const OnsetCNN = (() => {
  "use strict";
  const { getFFT } = DSP;

  const SR = 44100, FPS = 100, HOP = 441;
  const SIZES = [2048, 1024, 4096];       // channel order, as madmom stacks them
  const NB = 80, FMIN = 27.5, FMAX = 16000, PAD = 7;
  // madmom adds np.spacing(1) before the log, so digital silence comes out
  // at -36, far below anything in a recording, and the network misreads dry
  // samples with true silence between hits. A floor of -140 dB (1e-7 on a
  // full scale of 1) is below any real noise floor and leaves recordings
  // unchanged to well under 1e-6 in the output.
  const EPS = 1e-7;
  const hz2mel = (f) => 1127.01048 * Math.log(f / 700 + 1);
  const mel2hz = (m) => 700 * (Math.exp(m / 1127.01048) - 1);
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // np.hanning: symmetric, so the end points are exactly zero
  function hanning(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    return w;
  }

  /* madmom's MelFilterbank on one frame size: 82 Mel spaced edge frequencies,
     each snapped to the nearest bin (Nyquist excluded), a triangle over each
     consecutive triple with the centre at one, area normalised. A triple
     that collapses onto fewer than two bins becomes a single bin filter. */
  function melFilterbank(n) {
    const bins = n >> 1, binHz = SR / n;
    const lo = hz2mel(FMIN), hi = hz2mel(FMAX);
    const edges = [];
    for (let i = 0; i < NB + 2; i++) {
      const f = mel2hz(lo + ((hi - lo) * i) / (NB + 1));
      // frequencies2bins: left insertion point, clipped, then the nearer side
      let idx = Math.ceil(f / binHz);
      idx = Math.min(Math.max(idx, 1), bins - 1);
      const left = (idx - 1) * binHz, right = idx * binHz;
      if (f - left < right - f) idx--;
      edges.push(idx);
    }
    const filters = [];
    for (let b = 0; b < NB; b++) {
      let start = edges[b], center = edges[b + 1], stop = edges[b + 2];
      if (stop - start < 2) { center = start; stop = start + 1; }
      const w = new Float32Array(stop - start);
      const c = center - start;
      for (let j = 0; j < c; j++) w[j] = j / c;
      for (let j = c; j < w.length; j++) w[j] = 1 - (j - c) / (w.length - c);
      let sum = 0;
      for (const v of w) sum += v;
      for (let j = 0; j < w.length; j++) w[j] /= sum;
      filters.push({ k0: start, w, hz: mel2hz(lo + ((hi - lo) * (b + 1)) / (NB + 1)) });
    }
    return filters;
  }

  /* Log Mel features for the whole signal: Float32Array of frames x 80 x 3.
     Also returns the linear 2048 point Mel amplitudes per frame, which the
     caller uses for level, colour and range attribution. */
  async function frontend(mono, onProgress) {
    const frames = Math.ceil(mono.length / HOP);
    const feat = new Float32Array(frames * NB * 3);
    const mel2048 = new Float32Array(frames * NB);
    const res = SIZES.map((n) => ({
      n, fft: getFFT(n), win: hanning(n), fb: melFilterbank(n),
      re: new Float64Array(n), im: new Float64Array(n), mag: new Float32Array(n >> 1),
    }));
    for (let t = 0; t < frames; t++) {
      const ref = t * HOP;
      for (let c = 0; c < 3; c++) {
        const { n, fft, win, fb, re, im, mag } = res[c];
        const start = ref - (n >> 1);
        for (let i = 0; i < n; i++) {
          const s = start + i;
          re[i] = s >= 0 && s < mono.length ? mono[s] * win[i] : 0;
          im[i] = 0;
        }
        fft.run(re, im, false);
        for (let k = 0; k < n >> 1; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        for (let b = 0; b < NB; b++) {
          const { k0, w } = fb[b];
          let a = 0;
          for (let i = 0; i < w.length; i++) a += w[i] * mag[k0 + i];
          feat[(t * NB + b) * 3 + c] = Math.log(a + EPS);
          if (n === 2048) mel2048[t * NB + b] = a;
        }
      }
      if ((t & 255) === 255) { onProgress?.(t / frames); await tick(); }
    }
    return { feat, frames, mel2048, melHz: res[0].fb.map((f) => f.hz) };
  }

  /* --- the network -------------------------------------------------------- */

  const tanh = Math.tanh;
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  // weights from the manifest and binary; the layer order is fixed by the
  // architecture above and checked against the manifest
  function loadWeights(manifest, bin) {
    const f32 = new Float32Array(bin);
    const arr = (name) => { const a = manifest.arrays[name]; return { data: f32.subarray(a.offset, a.offset + a.length), shape: a.shape }; };
    const types = manifest.layers.map((l) => l.type).join(",");
    const want = "BatchNormLayer,ConvolutionalLayer,MaxPoolLayer,ConvolutionalLayer,MaxPoolLayer,StrideLayer,FeedForwardLayer,FeedForwardLayer";
    if (types !== want) throw new Error("unexpected layer stack: " + types);
    const L = manifest.layers;
    return {
      bnMean: arr("bn.mean").data, bnInvStd: arr("bn.inv_std").data,
      c1: arr(L[1].weights), b1: arr(L[1].bias).data,
      c2: arr(L[3].weights), b2: arr(L[3].bias).data,
      block: L[5].block_size,
      d1: arr(L[6].weights), db1: arr(L[6].bias).data,
      d2: arr(L[7].weights), db2: arr(L[7].bias).data,
    };
  }

  /* Onset probability per frame. The convolutions are true convolutions
     (kernels flipped on both axes, as scipy does them), valid only, and the
     max pools take every third band centred on bands 1, 4, 7... exactly as
     madmom slices them. */
  async function activate(W, feat, frames, onProgress) {
    const T = frames + 2 * PAD;
    // pad by repeating the first and last frame, then batch normalise
    const x = new Float32Array(T * NB * 3);
    for (let t = 0; t < T; t++) {
      const src = Math.min(frames - 1, Math.max(0, t - PAD));
      for (let i = 0; i < NB * 3; i++) x[t * NB * 3 + i] = (feat[src * NB * 3 + i] - W.bnMean[i]) * W.bnInvStd[i];
    }
    // conv 1: 3 channels, 10 maps, 7 x 3, valid: T-6 frames, 78 bands
    const [C1, M1, KT1, KF1] = W.c1.shape;
    const T1 = T - (KT1 - 1), F1 = NB - (KF1 - 1);
    const y1 = new Float32Array(T1 * F1 * M1);
    const w1 = W.c1.data;
    for (let t = 0; t < T1; t++) {
      for (let f = 0; f < F1; f++) {
        for (let m = 0; m < M1; m++) {
          let s = W.b1[m];
          for (let c = 0; c < C1; c++) {
            for (let dt = 0; dt < KT1; dt++) {
              const xrow = ((t + KT1 - 1 - dt) * NB) * 3 + c;
              const wrow = ((c * M1 + m) * KT1 + dt) * KF1;
              for (let df = 0; df < KF1; df++) s += x[xrow + (f + KF1 - 1 - df) * 3] * w1[wrow + df];
            }
          }
          y1[(t * F1 + f) * M1 + m] = tanh(s);
        }
      }
      if ((t & 255) === 255) { onProgress?.(0.5 * (t / T1)); await tick(); }
    }
    // pool 1: bands in threes (madmom slices the max filtered bands 1, 4, 7...
    // up to F1 - 1, which is the max over each complete triple from band 0)
    const F1p = Math.ceil((F1 - 2) / 3);
    const y1p = new Float32Array(T1 * F1p * M1);
    for (let t = 0; t < T1; t++) for (let p = 0; p < F1p; p++) for (let m = 0; m < M1; m++) {
      const b = 3 * p;
      let v = y1[(t * F1 + b) * M1 + m];
      for (let j = 1; j < 3 && b + j < F1; j++) { const u = y1[(t * F1 + b + j) * M1 + m]; if (u > v) v = u; }
      y1p[(t * F1p + p) * M1 + m] = v;
    }
    // conv 2: 10 channels, 20 maps, 3 x 3, valid
    const [C2, M2, KT2, KF2] = W.c2.shape;
    const T2 = T1 - (KT2 - 1), F2 = F1p - (KF2 - 1);
    const y2 = new Float32Array(T2 * F2 * M2);
    const w2 = W.c2.data;
    for (let t = 0; t < T2; t++) {
      for (let f = 0; f < F2; f++) {
        for (let m = 0; m < M2; m++) {
          let s = W.b2[m];
          for (let c = 0; c < C2; c++) {
            for (let dt = 0; dt < KT2; dt++) {
              const xrow = ((t + KT2 - 1 - dt) * F1p) * M1 + c;
              const wrow = ((c * M2 + m) * KT2 + dt) * KF2;
              for (let df = 0; df < KF2; df++) s += y1p[xrow + (f + KF2 - 1 - df) * M1] * w2[wrow + df];
            }
          }
          y2[(t * F2 + f) * M2 + m] = tanh(s);
        }
      }
    }
    // pool 2
    const F2p = Math.ceil((F2 - 2) / 3);
    const y2p = new Float32Array(T2 * F2p * M2);
    for (let t = 0; t < T2; t++) for (let p = 0; p < F2p; p++) for (let m = 0; m < M2; m++) {
      const b = 3 * p;
      let v = y2[(t * F2 + b) * M2 + m];
      for (let j = 1; j < 3 && b + j < F2; j++) { const u = y2[(t * F2 + b + j) * M2 + m]; if (u > v) v = u; }
      y2p[(t * F2p + p) * M2 + m] = v;
    }
    // stride: seven consecutive frames into one vector, then the dense layers
    const block = W.block, D = block * F2p * M2;
    const [DI, DH] = W.d1.shape;
    if (DI !== D) throw new Error(`dense input ${DI} does not match ${block} x ${F2p} x ${M2}`);
    const out = new Float32Array(frames);
    const h = new Float32Array(DH);
    const d1 = W.d1.data, d2 = W.d2.data;
    const T3 = T2 - block + 1;
    for (let t = 0; t < Math.min(T3, frames); t++) {
      h.set(W.db1);
      const base = t * F2p * M2;
      for (let i = 0; i < D; i++) {
        const v = y2p[base + i];
        if (v === 0) continue;
        const row = i * DH;
        for (let j = 0; j < DH; j++) h[j] += v * d1[row + j];
      }
      let s = W.db2[0];
      for (let j = 0; j < DH; j++) s += sigmoid(h[j]) * d2[j];
      out[t] = sigmoid(s);
      if ((t & 511) === 511) { onProgress?.(0.5 + 0.5 * (t / T3)); await tick(); }
    }
    return out;
  }

  /* madmom's peak picking for this detector: a 50 ms Hamming smoothing
     (unnormalised, as madmom convolves it, so a lone frame at 1.0 becomes
     about 1.0 and a plateau about 2.2), a threshold, local maxima over one
     frame either side, and onsets closer than 30 ms merged keeping the
     earlier one. Returns frame indices. */
  function pickPeaks(act, threshold, fps = FPS) {
    const n = act.length;
    const sm = Math.round(0.05 * fps);
    let a = act;
    if (sm > 1) {
      const k = new Float64Array(sm);
      for (let i = 0; i < sm; i++) k[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (sm - 1));
      a = new Float32Array(n);
      const half = sm >> 1;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < sm; j++) { const u = i + j - half; if (u >= 0 && u < n) s += act[u] * k[j]; }
        a[i] = s;
      }
    }
    const peaks = [];
    const minSep = Math.round(0.03 * fps);
    for (let i = 0; i < n; i++) {
      const v = a[i];
      if (v < threshold) continue;
      if ((i > 0 && a[i - 1] > v) || (i + 1 < n && a[i + 1] > v)) continue;
      const last = peaks[peaks.length - 1];
      if (last && i - last.frame <= minSep) continue;
      peaks.push({ frame: i, strength: v });
    }
    return peaks;
  }

  return { frontend, loadWeights, activate, pickPeaks, melFilterbank, hanning, SR, FPS, HOP, NB, PAD };
})();

if (typeof module !== "undefined") module.exports = OnsetCNN;
