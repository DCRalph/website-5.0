/* FFT scope: band select and colouring by Fourier transform, playback
   transport, and a beat grid fitted with the timeline pipeline's fitter. */
(() => {
"use strict";

const { getFFT, hann, clamp, bandMask } = DSP;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const S = {
  lo: 80, hi: 2500,
  windowMs: 40,
  gainDb: 0,
  normalize: false,
  trig: "edge",        // edge | bar | off
  level: 0,
  color: "freq",       // freq | env | flat
  envelope: true,
  grid: true,
  beats: true,
  frozen: false,
  solo: false,
  auto: false,
  focus: "all",        // all | low | mid | high
  method: "level",     // onset detection function, see BeatGrid.ODF_NAMES
  sens: 0.65,
  hold: false,
};

const FOCUS = {
  all: [20, Infinity],
  low: [20, 300],
  mid: [200, 3000],
  high: [2000, Infinity],
};

const MAX_WINDOW_MS = 8000;
const RING_SEC = 12;
const SHORT_MAX = 16384;     // samples drawn per sample; above this, per column

/* --- audio graph --------------------------------------------------------- */

let ctx = null, hub = null, monitorGain = null, capNode = null;
let dryGain = null, wetGain = null, bandNode = null;
let ring = null;
let source = null;           // mic | file | test
let micStream = null, testNodes = null;

const file = {
  name: "", buf: null, mono: null, sr: 0, duration: 0,
  grid: null,                // { startPos, ibi, bpm, anchor, support, devMs }
  over: null,                // overview columns
  status: "",
};

const T = {
  playing: false, offset: 0, startedAt: 0, rate: 1,
  loop: false, loopBars: 4, loopStart: 0, loopEnd: 0,
  node: null,
};

async function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    hub = ctx.createGain();
    monitorGain = ctx.createGain();
    monitorGain.gain.value = 0;
    dryGain = ctx.createGain();
    wetGain = ctx.createGain();
    wetGain.gain.value = 0;
    hub.connect(dryGain).connect(monitorGain);
    wetGain.connect(monitorGain);
    monitorGain.connect(ctx.destination);
    // not awaited: a worklet that never loads must not stop the scope from
    // running, and neither path is needed until a source or solo is used
    startCapture().catch((e) => console.warn("capture:", e));
    startAudition().catch((e) => console.warn("audition:", e));
  }
  if (ctx.state === "suspended") await ctx.resume();
}

/* Live sources need more history than any single analyser block: 8 s at 48 kHz
   is 384k samples. Capture into a ring instead, from a worklet where one is
   available and a ScriptProcessor where it is not. */
async function startCapture() {
  ring = new DSP.Ring(Math.ceil(RING_SEC * ctx.sampleRate));
  const mute = ctx.createGain();
  mute.gain.value = 0;
  mute.connect(ctx.destination);
  try {
    const code = `
      class Cap extends AudioWorkletProcessor {
        constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
        process(inputs) {
          const c = inputs[0][0];
          if (c) {
            for (let i = 0; i < c.length; i++) {
              this.buf[this.n++] = c[i];
              if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
            }
          }
          return true;
        }
      }
      registerProcessor("cap", Cap);`;
    const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, "cap");
    node.port.onmessage = (e) => ring.push(e.data);
    hub.connect(node);
    node.connect(mute);
    capNode = node;
  } catch (err) {
    const sp = ctx.createScriptProcessor(4096, 1, 1);
    sp.onaudioprocess = (e) => ring.push(e.inputBuffer.getChannelData(0));
    hub.connect(sp);
    sp.connect(mute);
    capNode = sp;
  }
}

/* Band audition. The same mask the scope draws with drives an overlap add
   filter, so what you hear is the band you are looking at rather than a biquad
   approximation of it. It runs in a worklet where one can be loaded, and on a
   ScriptProcessor where one cannot: Chrome refuses worklet modules from a blob
   URL on a file:// page, which is exactly how this tool tends to be opened.
   Either way it is the same DSP.OlaBandPass, stringified into the worklet along
   with the FFT so there is only ever one implementation. */
const AUDITION_N = 2048;
let auditionError = "", auditionPath = "";

async function startAudition() {
  const code = `
    ${DSP.FFT.toString()}
    ${DSP.OlaBandPass.toString()}
    class BandPass extends AudioWorkletProcessor {
      constructor() {
        super();
        this.f = new OlaBandPass(${AUDITION_N});
        this.port.onmessage = (e) => this.f.setMask(e.data);
      }
      process(inputs, outputs) {
        this.f.process(inputs[0][0], outputs[0][0]);
        return true;
      }
    }
    registerProcessor("bandpass", BandPass);`;
  try {
    const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    bandNode = new AudioWorkletNode(ctx, "bandpass");
    auditionPath = "worklet";
  } catch (err) {
    auditionError = String((err && err.message) || err);
    const filter = new DSP.OlaBandPass(AUDITION_N);
    const sp = ctx.createScriptProcessor(1024, 1, 1);
    sp.onaudioprocess = (e) =>
      filter.process(e.inputBuffer.getChannelData(0), e.outputBuffer.getChannelData(0));
    sp.port = { postMessage: (m) => filter.setMask(m) };   // same interface as the node
    bandNode = sp;
    auditionPath = "main thread";
  }
  hub.connect(bandNode);
  bandNode.connect(wetGain);
  pushAuditionMask();
  syncUI();
}

function pushAuditionMask() {
  if (bandNode) bandNode.port.postMessage(DSP.bandMask(AUDITION_N, ctx.sampleRate, S.lo, S.hi));
}

// Solo replaces the monitor path with the band, so it only makes sense with
// the monitor on.
function setSolo(on) {
  S.solo = on && !!bandNode;
  if (dryGain) dryGain.gain.value = S.solo ? 0 : 1;
  if (wetGain) wetGain.gain.value = S.solo ? 1 : 0;
  if (S.solo && !monitorOn()) setMonitor(true);
  else syncUI();
}

/* --- sources ------------------------------------------------------------- */

function stopSource() {
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  if (testNodes) { testNodes.forEach((n) => { try { n.stop(); } catch (e) {} n.disconnect(); }); testNodes = null; }
  stopNode();
}

function stopNode() {
  if (T.node) { try { T.node.stop(); } catch (e) {} T.node.disconnect(); T.node = null; }
  T.playing = false;
}

async function selectSource(kind) {
  await ensureCtx();
  stopSource();
  source = kind;
  bumpColumns();
  if (kind === "mic") {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx.createMediaStreamSource(micStream).connect(hub);
    setMonitor(false);
  } else if (kind === "file") {
    if (file.buf) { setMonitor(true); play(); } else $("#fileInput").click();
  } else {
    startTest();
    setMonitor(false);
  }
  syncUI();
}

// Broadband noise plus a slow sweeping saw, so the band select is visible
// without needing real input.
function startTest() {
  const len = ctx.sampleRate * 2;
  const nb = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = nb;
  noise.loop = true;
  const ng = ctx.createGain();
  ng.gain.value = 0.12;
  noise.connect(ng).connect(hub);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 1800;
  const lfo = ctx.createOscillator();
  lfo.type = "triangle";
  lfo.frequency.value = 0.08;
  const lg = ctx.createGain();
  lg.gain.value = 1500;
  lfo.connect(lg).connect(osc.frequency);
  const og = ctx.createGain();
  og.gain.value = 0.3;
  osc.connect(og).connect(hub);

  noise.start(); osc.start(); lfo.start();
  testNodes = [noise, osc, lfo];
}

function setMonitor(on) {
  if (monitorGain) monitorGain.gain.value = on ? 1 : 0;
  syncUI();
}
const monitorOn = () => !!monitorGain && monitorGain.gain.value > 0;

