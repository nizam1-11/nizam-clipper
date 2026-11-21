"use strict";
const node_child_process = require("node:child_process");
const local = require("./local-uqjgyXoD.js");
let entry = null;
function setSpeechWorkerEntry(file) {
  entry = file;
}
function serveSpeechWorker() {
  const send = (r) => process.send?.(r);
  let pcm = null;
  const samplesOf = (p) => {
    if (pcm?.path !== p) pcm = { path: p, samples: local.readPcmF32(p) };
    return pcm.samples;
  };
  const quit = () => process.kill(process.pid, "SIGKILL");
  process.on("disconnect", quit);
  send({ type: "ready", id: 0 });
  process.on("message", (msg) => {
    if (msg.type === "close") {
      quit();
      return;
    }
    const id = msg.id;
    const log = (message) => send({ type: "log", id, message });
    const work = msg.type === "detect" ? samplesOf(msg.pcmPath).then((samples) => local.detectSpokenLanguage({ modelsDir: msg.modelsDir, model: msg.model, accelerator: msg.accelerator, samples, log })) : samplesOf(msg.pcmPath).then((samples) => local.transcribeLocal({
      pcmPath: msg.pcmPath,
      samples,
      modelsDir: msg.modelsDir,
      model: msg.model,
      accelerator: msg.accelerator,
      language: msg.language,
      duration: msg.duration,
      onProgress: (pct, message) => send({ type: "progress", id, pct, message }),
      log
    }));
    work.then((value) => send({ type: "result", id, value })).catch((err) => send({ type: "error", id, message: err?.message || String(err) }));
  });
}
class SpeechWorker {
  constructor(log, signal) {
    this.log = log;
    this.signal = signal;
    signal?.addEventListener("abort", () => this.kill(new Error("Cancelled")), { once: true });
  }
  log;
  signal;
  child = null;
  failedToStart = false;
  /** Whether the child got as far as running the engine code: before that, a failure is the split's, not the model's. */
  ready = false;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  start() {
    if (this.child) return this.child;
    if (this.failedToStart || !entry || process.env.CLIPIE_SPEECH_IN_ENGINE === "1") return null;
    let child;
    try {
      child = node_child_process.fork(entry, [], {
        // In the app this is Electron itself; ELECTRON_RUN_AS_NODE makes it plain Node (the same
        // way yt-dlp and the PO-token helper already run). Under plain Node it is ignored.
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        // Its output goes where the engine's does, so the main process's log filter still sees it.
        stdio: ["ignore", "inherit", "inherit", "ipc"],
        serialization: "advanced",
        // Passed through to spawn, which honours it; ForkOptions just does not declare it.
        ...{ windowsHide: true }
      });
    } catch (err) {
      this.failedToStart = true;
      this.log(`Could not start a separate process for the speech model (${err.message}); running it in the engine.`);
      return null;
    }
    this.child = child;
    this.ready = false;
    child.on("message", (r) => {
      if (r.type === "ready") {
        this.ready = true;
        return;
      }
      const p = this.pending.get(r.id);
      if (!p) return;
      if (r.type === "progress") p.onProgress?.(r.pct, r.message);
      else if (r.type === "log") p.log(r.message);
      else {
        this.pending.delete(r.id);
        if (r.type === "result") p.resolve(r.value);
        else p.reject(new Error(r.message));
      }
    });
    const notStarted = (why) => {
      this.failedToStart = true;
      this.log(`Could not start a separate process for the speech model (${why}); running it in the engine.`);
      return Object.assign(new Error(why), { notStarted: true });
    };
    child.on("error", (err) => this.kill(this.ready ? err : notStarted(err.message)));
    child.on("exit", (code, sig) => {
      if (this.child === child) this.child = null;
      if (!this.pending.size) return;
      if (this.signal?.aborted) this.kill(new Error("Cancelled"));
      else if (!this.ready) this.kill(notStarted(`it exited with ${sig ?? `code ${code}`} before starting`));
      else this.kill(new Error(`The speech model stopped unexpectedly (${sig ?? `code ${code}`}). If this keeps happening, choose a smaller speech model in Settings → Speech.`));
    });
    return child;
  }
  kill(err) {
    const child = this.child;
    this.child = null;
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    if (child && child.exitCode === null) {
      try {
        child.kill();
      } catch {
      }
    }
  }
  call(req, log, onProgress) {
    if (this.signal?.aborted) return Promise.reject(new Error("Cancelled"));
    const child = this.start();
    if (!child) return null;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress, log });
      child.send({ ...req, id });
    });
  }
  /** Which language is spoken, heard by `model` (see detectSpokenLanguage). */
  async detect(o) {
    const remote = this.call({ type: "detect", ...o }, this.log);
    if (remote) {
      try {
        return await remote;
      } catch (err) {
        if (!err.notStarted) throw err;
      }
    }
    return local.detectSpokenLanguage({ ...o, samples: await local.readPcmF32(o.pcmPath), log: this.log });
  }
  /** transcribeLocal, in the child. */
  async transcribe(o) {
    const { onProgress, ...rest } = o;
    const remote = this.call({ type: "transcribe", ...rest }, this.log, onProgress);
    if (remote) {
      try {
        return await remote;
      } catch (err) {
        if (!err.notStarted) throw err;
      }
    }
    return local.transcribeLocal({ ...o, log: this.log, signal: this.signal });
  }
  /** Let the child exit, which hands the model's memory back to the system. */
  close() {
    const child = this.child;
    this.child = null;
    if (child && child.connected) {
      try {
        child.send({ type: "close" });
      } catch {
      }
      setTimeout(() => {
        if (child.exitCode === null) try {
          child.kill();
        } catch {
        }
      }, 5e3).unref();
    }
  }
}
exports.SpeechWorker = SpeechWorker;
exports.serveSpeechWorker = serveSpeechWorker;
exports.setSpeechWorkerEntry = setSpeechWorkerEntry;
