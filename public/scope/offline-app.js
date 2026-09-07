/* Transients page: load a file, run Offline over all of it, show the onsets
   on an overview and a zoomable detail view, audition, export. Nothing here
   is real time: the analysis runs once per file and SENS only re-picks. */
(() => {
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const { INSTRUMENTS } = Offline;

const S = { sens: 0.65, win: 4, start: 0, engine: "cnn" };   // window seconds, view start seconds, detector

// both analyses are kept once a file is in, so the engine switch is instant
const file = { name: "", buf: null, mono: null, sr: 0, duration: 0, peak: 0, analysis: null, cnn: null, sflux: null, onsets: [] };
const over = { min: null, max: null, cols: 0 };  // overview columns, fixed count

let ctx = null;
const T = { playing: false, node: null, offset: 0, startedAt: 0 };

/* The CNN weights, fetched next to this script so the page works at any
   route. Null means the fetch failed (a file:// page, or offline) and the
   SuperFlux curve is used instead; the engine readout says which. */
const scriptUrl = document.currentScript.src;
let model = null;
const modelReady = Offline.loadModel(new URL("onsets-cnn.json", scriptUrl), new URL("onsets-cnn.bin", scriptUrl))
  .then((w) => { model = w; })
  .catch((err) => { console.warn("CNN weights not available, using SuperFlux:", err); S.engine = "sflux"; })
  .then(syncUI);

/* --- colours ------------------------------------------------------------- */

// the scope's spectral ramp, low to high, for the waveform
const PAL = [[0xcc, 0x33, 0x44], [0xff, 0x77, 0x33], [0x88, 0xcc, 0x44], [0x44, 0xaa, 0xdd], [0x88, 0x66, 0xff]];
function paletteAt(t) {
  const x = Math.min(1, Math.max(0, t)) * (PAL.length - 1);
  const i = Math.min(PAL.length - 2, Math.floor(x));
  const f = x - i;
  const a = PAL[i], b = PAL[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
// waveform colour for a frame hue and a level 0..1 (0 dark, 1 file peak):
// quiet reads neutral, loud carries the hue, as in the scope
function waveCss(hue, k) {
  const c = paletteAt(hue);
  const g = 0.3 + 0.7 * k, h = k * k;
  return `rgb(${((c[0] * h + 120 * (1 - h)) * g) | 0},${((c[1] * h + 120 * (1 - h)) * g) | 0},${((c[2] * h + 120 * (1 - h)) * g) | 0})`;
}
// one colour per instrument, in INSTRUMENTS order
const INST_HEX = { KICK: "#e8453c", SNARE: "#ff9a3c", CLAP: "#ffd43c", TOM: "#c98a5e", HAT: "#4fd1e8", OPEN: "#5a8cff", BASS: "#b06cff", TONAL: "#7ee06c", PERC: "#a0a8b0" };
const INST_RGB = INSTRUMENTS.map((n) => [1, 3, 5].map((i) => parseInt(INST_HEX[n].slice(i, i + 2), 16)));
const instCss = (i, alpha = 1) => `rgba(${INST_RGB[i][0]},${INST_RGB[i][1]},${INST_RGB[i][2]},${alpha})`;
const labelText = (o) => o.labels.map((l) => INSTRUMENTS[l]).join("+");

/* --- loading and analysis -------------------------------------------------- */

async function loadFile(f) {
  stop();
  file.name = f.name;
  $("#fname").textContent = f.name;
  $("#fname").classList.remove("dim");
  setStatus("decoding");
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  await modelReady;
  // decode at 44.1 kHz whatever the output device runs at: the model was
  // trained there, and an OfflineAudioContext resamples on decode
  const bytes = await f.arrayBuffer();
  const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes);
  file.buf = buf;
  file.sr = buf.sampleRate;
  file.duration = buf.duration;
  const mono = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels;
  }
  file.mono = mono;
  let peak = 0;
  for (let i = 0; i < mono.length; i++) { const v = Math.abs(mono[i]); if (v > peak) peak = v; }
  file.peak = peak;
  file.onsets = [];
  file.analysis = file.cnn = file.sflux = null;
  file.featureCache = new Map();
  document.body.classList.add("has-file");
  $("#finfo").innerHTML = `<i>${fmtTime(buf.duration)}</i> &nbsp; <i>${buf.sampleRate}</i> Hz`;
  buildOverview();
  S.start = 0;
  T.offset = 0;
  syncUI();
  draw();

  const t0 = performance.now();
  const progress = (label) => (p) => setStatus(`${label} <i>${(p * 100) | 0}</i>%`);
  file.sflux = await Offline.analyse(mono, file.sr, progress("superflux"));
  if (model) file.cnn = await Offline.analyseCNN(mono, file.sr, model, progress("cnn"), file.sflux);
  setEngine(S.engine);
  setStatus(`analysed in <i>${((performance.now() - t0) / 1000).toFixed(1)}</i> s`);
}

// which detection curve the picker reads; falls back when the CNN is absent
function setEngine(engine) {
  S.engine = engine === "cnn" && (file.cnn || !file.sflux) && model ? "cnn" : "sflux";
  file.analysis = S.engine === "cnn" ? file.cnn : file.sflux;
  syncUI();
  repick();
}

// pick and refine at the current SENS; cheap, so it runs on every slider move
function repick() {
  if (!file.analysis) return;
  file.onsets = Offline.classify(file.mono, file.sr, Offline.refine(file.mono, file.sr, Offline.pick(file.analysis, S.sens), file.analysis), file.featureCache);
  const counts = new Array(INSTRUMENTS.length).fill(0);
  for (const o of file.onsets) for (const l of o.labels) counts[l]++;
  const n = file.onsets.length;
  const ioi = [];
  for (let i = 1; i < n; i++) ioi.push(file.onsets[i].t - file.onsets[i - 1].t);
  ioi.sort((a, b) => a - b);
  const med = ioi.length ? ioi[ioi.length >> 1] : 0;
  $("#counts").innerHTML =
    `<i>${n}</i> onsets &nbsp; <i>${(n / Math.max(1e-9, file.duration)).toFixed(2)}</i>/s &nbsp; median gap <i>${(med * 1000).toFixed(0)}</i> ms &nbsp; ` +
    INSTRUMENTS.map((name, i) => (counts[i] ? `<span style="color:${instCss(i)}">${name}</span> <i>${counts[i]}</i>` : "")).filter(Boolean).join(" ");
  syncUI();
  draw();
}

function setStatus(html) { $("#status").innerHTML = html; }

/* --- overview columns ------------------------------------------------------- */

const OVER_COLS = 4000;
function buildOverview() {
  const { mono } = file;
  over.cols = OVER_COLS;
  over.min = new Float32Array(OVER_COLS);
  over.max = new Float32Array(OVER_COLS);
  const per = mono.length / OVER_COLS;
  for (let c = 0; c < OVER_COLS; c++) {
    let lo = 0, hi = 0;
    const a = Math.floor(c * per), b = Math.min(mono.length, Math.floor((c + 1) * per));
    for (let i = a; i < b; i++) { const v = mono[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    over.min[c] = lo; over.max[c] = hi;
  }
}

/* --- playback ---------------------------------------------------------------- */

function position() {
  return T.playing ? Math.min(file.duration, T.offset + (ctx.currentTime - T.startedAt)) : T.offset;
}

function play(from = T.offset) {
  if (!file.buf) return;
  stop();
  if (ctx.state === "suspended") ctx.resume();
  const node = ctx.createBufferSource();
  node.buffer = file.buf;
  node.connect(ctx.destination);
  node.start(0, Math.max(0, from));
  node.onended = () => { if (T.node === node) { T.offset = position(); T.playing = false; T.node = null; syncUI(); } };
  T.node = node;
  T.offset = from;
  T.startedAt = ctx.currentTime;
  T.playing = true;
  syncUI();
  tickPlay();
}

function stop() {
  if (T.node) { const n = T.node; T.node = null; T.offset = position(); T.playing = false; try { n.stop(); } catch (e) { /* already ended */ } }
  syncUI();
}

// redraw while playing, following the playhead by the page
function tickPlay() {
  if (!T.playing) return;
  const p = position();
  if (p < S.start || p > S.start + S.win) S.start = Math.min(Math.max(0, p - 0.1 * S.win), Math.max(0, file.duration - S.win));
  draw();
  requestAnimationFrame(tickPlay);
}

/* --- drawing ------------------------------------------------------------------ */

const overC = $("#over"), detC = $("#detail");
const octx = overC.getContext("2d"), dctx = detC.getContext("2d");
let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  for (const c of [overC, detC]) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
  }
  draw();
}

function draw() {
  drawOverview();
  drawDetail();
  updateLamps();
  $("#time").innerHTML = file.buf ? `<i>${fmtTime(position())}</i>` : "";
}

/* Instrument lamps: each lights in its colour when an onset carrying that
   label sits within the last quarter second before the playhead, full at the
   hit and fading from there. Driven by the redraw, so they flash with the
   music during playback and hold still when paused; DOM writes only when a
   lamp's level changes. */
const LAMP_DECAY = 0.25;
const lampEls = INSTRUMENTS.map((name) => {
  const el = document.createElement("span");
  el.textContent = name;
  $("#lamps").appendChild(el);
  return el;
});
const lampLevel = new Array(INSTRUMENTS.length).fill(-1);
function updateLamps() {
  const level = new Array(INSTRUMENTS.length).fill(0);
  if (file.onsets.length) {
    const p = position();
    // walk back from the playhead through the onsets inside the decay window
    let i = file.onsets.length - 1;
    let lo = 0, hi = i;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (file.onsets[m].t <= p) lo = m; else hi = m - 1; }
    for (i = lo; i >= 0 && p - file.onsets[i].t <= LAMP_DECAY; i--) {
      const o = file.onsets[i];
      if (o.t > p) continue;
      const v = 1 - (p - o.t) / LAMP_DECAY;
      for (const l of o.labels) if (v > level[l]) level[l] = v;
    }
  }
  for (let l = 0; l < lampEls.length; l++) {
    const q = Math.round(level[l] * 12) / 12;
    if (q === lampLevel[l]) continue;
    lampLevel[l] = q;
    lampEls[l].style.background = q > 0 ? instCss(l, 0.15 + 0.85 * q) : "transparent";
    lampEls[l].style.color = q > 0.5 ? "#000" : q > 0 ? "#fff" : "";
    lampEls[l].style.borderColor = q > 0 ? instCss(l, 1) : "";
  }
}

function drawOverview() {
  const W = overC.width / dpr, H = overC.height / dpr;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, W, H);
  if (!file.buf) return;
  const mid = H * 0.58, amp = H * 0.38;
  const an = file.analysis;
  for (let x = 0; x < W; x++) {
    const c0 = Math.floor((x / W) * over.cols), c1 = Math.max(c0 + 1, Math.floor(((x + 1) / W) * over.cols));
    let lo = 0, hi = 0;
    for (let c = c0; c < c1; c++) { if (over.min[c] < lo) lo = over.min[c]; if (over.max[c] > hi) hi = over.max[c]; }
    octx.fillStyle = an ? waveCss(hueAt(an, (x / W) * file.duration, ((x + 1) / W) * file.duration), levelK(Math.max(hi, -lo))) : "#3a4048";
    octx.fillRect(x, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
  }
  // onsets as ticks along the top, in their instrument colour
  for (const o of file.onsets) {
    octx.fillStyle = instCss(o.inst, 0.9);
    octx.fillRect(Math.round((o.t / file.duration) * W), 0, 1, 10);
  }
  // the detail window
  const x0 = (S.start / file.duration) * W, x1 = ((S.start + S.win) / file.duration) * W;
  octx.strokeStyle = "rgba(255,255,255,.7)";
  octx.strokeRect(Math.round(x0) + 0.5, 0.5, Math.max(1, Math.round(x1 - x0)), H - 1);
  // playhead
  octx.fillStyle = "#fff";
  octx.fillRect(Math.round((position() / file.duration) * W), 0, 1, H);
}

function drawDetail() {
  const W = detC.width / dpr, H = detC.height / dpr;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.clearRect(0, 0, W, H);
  if (!file.buf) return;
  const { mono, sr } = file;
  const s0 = S.start * sr, per = (S.win * sr) / W;
  const mid = H * 0.55, amp = H * 0.42;

  // time ticks
  const step = niceStep(S.win / 8);
  dctx.fillStyle = "#1b1e24";
  dctx.font = "10px ui-monospace, Menlo, monospace";
  for (let t = Math.ceil(S.start / step) * step; t <= S.start + S.win; t += step) {
    const x = Math.round(((t - S.start) / S.win) * W);
    dctx.fillRect(x, 0, 1, H);
    dctx.fillStyle = "#6d757f";
    dctx.fillText(fmtTime(t), x + 3, H - 4);
    dctx.fillStyle = "#1b1e24";
  }

  // waveform, min/max per column, coloured by the frame centroid and level
  const an = file.analysis;
  for (let x = 0; x < W; x++) {
    const a = Math.max(0, Math.floor(s0 + x * per)), b = Math.min(mono.length, Math.max(a + 1, Math.floor(s0 + (x + 1) * per)));
    if (a >= mono.length) break;
    let lo = 0, hi = 0;
    for (let i = a; i < b; i++) { const v = mono[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    dctx.fillStyle = an ? waveCss(hueAt(an, a / sr, b / sr), levelK(Math.max(hi, -lo))) : "#9aa3ad";
    dctx.fillRect(x, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
  }

  // onsets: a line in the instrument colour, all its labels at the top
  dctx.font = "10px ui-monospace, Menlo, monospace";
  for (const o of file.onsets) {
    if (o.t < S.start || o.t > S.start + S.win) continue;
    const x = Math.round(((o.t - S.start) / S.win) * W);
    dctx.fillStyle = instCss(o.inst, 0.85);
    dctx.fillRect(x, 0, 1, H);
    dctx.fillText(labelText(o), x + 3, 11);
  }

  // playhead
  const p = position();
  if (p >= S.start && p <= S.start + S.win) {
    dctx.fillStyle = "#fff";
    dctx.fillRect(Math.round(((p - S.start) / S.win) * W), 0, 1, H);
  }
}

// mean hue of the analysis frames between two times, level weighted so a
// column that spans a hit and its gap takes the hit's colour
function hueAt(an, t0, t1) {
  const f0 = Math.max(0, Math.floor(t0 * an.fps)), f1 = Math.min(an.frames - 1, Math.max(f0, Math.floor(t1 * an.fps)));
  let hs = 0, ws = 0;
  for (let f = f0; f <= f1; f++) { const w = an.level[f] + 1e-6; hs += an.hue[f] * w; ws += w; }
  return ws > 0 ? hs / ws : 0;
}
// 0..1 brightness from a column's peak, over 54 dB under the file's peak
const levelK = (peak) => Math.min(1, Math.max(0, (20 * Math.log10(peak / (file.peak || 1) + 1e-9) + 54) / 54));

const niceStep = (s) => { const p = Math.pow(10, Math.floor(Math.log10(s))); const m = s / p; return (m < 2 ? 1 : m < 5 ? 2 : 5) * p; };

function fmtTime(t) {
  const ms = Math.round(t * 1000);
  const m = Math.floor(ms / 60000), s = (ms - m * 60000) / 1000;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(3)}`;
}

/* --- view ---------------------------------------------------------------------- */

const WIN_MIN = 0.05, WIN_MAX = 60;
const sliderToWin = (v) => WIN_MIN * Math.pow(WIN_MAX / WIN_MIN, v / 1000);
const winToSlider = (w) => (1000 * Math.log(w / WIN_MIN)) / Math.log(WIN_MAX / WIN_MIN);

function setWindow(w, anchorFrac = 0.5) {
  const anchorT = S.start + S.win * anchorFrac;
  S.win = Math.min(Math.max(WIN_MIN, w), Math.max(WIN_MIN, file.duration || WIN_MAX));
  S.start = anchorT - S.win * anchorFrac;
  clampView();
  syncUI();
  draw();
}

function clampView() {
  S.start = Math.min(Math.max(0, S.start), Math.max(0, (file.duration || 0) - S.win));
}

function nearestOnset(t, dir) {
  const os = file.onsets;
  if (!os.length) return null;
  if (dir > 0) { for (const o of os) if (o.t > t + 1e-3) return o; return null; }
  for (let i = os.length - 1; i >= 0; i--) if (os[i].t < t - 1e-3) return os[i];
  return null;
}

function seek(t) {
  T.offset = Math.min(Math.max(0, t), file.duration);
  if (T.playing) play(T.offset);
  if (T.offset < S.start || T.offset > S.start + S.win) { S.start = T.offset - S.win * 0.3; clampView(); }
  draw();
}

/* --- export --------------------------------------------------------------------- */

function exportJson() {
  if (!file.buf) return;
  const out = {
    file: file.name, sampleRate: file.sr, duration: file.duration, sens: S.sens,
    instruments: INSTRUMENTS,
    onsets: file.onsets.map((o) => ({ t: +o.t.toFixed(5), instrument: INSTRUMENTS[o.inst], labels: o.labels.map((l) => INSTRUMENTS[l]), strength: +o.strength.toFixed(3) })),
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
  a.download = file.name.replace(/\.[^.]+$/, "") + ".transients.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* --- ui ------------------------------------------------------------------------- */

function syncUI() {
  $("#sens").value = S.sens;
  $("#sensv").textContent = S.sens.toFixed(2);
  $("#win").value = winToSlider(S.win);
  $("#winv").textContent = S.win >= 10 ? `${S.win.toFixed(0)} s` : S.win >= 1 ? `${S.win.toFixed(1)} s` : `${(S.win * 1000).toFixed(0)} ms`;
  $$("[data-engine]").forEach((b) => {
    b.classList.toggle("on", b.dataset.engine === S.engine);
    b.disabled = b.dataset.engine === "cnn" && !model;
    b.title = b.dataset.engine === "cnn" ? (model ? "madmom's CNN onset detector" : "model not loaded") : "SuperFlux on a log filterbank";
  });
  $("#play").textContent = T.playing ? "STOP" : "PLAY";
  $("#play").classList.toggle("on", T.playing);
  $("#play").disabled = !file.buf;
  $("#export").disabled = !file.onsets.length;
}

$("#open").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); });
$("#sens").addEventListener("input", (e) => { S.sens = +e.target.value; syncUI(); repick(); });
$("#win").addEventListener("input", (e) => setWindow(sliderToWin(+e.target.value)));
$("#play").addEventListener("click", () => (T.playing ? stop() : play()));
$$("[data-engine]").forEach((b) => b.addEventListener("click", () => setEngine(b.dataset.engine)));
$("#export").addEventListener("click", exportJson);

// detail: wheel zooms around the cursor, drag pans, click seeks
let drag = null;
detC.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (!file.buf) return;
  const frac = e.offsetX / detC.getBoundingClientRect().width;
  setWindow(S.win * Math.pow(1.15, Math.sign(e.deltaY)), frac);
}, { passive: false });
detC.addEventListener("pointerdown", (e) => {
  if (!file.buf) return;
  drag = { x: e.clientX, start: S.start, moved: false };
  detC.setPointerCapture(e.pointerId);
});
detC.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 3) drag.moved = true;
  if (drag.moved) { S.start = drag.start - (dx / detC.getBoundingClientRect().width) * S.win; clampView(); draw(); }
});
detC.addEventListener("pointerup", (e) => {
  if (!drag) return;
  if (!drag.moved) seek(S.start + (e.offsetX / detC.getBoundingClientRect().width) * S.win);
  drag = null;
});
// overview: click or drag centres the view there
let overDrag = false;
const overSeek = (e) => {
  const t = (e.offsetX / overC.getBoundingClientRect().width) * file.duration;
  S.start = t - S.win / 2;
  clampView();
  draw();
};
overC.addEventListener("pointerdown", (e) => { if (!file.buf) return; overDrag = true; overC.setPointerCapture(e.pointerId); overSeek(e); });
overC.addEventListener("pointermove", (e) => { if (overDrag) overSeek(e); });
overC.addEventListener("pointerup", () => { overDrag = false; });

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
  if (e.code === "Space") { e.preventDefault(); if (file.buf) (T.playing ? stop() : play()); }
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const o = nearestOnset(position(), e.key === "ArrowRight" ? 1 : -1);
    if (o) seek(o.t);
  }
});

// drag and drop
window.addEventListener("dragover", (e) => { e.preventDefault(); document.body.classList.add("dragging"); });
window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
window.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});

// ?url= loads a file by URL, for scripting and remote use
const url = new URLSearchParams(location.search).get("url");
if (url) {
  fetch(url).then((r) => r.blob()).then((b) => loadFile(new File([b], url.split("/").pop() || "audio")))
    .catch((err) => setStatus(`could not load: ${err.message}`));
}

window.addEventListener("resize", resize);
resize();
syncUI();
window.__transients = { S, file, T, repick };
})();