/* --- file load and offline analysis -------------------------------------- */

async function loadFile(f) {
  await ensureCtx();
  file.status = "decoding";
  syncUI();
  const buf = await ctx.decodeAudioData(await f.arrayBuffer());
  stopSource();
  source = "file";
  file.buf = buf;
  file.name = f.name;
  file.sr = buf.sampleRate;
  file.duration = buf.duration;
  file.grid = null;
  file.over = null;
  T.offset = 0;
  T.loop = false;

  // mono sum: the scope reads its window straight out of this, so the display
  // tracks the playhead exactly and works while paused
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i];
  }
  if (buf.numberOfChannels > 1) for (let i = 0; i < n; i++) mono[i] /= buf.numberOfChannels;
  file.mono = mono;
  bumpColumns();

  setMonitor(true);
  play();
  syncUI();

  file.status = "analysing";
  const res = await BeatGrid.detect(mono, file.sr, (p) => {
    file.status = "analysing " + Math.round(p * 100) + "%";
    syncUI();
  });
  if (res.fit) {
    file.grid = {
      startPos: res.fit.startPos,
      ibi: res.fit.beatInterval,
      bpm: res.fit.bpm,
      anchor: res.fit.downbeatTimes.length ? res.fit.downbeatTimes[0] : res.fit.startPos,
      support: res.fit.confidence,
      devMs: res.fit.meanDeviationMs,
      peaks: res.peaks.times.length,
    };
  }
  buildOverview(res.bands, res.fps);
  file.status = "";
  syncUI();
}

/* Overview columns: peak height straight from the samples, colour from the
   low/mid/high band energies of the onset analysis. Same idea as webui.py's
   _colored_waveform (bass red, mids green, highs blue, each normalised to its
   own 99th percentile so the colours stay vivid). */
function buildOverview(bands, fps) {
  const N = 2048;
  const mono = file.mono;
  const peak = new Float32Array(N);
  const per = mono.length / N;
  for (let i = 0; i < N; i++) {
    const a = Math.floor(i * per), b = Math.min(mono.length, Math.floor((i + 1) * per));
    let m = 0;
    for (let j = a; j < b; j++) { const v = Math.abs(mono[j]); if (v > m) m = v; }
    peak[i] = m;
  }
  const pk = Math.max(1e-6, Math.max(...peak));
  for (let i = 0; i < N; i++) peak[i] /= pk;

  const pick = (src) => {
    const out = new Float32Array(N);
    const step = src.length / N;
    for (let i = 0; i < N; i++) {
      const a = Math.floor(i * step), b = Math.min(src.length, Math.floor((i + 1) * step));
      let m = 0;
      for (let j = a; j < b; j++) if (src[j] > m) m = src[j];
      out[i] = m;
    }
    const sorted = Float32Array.from(out).sort();
    const p99 = sorted[Math.floor(0.99 * (N - 1))] || 1;
    for (let i = 0; i < N; i++) out[i] = clamp(out[i] / p99, 0, 1);
    return out;
  };
  const low = pick(bands.low), mid = pick(bands.mid), high = pick(bands.high);
  const rgb = new Uint8Array(N * 3);
  for (let i = 0; i < N; i++) {
    rgb[i * 3] = 60 + 195 * low[i];
    rgb[i * 3 + 1] = 60 + 175 * mid[i];
    rgb[i * 3 + 2] = 70 + 185 * high[i];
  }
  file.over = { n: N, peak, rgb, fps };
  overDirty = true;
}

/* --- transport ----------------------------------------------------------- */

const barLen = () => (file.grid ? 4 * file.grid.ibi : 2);

function position() {
  if (source !== "file" || !file.buf) return 0;
  if (!T.playing) return T.offset;
  let p = T.offset + (ctx.currentTime - T.startedAt) * T.rate;
  if (T.loop && T.loopEnd > T.loopStart) {
    const len = T.loopEnd - T.loopStart;
    if (p >= T.loopEnd) p = T.loopStart + ((p - T.loopStart) % len);
  }
  return clamp(p, 0, file.duration);
}

function play(at) {
  if (!file.buf) return;
  const from = at === undefined ? T.offset : at;
  stopNode();
  const node = ctx.createBufferSource();
  node.buffer = file.buf;
  node.playbackRate.value = T.rate;
  if (T.loop && T.loopEnd > T.loopStart) {
    node.loop = true;
    node.loopStart = T.loopStart;
    node.loopEnd = T.loopEnd;
  }
  node.connect(hub);
  node.start(0, clamp(from, 0, Math.max(0, file.duration - 0.01)));
  node.onended = () => { if (T.node === node && !T.loop) { T.playing = false; syncUI(); } };
  T.node = node;
  T.offset = from;
  T.startedAt = ctx.currentTime;
  T.playing = true;
  syncUI();
}

function pause() {
  if (!T.playing) return;
  T.offset = position();
  stopNode();
  syncUI();
}

const togglePlay = () => (T.playing ? pause() : play());

function seek(t) {
  t = clamp(t, 0, file.duration);
  if (T.playing) play(t);
  else { T.offset = t; syncUI(); }
}

function setRate(r) {
  T.rate = clamp(r, 0.25, 2);
  if (T.playing) play(position());
  else syncUI();
}

// Loop the next N bars from the playhead, snapped to the grid.
function setLoop(on) {
  T.loop = on;
  if (on) {
    const g = file.grid;
    const p = position();
    const start = g ? g.anchor + Math.floor((p - g.anchor) / barLen()) * barLen() : p;
    T.loopStart = Math.max(0, start);
    T.loopEnd = Math.min(file.duration, T.loopStart + T.loopBars * barLen());
  }
  if (T.playing) play(T.loop ? Math.max(T.loopStart, Math.min(position(), T.loopEnd - 0.01)) : position());
  else syncUI();
}

/* --- grid edits ---------------------------------------------------------- */

function scaleGrid(factor) {
  const g = file.grid;
  if (!g) return;
  const ibi = g.ibi / factor;
  if (60 / ibi < 40 || 60 / ibi > 300) return;
  g.ibi = ibi;
  g.bpm = 60 / ibi;
  g.startPos = g.anchor - Math.floor(g.anchor / ibi) * ibi;
  syncUI();
}

function nudgeDownbeat(beats) {
  const g = file.grid;
  if (!g) return;
  g.anchor += beats * g.ibi;
  syncUI();
}

/* --- window geometry ----------------------------------------------------- */

let frozenAt = null;         // playhead time, or ring write count, when frozen

function setFrozen(on) {
  S.frozen = on;
  frozenAt = !on ? null : source === "file" ? position() : ring ? ring.write : 0;
  syncUI();
}

/* Absolute sample index of the first sample on screen, its time, and the
   centre the view would have had untriggered (which is what the auto transient
   analysis reads around, so that aligning the view cannot chase itself). */
function viewGeometry(count) {
  const live = source !== "file";
  const sr = live ? ctx.sampleRate : file.sr || ctx.sampleRate;
  let center, start;
  if (live) {
    const head = S.frozen && frozenAt !== null ? frozenAt : ring ? ring.write : 0;
    start = head - count;
    center = head - (count >> 1);
  } else {
    const at = S.frozen && frozenAt !== null ? frozenAt : position();
    center = Math.round(at * sr);
    start = center - (count >> 1);
  }

  if (S.trig === "bar" && !live && file.grid) {
    const g = file.grid;
    const t0 = g.startPos + Math.round((start / sr - g.startPos) / g.ibi) * g.ibi;
    start = Math.round(t0 * sr);
  } else if (S.trig === "trans" && transients.length) {
    // put the nearest attack a short way in from the left, so the window shows
    // the attack and what follows it rather than what came before
    let nearest = transients[0];
    for (const t of transients) if (Math.abs(t - center) < Math.abs(nearest - center)) nearest = t;
    if (Math.abs(nearest - center) < count) start = Math.round(nearest - count * 0.15);
  }
  return { sr, start, t0: start / sr, live, center };
}

