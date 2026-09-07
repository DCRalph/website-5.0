/* Shared DSP: radix-2 FFT, window functions, the band mask. */
const DSP = (() => {
  "use strict";

  class FFT {
    constructor(n) {
      this.n = n;
      const half = n >> 1;
      this.cos = new Float64Array(half);
      this.sin = new Float64Array(half);
      for (let i = 0; i < half; i++) {
        this.cos[i] = Math.cos((-2 * Math.PI * i) / n);
        this.sin[i] = Math.sin((-2 * Math.PI * i) / n);
      }
      const bits = Math.round(Math.log2(n));
      this.rev = new Uint32Array(n);
      for (let i = 0; i < n; i++) {
        let r = 0;
        for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
        this.rev[i] = r;
      }
    }
    // In place. inverse conjugates the twiddles and scales by 1/n.
    run(re, im, inverse) {
      const { n, rev, cos, sin } = this;
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (j > i) {
          let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1;
        const step = n / len;
        for (let i = 0; i < n; i += len) {
          for (let k = 0; k < half; k++) {
            const t = k * step;
            const wr = cos[t];
            const wi = inverse ? -sin[t] : sin[t];
            const a = i + k;
            const b = a + half;
            const xr = re[b] * wr - im[b] * wi;
            const xi = re[b] * wi + im[b] * wr;
            re[b] = re[a] - xr;
            im[b] = im[a] - xi;
            re[a] += xr;
            im[a] += xi;
          }
        }
      }
      if (inverse) {
        const s = 1 / n;
        for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; }
      }
    }
  }

  /* Overlap add band pass. Hann analysis and synthesis at a quarter window hop,
     which is what the 2/3 is: the sum of Hann squared at that hop. The mask is
     applied to both halves of the spectrum so the output stays real. Feeds and
     drains at any block size, so the same object runs inside an AudioWorklet or
     on a ScriptProcessor. */
  class OlaBandPass {
    constructor(n) {
      const h = n >> 2;
      this.N = n;
      this.H = h;
      this.fft = new FFT(n);
      this.win = new Float32Array(n);
      for (let i = 0; i < n; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
      this.gain = 2 / 3;
      this.mask = new Float32Array((n >> 1) + 1).fill(1);
      this.inBuf = new Float32Array(n);
      this.hop = new Float32Array(h);
      this.hopN = 0;
      this.ola = new Float32Array(n);
      this.re = new Float64Array(n);
      this.im = new Float64Array(n);
      this.fifo = new Float32Array(n * 4);
      this.wr = 0;
      this.rd = 0;
      this.avail = 0;
    }
    setMask(m) { this.mask.set(m); }
    frame() {
      const { N, H, inBuf, hop, win, re, im, mask, ola, fifo } = this;
      inBuf.copyWithin(0, H);
      inBuf.set(hop, N - H);
      for (let i = 0; i < N; i++) { re[i] = inBuf[i] * win[i]; im[i] = 0; }
      this.fft.run(re, im, false);
      const half = N >> 1;
      for (let k = 0; k <= half; k++) {
        const g = mask[k];
        re[k] *= g; im[k] *= g;
        if (k > 0 && k < half) { const j = N - k; re[j] *= g; im[j] *= g; }
      }
      this.fft.run(re, im, true);
      for (let i = 0; i < N; i++) ola[i] += re[i] * win[i];
      for (let i = 0; i < H; i++) {
        fifo[this.wr] = ola[i] * this.gain;
        this.wr = (this.wr + 1) % fifo.length;
      }
      this.avail += H;
      ola.copyWithin(0, H);
      ola.fill(0, N - H);
    }
    process(input, output) {
      if (input) {
        for (let i = 0; i < input.length; i++) {
          this.hop[this.hopN++] = input[i];
          if (this.hopN === this.H) { this.hopN = 0; this.frame(); }
        }
      }
      for (let i = 0; i < output.length; i++) {
        if (this.avail > 0) {
          output[i] = this.fifo[this.rd];
          this.rd = (this.rd + 1) % this.fifo.length;
          this.avail--;
        } else output[i] = 0;
      }
    }
  }

  const fftCache = new Map();
  const winCache = new Map();

  function getFFT(n) {
    let f = fftCache.get(n);
    if (!f) { f = new FFT(n); fftCache.set(n, f); }
    return f;
  }

  function hann(n) {
    let w = winCache.get(n);
    if (!w) {
      w = new Float32Array(n);
      for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
      winCache.set(n, w);
    }
    return w;
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rc = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));

  // Brick wall with raised-cosine skirts. The pass band is exactly [lo, hi];
  // the skirts sit outside it and shorten the filter kernel, which keeps the
  // ringing from smearing across the whole block.
  function bandGain(f, lo, hi) {
    if (f <= 0) return 0;
    const t = clamp(0.15 * Math.log2(hi / lo), 0.03, 0.5);
    const k = Math.pow(2, t);
    if (f >= lo && f <= hi) return 1;
    if (f < lo) return f > lo / k ? rc(Math.log2((f * k) / lo) / t) : 0;
    return f < hi * k ? rc(1 - Math.log2(f / hi) / t) : 0;
  }

  // Band mask table for one FFT size, cached until the band or size changes.
  function bandMask(n, sr, lo, hi) {
    const half = n >> 1;
    const g = new Float32Array(half + 1);
    const binHz = sr / n;
    for (let k = 0; k <= half; k++) g[k] = bandGain(k * binHz, lo, hi);
    return g;
  }

  /* Fixed size sample history addressed by absolute sample index, so a window
     can be asked for by position rather than by "the last n samples". Anything
     outside the retained history reads as silence, which includes everything
     before the first sample ever written. */
  class Ring {
    constructor(len) {
      this.buf = new Float32Array(len);
      this.len = len;
      this.write = 0;              // absolute count of samples ever written
    }
    push(block) {
      const { buf, len } = this;
      let w = this.write % len;
      for (let i = 0; i < block.length; i++) {
        buf[w] = block[i];
        if (++w === len) w = 0;
      }
      this.write += block.length;
    }
    read(dst, start, n) {
      dst.fill(0, 0, n);
      const { buf, len, write } = this;
      const oldest = Math.max(0, write - len);
      const from = Math.max(start, oldest);
      const to = Math.min(start + n, write);
      for (let idx = from; idx < to; idx++) dst[idx - start] = buf[idx % len];
    }
  }

  return { FFT, OlaBandPass, getFFT, hann, clamp, rc, bandGain, bandMask, Ring };
})();

if (typeof module !== "undefined") module.exports = DSP;