function readWindow(dst, start, n) {
  dst.fill(0);
  if (source === "file") {
    const src = file.mono;
    if (!src) return;                 // file selected but nothing loaded yet
    const a = Math.max(0, start), b = Math.min(src.length, start + n);
    if (b > a) dst.set(src.subarray(a, b), a - start);
    return;
  }
  if (ring) ring.read(dst, start, n);
}

/* --- short window: exact analytic band pass ------------------------------ */

let raw = null, re = null, im = null, blockN = 0;
const view = { count: 0, offset: 0, sr: 0, peak: 0, rms: 0, norm: 1, long: false };

function ensureBlock(n) {
  if (n === blockN) return;
  blockN = n;
  raw = new Float32Array(n);
  re = new Float64Array(n);
  im = new Float64Array(n);
}

function analyseShort(count, geo) {
  let n = 2048;
  while (n < count * 4 && n < 32768) n <<= 1;
  ensureBlock(n);
  const pad = (n - count) >> 1;
  readWindow(raw, geo.start - pad, n);

  re.set(raw);
  im.fill(0);
  const fft = getFFT(n);
  fft.run(re, im, false);

  // band select and analytic signal in one pass: zero the bins outside the
  // band, zero the negative frequencies and double the positive ones
  const half = n >> 1;
  const mask = maskFor(n, geo.sr);
  for (let k = 0; k <= half; k++) {
    const s = k === 0 || k === half ? mask[k] : 2 * mask[k];
    re[k] *= s;
    im[k] *= s;
  }
  for (let k = half + 1; k < n; k++) { re[k] = 0; im[k] = 0; }
  fft.run(re, im, true);

  let offset = pad;
  if (S.trig === "edge") offset = triggerOffset(pad, count, n);
  view.offset = clamp(offset, n >> 2, Math.max(n >> 2, n - (n >> 2) - count));

  let peak = 0, sum = 0;
  for (let i = view.offset; i < view.offset + count; i++) {
    const v = re[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sum += v * v;
  }
  view.peak = peak;
  view.rms = Math.sqrt(sum / count);
}

// Rising edge nearest the centre of the window, so the trace stops sliding.
function triggerOffset(pad, count, n) {
  const thr = S.level * Math.max(view.peak, 1e-5);
  const center = pad + (count >> 1);
  const radius = Math.min(count, n >> 2);
  for (let d = 1; d < radius; d++) {
    for (const i of [center - d, center + d]) {
      if (i <= 1 || i >= n) continue;
      if (re[i - 1] <= thr && re[i] > thr) return i - (count >> 1);
    }
  }
  return pad;
}

/* --- long window: cached short time analysis ----------------------------- */

/* Past a few hundred milliseconds a per sample band pass is neither drawable
   nor affordable: one FFT over 8 s of audio is millions of butterflies per
   frame. Analyse per display column instead, and cache each column by its
   absolute position, so a sliding window only pays for the columns that just
   came into view. Envelope is sqrt of the in band energy (exact for a tone),
   hue comes from the in band centroid, which is where the per sample path's
   instantaneous frequency ends up anyway. */

const CACHE_N = 1 << 12;
const cKey = new Float64Array(CACHE_N).fill(-1);
const cGen = new Int32Array(CACHE_N).fill(-1);
const cEnv = new Float32Array(CACHE_N);
const cCent = new Float32Array(CACHE_N);
let colGen = 0, colHop = 256, colFFT = 1024, colBuf = null, colRe = null, colIm = null;
const COLS_PER_FRAME = 1024;   // ~8 ms, so a full rebuild costs about three frames

const bumpColumns = () => { colGen++; };

let maskCache = { n: 0, sr: 0, lo: 0, hi: 0, table: null };
function maskFor(n, sr) {
  if (maskCache.n !== n || maskCache.sr !== sr || maskCache.lo !== S.lo || maskCache.hi !== S.hi) {
    maskCache = { n, sr, lo: S.lo, hi: S.hi, table: bandMask(n, sr, S.lo, S.hi) };
  }
  return maskCache.table;
}

function setColumnScale(count) {
  const hop = clamp(1 << Math.round(Math.log2(Math.max(1, count / 2048))), 16, 4096);
  const nfft = Math.max(1024, 2 * hop);
  if (hop !== colHop || nfft !== colFFT) {
    colHop = hop;
    colFFT = nfft;
    colBuf = new Float32Array(nfft);
    colRe = new Float64Array(nfft);
    colIm = new Float64Array(nfft);
    colGen++;
  }
}

function computeColumn(col, sr, slot) {
  const fft = getFFT(colFFT);
  const win = hann(colFFT);
  readWindow(colBuf, col * colHop - (colFFT >> 1), colFFT);
  for (let i = 0; i < colFFT; i++) { colRe[i] = colBuf[i] * win[i]; colIm[i] = 0; }
  fft.run(colRe, colIm, false);
  const half = colFFT >> 1;
  const mask = maskFor(colFFT, sr);
  const binHz = sr / colFFT;
  const scale = 4 / colFFT;            // Hann coherent gain 0.5
  let energy = 0, weighted = 0;
  for (let k = 1; k < half; k++) {
    const g = mask[k];
    if (g === 0) continue;
    const a = Math.sqrt(colRe[k] * colRe[k] + colIm[k] * colIm[k]) * scale * g;
    const e = a * a;
    energy += e;
    weighted += e * k * binHz;
  }
  cEnv[slot] = Math.sqrt(energy);
  cCent[slot] = energy > 0 ? weighted / energy : 0;
  cKey[slot] = col;
  cGen[slot] = colGen;
}

/* --- auto transient tuning ----------------------------------------------- */

/* Hands the section on screen to BeatGrid.transientBand, then eases the band
   towards what it found. Easing rather than jumping, because the answer moves
   with the music and a band that snaps around is unreadable. */

const AUTO_FRAMES = 400;
const AUTO_SPAN_SEC = 1.5;             // minimum audio to judge from
let transients = [];                   // absolute sample indices
let transientRanges = null;            // per transient, index into BeatGrid.RANGE_NAMES; full methods only
let transientSpan = 0;                 // seconds of audio they were found in

let autoTick = 0, autoRuns = 0;

function autoTune(geo) {
  const sr = geo.sr;
  const span = Math.max(view.count, Math.round(AUTO_SPAN_SEC * sr));
  const hop = Math.max(128, 1 << Math.round(Math.log2(Math.max(1, span / AUTO_FRAMES))));
  const frames = Math.min(AUTO_FRAMES, Math.floor(span / hop));
  const start = geo.center - (frames * hop) / 2;
  const [minHz, maxHz] = FOCUS[S.focus] || FOCUS.all;
  const res = BeatGrid.transientBand((dst, at) => readWindow(dst, at, dst.length), {
    sr, start, frames, hop,
    curLo: S.lo, curHi: S.hi,
    minHz, maxHz,
    thresh: 0.5 - 0.45 * S.sens,
    floor: 0.7 * (1 - S.sens),      // how quiet, relative to the loudest attack, still counts
    method: S.method,
  });
  autoRuns++;
  if (!res) { transients = []; transientRanges = null; transientSpan = 0; return; }

  // full spectrum methods do not read the band, so they do not move it either
  if (!S.hold && !isFullMethod()) {
    const step = (cur, target) => cur * Math.pow(target / cur, 0.4);
    const nlo = step(S.lo, res.lo), nhi = step(S.hi, res.hi);
    if (Math.abs(Math.log2(nlo / S.lo)) > 0.005 || Math.abs(Math.log2(nhi / S.hi)) > 0.005) setBand(nlo, nhi);
  }
  transients = res.transients.map((t) => start + t * sr);
  transientRanges = res.ranges;
  transientSpan = res.span;
}

/* Range lamps in the auto bar: lit for a range with an attack in view, bright
   for one that fired in the last 150 ms before the view centre. DOM writes
   only when the state changes. */
const isFullMethod = () => S.method === "superflux" || S.method === "perc";
let lampState = "";
function updateLamps(geo) {
  let next = "";
  if (S.auto && transientRanges) {
    const hot = new Array(RANGE_RGB.length).fill(0);
    const end = geo.start + view.count, recent = geo.center - 0.15 * geo.sr;
    transients.forEach((s, i) => {
      const r = transientRanges[i];
      if (r < 0 || s < geo.start || s > end) return;
      hot[r] = Math.max(hot[r], s >= recent && s <= geo.center ? 2 : 1);
    });
    next = hot.join("");
  }
  if (next === lampState) return;
  lampState = next;
  $$("#tlamps span").forEach((el, r) => {
    const h = next ? +next[r] : 0;
    el.style.background = h ? rangeCss(r, h === 2 ? 1 : 0.35) : "transparent";
    el.style.color = h === 2 ? "#000" : h ? "#fff" : "";
  });
}

/* --- point building ------------------------------------------------------ */

const MAXP = 32768;
const px = new Float32Array(MAXP);
const pmin = new Float32Array(MAXP);
const pmax = new Float32Array(MAXP);
const pcol = new Float32Array(MAXP);
const penv = new Float32Array(MAXP);
const ptmp = new Float32Array(MAXP);
let plen = 0;

const hueOf = (f, span) => (f > 0 ? clamp(Math.log2(f / S.lo) / span, 0, 1) : 0);

function buildShortPoints(W, H, geo) {
  const count = view.count;
  const start = view.offset;
  const sr = geo.sr;
  const amp = ampScale();
  const mid = H / 2;
  const span = Math.log2(Math.max(1.01, S.hi / S.lo));
  const twoPi = 2 * Math.PI;
  const dense = count / W > 1.4;
  plen = dense ? Math.min(W | 0, MAXP) : Math.min(count, MAXP);

  for (let p = 0; p < plen; p++) {
    const i0 = dense ? start + Math.floor((p * count) / plen) : start + p;
    const i1 = dense ? start + Math.floor(((p + 1) * count) / plen) : i0 + 1;
    let vmin = Infinity, vmax = -Infinity, eMax = 0, fw = 0, ew = 0;
    for (let i = i0; i < Math.max(i1, i0 + 1); i++) {
      const v = re[i];
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
      const e = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      if (e > eMax) eMax = e;
      // instantaneous frequency from arg(z[i] * conj(z[i-1]))
      const dot = re[i] * re[i - 1] + im[i] * im[i - 1];
      const cross = im[i] * re[i - 1] - re[i] * im[i - 1];
      fw += Math.abs((Math.atan2(cross, dot) * sr) / twoPi) * e;
      ew += e;
    }
    px[p] = dense ? (p * W) / plen : ((i0 - start) * W) / count;
    pmin[p] = mid - clamp(vmin * amp, -1.6, 1.6) * mid;
    pmax[p] = mid - clamp(vmax * amp, -1.6, 1.6) * mid;
    penv[p] = eMax * amp;
    pcol[p] = hueOf(ew > 1e-9 ? fw / ew : 0, span);
  }
  smoothHue();
}

function buildLongPoints(W, H, geo) {
  const count = view.count;
  setColumnScale(count);
  const first = Math.floor(geo.start / colHop);
  const cols = Math.min(MAXP, Math.ceil(count / colHop) + 1);
  const amp = ampScale();
  const mid = H / 2;
  const span = Math.log2(Math.max(1.01, S.hi / S.lo));
  let budget = COLS_PER_FRAME;
  let peak = 0, sum = 0;

  plen = cols;
  for (let p = 0; p < cols; p++) {
    const col = first + p;
    const slot = ((col % CACHE_N) + CACHE_N) % CACHE_N;
    const known = cKey[slot] === col;
    if (!known || cGen[slot] !== colGen) {
      if (budget > 0) { computeColumn(col, geo.sr, slot); budget--; }
      else if (!known) { cEnv[slot] = 0; cCent[slot] = 0; cKey[slot] = -1; }
      // a known column whose band is out of date keeps its old value for this
      // frame, so dragging the band dims the trace rather than blanking it
    }
    const env = cKey[slot] === col ? cEnv[slot] : 0;
    const e = env * amp;
    px[p] = ((col * colHop - geo.start) * W) / count;
    pmin[p] = mid - clamp(e, 0, 1.6) * mid;
    pmax[p] = mid + clamp(e, 0, 1.6) * mid;
    penv[p] = e;
    pcol[p] = hueOf(cKey[slot] === col ? cCent[slot] : 0, span);
    if (env > peak) peak = env;
    sum += env * env * 0.5;
  }
  view.peak = peak;
  view.rms = Math.sqrt(sum / Math.max(1, cols));
}

function ampScale() {
  return Math.pow(10, S.gainDb / 20) * (S.normalize ? view.norm : 1);
}

/* Instantaneous frequency is meaningless where the envelope dips towards zero,
   which throws stray hues into an otherwise steady trace. Let loud neighbours
   carry the hue through those nulls. */
function smoothHue() {
  const r = 3;
  for (let p = 0; p < plen; p++) {
    let s = 0, w = 0;
    const a = Math.max(0, p - r), b = Math.min(plen - 1, p + r);
    for (let q = a; q <= b; q++) {
      const e = penv[q] + 1e-6;
      s += pcol[q] * e;
      w += e;
    }
    ptmp[p] = s / w;
  }
  pcol.set(ptmp.subarray(0, plen));
}

/* --- spectrum ------------------------------------------------------------ */

const SPEC_N = 8192;
const specRaw = new Float32Array(SPEC_N);
const specRe = new Float64Array(SPEC_N);
const specIm = new Float64Array(SPEC_N);
const mag = new Float32Array(SPEC_N / 2 + 1);
const stats = { centroid: 0, bandDb: 0 };

// Its own transform at a fixed size, so the spectrum keeps the same resolution
// whatever the time window is doing.
function analyseSpectrum(geo) {
  const center = geo.start + (view.count >> 1);
  readWindow(specRaw, center - (SPEC_N >> 1), SPEC_N);
  const win = hann(SPEC_N);
  for (let i = 0; i < SPEC_N; i++) { specRe[i] = specRaw[i] * win[i]; specIm[i] = 0; }
  getFFT(SPEC_N).run(specRe, specIm, false);
  const half = SPEC_N >> 1;
  const scale = 4 / SPEC_N;
  const binHz = geo.sr / SPEC_N;
  const mask = maskFor(SPEC_N, geo.sr);
  let bandE = 0, allE = 0, cw = 0;
  for (let k = 0; k <= half; k++) {
    const a = Math.sqrt(specRe[k] * specRe[k] + specIm[k] * specIm[k]) * scale;
    mag[k] = a;
    const p = a * a;
    allE += p;
    const g = mask[k];
    if (g > 0) { bandE += p * g * g; cw += p * g * g * k * binHz; }
  }
  stats.centroid = bandE > 0 ? cw / bandE : 0;
  stats.bandDb = allE > 0 ? 10 * Math.log10(bandE / allE + 1e-12) : -120;
}

/* --- drawing ------------------------------------------------------------- */

const scope = $("#scope"), sctx = scope.getContext("2d");
const spec = $("#spec"), pctx = spec.getContext("2d");
const over = $("#over"), octx = over.getContext("2d");
const overCanvas = document.createElement("canvas");
let overDirty = true;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [scope, spec, over]) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
  }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  overDirty = true;
}

// Scyllascope's spectral ramp, low frequency to high.
const PAL = [[0xcc, 0x33, 0x44], [0xff, 0x77, 0x33], [0x88, 0xcc, 0x44], [0x44, 0xaa, 0xdd], [0x88, 0x66, 0xff]];
const FLAT = [0xd8, 0xe2, 0xea];

function paletteAt(t) {
  const x = clamp(t, 0, 1) * (PAL.length - 1);
  const i = Math.min(PAL.length - 2, Math.floor(x));
  const f = x - i;
  const a = PAL[i], b = PAL[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// the six transient ranges take their colours from the same ramp, low to high
const RANGE_RGB = BeatGrid.RANGE_NAMES.map((_, i, a) => paletteAt(i / (a.length - 1)).map((c) => c | 0));
const rangeCss = (r, alpha) => `rgba(${RANGE_RGB[r][0]},${RANGE_RGB[r][1]},${RANGE_RGB[r][2]},${alpha})`;

function pointColor(p) {
  const k = clamp((20 * Math.log10(penv[p] + 1e-9) + 60) / 54, 0, 1);
  if (S.color === "flat") {
    const g = 0.3 + 0.7 * k;
    return `rgb(${(FLAT[0] * g) | 0},${(FLAT[1] * g) | 0},${(FLAT[2] * g) | 0})`;
  }
  const c = paletteAt(S.color === "env" ? k : pcol[p]);
  const g = 0.24 + 0.76 * k;
  const h = k * k;                      // hue presence: silence reads neutral
  return `rgb(${((c[0] * h + 110 * (1 - h)) * g) | 0},` +
    `${((c[1] * h + 110 * (1 - h)) * g) | 0},` +
    `${((c[2] * h + 110 * (1 - h)) * g) | 0})`;
}

// One horizontal gradient stroked over the whole trace beats one stroke per
// segment: same look, a fraction of the draw calls.
function traceGradient(W) {
  const g = sctx.createLinearGradient(0, 0, W, 0);
  const step = Math.max(1, Math.floor(plen / 180));
  for (let p = 0; p < plen; p += step) g.addColorStop(clamp(px[p] / W, 0, 1), pointColor(p));
  g.addColorStop(1, pointColor(plen - 1));
  return g;
}

function drawGrid(W, H) {
  const mid = H / 2;
  sctx.lineWidth = 1;
  sctx.strokeStyle = "#12141a";
  sctx.beginPath();
  for (let i = 1; i < 10; i++) {
    const x = Math.round((W * i) / 10) + 0.5;
    sctx.moveTo(x, 0); sctx.lineTo(x, H);
  }
  sctx.stroke();
  sctx.strokeStyle = "#1b1e24";
  sctx.beginPath();
  for (const a of [1, 0.5, 0.25]) for (const s of [-1, 1]) {
    const y = Math.round(mid - s * a * mid) + 0.5;
    sctx.moveTo(0, y); sctx.lineTo(W, y);
  }
  sctx.stroke();
  sctx.strokeStyle = "#2b3038";
  sctx.beginPath();
  sctx.moveTo(0, Math.round(mid) + 0.5);
  sctx.lineTo(W, Math.round(mid) + 0.5);
  sctx.stroke();
  sctx.fillStyle = "#3d434b";
  sctx.font = "9px ui-monospace, monospace";
  sctx.textAlign = "left";
  for (const [a, t] of [[1, "0"], [0.5, "-6"], [0.25, "-12"]]) sctx.fillText(t, 3, mid - a * mid + 10);
  sctx.textAlign = "center";
  const ms = S.windowMs;
  for (let i = 1; i < 10; i++) {
    const v = (ms * i) / 10;
    sctx.fillText(ms >= 1000 ? (v / 1000).toFixed(2) : v.toFixed(v < 10 ? 1 : 0), (W * i) / 10, H - 4);
  }
}

// Beat and bar lines from the fitted grid, plus the playhead.
function drawBeats(W, H, geo) {
  if (source !== "file" || !file.grid || !S.beats) return;
  const g = file.grid;
  const t1 = geo.t0 + view.count / geo.sr;
  const bar = 4 * g.ibi;
  const spacing = (g.ibi / (t1 - geo.t0)) * W;
  const kFrom = Math.ceil((geo.t0 - g.startPos) / g.ibi);
  const kTo = Math.floor((t1 - g.startPos) / g.ibi);
  if (kTo - kFrom > 4000) return;
  sctx.font = "9px ui-monospace, monospace";
  sctx.textAlign = "left";
  for (let k = kFrom; k <= kTo; k++) {
    const t = g.startPos + k * g.ibi;
    const x = Math.round(((t - geo.t0) / (t1 - geo.t0)) * W) + 0.5;
    const barIndex = (t - g.anchor) / bar;
    const isDown = Math.abs(barIndex - Math.round(barIndex)) < 1e-6;
    if (!isDown && spacing < 6) continue;
    sctx.beginPath();
    sctx.strokeStyle = isDown ? "rgba(150,164,184,.55)" : "rgba(120,132,150,.22)";
    sctx.moveTo(x, 0);
    sctx.lineTo(x, H);
    sctx.stroke();
    if (isDown && spacing > 3) {
      sctx.fillStyle = "#6b7583";
      sctx.fillText(String(Math.round(barIndex) + 1), x + 3, 11);
    }
  }
}

function drawTransients(W, H, geo) {
  if (!S.auto || !transients.length) return;
  sctx.fillStyle = "rgba(255,255,255,.75)";
  for (let i = 0; i < transients.length; i++) {
    const s = transients[i];
    const x = ((s - geo.start) / view.count) * W;
    if (x < 0 || x > W) continue;
    // full spectrum methods know the range; colour the marker by it
    if (transientRanges) sctx.fillStyle = transientRanges[i] >= 0 ? rangeCss(transientRanges[i], 0.9) : "rgba(255,255,255,.75)";
    sctx.fillRect(Math.round(x), 0, 1, 9);
    sctx.beginPath();
    sctx.moveTo(Math.round(x) - 3, 0);
    sctx.lineTo(Math.round(x) + 4, 0);
    sctx.lineTo(Math.round(x) + 0.5, 5);
    sctx.closePath();
    sctx.fill();
  }
}

function drawPlayhead(W, H, geo) {
  if (source !== "file" || !file.buf) return;
  const t1 = geo.t0 + view.count / geo.sr;
  const x = ((position() - geo.t0) / (t1 - geo.t0)) * W;
  if (x < 0 || x > W) return;
  sctx.strokeStyle = "rgba(255,255,255,.55)";
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.moveTo(Math.round(x) + 0.5, 0);
  sctx.lineTo(Math.round(x) + 0.5, H);
  sctx.stroke();
}

function drawScope(geo) {
  const W = scope.width / dpr, H = scope.height / dpr;
  sctx.clearRect(0, 0, W, H);
  if (S.grid) drawGrid(W, H);
  if (!ctx || plen === 0) {
    if (geo) drawBeats(W, H, geo);
    sctx.fillStyle = "#4a5058";
    sctx.font = "11px ui-monospace, monospace";
    sctx.textAlign = "center";
    sctx.fillText("SELECT A SOURCE", W / 2, H / 2 - 8);
    return;
  }

  const grad = traceGradient(W);
  const mid = H / 2;
  if (S.envelope) {
    sctx.beginPath();
    sctx.moveTo(px[0], mid - penv[0] * mid);
    for (let p = 1; p < plen; p++) sctx.lineTo(px[p], mid - penv[p] * mid);
    for (let p = plen - 1; p >= 0; p--) sctx.lineTo(px[p], mid + penv[p] * mid);
    sctx.closePath();
    sctx.globalAlpha = 0.1;
    sctx.fillStyle = grad;
    sctx.fill();
    sctx.globalAlpha = 1;
  }

  sctx.beginPath();
  sctx.moveTo(px[0], pmin[0]);
  for (let p = 0; p < plen; p++) {
    sctx.lineTo(px[p], pmin[p]);
    sctx.lineTo(px[p], pmax[p]);
  }
  sctx.strokeStyle = grad;
  sctx.lineJoin = "round";
  sctx.globalAlpha = 0.22;
  sctx.lineWidth = 4;
  sctx.stroke();
  sctx.globalAlpha = 1;
  sctx.lineWidth = 1.4;
  sctx.stroke();
  if (geo) { drawBeats(W, H, geo); drawTransients(W, H, geo); drawPlayhead(W, H, geo); }
}

const specGeom = { x0: 0, x1: 0, fMin: 20, fMax: 20000 };
let specPeak = new Float32Array(0);
const fToX = (f, W) => {
  const a = Math.log2(specGeom.fMin), b = Math.log2(specGeom.fMax);
  return ((Math.log2(clamp(f, specGeom.fMin, specGeom.fMax)) - a) / (b - a)) * W;
};
const xToF = (x, W) => {
  const a = Math.log2(specGeom.fMin), b = Math.log2(specGeom.fMax);
  return Math.pow(2, a + (clamp(x, 0, W) / W) * (b - a));
};

function drawSpectrum(geo) {
  const W = spec.width / dpr, H = spec.height / dpr;
  pctx.clearRect(0, 0, W, H);
  if (!ctx || !geo) return;
  specGeom.fMax = geo.sr / 2;
  const half = SPEC_N >> 1;
  const binHz = geo.sr / SPEC_N;
  const x0 = fToX(S.lo, W), x1 = fToX(S.hi, W);
  specGeom.x0 = x0;
  specGeom.x1 = x1;

  pctx.fillStyle = "#080a0d";
  pctx.fillRect(x0, 0, x1 - x0, H);

  pctx.strokeStyle = "#12141a";
  pctx.beginPath();
  pctx.fillStyle = "#3d434b";
  pctx.font = "9px ui-monospace, monospace";
  pctx.textAlign = "left";
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
    if (f >= specGeom.fMax) break;
    const x = Math.round(fToX(f, W)) + 0.5;
    pctx.moveTo(x, 0); pctx.lineTo(x, H);
    pctx.fillText(f >= 1000 ? f / 1000 + "k" : String(f), x + 3, H - 3);
  }
  pctx.stroke();

  // Peak held per pixel column so the dense high end stays readable, columns
  // with no bin skipped so the sparse low end interpolates.
  const cols = Math.ceil(W);
  if (specPeak.length < cols) specPeak = new Float32Array(cols);
  specPeak.fill(0, 0, cols);
  for (let k = 1; k <= half; k++) {
    const f = k * binHz;
    if (f < specGeom.fMin) continue;
    const c = clamp(Math.round(fToX(f, W)), 0, cols - 1);
    if (mag[k] > specPeak[c]) specPeak[c] = mag[k];
  }
  pctx.beginPath();
  pctx.moveTo(0, H);
  let started = false;
  for (let c = 0; c < cols; c++) {
    if (specPeak[c] <= 0) continue;
    const y = H - clamp((20 * Math.log10(specPeak[c]) + 96) / 96, 0, 1) * (H - 6);
    if (!started) { pctx.lineTo(c, H); started = true; }
    pctx.lineTo(c, y);
  }
  pctx.lineTo(W, H);
  pctx.closePath();
  pctx.fillStyle = "#0f1319";
  pctx.fill();
  pctx.strokeStyle = "#5a636e";
  pctx.lineWidth = 1;
  pctx.stroke();

  pctx.fillStyle = "rgba(0,0,0,.6)";
  pctx.fillRect(0, 0, x0, H);
  pctx.fillRect(x1, 0, W - x1, H);

  pctx.strokeStyle = "#ffffff";
  pctx.beginPath();
  for (const x of [x0, x1]) { pctx.moveTo(Math.round(x) + 0.5, 0); pctx.lineTo(Math.round(x) + 0.5, H); }
  pctx.stroke();
  pctx.fillStyle = "#fff";
  pctx.fillRect(Math.round(x0) - 1, 0, 3, 5);
  pctx.fillRect(Math.round(x1) - 1, 0, 3, 5);
  pctx.font = "9px ui-monospace, monospace";
  // labels sit outside their edge, unless that would run off the strip
  pctx.textAlign = x0 < 46 ? "left" : "right";
  pctx.fillText(fmtHz(S.lo), x0 + (x0 < 46 ? 4 : -4), 10);
  pctx.textAlign = x1 > W - 52 ? "right" : "left";
  pctx.fillText(fmtHz(S.hi), x1 + (x1 > W - 52 ? -4 : 4), 10);
}

function renderOverview(W, H) {
  overCanvas.width = Math.max(1, Math.round(W * dpr));
  overCanvas.height = Math.max(1, Math.round(H * dpr));
  const c = overCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const o = file.over;
  if (!o) return;
  const mid = H / 2;
  for (let x = 0; x < W; x++) {
    const i = Math.min(o.n - 1, Math.floor((x / W) * o.n));
    const h = o.peak[i] * (mid - 1);
    c.fillStyle = `rgb(${o.rgb[i * 3]},${o.rgb[i * 3 + 1]},${o.rgb[i * 3 + 2]})`;
    c.fillRect(x, mid - h, 1, Math.max(1, 2 * h));
  }
  overDirty = false;
}

function drawOverview(geo) {
  const W = over.width / dpr, H = over.height / dpr;
  octx.clearRect(0, 0, W, H);
  if (source !== "file" || !file.buf) return;
  if (overDirty) renderOverview(W, H);
  octx.drawImage(overCanvas, 0, 0, W, H);

  const toX = (t) => (t / file.duration) * W;
  const g = file.grid;
  if (g && S.beats) {
    const bar = 4 * g.ibi;
    const step = (bar / file.duration) * W < 6 ? 4 : 1;   // phrase lines when bars crowd
    octx.strokeStyle = "rgba(120,132,148,.35)";
    octx.beginPath();
    for (let b = 0; ; b += step) {
      const t = g.anchor + b * bar;
      if (t > file.duration) break;
      if (t < 0) continue;
      const x = Math.round(toX(t)) + 0.5;
      octx.moveTo(x, H - 5);
      octx.lineTo(x, H);
    }
    octx.stroke();
  }

  if (T.loop && T.loopEnd > T.loopStart) {
    octx.fillStyle = "rgba(255,255,255,.10)";
    octx.fillRect(toX(T.loopStart), 0, toX(T.loopEnd) - toX(T.loopStart), H);
  }

  // window under the scope, then the playhead
  if (geo) {
    const a = toX(geo.t0), b = toX(geo.t0 + view.count / geo.sr);
    octx.strokeStyle = "rgba(255,255,255,.35)";
    octx.strokeRect(Math.round(a) + 0.5, 0.5, Math.max(1, b - a), H - 1);
  }
  const x = Math.round(toX(position())) + 0.5;
  octx.strokeStyle = "#fff";
  octx.beginPath();
  octx.moveTo(x, 0);
  octx.lineTo(x, H);
  octx.stroke();
}

/* --- readouts ------------------------------------------------------------ */

const fmtHz = (f) => (f >= 1000 ? (f / 1000).toFixed(2).replace(/\.?0+$/, "") + " kHz" : f.toFixed(0) + " Hz");
const db = (v) => (v > 1e-7 ? (20 * Math.log10(v)).toFixed(1) : "-inf");
const fmtTime = (t) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
};

let statTick = 0;
// the count readout in the auto bar; refreshed with the stats, since the
// detection reruns every 12 frames and the count is the point of it
function drawTransientRate() {
  if (!S.auto) return;
  const n = transients.length;
  const perSec = transientSpan > 0 ? n / transientSpan : 0;
  const perBar = file.grid ? perSec * 4 * file.grid.ibi : null;
  $("#trate").innerHTML = `<i>${n}</i> in <i>${transientSpan.toFixed(2)}</i> s &nbsp; ` +
    `<i>${perSec.toFixed(1)}</i>/s` + (perBar ? ` &nbsp; <i>${perBar.toFixed(1)}</i>/bar` : "");
}

function drawStats() {
  if (statTick++ % 8) return;
  drawTransientRate();
  if (!ctx) { $("#stats").textContent = ""; return; }
  const crest = view.rms > 1e-7 ? 20 * Math.log10(view.peak / view.rms) : 0;
  $("#stats").innerHTML =
    `PEAK <i>${db(view.peak)}</i> &nbsp; RMS <i>${db(view.rms)}</i> &nbsp; CREST <i>${crest.toFixed(1)}</i>` +
    ` &nbsp; CENTROID <i>${stats.centroid.toFixed(0)}</i> Hz &nbsp; BAND <i>${stats.bandDb.toFixed(1)}</i> dB` +
    ` &nbsp; ${view.long ? "COL " + colHop : "FFT " + blockN}` +
    (S.auto ? ` &nbsp; TRANS <i>${transients.length}</i>` : "");

  if (source === "file" && file.buf) {
    const p = position();
    let bar = "";
    if (file.grid) {
      const g = file.grid;
      const beats = (p - g.anchor) / g.ibi;
      const b = Math.floor(beats / 4);
      const inBar = Math.floor(((beats % 4) + 4) % 4) + 1;
      bar = ` &nbsp; BAR <i>${b + 1}.${inBar}</i>`;
    }
    $("#time").innerHTML = `<i>${fmtTime(p)}</i> / ${fmtTime(file.duration)}${bar}`;
  } else {
    $("#time").textContent = "";
  }
}

/* --- frame --------------------------------------------------------------- */

function frame() {
  requestAnimationFrame(frame);
  let geo = null;
  if (ctx && source) {
    const W = Math.max(1, scope.width / dpr), H = Math.max(1, scope.height / dpr);
    const sr = source === "file" && file.sr ? file.sr : ctx.sampleRate;
    view.count = Math.max(16, Math.round((S.windowMs * sr) / 1000));
    view.long = view.count > SHORT_MAX;
    geo = viewGeometry(view.count);
    view.sr = geo.sr;
    if (S.auto && autoTick++ % 12 === 0) autoTune(geo);
    if (view.long) buildLongPoints(W, H, geo);
    else { analyseShort(view.count, geo); buildShortPoints(W, H, geo); }
    analyseSpectrum(geo);
    const target = view.peak > 1e-6 ? 0.92 / view.peak : 1;
    view.norm += (target - view.norm) * (target < view.norm ? 0.5 : 0.08);
  }
  drawScope(geo);
  drawSpectrum(geo);
  drawOverview(geo);
  drawStats();
  if (geo) updateLamps(geo);
}

/* --- band and window interaction ----------------------------------------- */

function setBand(lo, hi, manual) {
  if (manual) S.auto = false;            // the knob wins over the mode
  const nyq = (ctx ? (source === "file" && file.sr ? file.sr : ctx.sampleRate) : 44100) / 2;
  hi = clamp(hi, 10, nyq * 0.98);
  lo = clamp(lo, 5, hi / 1.02);
  if (lo === S.lo && hi === S.hi) return;
  S.lo = lo;
  S.hi = hi;
  bumpColumns();
  if (ctx) pushAuditionMask();
  syncUI();
}

function setWindow(ms) {
  S.windowMs = clamp(Math.round(ms), 1, MAX_WINDOW_MS);
  syncUI();
}

let drag = null;
spec.addEventListener("pointerdown", (e) => {
  const W = spec.width / dpr;
  const x = e.offsetX;
  const near0 = Math.abs(x - specGeom.x0) < 9;
  const near1 = Math.abs(x - specGeom.x1) < 9;
  if (near0 && (!near1 || x < specGeom.x0)) drag = { mode: "lo" };
  else if (near1) drag = { mode: "hi" };
  else if (x > specGeom.x0 && x < specGeom.x1) drag = { mode: "move", f: xToF(x, W), lo: S.lo, hi: S.hi };
  else drag = { mode: "new", f: xToF(x, W) };
  spec.setPointerCapture(e.pointerId);
  onBandDrag(e);
});
spec.addEventListener("pointermove", (e) => { if (drag) onBandDrag(e); });
spec.addEventListener("pointerup", () => { drag = null; });
spec.addEventListener("pointercancel", () => { drag = null; });

function onBandDrag(e) {
  const W = spec.width / dpr;
  const f = xToF(e.offsetX, W);
  if (drag.mode === "lo") setBand(f, S.hi, true);
  else if (drag.mode === "hi") setBand(S.lo, f, true);
  else if (drag.mode === "new") setBand(Math.min(drag.f, f), Math.max(drag.f, f), true);
  else {
    const r = f / drag.f;
    setBand(drag.lo * r, drag.hi * r, true);
  }
}

spec.addEventListener("wheel", (e) => {
  e.preventDefault();
  const k = Math.pow(2, (e.deltaY > 0 ? 1 : -1) * 0.08);
  setBand(S.lo / k, S.hi * k, true);
}, { passive: false });

scope.addEventListener("wheel", (e) => {
  e.preventDefault();
  setWindow(S.windowMs * (e.deltaY > 0 ? 1.12 : 0.89));
}, { passive: false });

let scrub = false;
over.addEventListener("pointerdown", (e) => {
  if (source !== "file" || !file.buf) return;
  scrub = true;
  over.setPointerCapture(e.pointerId);
  seek((e.offsetX / (over.width / dpr)) * file.duration);
});
over.addEventListener("pointermove", (e) => {
  if (scrub) seek((e.offsetX / (over.width / dpr)) * file.duration);
});
over.addEventListener("pointerup", () => { scrub = false; });
over.addEventListener("pointercancel", () => { scrub = false; });

/* --- UI ------------------------------------------------------------------ */

function syncUI() {
  const isFile = source === "file";
  $$("[data-src]").forEach((b) => b.classList.toggle("on", b.dataset.src === source));
  $$("[data-col]").forEach((b) => b.classList.toggle("on", b.dataset.col === S.color));
  $$("[data-trig]").forEach((b) => b.classList.toggle("on", b.dataset.trig === S.trig));
  $$("[data-loopbars]").forEach((b) => b.classList.toggle("on", +b.dataset.loopbars === T.loopBars));
  document.body.classList.toggle("has-file", isFile && !!file.buf);
  $("#play").textContent = T.playing ? "PAUSE" : "PLAY";
  $("#play").classList.toggle("on", T.playing);
  $("#loop").classList.toggle("on", T.loop);
  $("#monitor").classList.toggle("on", monitorOn());
  $("#solo").classList.toggle("on", S.solo);
  $("#solo").disabled = !bandNode;
  $("#solo").title = bandNode
    ? `hear only the selected band (${auditionPath} filter)` +
      (auditionError ? `; worklet unavailable: ${auditionError}` : "")
    : "starting";
  $("#auto").classList.toggle("on", S.auto);
  document.body.classList.toggle("auto", S.auto);
  $$("[data-focus]").forEach((b) => b.classList.toggle("on", b.dataset.focus === S.focus));
  $$("[data-method]").forEach((b) => b.classList.toggle("on", b.dataset.method === S.method));
  $("#tlamps").style.display = isFullMethod() ? "" : "none";
  $("#hold").classList.toggle("on", S.hold);
  $("#hold").disabled = isFullMethod();
  $("#hold").title = isFullMethod() ? "full spectrum methods never move the band" : "keep detecting, stop moving the band";
  $("#sens").value = S.sens;
  $("#sensv").textContent = S.sens.toFixed(2);
  drawTransientRate();
  $("#freeze").classList.toggle("on", S.frozen);
  $("#norm").classList.toggle("on", S.normalize);
  $("#envb").classList.toggle("on", S.envelope);
  $("#gridb").classList.toggle("on", S.grid);
  $("#beatsb").classList.toggle("on", S.beats);
  $("#fname").textContent = file.name || "drop an audio file";
  $("#status").textContent = file.status;
  $("#lo").value = Math.round(S.lo);
  $("#hi").value = Math.round(S.hi);
  $("#win").value = Math.round(msToSlider(S.windowMs));
  $("#winv").textContent = S.windowMs >= 1000 ? (S.windowMs / 1000).toFixed(2) + " s" : S.windowMs + " ms";
  $("#gain").value = S.gainDb;
  $("#gainv").textContent = S.gainDb;
  $("#lev").value = S.level;
  $("#rate").value = T.rate;
  $("#ratev").textContent = T.rate.toFixed(2) + "x";
  const g = file.grid;
  $("#bpm").innerHTML = g
    ? `BPM <i>${g.bpm.toFixed(2)}</i> &nbsp; GRID <i>${(g.support * 100).toFixed(0)}%</i> &nbsp; DEV <i>${g.devMs.toFixed(1)}</i> ms`
    : (isFile && file.buf ? "BPM <i>none</i>" : "");
}

// The window slider is logarithmic: 1 ms to 8 s in one throw.
const sliderToMs = (v) => Math.exp((v / 1000) * Math.log(MAX_WINDOW_MS));
const msToSlider = (ms) => (Math.log(ms) / Math.log(MAX_WINDOW_MS)) * 1000;

$$("[data-src]").forEach((b) => b.addEventListener("click", () => selectSource(b.dataset.src).catch(reportError)));
$$("[data-col]").forEach((b) => b.addEventListener("click", () => { S.color = b.dataset.col; syncUI(); }));
$$("[data-trig]").forEach((b) => b.addEventListener("click", () => {
  S.trig = b.dataset.trig;
  // the transient trigger has nothing to align to unless detection is running
  if (S.trig === "trans" && !S.auto) $("#auto").click();
  else syncUI();
}));
$$("[data-loopbars]").forEach((b) => b.addEventListener("click", () => {
  T.loopBars = +b.dataset.loopbars;
  if (T.loop) setLoop(true);
  syncUI();
}));
$$("[data-bars]").forEach((b) => b.addEventListener("click", () => {
  const bars = +b.dataset.bars;
  setWindow(file.grid ? bars * 4 * file.grid.ibi * 1000 : bars * 2000);
}));

$("#play").addEventListener("click", togglePlay);
$("#stop").addEventListener("click", () => { pause(); seek(0); });
$("#back").addEventListener("click", () => seek(position() - barLen()));
$("#fwd").addEventListener("click", () => seek(position() + barLen()));
$("#loop").addEventListener("click", () => setLoop(!T.loop));
$("#rate").addEventListener("input", (e) => setRate(+e.target.value));
$("#x2").addEventListener("click", () => scaleGrid(2));
$("#d2").addEventListener("click", () => scaleGrid(0.5));
$("#nudgeL").addEventListener("click", () => nudgeDownbeat(-1));
$("#nudgeR").addEventListener("click", () => nudgeDownbeat(1));
$("#monitor").addEventListener("click", () => setMonitor(!monitorOn()));
$("#solo").addEventListener("click", () => setSolo(!S.solo));
$$("[data-focus]").forEach((b) => b.addEventListener("click", () => {
  S.focus = b.dataset.focus;
  autoTick = 0;                     // retune on the next frame
  syncUI();
}));
$$("[data-method]").forEach((b) => b.addEventListener("click", () => {
  S.method = b.dataset.method;
  autoTick = 0;
  syncUI();
}));
$("#sens").addEventListener("input", (e) => { S.sens = +e.target.value; autoTick = 0; syncUI(); });
$("#hold").addEventListener("click", () => { S.hold = !S.hold; syncUI(); });
$("#auto").addEventListener("click", () => {
  S.auto = !S.auto;
  if (!S.auto) { transients = []; transientRanges = null; }
  else {
    autoTick = 0;
    S.normalize = true;      // a transient band is mostly silence, so scale to it
  }
  syncUI();
});
$("#freeze").addEventListener("click", () => setFrozen(!S.frozen));
$("#norm").addEventListener("click", () => { S.normalize = !S.normalize; syncUI(); });
$("#envb").addEventListener("click", () => { S.envelope = !S.envelope; syncUI(); });
$("#gridb").addEventListener("click", () => { S.grid = !S.grid; syncUI(); });
$("#beatsb").addEventListener("click", () => { S.beats = !S.beats; syncUI(); });
$("#lo").addEventListener("change", (e) => setBand(+e.target.value, S.hi, true));
$("#hi").addEventListener("change", (e) => setBand(S.lo, +e.target.value, true));
$("#win").addEventListener("input", (e) => setWindow(sliderToMs(+e.target.value)));
$("#gain").addEventListener("input", (e) => { S.gainDb = +e.target.value; syncUI(); });
$("#lev").addEventListener("input", (e) => { S.level = +e.target.value; });
$("#fileInput").addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]).catch(reportError); });
$("#fname").addEventListener("click", () => $("#fileInput").click());

addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); source === "file" ? togglePlay() : setFrozen(!S.frozen); }
  else if (e.key === "f") setFrozen(!S.frozen);
  else if (e.key === "ArrowLeft") seek(position() - barLen());
  else if (e.key === "ArrowRight") seek(position() + barLen());
  else if (e.key === "l") setLoop(!T.loop);
  else if (e.key === "s") setSolo(!S.solo);
  else if (e.key === "a") $("#auto").click();
});

addEventListener("dragover", (e) => { e.preventDefault(); document.body.classList.add("dragging"); });
addEventListener("dragleave", (e) => { if (e.relatedTarget === null) document.body.classList.remove("dragging"); });
addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f).catch(reportError);
});

function reportError(err) {
  console.error(err);
  file.status = String(err.message || err).slice(0, 70);
  syncUI();
}

// handy from the console; nothing in the app reads it
window.__scope = { S, T, file, view, auditionError: () => auditionError, transients: () => transients, autoTune: () => autoTune(viewGeometry(view.count)), runs: () => autoRuns, peek: () => ({ source, plen, colHop, colFFT, blockN, count: view.count, long: view.long, ringWrite: ring && ring.write, cap: capNode && capNode.constructor.name }) };

new ResizeObserver(resize).observe($("#scopeWrap"));
new ResizeObserver(resize).observe($("#specWrap"));
new ResizeObserver(resize).observe($("#overWrap"));
resize();
syncUI();
requestAnimationFrame(frame);
})();
