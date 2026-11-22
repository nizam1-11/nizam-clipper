"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("node:path");
const node_url = require("node:url");
const node_fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const hardware = require("./chunks/hardware-BuqFOQez.js");
const local = require("./chunks/local-uqjgyXoD.js");
const node_child_process = require("node:child_process");
const os = require("node:os");
const net = require("node:net");
const node_events = require("node:events");
const electronUpdater = require("electron-updater");
const node_util = require("node:util");
function unpacked(p) {
  return p.replace("app.asar", "app.asar.unpacked");
}
function exists$1(p) {
  try {
    node_fs.accessSync(p, node_fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function resolveBinaries() {
  const envF = process.env.CLIPIE_FFMPEG;
  const envP = process.env.CLIPIE_FFPROBE;
  const ffmpegStatic = require("ffmpeg-static");
  const ffprobeStatic = require("ffprobe-static");
  let ffmpeg = envF || (ffmpegStatic ? unpacked(ffmpegStatic) : "");
  let ffprobe = envP || unpacked(ffprobeStatic.path);
  if (!ffmpeg || !exists$1(ffmpeg)) {
    ffmpeg = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  }
  if (!exists$1(ffprobe)) ffprobe = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  return { ffmpeg, ffprobe };
}
function enginePath() {
  return path.join(__dirname, "engine.js");
}
function defaultModelsDir() {
  return path.join(electron.app.getPath("userData"), "models");
}
let chosenModelsDir = null;
function setModelsDir(dir) {
  chosenModelsDir = dir && dir.trim() ? dir : null;
}
function modelsDir() {
  return chosenModelsDir ?? defaultModelsDir();
}
function fontsDir() {
  return electron.app.isPackaged ? path.join(process.resourcesPath, "fonts") : path.resolve(__dirname, "../../resources/fonts");
}
function uiFontsDir() {
  return electron.app.isPackaged ? path.join(process.resourcesPath, "ui-fonts") : path.resolve(__dirname, "../../resources/ui-fonts");
}
const DEFAULT_APPEARANCE = { theme: "dark", accent: "coral" };
const ACCENTS = [
  { id: "coral", label: "Coral", a: "#ff6a3d", b: "#ffb648" },
  { id: "violet", label: "Violet", a: "#8a6bff", b: "#c084fc" },
  { id: "teal", label: "Teal", a: "#2dd4bf", b: "#7dd3fc" },
  { id: "pink", label: "Pink", a: "#ff4fa3", b: "#ff8fab" },
  { id: "sky", label: "Sky", a: "#38bdf8", b: "#818cf8" },
  { id: "lime", label: "Lime", a: "#a3e635", b: "#facc15" }
];
const isThemeMode = (v) => v === "system" || v === "dark" || v === "light";
const isAccent = (v) => ACCENTS.some((a) => a.id === v);
const WINDOW_COLORS = {
  dark: { background: "#0a0a10", bar: "#12121b", symbol: "#c9c6d8" },
  light: { background: "#f6f5fa", bar: "#ffffff", symbol: "#3a3650" }
};
const APPEARANCE_ARG = "--clipie-appearance=";
function appearanceArg(a) {
  return `${APPEARANCE_ARG}${a.theme}:${a.accent}`;
}
const BUNDLED_OPENROUTER_KEY = "";
let cache$2 = null;
function file$2() {
  return path.join(electron.app.getPath("userData"), "settings.json");
}
function defaultOutputDir() {
  for (const name of ["videos", "documents", "home"]) {
    try {
      const dir = electron.app.getPath(name);
      if (dir) return path.join(dir, "SNU Clipper");
    } catch {
    }
  }
  return path.join(electron.app.getPath("userData"), "SNU Clipper");
}
function providerForPlan(plan) {
  return plan === "paid" ? "openai" : "local";
}
function allowedPlan(_plan) {
  return "free";
}
async function load() {
  if (cache$2) return cache$2;
  const base = {
    plan: "free",
    acceleration: "auto",
    writingModel: local.WRITING_MODEL_AUTO,
    transcription: "local",
    whisperModel: "base",
    outputDir: defaultOutputDir(),
    modelsDir: defaultModelsDir(),
    welcomeSeen: false,
    desktopShortcutCreated: false,
    defaults: { ...local.DEFAULT_JOB_DEFAULTS }
  };
  try {
    const raw = JSON.parse(await node_fs.promises.readFile(file$2(), "utf8"));
    const merged = {
      plan: allowedPlan(raw.plan === "paid" || raw.plan === "free" ? raw.plan : raw.transcription === "openai" ? "paid" : "free"),
      acceleration: raw.acceleration === "cpu" || raw.acceleration === "gpu" ? raw.acceleration : "auto",
      accelerationTest: raw.accelerationTest,
      speechRates: raw.speechRates && typeof raw.speechRates === "object" ? raw.speechRates : void 0,
      writingModel: typeof raw.writingModel === "string" && raw.writingModel ? raw.writingModel : base.writingModel,
      openrouterKeyEnc: raw.openrouterKeyEnc,
      writingProvider: hardware.LLM_PROVIDERS.some((p) => p.id === raw.writingProvider) ? raw.writingProvider : void 0,
      providerKeysEnc: raw.providerKeysEnc && typeof raw.providerKeysEnc === "object" ? raw.providerKeysEnc : void 0,
      providerModels: raw.providerModels && typeof raw.providerModels === "object" ? raw.providerModels : void 0,
      customBaseUrl: typeof raw.customBaseUrl === "string" && raw.customBaseUrl ? raw.customBaseUrl : void 0,
      whisperAuto: raw.whisperAuto === true,
      writingFailover: raw.writingFailover !== false,
      openaiKeyEnc: raw.openaiKeyEnc,
      cloudSpeech: raw.cloudSpeech === "groq" || raw.cloudSpeech === "clipie" ? raw.cloudSpeech : void 0,
      groqSpeechModel: raw.groqSpeechModel === "whisper-large-v3-turbo" ? "whisper-large-v3-turbo" : void 0,
      transcription: "local",
      whisperModel: raw.whisperModel ?? base.whisperModel,
      outputDir: raw.outputDir ?? base.outputDir,
      clipsDir: typeof raw.clipsDir === "string" && raw.clipsDir ? raw.clipsDir : void 0,
      keepDownloads: raw.keepDownloads === true,
      youtubeCookies: hardware.isCookieBrowser(raw.youtubeCookies) ? raw.youtubeCookies : void 0,
      modelsDir: raw.modelsDir || base.modelsDir,
      theme: isThemeMode(raw.theme) ? raw.theme : void 0,
      accent: isAccent(raw.accent) ? raw.accent : void 0,
      welcomeSeen: raw.welcomeSeen === true,
      desktopShortcutCreated: raw.desktopShortcutCreated === true,
      defaults: { ...base.defaults, ...raw.defaults ?? {} }
    };
    merged.transcription = providerForPlan(merged.plan);
    cache$2 = merged;
  } catch {
    cache$2 = base;
  }
  setModelsDir(cache$2.modelsDir);
  return cache$2;
}
async function save$1(s) {
  cache$2 = s;
  setModelsDir(s.modelsDir);
  await node_fs.promises.mkdir(path.dirname(file$2()), { recursive: true });
  await node_fs.promises.writeFile(file$2(), JSON.stringify(s, null, 2), "utf8");
}
function encrypt$1(value) {
  if (electron.safeStorage.isEncryptionAvailable()) return electron.safeStorage.encryptString(value).toString("base64");
  return "plain:" + Buffer.from(value, "utf8").toString("base64");
}
function decrypt$1(enc) {
  if (!enc) return void 0;
  try {
    if (enc.startsWith("plain:")) return Buffer.from(enc.slice(6), "base64").toString("utf8");
    if (!electron.safeStorage.isEncryptionAvailable()) return void 0;
    return electron.safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch {
    return void 0;
  }
}
function writingKey(s) {
  const provider = s.writingProvider ?? "openrouter";
  if (provider !== "openrouter") {
    const key = decrypt$1(s.providerKeysEnc?.[provider]);
    return key ? { key, source: "user" } : { source: "none" };
  }
  const own = decrypt$1(s.openrouterKeyEnc);
  if (own) return { key: own, source: "user" };
  const fallback = process.env.OPENROUTER_API_KEY || BUNDLED_OPENROUTER_KEY;
  if (fallback) return { key: fallback, source: "bundled" };
  return { source: "none" };
}
function effectiveAcceleration(s) {
  if (s.acceleration === "cpu") return "cpu";
  if (s.acceleration === "gpu") return "gpu";
  return s.accelerationTest && s.accelerationTest.backend !== "cpu" ? "gpu" : "cpu";
}
async function getSettings() {
  const s = await load();
  const wk = writingKey(s);
  const hardware$1 = hardware.detectHardware();
  return {
    plan: s.plan,
    acceleration: { mode: s.acceleration, effective: effectiveAcceleration(s), test: s.accelerationTest },
    hardware: hardware$1,
    writingModel: s.writingModel,
    hasWritingKey: Boolean(wk.key),
    writingKeySource: wk.source,
    writingProvider: s.writingProvider ?? "openrouter",
    providerModels: { ...s.providerModels ?? {} },
    providersWithKey: [
      ...decrypt$1(s.openrouterKeyEnc) ? ["openrouter"] : [],
      ...Object.keys(s.providerKeysEnc ?? {}).filter((id) => decrypt$1(s.providerKeysEnc?.[id]))
    ],
    customBaseUrl: s.customBaseUrl,
    whisperAuto: Boolean(s.whisperAuto),
    writingFailover: s.writingFailover !== false,
    hasOpenAIKey: Boolean(decrypt$1(s.openaiKeyEnc)),
    cloudSpeech: s.cloudSpeech ?? "off",
    groqSpeechModel: s.groqSpeechModel ?? "whisper-large-v3",
    transcription: s.transcription,
    whisperModel: s.whisperModel,
    outputDir: s.outputDir,
    clipsDir: s.clipsDir,
    keepDownloads: Boolean(s.keepDownloads),
    ...s.youtubeCookies ? { youtubeCookies: s.youtubeCookies } : {},
    modelsDir: s.modelsDir ?? defaultModelsDir(),
    theme: s.theme ?? DEFAULT_APPEARANCE.theme,
    accent: s.accent ?? DEFAULT_APPEARANCE.accent,
    welcomeSeen: s.welcomeSeen === true,
    desktopShortcutCreated: s.desktopShortcutCreated === true,
    defaults: s.defaults
  };
}
async function providerSecrets(id) {
  const s = await load();
  const provider = hardware.findProvider(id);
  const baseUrl = id === "custom" ? hardware.normalizeBaseUrl(s.customBaseUrl ?? "") : provider.baseUrl;
  const key = id === "openrouter" ? decrypt$1(s.openrouterKeyEnc) : decrypt$1(s.providerKeysEnc?.[id]);
  return { baseUrl, key };
}
async function getSecrets() {
  const s = await load();
  const provider = hardware.findProvider(s.writingProvider);
  const baseUrl = provider.id === "custom" ? hardware.normalizeBaseUrl(s.customBaseUrl ?? "") : provider.baseUrl;
  const llmFallbacks = [];
  if (s.writingFailover !== false) {
    for (const p of hardware.LLM_PROVIDERS) {
      if (p.id === provider.id) continue;
      const url = p.id === "custom" ? hardware.normalizeBaseUrl(s.customBaseUrl ?? "") : p.baseUrl;
      const key = p.id === "openrouter" ? writingKey({ ...s, writingProvider: "openrouter" }).key : decrypt$1(s.providerKeysEnc?.[p.id]);
      if (!url || !key) continue;
      llmFallbacks.push({ llm: { provider: p.id, baseUrl: url }, key, model: p.id === "openrouter" ? s.writingModel : s.providerModels?.[p.id] || p.defaultModel });
    }
  }
  return {
    ...llmFallbacks.length ? { llmFallbacks } : {},
    llm: { provider: provider.id, baseUrl },
    writingModel: provider.id === "openrouter" ? s.writingModel : s.providerModels?.[provider.id] || provider.defaultModel,
    // A custom service with no address has nowhere to send the key: write with the built-in finder.
    openrouterKey: provider.id === "custom" && !baseUrl ? void 0 : writingKey(s).key,
    openaiKey: decrypt$1(s.openaiKeyEnc) || process.env.OPENAI_API_KEY || void 0,
    groqKey: decrypt$1(s.providerKeysEnc?.groq) || process.env.GROQ_API_KEY || void 0
  };
}
async function updateSettings(u) {
  const s = { ...await load() };
  if (u.plan) {
    s.plan = allowedPlan(u.plan);
    s.transcription = providerForPlan(s.plan);
  } else if (u.transcription) {
    s.plan = allowedPlan(u.transcription === "openai" ? "paid" : "free");
    s.transcription = providerForPlan(s.plan);
  }
  if (u.acceleration) s.acceleration = u.acceleration;
  if (u.writingModel) s.writingModel = u.writingModel;
  if (u.openrouterKey !== void 0) s.openrouterKeyEnc = u.openrouterKey ? encrypt$1(u.openrouterKey.trim()) : void 0;
  if (u.openaiKey !== void 0) s.openaiKeyEnc = u.openaiKey ? encrypt$1(u.openaiKey.trim()) : void 0;
  if (u.writingProvider && hardware.LLM_PROVIDERS.some((p) => p.id === u.writingProvider)) s.writingProvider = u.writingProvider;
  if (u.providerKey) {
    if (u.providerKey.provider === "openrouter") s.openrouterKeyEnc = u.providerKey.key ? encrypt$1(u.providerKey.key.trim()) : void 0;
    else {
      const keys = { ...s.providerKeysEnc ?? {} };
      if (u.providerKey.key) keys[u.providerKey.provider] = encrypt$1(u.providerKey.key.trim());
      else delete keys[u.providerKey.provider];
      s.providerKeysEnc = keys;
    }
  }
  if (u.providerModel) {
    if (u.providerModel.provider === "openrouter") s.writingModel = u.providerModel.model || local.WRITING_MODEL_AUTO;
    else s.providerModels = { ...s.providerModels ?? {}, [u.providerModel.provider]: u.providerModel.model.trim() };
  }
  if (u.customBaseUrl !== void 0) s.customBaseUrl = hardware.normalizeBaseUrl(u.customBaseUrl) || void 0;
  if (u.whisperAuto !== void 0) s.whisperAuto = u.whisperAuto;
  if (u.cloudSpeech !== void 0) s.cloudSpeech = u.cloudSpeech === "groq" || u.cloudSpeech === "clipie" ? u.cloudSpeech : void 0;
  if (u.groqSpeechModel !== void 0) s.groqSpeechModel = u.groqSpeechModel === "whisper-large-v3-turbo" ? u.groqSpeechModel : void 0;
  if (u.writingFailover !== void 0) s.writingFailover = u.writingFailover;
  if (u.whisperModel) s.whisperModel = u.whisperModel;
  if (u.outputDir) s.outputDir = u.outputDir;
  if (u.clipsDir !== void 0) s.clipsDir = u.clipsDir || void 0;
  if (u.keepDownloads !== void 0) s.keepDownloads = u.keepDownloads;
  if (u.youtubeCookies !== void 0) s.youtubeCookies = hardware.isCookieBrowser(u.youtubeCookies) ? u.youtubeCookies : void 0;
  if (u.modelsDir) s.modelsDir = u.modelsDir;
  if (isThemeMode(u.theme)) s.theme = u.theme;
  if (isAccent(u.accent)) s.accent = u.accent;
  if (u.defaults) s.defaults = { ...s.defaults, ...u.defaults };
  if (u.welcomeSeen !== void 0) s.welcomeSeen = Boolean(u.welcomeSeen);
  await save$1(s);
  return getSettings();
}
async function getAppearance() {
  const s = await load();
  return { theme: s.theme ?? DEFAULT_APPEARANCE.theme, accent: s.accent ?? DEFAULT_APPEARANCE.accent };
}
async function getSpeechRates() {
  return { ...(await load()).speechRates ?? {} };
}
async function saveSpeechRate(key, rate) {
  if (!(rate > 0) || !Number.isFinite(rate)) return;
  const s = { ...await load() };
  const before = s.speechRates?.[key];
  s.speechRates = { ...s.speechRates ?? {}, [key]: Math.round((before ? (before + rate) / 2 : rate) * 1e3) / 1e3 };
  await save$1(s);
}
async function saveAccelerationTest(test) {
  const s = { ...await load() };
  s.accelerationTest = test;
  await save$1(s);
  return getSettings();
}
async function resolveAccelerator() {
  const s = await load();
  const effective = effectiveAcceleration(s);
  if (effective === "cpu") return "cpu";
  return s.accelerationTest?.gpuBackend ?? hardware.detectHardware().gpuBackend ?? "cpu";
}
const TIMEOUT_MS = 5 * 6e4;
let pending = null;
const b64url$1 = (b) => b.toString("base64url");
async function connectOpenRouter() {
  pending?.abort();
  const verifier = b64url$1(crypto.randomBytes(32));
  const challenge = b64url$1(crypto.createHash("sha256").update(verifier).digest());
  const state2 = b64url$1(crypto.randomBytes(16));
  const code = await new Promise((resolve, reject) => {
    const servers = [];
    const handle = (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/openrouter") {
        res.writeHead(404).end();
        return;
      }
      const got = url.searchParams.get("code");
      const ok = Boolean(got) && url.searchParams.get("state") === state2;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(donePage$1(ok));
      finish();
      if (ok) resolve(got);
      else reject(new Error("OpenRouter did not finish connecting. Try again."));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("Connecting took too long. Try again."));
    }, TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      pending = null;
      for (const s of servers) {
        s.close();
        s.closeAllConnections?.();
      }
    };
    pending = {
      abort: () => {
        finish();
        reject(new Error("Connecting was cancelled."));
      }
    };
    const v4 = http.createServer(handle);
    servers.push(v4);
    v4.on("error", (err) => {
      finish();
      reject(new Error(`SNU Clipper could not start connecting (${err.message}).`));
    });
    v4.listen(0, "127.0.0.1", () => {
      const port = v4.address().port;
      const v6 = http.createServer(handle);
      v6.on("error", () => void 0);
      v6.listen(port, "::1");
      servers.push(v6);
      const auth = new URL("https://openrouter.ai/auth");
      auth.search = new URLSearchParams({
        callback_url: `http://localhost:${port}/openrouter`,
        code_challenge: challenge,
        code_challenge_method: "S256",
        key_label: "SNU Clipper",
        state: state2
      }).toString();
      void electron.shell.openExternal(auth.toString());
    });
  });
  const key = await exchange(code, verifier);
  focusApp$1();
  return updateSettings({ providerKey: { provider: "openrouter", key }, writingProvider: "openrouter" });
}
async function exchange(code, verifier) {
  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
      signal: AbortSignal.timeout(2e4)
    });
  } catch {
    throw new Error("Could not reach OpenRouter. Check your internet connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.key !== "string" || !body.key) {
    throw new Error(res.status === 403 ? "That sign-in ran out before it finished. Try again." : "OpenRouter did not hand over a key. Try again.");
  }
  return body.key;
}
function cancelConnectOpenRouter() {
  pending?.abort();
}
function focusApp$1() {
  const win = electron.BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (process.platform === "darwin") electron.app.focus({ steal: true });
}
function donePage$1(ok) {
  const title = ok ? "SNU Clipper is connected to free AI" : "Connecting did not finish";
  const line = ok ? "You can close this tab and go back to SNU Clipper." : "Go back to SNU Clipper and try again.";
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;background:#0b0b10;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${title}</h2><p style="color:#999">${line}</p></div></body>`;
}
const TITLE_BAR_HEIGHT = 38;
let current$1 = DEFAULT_APPEARANCE;
function windowAppearance() {
  return current$1;
}
function windowColors() {
  return WINDOW_COLORS[electron.nativeTheme.shouldUseDarkColors ? "dark" : "light"];
}
function titleBarOverlay() {
  const c = windowColors();
  return { color: c.bar, symbolColor: c.symbol, height: TITLE_BAR_HEIGHT };
}
function setWindowAppearance(a) {
  current$1 = a;
  if (electron.nativeTheme.themeSource !== a.theme) electron.nativeTheme.themeSource = a.theme;
  repaintWindows();
}
function repaintWindows() {
  const c = windowColors();
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.setBackgroundColor(c.background);
    if (process.platform !== "darwin") {
      try {
        win.setTitleBarOverlay(titleBarOverlay());
      } catch {
      }
    }
  }
}
electron.nativeTheme.on("updated", () => repaintWindows());
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "project";
}
function shortId() {
  return Math.random().toString(36).slice(2, 8);
}
const summaries = /* @__PURE__ */ new Map();
const SETTLED_MS = 3e3;
async function readSummary(file2) {
  const st = await node_fs.promises.stat(file2).catch(() => null);
  if (!st?.isFile()) {
    summaries.delete(file2);
    return null;
  }
  const hit = summaries.get(file2);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.project;
  const full = JSON.parse(await node_fs.promises.readFile(file2, "utf8"));
  if (!full?.id) return null;
  const { transcript: _t, ...project } = full;
  if (Date.now() - st.mtimeMs > SETTLED_MS) summaries.set(file2, { mtimeMs: st.mtimeMs, size: st.size, project });
  else summaries.delete(file2);
  return project;
}
async function listProjectSummaries(root) {
  let entries = [];
  try {
    entries = await node_fs.promises.readdir(root);
  } catch {
    return [];
  }
  const files = entries.map((e) => path.join(root, e, "project.json"));
  const read = await Promise.all(files.map((f) => readSummary(f).catch(() => null)));
  const seen = new Set(files);
  const dir = path.resolve(root);
  for (const f of summaries.keys()) if (path.dirname(path.dirname(f)) === dir && !seen.has(f)) summaries.delete(f);
  const out = read.filter((p) => p !== null);
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}
async function findProject(root, id) {
  const p = (await listProjectSummaries(root)).find((x) => x.id === id);
  return p ? readProject(p.outputDir) : null;
}
async function readProject(dir) {
  try {
    return JSON.parse(await node_fs.promises.readFile(path.join(dir, "project.json"), "utf8"));
  } catch {
    return null;
  }
}
async function writeProject(p) {
  await node_fs.promises.mkdir(p.outputDir, { recursive: true });
  const file2 = path.join(p.outputDir, "project.json");
  summaries.delete(file2);
  await node_fs.promises.writeFile(file2, JSON.stringify(p, null, 2), "utf8");
}
async function markInterruptedProjects(root) {
  let fixed = 0;
  for (const summary of await listProjectSummaries(root)) {
    const liveWithClips = summary.options.mode === "live" && summary.clips.length > 0;
    if (liveWithClips && summary.status !== "done") {
      const project2 = await readProject(summary.outputDir);
      if (!project2) continue;
      const stoppedByPerson = project2.status === "cancelled";
      await writeProject({
        ...project2,
        status: "done",
        error: void 0,
        liveStopped: stoppedByPerson ? void 0 : { reason: project2.status === "processing" || /^Interrupted/.test(project2.error ?? "") ? "SNU Clipper closed while it was watching." : "Something went wrong while watching.", watched: Math.round(project2.media?.duration ?? 0) },
        updatedAt: Date.now()
      });
      fixed++;
      continue;
    }
    if (summary.status !== "processing") continue;
    const project = await readProject(summary.outputDir);
    if (!project) continue;
    await writeProject({
      ...project,
      status: "failed",
      error: "Interrupted: the app closed while this was running.",
      updatedAt: Date.now()
    });
    fixed++;
  }
  return fixed;
}
function isInsideDir(root, target, allowSame = false) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  if (rel === "") return allowSame;
  return rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel);
}
async function deleteProject(root, p) {
  if (!isInsideDir(root, p.outputDir)) throw new Error("Refusing to delete a folder outside the SNU Clipper output directory.");
  await node_fs.promises.rm(path.resolve(p.outputDir), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
const WORK_DIR_NAME = ".work";
async function dirSize(dir) {
  let total = 0;
  const entries = await node_fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (e.isFile()) total += (await node_fs.promises.stat(p).catch(() => null))?.size ?? 0;
  }
  return total;
}
async function diskSpace(dir) {
  try {
    await node_fs.promises.mkdir(dir, { recursive: true });
    const st = await node_fs.promises.statfs(dir);
    return { free: Number(st.bavail) * Number(st.bsize), total: Number(st.blocks) * Number(st.bsize) };
  } catch {
    return { free: 0, total: 0 };
  }
}
async function storageOverview(outputDir) {
  const [disk, projects, modelsBytes, outputBytes] = await Promise.all([
    diskSpace(outputDir),
    listProjectSummaries(outputDir),
    dirSize(modelsDir()),
    dirSize(outputDir)
  ]);
  let tempBytes = 0;
  let downloadsBytes = 0;
  for (const p of projects) {
    tempBytes += await dirSize(path.join(p.outputDir, WORK_DIR_NAME));
    if (p.sourceUrl && !p.sourceRemoved && p.status === "done") downloadsBytes += await dirSize(path.join(p.outputDir, "source"));
  }
  return {
    downloadsBytes,
    clipsDir: (await getSettings()).clipsDir,
    outputDir,
    modelsDir: modelsDir(),
    diskFreeBytes: disk.free,
    diskTotalBytes: disk.total,
    projectsBytes: Math.max(0, outputBytes - tempBytes),
    projectCount: projects.length,
    modelsBytes,
    tempBytes
  };
}
async function clearTemp(outputDir) {
  let freed = 0;
  for (const p of await listProjectSummaries(outputDir)) {
    if (isRunning(p.id)) continue;
    const work = path.join(p.outputDir, WORK_DIR_NAME);
    freed += await dirSize(work);
    await node_fs.promises.rm(work, { recursive: true, force: true }).catch(() => void 0);
  }
  return freed;
}
async function clearDownloads(outputDir) {
  let freed = 0;
  for (const s of await listProjectSummaries(outputDir)) {
    if (isRunning(s.id) || s.status !== "done" || !s.sourceUrl || s.sourceRemoved) continue;
    const p = await readProject(s.outputDir);
    if (!p) continue;
    const bytes = await dirSize(path.join(p.outputDir, "source"));
    const updated = await removeDownload(p);
    if (updated.sourceRemoved) {
      freed += bytes;
      await writeProject(updated);
    }
  }
  return freed;
}
const DOWNLOAD_KEEP_DAYS = 3;
async function sweepOldDownloads(outputDir) {
  if ((await getSettings()).keepDownloads) return 0;
  const cutoff = Date.now() - DOWNLOAD_KEEP_DAYS * 24 * 60 * 60 * 1e3;
  let freed = 0;
  for (const s of await listProjectSummaries(outputDir)) {
    if (isRunning(s.id) || s.status !== "done" || !s.sourceUrl || s.sourceRemoved || s.updatedAt > cutoff) continue;
    const p = await readProject(s.outputDir);
    if (!p) continue;
    const bytes = await dirSize(path.join(p.outputDir, "source"));
    const updated = await removeDownload(p);
    if (updated.sourceRemoved) {
      freed += bytes;
      await writeProject(updated);
    }
  }
  return freed;
}
const MB = 1024 * 1024;
const DOWNLOAD_BUDGET_BYTES = 1200 * MB;
function estimateJobBytes(sourceBytes, clipCount, downloads = false) {
  return 400 * MB + sourceBytes * 0.3 + clipCount * 40 * MB + (downloads ? DOWNLOAD_BUDGET_BYTES : 0);
}
async function ensureDiskSpace(outputDir, sourceBytes, clipCount, downloads = false) {
  const { free, total } = await diskSpace(outputDir);
  if (total === 0) return;
  const need = estimateJobBytes(sourceBytes, clipCount, downloads);
  if (free < need) {
    throw new Error(
      `Not enough free disk space: ${fmtBytes(free)} free, about ${fmtBytes(need)} needed. Free up space (Settings → Storage) or choose another output folder.`
    );
  }
}
function fmtBytes(n) {
  if (n < 1024 * MB) return `${Math.round(n / MB)} MB`;
  return `${(n / (1024 * MB)).toFixed(1)} GB`;
}
let quitting = false;
function markQuitting() {
  quitting = true;
}
function killTree(pid, kill) {
  const killParent = () => {
    try {
      kill();
    } catch {
    }
  };
  if (!pid) return killParent();
  const [tool, args] = process.platform === "win32" ? ["taskkill", ["/pid", String(pid), "/T", "/F"]] : ["pkill", ["-KILL", "-P", String(pid)]];
  if (quitting) {
    try {
      node_child_process.spawnSync(tool, args, { windowsHide: true, timeout: 5e3 });
    } catch {
    }
    return killParent();
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    killParent();
  };
  const timer = setTimeout(finish, 5e3);
  try {
    const p = node_child_process.spawn(tool, args, { windowsHide: true, stdio: "ignore" });
    p.once("exit", finish);
    p.once("error", finish);
  } catch {
    finish();
  }
}
function bgutilDir() {
  return electron.app.isPackaged ? path.join(process.resourcesPath, "bgutil") : path.resolve(__dirname, "../../resources/bgutil");
}
let child = null;
let starting = null;
let users = 0;
let stopTimer = null;
function freePort(preferred = 4416) {
  const tryPort = (port) => new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen({ host: "127.0.0.1", port }, () => {
      const got = srv.address().port;
      srv.close(() => resolve(got));
    });
  });
  return tryPort(preferred).catch(() => tryPort(0));
}
async function ping(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/ping`, { signal: AbortSignal.timeout(2e3) });
    return res.ok;
  } catch {
    return false;
  }
}
function potAvailable() {
  const dir = bgutilDir();
  return Promise.all([node_fs.promises.stat(path.join(dir, "bgutil-server.mjs")), node_fs.promises.stat(path.join(dir, "plugins", "bgutil-ytdlp-pot-provider.zip"))]).then(() => true, () => false);
}
async function start() {
  const dir = bgutilDir();
  const script = path.join(dir, "bgutil-server.mjs");
  const pluginDir = path.join(dir, "plugins");
  if (!await potAvailable()) {
    console.warn("[pot] the PO-token helper is not in this build; going on without it");
    return null;
  }
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = node_child_process.spawn(process.execPath, [script, "--port", String(port), "--host", "127.0.0.1"], {
    windowsHide: true,
    // stdin stays open for as long as SNU Clipper runs: the helper exits when it closes (a crash too).
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", BGUTIL_EXIT_WITH_STDIN: "1" }
  });
  let log = "";
  const keep2 = (d) => log = (log + String(d)).slice(-2e3);
  proc.stdout?.on("data", keep2);
  proc.stderr?.on("data", keep2);
  let exited = false;
  proc.on("exit", () => {
    exited = true;
    if (child === proc) child = null;
  });
  proc.on("error", () => exited = true);
  for (let i = 0; i < 60 && !exited; i++) {
    if (await ping(baseUrl)) {
      child = proc;
      console.info(`[pot] PO-token helper up on ${baseUrl}`);
      return { baseUrl, pluginDir };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.warn(`[pot] the PO-token helper did not start; going on without it. ${log.trim().split("\n").slice(-3).join(" ")}`);
  killTree(proc.pid, () => proc.kill("SIGKILL"));
  return null;
}
async function acquirePotServer() {
  users++;
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    users = Math.max(0, users - 1);
    if (users === 0) stopTimer = setTimeout(stopPotServer, 3e4);
  };
  if (!starting) starting = start();
  const server = await starting;
  if (!server || !child) starting = null;
  return { server: child ? server : null, release };
}
process.on("exit", () => {
  try {
    child?.kill();
  } catch {
  }
});
function stopPotServer() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  starting = null;
  const proc = child;
  child = null;
  if (proc && proc.exitCode === null) killTree(proc.pid, () => proc.kill("SIGKILL"));
}
const NIGHTLY_BASE = "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/";
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";
function assetName() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}
function ytDlpPath() {
  return path.join(electron.app.getPath("userData"), "bin", assetName());
}
const UPDATE_AFTER_MS = 3 * 24 * 60 * 60 * 1e3;
const REFRESH_ON_FAILURE_MS = 24 * 60 * 60 * 1e3;
const previous = (bin) => `${bin}.prev`;
async function selfUpdate(bin, onProgress) {
  onProgress(0, "Updating the video downloader…");
  await node_fs.promises.copyFile(bin, previous(bin)).catch(() => void 0);
  await new Promise((resolve) => {
    const child2 = node_child_process.spawn(bin, ["--update-to", "nightly"], { windowsHide: true, stdio: "ignore", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    const timer = setTimeout(() => child2.kill(), 18e4);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    child2.on("error", done);
    child2.on("close", done);
  });
  if (!await node_fs.promises.stat(bin).then((st) => st.size > 1024 * 1024).catch(() => false)) {
    await node_fs.promises.copyFile(previous(bin), bin).catch(() => void 0);
    await node_fs.promises.chmod(bin, 493).catch(() => void 0);
  }
  const now = /* @__PURE__ */ new Date();
  await node_fs.promises.utimes(bin, now, now).catch(() => void 0);
}
let updating = null;
function updateOnce(bin, onProgress) {
  if (!updating) updating = selfUpdate(bin, onProgress).finally(() => updating = null);
  return updating;
}
async function refreshIfStale(bin, onProgress) {
  if (process.env.CLIPIE_YTDLP) return false;
  const st = await node_fs.promises.stat(bin).catch(() => null);
  if (!st || Date.now() - st.mtimeMs < REFRESH_ON_FAILURE_MS) return false;
  await updateOnce(bin, onProgress);
  return true;
}
let ensuring = null;
function ensureYtDlp(onProgress, signal) {
  if (!ensuring) ensuring = ensureYtDlpOnce(onProgress, signal).finally(() => ensuring = null);
  return ensuring;
}
async function ensureYtDlpOnce(onProgress, signal) {
  const bin = process.env.CLIPIE_YTDLP || ytDlpPath();
  const st = await node_fs.promises.stat(bin).catch(() => null);
  if (st) {
    if (!process.env.CLIPIE_YTDLP && Date.now() - st.mtimeMs > UPDATE_AFTER_MS) await updateOnce(bin, onProgress);
    return bin;
  }
  onProgress(0, "Downloading the video downloader (one time)…");
  await node_fs.promises.mkdir(path.dirname(bin), { recursive: true });
  let res = await fetch(NIGHTLY_BASE + assetName(), { signal }).catch(() => null);
  if (!res?.ok || !res.body) res = await fetch(RELEASE_BASE + assetName(), { signal });
  if (!res.ok || !res.body) throw new Error(`Could not download yt-dlp (${res.status}).`);
  const total = Number(res.headers.get("content-length") ?? 0);
  const tmp = `${bin}.part`;
  const handle = await node_fs.promises.open(tmp, "w");
  try {
    let loaded = 0;
    for await (const chunk of res.body) {
      await handle.write(chunk);
      loaded += chunk.byteLength;
      if (total) onProgress(loaded / total * 100, `Downloading the video downloader… ${Math.round(loaded / total * 100)}%`);
    }
  } finally {
    await handle.close();
  }
  await node_fs.promises.chmod(tmp, 493).catch(() => void 0);
  await node_fs.promises.rename(tmp, bin);
  return bin;
}
async function toolsDir() {
  const bins = resolveBinaries();
  const dir = path.join(electron.app.getPath("userData"), "bin", "tools");
  await node_fs.promises.mkdir(dir, { recursive: true });
  for (const [name, target] of [["ffmpeg", bins.ffmpeg], ["ffprobe", bins.ffprobe]]) {
    const link = path.join(dir, name + (process.platform === "win32" ? ".exe" : ""));
    const current2 = await node_fs.promises.readlink(link).catch(() => null);
    if (current2 === target) continue;
    if (current2 === null) {
      const [have, want] = await Promise.all([node_fs.promises.stat(link).catch(() => null), node_fs.promises.stat(target).catch(() => null)]);
      if (have?.isFile() && want && have.size === want.size) continue;
    }
    try {
      await node_fs.promises.rm(link, { force: true });
    } catch {
      continue;
    }
    try {
      await node_fs.promises.symlink(target, link);
    } catch {
      await node_fs.promises.link(target, link).catch(() => node_fs.promises.copyFile(target, link)).catch(() => void 0);
    }
  }
  return dir;
}
async function resolveStreamUrl(url, onProgress, signal, o = {}) {
  const bin = await ensureYtDlp(onProgress, signal);
  const format = o.gaming ? "b[protocol^=m3u8][height<=1080]/b[protocol^=m3u8]/b[height<=1080]/b/bv*+ba" : "b[protocol^=m3u8]/b/bv*+ba";
  const base = ["--no-playlist", "--no-warnings", "-g", "-f", format];
  const { result, cookies } = await runResilient(bin, (extra) => [...base, ...extra, url], () => void 0, (m) => onProgress(0, m), signal);
  const urls = result.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l));
  if (result.code !== 0 || urls.length === 0) {
    const plain = plainFailure(result, cookies);
    if (plain) throw new Error(plain);
    const raw = `Could not open that stream: ${errorLines(result) || `yt-dlp exited with code ${result.code}`}`;
    throw new Error(hardware.withDetails(hardware.friendlyError(raw).message, raw));
  }
  return urls.slice(0, 2).join("\n");
}
function errorLines(result) {
  return result.stderr.trim().split("\n").filter((l) => /ERROR/i.test(l)).slice(-2).join("\n") || result.stderr.trim().slice(-300);
}
function hasIpv6() {
  return Object.values(os.networkInterfaces()).some(
    (list) => (list ?? []).some((i) => i.family === "IPv6" && !i.internal && !/^(fe80|fc|fd)/i.test(i.address))
  );
}
const sleep$1 = (ms) => new Promise((r) => setTimeout(r, ms));
const RATE_LIMIT_WAITS = [60, 180];
async function countdown(seconds, onStatus, signal) {
  for (let left = seconds; left > 0 && !signal?.aborted; left--) {
    onStatus(`YouTube asked us to slow down, trying again in ${left} s`);
    await sleep$1(1e3);
  }
}
async function stubbedRun(args) {
  const file2 = process.env.CLIPIE_YTDLP_STUB;
  if (!file2) return null;
  const answers = JSON.parse(await node_fs.promises.readFile(file2, "utf8"));
  const calls = (await node_fs.promises.readFile(`${file2}.calls`, "utf8").catch(() => "")).split("\n").filter(Boolean);
  await node_fs.promises.appendFile(`${file2}.calls`, JSON.stringify(args) + "\n");
  const answer = answers[Math.min(calls.length, answers.length - 1)];
  await sleep$1(300);
  return { code: answer.code, stdout: answer.stdout ?? "", stderr: answer.stderr ?? "" };
}
async function runYt(bin, args, onProgress, signal) {
  const stub = await stubbedRun(args);
  if (stub) return stub;
  const prev = previous(bin);
  let result;
  try {
    result = await runYtDlp(bin, args, onProgress, signal);
  } catch (err) {
    if (err.message === "Cancelled" || !await node_fs.promises.stat(prev).catch(() => null)) throw err;
    result = { code: -1, stdout: "", stderr: String(err.message) };
  }
  const haveBackup = Boolean(await node_fs.promises.stat(prev).catch(() => null));
  if (haveBackup && result.code !== 0 && !result.stdout.trim() && !/ERROR:|WARNING:|yt-dlp|Usage|\[\w+\]/.test(result.stderr) && !signal?.aborted) {
    console.warn(`[ytdlp] the updated downloader did not start (${result.stderr.trim().slice(-200) || `exit ${result.code}`}); putting the previous one back`);
    await node_fs.promises.rename(prev, bin).catch(() => void 0);
    return runYtDlp(bin, args, onProgress, signal);
  }
  if (haveBackup) await node_fs.promises.rm(prev, { force: true }).catch(() => void 0);
  return result;
}
async function runResilient(bin, build, onProgress, onStatus, signal, retry, startWith) {
  const cookies = (await getSettings()).youtubeCookies;
  let pot = null;
  const ctx = () => ({ execPath: process.execPath, cookies, potBaseUrl: pot?.baseUrl, pluginDir: pot?.pluginDir });
  const kind = (r) => hardware.classifyYtDlp(r.stderr, hardware.OFFLINE, Boolean(cookies));
  const once = async (a) => {
    let r = await runYt(bin, build(hardware.attemptArgs(a, ctx())), onProgress, signal);
    if (r.code !== 0 && /no such option|unrecognized arguments/i.test(r.stderr) && !a.clients && !a.pot) {
      r = await runYt(bin, build([]), onProgress, signal);
    }
    return r;
  };
  const settle = async (a) => {
    const again = () => once(a);
    let r = await again();
    if (retry && !signal?.aborted) r = await retry(r, again);
    r = await untilOnline$1(r, again, onStatus, signal);
    for (const wait of RATE_LIMIT_WAITS) {
      if (r.code === 0 || signal?.aborted || kind(r) !== "rateLimit") break;
      await countdown(wait, onStatus, signal);
      if (signal?.aborted) break;
      r = await again();
    }
    return r;
  };
  let attempt = startWith ?? { name: "defaults" };
  let release = null;
  if (attempt.pot) {
    const helper = await acquirePotServer();
    if (helper.server) {
      release = helper.release;
      pot = helper.server;
    } else {
      helper.release();
      attempt = { name: "defaults" };
    }
  }
  let result;
  try {
    result = await settle(attempt);
    if (result.code !== 0 && !signal?.aborted && hardware.wantsFreshYtDlp(result.stderr) && await refreshIfStale(bin, onProgress)) {
      result = await settle(attempt);
    }
    if (result.code !== 0 && !signal?.aborted && (kind(result) === "bot" || kind(result) === "client")) {
      const chain = hardware.attemptChain({ pot: await potAvailable(), ipv6: hasIpv6() });
      let potTried = Boolean(pot);
      const from = Math.max(1, chain.findIndex((a) => a.name === attempt.name) + 1);
      for (let i = from; i < chain.length && !signal?.aborted; i++) {
        const next = chain[i];
        if (next.pot && !potTried) {
          potTried = true;
          const helper = await acquirePotServer();
          release = helper.release;
          pot = helper.server;
        }
        if (next.pot && !pot) continue;
        console.info(`[ytdlp] ${attempt.name}: ${kind(result)}; trying ${next.name}`);
        onStatus(`YouTube wants more proof; trying another way (${i + 1} of ${chain.length})…`);
        attempt = next;
        result = await settle(attempt);
        if (result.code === 0) break;
        const k = kind(result);
        if (k !== "bot" && k !== "client") break;
      }
    }
  } finally {
    release?.();
  }
  if (result.code === 0) console.info(`[ytdlp] succeeded with: ${attempt.name}${cookies ? ` (with the ${cookies} session)` : ""}`);
  else console.warn(`[ytdlp] failed (${kind(result)}) after: ${attempt.name}`);
  return { result, attempt, cookies };
}
function plainFailure(result, cookies) {
  const detail = errorLines(result);
  const k = hardware.classifyYtDlp(result.stderr, hardware.OFFLINE, Boolean(cookies));
  if (k === "offline") return hardware.withDetails(OFFLINE_MESSAGE, detail);
  if (k === "cookies" && cookies) return hardware.withDetails(`${hardware.ROBOT_MESSAGE} ${hardware.cookieTrouble(cookies, process.platform, result.stderr)}`, detail);
  if (k === "bot" || k === "client") {
    const note = cookies ? `Even with your ${hardware.BROWSER_NAMES[cookies]} session, YouTube still asked.` : hardware.ROBOT_TAIL;
    return hardware.withDetails(`${hardware.ROBOT_MESSAGE} ${note}`, detail);
  }
  if (k === "rateLimit") return hardware.withDetails("YouTube asked SNU Clipper to slow down and is still refusing. Wait a few minutes, then try again.", detail);
  return null;
}
const AUDIO_FORMAT = "ba[ext=m4a]/ba";
const VIDEO_FORMAT = [
  "bv*[height<=1080][ext=mp4][protocol=https][vcodec^=avc1]+ba[ext=m4a]",
  "bv*[height<=1080][ext=mp4][protocol=https]+ba[ext=m4a]",
  "bv*[height<=1080][ext=mp4]+ba[ext=m4a]",
  // The fallback players (web_safari, the TV ones) may only offer HLS with picture and sound in
  // one stream. Still 1080p at most.
  "b[height<=1080][ext=mp4]",
  "bv*[height<=1080]+ba",
  "b[height<=1080]",
  "b[ext=mp4]",
  "b"
].join("/");
const OFFLINE_MESSAGE = hardware.MESSAGES.offline;
const WAITING = "No internet connection. Waiting for it to come back; SNU Clipper carries on by itself.";
async function waitForInternet(onWait, signal) {
  const { lookup } = await import("node:dns/promises");
  const up = () => lookup("www.youtube.com").then(() => true, () => false);
  let wasDown = false;
  for (let wait = 2e3; !signal?.aborted; wait = Math.min(wait * 2, 1e4)) {
    if (await up()) return { back: true, wasDown };
    wasDown = true;
    onWait(WAITING);
    await new Promise((r) => setTimeout(r, wait));
  }
  return { back: false, wasDown };
}
async function untilOnline$1(first, attempt, onWait, signal) {
  let result = first;
  let fineButFailing = 0;
  while (result.code !== 0 && hardware.OFFLINE.test(result.stderr) && !signal?.aborted) {
    const { back, wasDown } = await waitForInternet(onWait, signal);
    if (!back) break;
    if (!wasDown && ++fineButFailing > 3) break;
    if (wasDown) onWait("Back online. Continuing…");
    else await new Promise((r) => setTimeout(r, 3e3 * fineButFailing));
    result = await attempt();
  }
  return result;
}
const TRANSIENT = /HTTP Error (403|5\d\d)|timed out|Connection reset|Remote end closed|IncompleteRead/i;
async function downloadVideo(url, destDir, onProgressRaw, signal, opts = {}) {
  const audioOnly = Boolean(opts.audioOnly);
  const onProgress = audioOnly ? (pct, message) => onProgressRaw(Math.min(99, pct / 0.9), message.replace(/^Downloading video/, "Downloading the sound")) : onProgressRaw;
  const bin = await ensureYtDlp(onProgress, signal);
  await node_fs.promises.mkdir(destDir, { recursive: true });
  const outTemplate = path.join(destDir, audioOnly ? "audio.%(ext)s" : "source.%(ext)s");
  const baseArgs = [
    "--no-playlist",
    "--newline",
    "--no-warnings",
    "--no-mtime",
    "-f",
    audioOnly ? AUDIO_FORMAT : VIDEO_FORMAT,
    ...audioOnly ? [] : ["--merge-output-format", "mp4"],
    "--ffmpeg-location",
    await toolsDir(),
    "-o",
    outTemplate,
    "--print",
    "after_move:__title__%(title)s",
    "--no-simulate",
    // --print makes yt-dlp quiet, and quiet drops the progress lines: without this, a download
    // showed "Starting… 0%" from the first second to the last (measured: 0 lines vs 20).
    "--progress",
    // Ride out a connection that drops for a moment instead of failing the whole project.
    "--retries",
    "10",
    "--fragment-retries",
    "10",
    "--socket-timeout",
    "30"
  ];
  let fragmentArgs = ["--concurrent-fragments", "4"];
  const build = (extra) => [...baseArgs, ...fragmentArgs, ...extra, url];
  const retry = async (first, again) => {
    let result2 = first;
    if (result2.code !== 0 && fragmentArgs.length > 0 && /HTTP Error (403|429)/i.test(result2.stderr) && !signal?.aborted) {
      fragmentArgs = [];
      onProgress(0, "YouTube refused the parallel download; downloading one piece at a time…");
      result2 = await again();
    }
    for (let attempt2 = 1; attempt2 <= 2 && result2.code !== 0 && !signal?.aborted && TRANSIENT.test(result2.stderr); attempt2++) {
      const wait = attempt2 * 4e3;
      onProgress(0, `YouTube refused for a moment; trying again in ${wait / 1e3} s…`);
      await sleep$1(wait);
      if (signal?.aborted) break;
      result2 = await again();
    }
    return result2;
  };
  const { result, attempt, cookies } = await runResilient(bin, build, onProgress, (m) => onProgress(0, m), signal, retry, opts.startWith);
  if (result.code !== 0) {
    if (signal?.aborted) throw new Error("Cancelled");
    console.warn(`[ytdlp] download failed: ${errorLines(result) || `exit ${result.code}`}`);
    const plain = plainFailure(result, cookies);
    if (plain) throw new Error(plain);
    const raw = `Video download failed: ${errorLines(result).replace(/\n/g, " ") || `yt-dlp exited with code ${result.code}`}`;
    throw new Error(hardware.withDetails(hardware.friendlyError(raw).message, raw));
  }
  const files = await node_fs.promises.readdir(destDir);
  const file2 = audioOnly ? files.find((f) => /^audio\.(m4a|webm|opus|mp3|ogg|aac|mp4)$/i.test(f)) : files.find((f) => /^source\.(mp4|mkv|webm|mov)$/i.test(f));
  if (!file2 && audioOnly) throw new Error("The sound finished downloading but no audio file was produced.");
  if (!file2) {
    const parts = files.filter((f) => /^source\.f[\w-]+\./i.test(f));
    if (parts.length > 1) throw new Error("The video and audio downloaded but could not be joined: the bundled ffmpeg could not run on this machine.");
    throw new Error("Video download finished but no video file was produced.");
  }
  const title = /__title__(.+)/.exec(result.stdout)?.[1]?.trim();
  return { filePath: path.join(destDir, file2), title, attempt, ...attempt.name !== "defaults" || cookies ? { via: `${attempt.name}${cookies ? `, ${hardware.BROWSER_NAMES[cookies]} session` : ""}` } : {} };
}
function runYtDlp(bin, args, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const child2 = node_child_process.spawn(bin, args, {
      windowsHide: true,
      // yt-dlp spawns process.execPath as its JS runtime; this makes Electron behave like plain Node there.
      // PYTHONIOENCODING: on Windows a pipe otherwise gets the ANSI code page, and yt-dlp drops every
      // character that page cannot hold, so non-Latin video titles come back garbled or empty.
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PYTHONIOENCODING: "utf-8" }
    });
    let stdout = "";
    let stderr = "";
    child2.stdout.setEncoding("utf8");
    child2.stderr.setEncoding("utf8");
    let streams = 0;
    let what = "video";
    let lastPercent = 0;
    child2.stdout.on("data", (d) => {
      const s = String(d);
      stdout += s;
      for (const line of s.split(/\r?\n/)) {
        if (/\[download\] Destination:/.test(line)) {
          streams++;
          what = streams > 1 || /\.(m4a|webm|opus|mp3)$/i.test(line.trim()) ? "audio" : "video";
          continue;
        }
        const p = hardware.parseDownloadLine(line);
        if (p && p.percent + 30 < lastPercent) what = "audio";
        if (p) lastPercent = p.percent;
        if (p) onProgress(what === "video" ? p.percent * 0.9 : 90 + p.percent * 0.09, hardware.describeDownload(what, p));
        else if (/\[Merger\]|Merging/i.test(line)) onProgress(99, "Merging audio and video…");
      }
    });
    child2.stderr.on("data", (d) => stderr += String(d));
    const onAbort = () => killTree(child2.pid, () => child2.kill("SIGKILL"));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child2.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child2.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) return reject(new Error("Cancelled"));
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}
async function fetchCaptionList(url, signal) {
  const bin = await ensureYtDlp(() => void 0, signal);
  const base = ["--no-playlist", "--no-warnings", "--skip-download", "-J"];
  const { result, cookies } = await runResilient(bin, (extra) => [...base, ...extra, url], () => void 0, () => void 0, signal);
  if (result.code !== 0) {
    const plain = plainFailure(result, cookies);
    if (plain) throw new Error(plain);
    const raw = `Could not check the video's captions: ${errorLines(result) || `yt-dlp exited with code ${result.code}`}`;
    throw new Error(hardware.withDetails(hardware.friendlyError(raw).message, raw));
  }
  try {
    return hardware.captionTracksFrom(JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))));
  } catch {
    throw new Error("YouTube's answer about this video's captions could not be read.");
  }
}
async function fetchCaptions(url, lang, auto, dir, signal) {
  const bin = await ensureYtDlp(() => void 0, signal);
  await node_fs.promises.mkdir(dir, { recursive: true });
  for (const f of await node_fs.promises.readdir(dir).catch(() => [])) if (/^youtube-captions\./.test(f)) await node_fs.promises.rm(path.join(dir, f), { force: true });
  const base = [
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    auto ? "--write-auto-subs" : "--write-subs",
    "--sub-langs",
    lang,
    "--sub-format",
    "json3/srv3/vtt/best",
    "-o",
    path.join(dir, "youtube-captions.%(ext)s")
  ];
  const { result, cookies } = await runResilient(bin, (extra) => [...base, ...extra, url], () => void 0, () => void 0, signal);
  const file2 = (await node_fs.promises.readdir(dir).catch(() => [])).find((f) => /^youtube-captions\..+\.(json3|srv3|vtt|srt)$/.test(f));
  if (result.code !== 0 || !file2) {
    if (signal?.aborted) throw new Error("Cancelled");
    const plain = result.code !== 0 ? plainFailure(result, cookies) : null;
    if (plain) throw new Error(plain);
    const raw = `Could not download the captions: ${errorLines(result) || (result.code === 0 ? "no caption file was written" : `yt-dlp exited with code ${result.code}`)}`;
    throw new Error(hardware.withDetails("YouTube's captions for this video could not be downloaded.", raw));
  }
  return path.join(dir, file2);
}
async function fetchMediaBatch(ids, outTemplate, format, onDone, signal) {
  if (!ids.length) return;
  const bin = await ensureYtDlp(() => void 0, signal);
  const args = [
    "--no-playlist",
    "--newline",
    "--no-warnings",
    "--no-mtime",
    "--no-progress",
    "--ignore-errors",
    "-f",
    format,
    "--ffmpeg-location",
    await toolsDir(),
    "-o",
    outTemplate,
    "--print",
    "after_move:__done__%(id)s",
    ...hardware.jsRuntimeArgs(process.execPath),
    ...ids.map((id) => `https://www.youtube.com/watch?v=${id}`)
  ];
  await new Promise((resolve, reject) => {
    const child2 = node_child_process.spawn(bin, args, { windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PYTHONIOENCODING: "utf-8" } });
    let buf = "";
    child2.stdout.setEncoding("utf8");
    child2.stdout.on("data", (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const l of lines) {
        const m = /__done__(\S+)/.exec(l);
        if (m) onDone(m[1]);
      }
    });
    child2.stderr.on("data", () => void 0);
    const onAbort = () => killTree(child2.pid, () => child2.kill("SIGKILL"));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child2.on("error", reject);
    child2.on("close", () => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) return reject(new Error("Cancelled"));
      resolve();
    });
  });
}
async function installedBrowsers() {
  const home = os.homedir();
  const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
  const local2 = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
  const mac = path.join(home, "Library", "Application Support");
  const places = process.platform === "darwin" ? {
    firefox: [path.join(mac, "Firefox")],
    chrome: [path.join(mac, "Google", "Chrome")],
    edge: [path.join(mac, "Microsoft Edge")],
    brave: [path.join(mac, "BraveSoftware", "Brave-Browser")],
    safari: ["/Applications/Safari.app"]
  } : process.platform === "win32" ? {
    firefox: [path.join(appData, "Mozilla", "Firefox")],
    chrome: [path.join(local2, "Google", "Chrome", "User Data")],
    edge: [path.join(local2, "Microsoft", "Edge", "User Data")],
    brave: [path.join(local2, "BraveSoftware", "Brave-Browser", "User Data")],
    safari: []
  } : {
    firefox: [path.join(home, ".mozilla", "firefox"), path.join(home, "snap", "firefox", "common", ".mozilla", "firefox"), path.join(home, ".var", "app", "org.mozilla.firefox", ".mozilla", "firefox")],
    chrome: [path.join(home, ".config", "google-chrome")],
    edge: [path.join(home, ".config", "microsoft-edge")],
    brave: [path.join(home, ".config", "BraveSoftware", "Brave-Browser")],
    safari: []
  };
  const exists2 = (p) => node_fs.promises.stat(p).then(() => true, () => false);
  const found = [];
  for (const b of hardware.COOKIE_BROWSERS) {
    if ((await Promise.all(places[b].map(exists2))).some(Boolean)) found.push(b);
  }
  if (found.length) return found;
  return hardware.COOKIE_BROWSERS.filter((b) => b !== "safari" || process.platform === "darwin");
}
function memeLibraryPath() {
  return electron.app.isPackaged ? path.join(process.resourcesPath, "memes", "library.json") : path.resolve(__dirname, "../../resources/memes/library.json");
}
function memesDir() {
  return path.join(electron.app.getPath("userData"), "memes");
}
let catalog = null;
async function library() {
  catalog ??= JSON.parse(await node_fs.promises.readFile(memeLibraryPath(), "utf8"));
  return catalog;
}
const LAUGHTER_MARK = "laughter-model.ok";
const LAUGHTER_MODEL_DIR = path.join("Xenova", "ast-finetuned-audioset-10-10-0.4593");
async function forgetLaughterModel() {
  await node_fs.promises.rm(path.join(memesDir(), LAUGHTER_MARK), { force: true });
}
let running$2 = null;
let runDone = Promise.resolve();
let lastError;
function broadcast$4(status) {
  for (const w of electron.BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("memes:status", status);
  }
}
const LIBRARY_VERSION = 2;
let migrated = false;
async function migrate(lib, dir) {
  if (migrated) return;
  migrated = true;
  const mark = path.join(dir, "library-version");
  const have = Number(await node_fs.promises.readFile(mark, "utf8").catch(() => "0")) || 0;
  if (have >= LIBRARY_VERSION) return;
  const files = await node_fs.promises.readdir(dir).catch(() => null);
  if (!files) return;
  if (have < 2) {
    for (const m of lib) if (m.kind === "video") await node_fs.promises.rm(path.join(dir, hardware.memeFileName(m)), { force: true });
  }
  await node_fs.promises.writeFile(mark, String(LIBRARY_VERSION));
}
async function memePackStatus() {
  const lib = await library();
  const dir = memesDir();
  if (!inFlight) await migrate(lib, dir);
  const names = new Set(await node_fs.promises.readdir(dir).catch(() => []));
  let bytes = 0;
  let ready = 0;
  for (const m of lib) {
    const f = hardware.memeFileName(m);
    if (!names.has(f)) continue;
    ready++;
    bytes += (await node_fs.promises.stat(path.join(dir, f)).catch(() => ({ size: 0 }))).size;
  }
  const laughter = names.has(LAUGHTER_MARK);
  return {
    total: lib.length,
    ready,
    bytes,
    usable: laughter && ready >= Math.ceil(lib.length * hardware.MEME_PACK_USABLE_SHARE),
    downloading: Boolean(running$2),
    percent: running$2 ? running$2.percent : 0,
    message: running$2 ? running$2.message : "",
    failed: running$2 ? running$2.failed.length : Math.max(0, lib.length - ready),
    ...lastError && !running$2 ? { error: lastError } : {}
  };
}
let inFlight = false;
function downloadMemePack() {
  if (inFlight) return runDone;
  inFlight = true;
  runDone = downloadAll().finally(() => inFlight = false);
  return runDone;
}
function memePackBusy() {
  return inFlight;
}
async function downloadAll() {
  const lib = await library();
  const dir = memesDir();
  await node_fs.promises.mkdir(dir, { recursive: true });
  await migrate(lib, dir);
  await node_fs.promises.writeFile(path.join(dir, "library-version"), String(LIBRARY_VERSION));
  const have = new Set(await node_fs.promises.readdir(dir).catch(() => []));
  const todo = lib.filter((m) => !have.has(hardware.memeFileName(m)));
  const needLaughter = !have.has(LAUGHTER_MARK);
  const run2 = { abort: new AbortController(), done: 0, failed: [], total: todo.length, message: "Connecting to YouTube… (the first meme takes about a minute)", percent: 0 };
  running$2 = run2;
  lastError = void 0;
  const push = async () => broadcast$4(await memePackStatus());
  const share = needLaughter ? 0.85 : 1;
  const tmp = path.join(dir, ".tmp");
  await node_fs.promises.rm(tmp, { recursive: true, force: true });
  await node_fs.promises.mkdir(tmp, { recursive: true });
  void push();
  try {
    const pending2 = [];
    let active = 0;
    const waiters = [];
    const slot = async () => {
      while (active >= 3) await new Promise((r) => waiters.push(r));
      active++;
    };
    const release = () => {
      active--;
      waiters.shift()?.();
    };
    const finished = /* @__PURE__ */ new Set();
    const settle = (m, ok, err) => {
      if (finished.has(m.id)) return;
      finished.add(m.id);
      if (!ok) {
        run2.failed.push(m.id);
        if (err) console.warn(`[memes] ${m.id}: ${err.message}`);
      }
      run2.done++;
      run2.percent = run2.done / Math.max(1, run2.total) * 100 * share;
      run2.message = `Downloading memes… ${run2.done} of ${run2.total}`;
      void push();
    };
    const batch = (kind) => {
      const list = todo.filter((m) => m.kind === kind);
      const ids = [...new Set(list.map((m) => m.youtube_id))];
      const format = kind === "video" ? "bv*[height<=720]+ba[ext=m4a]/bv*[height<=720]+ba/b[height<=720]/b" : "ba[ext=m4a]/ba/b";
      return fetchMediaBatch(ids, path.join(tmp, `%(id)s.${kind}.%(ext)s`), format, (ytid) => {
        for (const m of list.filter((x) => x.youtube_id === ytid)) {
          pending2.push((async () => {
            await slot();
            try {
              const src = (await node_fs.promises.readdir(tmp)).find((f) => f.startsWith(`${ytid}.${kind}.`) && !f.endsWith(".part") && !/\.f\d+\./.test(f));
              if (!src) throw new Error("nothing was downloaded");
              await buildMeme(m, path.join(tmp, src), dir, tmp, run2.abort.signal);
              settle(m, true);
            } catch (err) {
              if (!run2.abort.signal.aborted) settle(m, false, err);
            } finally {
              release();
            }
          })());
        }
      }, run2.abort.signal);
    };
    await Promise.all([batch("sound"), batch("video")]);
    await Promise.all(pending2);
    for (const m of todo) if (!finished.has(m.id)) settle(m, false);
    if (run2.abort.signal.aborted) throw new Error("Cancelled");
    if (needLaughter) {
      run2.message = "Downloading the laughter detector…";
      void push();
      await downloadLaughterModel(run2.abort.signal, (p) => {
        run2.percent = share * 100 + (1 - share) * p;
        run2.message = `Downloading the laughter detector… ${Math.round(p)}%`;
        void push();
      });
      await node_fs.promises.writeFile(path.join(dir, LAUGHTER_MARK), (/* @__PURE__ */ new Date()).toISOString());
    }
    const st = await memePackStatus();
    if (!st.usable) lastError = `${run2.failed.length} memes could not be downloaded. Check the connection and try again.`;
  } catch (err) {
    lastError = run2.abort.signal.aborted ? void 0 : err.message;
  } finally {
    await node_fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => void 0);
    running$2 = null;
    void push();
  }
}
function cancelMemePack() {
  running$2?.abort.abort();
}
async function deleteMemePack() {
  cancelMemePack();
  await runDone.catch(() => void 0);
  await node_fs.promises.rm(memesDir(), { recursive: true, force: true });
  lastError = void 0;
  broadcast$4(await memePackStatus());
}
const LUFS = -16;
const TRIM_SILENCE = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse";
async function buildMeme(m, srcPath, dir, tmp, signal) {
  const ffmpeg = resolveBinaries().ffmpeg;
  const ext = m.kind === "video" ? "mp4" : "m4a";
  const full = path.join(tmp, `${m.id}.full.${ext}`);
  const out = path.join(tmp, hardware.memeFileName(m));
  const cut = m.trim ? ["-ss", String(m.trim.start), "-to", String(m.trim.end)] : [];
  const loud = `loudnorm=I=${LUFS}:TP=-1.5:LRA=11`;
  try {
    if (m.kind === "video") {
      const audio = await hasAudio(srcPath, signal);
      await ff(ffmpeg, [
        "-y",
        ...cut,
        "-i",
        srcPath,
        ...audio ? [] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", "-shortest"],
        "-vf",
        "scale='min(1280,iw)':-2,fps=30,format=yuv420p",
        ...audio ? ["-af", `${loud},aresample=48000`] : [],
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        full
      ], signal);
    } else {
      await ff(ffmpeg, ["-y", ...cut, "-i", srcPath, "-vn", "-af", `${TRIM_SILENCE},${loud},aresample=48000`, "-c:a", "aac", "-b:a", "160k", "-ac", "2", full], signal);
    }
    if (m.clip) {
      const len = m.clip.end - m.clip.start;
      const fades = `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, len - 0.08).toFixed(3)}:d=0.08`;
      const video = m.kind === "video" ? ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart"] : ["-vn"];
      await ff(ffmpeg, ["-y", "-ss", String(m.clip.start), "-t", len.toFixed(3), "-i", full, "-af", fades, ...video, "-c:a", "aac", "-b:a", "160k", out], signal);
    } else {
      await node_fs.promises.rename(full, out);
    }
    await node_fs.promises.rename(out, path.join(dir, hardware.memeFileName(m)));
  } finally {
    for (const f of [full, out]) await node_fs.promises.rm(f, { force: true }).catch(() => void 0);
  }
}
function ff(bin, args, signal) {
  return new Promise((resolve, reject) => {
    const child2 = node_child_process.spawn(bin, ["-hide_banner", "-nostdin", ...args], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child2.stderr.setEncoding("utf8");
    child2.stderr.on("data", (d) => err = (err + d).slice(-3e3));
    const onAbort = () => killTree(child2.pid, () => child2.kill("SIGKILL"));
    signal.addEventListener("abort", onAbort, { once: true });
    child2.on("error", reject);
    child2.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) return reject(new Error("Cancelled"));
      code === 0 ? resolve(err) : reject(new Error(`ffmpeg: ${err.trim().split("\n").slice(-2).join(" ")}`));
    });
  });
}
function hasAudio(file2, signal) {
  return new Promise((resolve) => {
    const child2 = node_child_process.spawn(resolveBinaries().ffprobe, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file2], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child2.stdout.setEncoding("utf8");
    child2.stdout.on("data", (d) => out += d);
    const onAbort = () => child2.kill();
    signal.addEventListener("abort", onAbort, { once: true });
    child2.on("error", () => resolve(false));
    child2.on("close", () => {
      signal.removeEventListener("abort", onAbort);
      resolve(out.trim().length > 0);
    });
  });
}
function downloadLaughterModel(signal, onProgress) {
  return new Promise((resolve, reject) => {
    const child2 = electron.utilityProcess.fork(enginePath(), [], { serviceName: "SNU Clipper laughter model", stdio: "pipe" });
    const onAbort = () => child2.kill();
    signal.addEventListener("abort", onAbort, { once: true });
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      err ? reject(err) : resolve();
    };
    child2.on("message", (ev) => {
      if (ev.type === "laughter-progress") onProgress(ev.percent ?? 0);
      else if (ev.type === "laughter-done") finish();
      else if (ev.type === "laughter-failed") finish(new Error(`The laughter detector could not be downloaded: ${ev.error}`));
    });
    child2.on("exit", () => finish(signal.aborted ? new Error("Cancelled") : new Error("The laughter detector download stopped.")));
    child2.postMessage({ type: "download-laughter", modelsDir: modelsDir() });
  });
}
const LAUGHTER_MODEL_ID = path.join("Xenova", "ast-finetuned-audioset-10-10-0.4593");
const NEVER_LOADED = [path.join("Xenova", "whisper-large-v3"), path.join("Xenova", "multilingual-e5-small")];
const WEIGHT_FILE = /^(encoder_model|decoder_model_merged)(_\w+)?\.onnx(_data)?$/;
const PARTIAL = /\.tmp\.(\d+)\.[a-z0-9]+$/i;
async function isComplete(dir, model) {
  try {
    await node_fs.promises.access(path.join(dir, "config.json"));
    for (const file2 of Object.values(local.whisperWeightFiles(model))) {
      const stat = await node_fs.promises.stat(path.join(dir, "onnx", file2));
      if (stat.size < 1e7) await node_fs.promises.access(path.join(dir, "onnx", `${file2}_data`));
    }
    return true;
  } catch {
    return false;
  }
}
async function supersededWeights(onnxDir, model) {
  if (process.env.CLIPIE_WHISPER_ENCODER || process.env.CLIPIE_WHISPER_DECODER) return [];
  const keep2 = new Set(Object.values(local.whisperWeightFiles(model)).flatMap((f) => [f, `${f}_data`]));
  const names = await node_fs.promises.readdir(onnxDir).catch(() => []);
  return names.filter((f) => WEIGHT_FILE.test(f) && !keep2.has(f));
}
function alive(pid) {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
async function sizeOf(p) {
  const st = await node_fs.promises.lstat(p).catch(() => null);
  if (!st) return 0;
  if (!st.isDirectory()) return st.size;
  let total = 0;
  for (const name of await node_fs.promises.readdir(p).catch(() => [])) total += await sizeOf(path.join(p, name));
  return total;
}
async function partialsIn(dir) {
  const out = [];
  for (const ent of await node_fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await partialsIn(p));
    else {
      const m = PARTIAL.exec(ent.name);
      if (m && !alive(Number(m[1]))) out.push(p);
    }
  }
  return out;
}
async function tidyModelsFolder(root, opts = {}) {
  const items = [];
  const add = async (p, why) => items.push({ path: p, bytes: await sizeOf(p), why });
  for (const rel of NEVER_LOADED) {
    const p = path.join(root, rel);
    if (await node_fs.promises.stat(p).catch(() => null)) await add(p, "model folder no version of SNU Clipper loads");
  }
  for (const model of local.WHISPER_MODEL_SIZES) {
    const dir = path.join(root, local.WHISPER_MODEL_IDS[model]);
    if (!await node_fs.promises.stat(dir).catch(() => null)) continue;
    for (const p of await partialsIn(dir)) await add(p, "unfinished download");
    if (!await isComplete(dir, model)) continue;
    for (const f of await supersededWeights(path.join(dir, "onnx"), model)) await add(path.join(dir, "onnx", f), `${model} model weights this version does not load`);
  }
  const laughter = path.join(root, LAUGHTER_MODEL_ID);
  if (await node_fs.promises.stat(laughter).catch(() => null)) {
    for (const p of await partialsIn(laughter)) await add(p, "unfinished download");
  }
  if (!opts.dryRun) {
    for (const it of items) {
      await node_fs.promises.rm(it.path, { recursive: true, force: true });
      opts.log?.(`removed ${it.path} (${(it.bytes / 1e6).toFixed(0)} MB, ${it.why})`);
    }
  }
  if (!opts.dryRun) {
    for (const rel of NEVER_LOADED) {
      const parent = path.join(root, path.dirname(rel));
      const left = await node_fs.promises.readdir(parent).catch(() => null);
      if (left && left.length === 0) await node_fs.promises.rmdir(parent).catch(() => void 0);
    }
  }
  return items;
}
let current = null;
function sendToWindows$2(ev) {
  for (const w of electron.BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("models:event", ev);
  }
}
const broadcast$3 = hardware.eventThrottle(sendToWindows$2, (ev) => ev.type === "model-progress" ? `model:${ev.model}` : null).push;
function modelDir(model) {
  return path.join(modelsDir(), local.WHISPER_MODEL_IDS[model]);
}
async function pruneOtherWeights(model) {
  const onnxDir = path.join(modelDir(model), "onnx");
  for (const f of await supersededWeights(onnxDir, model)) {
    await node_fs.promises.rm(path.join(onnxDir, f), { force: true });
  }
}
async function tidyModels(log) {
  if (current || memePackBusy()) return;
  const removed = await tidyModelsFolder(modelsDir(), { log });
  if (removed.length) log(`models folder tidied: ${(removed.reduce((a, r) => a + r.bytes, 0) / 1e6).toFixed(0)} MB freed`);
}
async function modelStatuses() {
  return Promise.all(
    local.WHISPER_MODEL_SIZES.map(async (model) => {
      const dir = modelDir(model);
      const downloaded = await isComplete(dir, model);
      return {
        model,
        id: local.WHISPER_MODEL_IDS[model],
        downloaded,
        downloading: current?.model === model,
        sizeBytes: downloaded ? await dirSize(dir) : 0,
        path: dir
      };
    })
  );
}
function downloadModel(model) {
  if (current) throw new Error(`Already downloading the ${current.model} model. Wait for it to finish or cancel it first.`);
  const child2 = electron.utilityProcess.fork(enginePath(), [], {
    serviceName: "snu-model-download",
    stdio: "pipe",
    env: { ...process.env, CLIPIE_ENGINE: "1" }
  });
  const entry = { model, child: child2, cancelled: false };
  current = entry;
  child2.stdout?.on("data", (d) => {
    const message = String(d).trim();
    if (message) broadcast$3({ type: "model-log", model, message });
  });
  child2.stderr?.on("data", (d) => {
    const message = String(d).trim();
    if (message) broadcast$3({ type: "model-log", model, message });
  });
  child2.on("message", (raw) => {
    const ev = raw;
    if (ev.type === "model-done" || ev.type === "model-failed") {
      if (current === entry) current = null;
    }
    if (ev.type === "model-done") pruneOtherWeights(model).catch(() => void 0);
    broadcast$3(ev);
  });
  child2.on("exit", (code) => {
    if (current === entry) {
      current = null;
      broadcast$3({
        type: "model-failed",
        model,
        error: entry.cancelled ? "Cancelled" : `Download process exited unexpectedly (code ${code}).`
      });
    }
  });
  const job = { type: "download-model", model, modelsDir: modelsDir() };
  child2.postMessage(job);
  broadcast$3({ type: "model-progress", model, percent: 0, message: "Starting download…" });
}
function cancelDownload() {
  if (!current) return;
  current.cancelled = true;
  current.child.kill();
}
async function deleteModel(model) {
  if (current?.model === model) throw new Error("This model is downloading right now. Cancel the download first.");
  await node_fs.promises.rm(modelDir(model), { recursive: true, force: true });
}
async function deleteAllModels() {
  for (const model of local.WHISPER_MODEL_SIZES) {
    if (current?.model === model) continue;
    await node_fs.promises.rm(modelDir(model), { recursive: true, force: true });
  }
}
async function inspectModelsDir(dir) {
  let count = 0;
  let bytes = 0;
  for (const model of local.WHISPER_MODEL_SIZES) {
    const from = modelDir(model);
    if (!await isComplete(from, model)) continue;
    count++;
    bytes += await dirSize(from);
  }
  const movable = { count, bytes };
  if (path.resolve(dir) === path.resolve(modelsDir())) return { movable: { count: 0, bytes: 0 }, ok: true };
  try {
    await node_fs.promises.mkdir(dir, { recursive: true });
    const probe = path.join(dir, ".clipie-write-test");
    await node_fs.promises.writeFile(probe, "");
    await node_fs.promises.rm(probe, { force: true });
  } catch (err) {
    return { movable, ok: false, reason: `SNU Clipper cannot write to that folder (${err.message}).` };
  }
  return { movable, ok: true };
}
async function moveModelsTo(dir, move) {
  if (current) throw new Error("A model is downloading right now. Wait for it to finish or cancel it first.");
  const from = modelsDir();
  const failed = [];
  let moved = 0;
  if (move && path.resolve(dir) !== path.resolve(from)) {
    for (const model of local.WHISPER_MODEL_SIZES) {
      const src = modelDir(model);
      if (!await isComplete(src, model)) continue;
      const dst = path.join(dir, local.WHISPER_MODEL_IDS[model]);
      try {
        await node_fs.promises.mkdir(path.dirname(dst), { recursive: true });
        try {
          await node_fs.promises.rename(src, dst);
        } catch (err) {
          if (err.code !== "EXDEV") throw err;
          await node_fs.promises.cp(src, dst, { recursive: true, force: true });
          await node_fs.promises.rm(src, { recursive: true, force: true });
        }
        moved++;
      } catch (err) {
        await node_fs.promises.rm(dst, { recursive: true, force: true }).catch(() => {
        });
        failed.push(`${model}: ${err.message}`);
      }
    }
  }
  if (path.resolve(dir) !== path.resolve(from)) {
    const ast = path.join(from, LAUGHTER_MODEL_DIR);
    const moveAst = move && await node_fs.promises.stat(ast).catch(() => null);
    if (moveAst) {
      const dst = path.join(dir, LAUGHTER_MODEL_DIR);
      try {
        await node_fs.promises.mkdir(path.dirname(dst), { recursive: true });
        await node_fs.promises.rename(ast, dst).catch(async (err) => {
          if (err.code !== "EXDEV") throw err;
          await node_fs.promises.cp(ast, dst, { recursive: true, force: true });
          await node_fs.promises.rm(ast, { recursive: true, force: true });
        });
      } catch {
        await forgetLaughterModel();
      }
    } else {
      await forgetLaughterModel();
    }
  }
  await updateSettings({ modelsDir: dir });
  return { moved, failed };
}
const SUPABASE_URL = "https://YOUR-SUPABASE-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-KEY";
const GOOGLE_CLIENT_ID = "YOUR-GOOGLE-CLIENT-ID";
const GOOGLE_CLIENT_SECRET = "YOUR-GOOGLE-CLIENT-SECRET";
const CLIPIE_CLOUD_DEFAULT_URL = "https://speech.inshalamir.com";
const CLIPIE_CLOUD_STATUS_URL = "https://clipie.vercel.app/cloud.json";
const SIGN_IN_TIMEOUT_MS = 5 * 6e4;
const RENEW_BEFORE_MS = 10 * 6e4;
let session = null;
let renewing = null;
let pendingSignIn = null;
function file$1() {
  return path.join(electron.app.getPath("userData"), "account.json");
}
async function readStored() {
  try {
    const s = JSON.parse(await node_fs.promises.readFile(file$1(), "utf8"));
    return s.refreshEnc && s.userId ? s : null;
  } catch {
    return null;
  }
}
async function writeStored(s) {
  if (!s) {
    await node_fs.promises.rm(file$1(), { force: true });
    return;
  }
  await node_fs.promises.mkdir(path.dirname(file$1()), { recursive: true });
  await node_fs.promises.writeFile(file$1(), JSON.stringify(s, null, 2), "utf8");
}
function encrypt(value) {
  if (electron.safeStorage.isEncryptionAvailable()) return electron.safeStorage.encryptString(value).toString("base64");
  return "plain:" + Buffer.from(value, "utf8").toString("base64");
}
function decrypt(enc) {
  try {
    if (enc.startsWith("plain:")) return Buffer.from(enc.slice(6), "base64").toString("utf8");
    if (!electron.safeStorage.isEncryptionAvailable()) return void 0;
    return electron.safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch {
    return void 0;
  }
}
function cloudUrl() {
  return (process.env.CLIPIE_CLOUD_URL || CLIPIE_CLOUD_DEFAULT_URL).replace(/\/+$/, "");
}
let openCache = null;
async function cloudOpen() {
  if (!cloudUrl()) return false;
  const forced = process.env.CLIPIE_CLOUD_OPEN;
  if (forced === "1" || forced === "0") return forced === "1";
  if (openCache && Date.now() - openCache.at < 5 * 6e4) return openCache.open;
  try {
    const res = await fetch(`${CLIPIE_CLOUD_STATUS_URL}?t=${Math.floor(Date.now() / 6e4)}`, { signal: AbortSignal.timeout(8e3) });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    openCache = { open: body?.open === true, at: Date.now() };
    return openCache.open;
  } catch {
    return openCache?.open ?? false;
  }
}
async function openCloudUrl() {
  return await cloudOpen() ? cloudUrl() : "";
}
async function keep(s) {
  session = { access: s.access_token, expiresAt: Date.now() + s.expires_in * 1e3 };
  const meta = s.user.user_metadata ?? {};
  await writeStored({ refreshEnc: encrypt(s.refresh_token), userId: s.user.id, email: s.user.email, name: meta.full_name || meta.name });
}
async function supabaseToken(grant, body) {
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2e4)
  });
}
const b64url = (b) => b.toString("base64url");
async function signIn() {
  pendingSignIn?.abort();
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state2 = b64url(crypto.randomBytes(16));
  const nonce = b64url(crypto.randomBytes(16));
  const nonceHash = crypto.createHash("sha256").update(nonce).digest("hex");
  const { code, redirectUri } = await new Promise((resolve, reject) => {
    let redirectUri2 = "";
    const server = http.createServer((req, res2) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/auth/callback") {
        res2.writeHead(404).end();
        return;
      }
      const ok = url.searchParams.get("state") === state2 && url.searchParams.get("code");
      res2.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(donePage(Boolean(ok)));
      finish();
      if (ok) resolve({ code: url.searchParams.get("code"), redirectUri: redirectUri2 });
      else reject(new Error(url.searchParams.get("error") === "access_denied" ? "Sign-in was cancelled." : "Google did not finish the sign-in. Try again."));
    });
    const timer = setTimeout(() => {
      finish();
      reject(new Error("The sign-in took too long. Try again."));
    }, SIGN_IN_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      pendingSignIn = null;
      server.close();
      server.closeAllConnections?.();
    };
    pendingSignIn = {
      abort: () => {
        finish();
        reject(new Error("Sign-in was cancelled."));
      }
    };
    server.on("error", (err) => {
      finish();
      reject(new Error(`SNU Clipper could not start the sign-in (${err.message}).`));
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      redirectUri2 = `http://127.0.0.1:${port}/auth/callback`;
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.search = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri2,
        response_type: "code",
        scope: "openid email profile",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: state2,
        nonce: nonceHash,
        prompt: "select_account"
      }).toString();
      void electron.shell.openExternal(auth.toString());
    });
  });
  let google;
  try {
    google = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
      signal: AbortSignal.timeout(2e4)
    });
  } catch {
    throw new Error("Could not reach Google. Check your internet connection and try again.");
  }
  const idToken = (await google.json().catch(() => ({}))).id_token;
  if (!google.ok || !idToken) throw new Error("Google did not finish the sign-in. Try again.");
  let res;
  try {
    res = await supabaseToken("id_token", { provider: "google", id_token: idToken, nonce });
  } catch {
    throw new Error("Could not reach SNU Clipper's sign-in service. Check your internet connection and try again.");
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`[account] Supabase id_token exchange ${res.status}: ${detail}`);
    throw new Error(/provider is not enabled|Unsupported provider/i.test(detail) ? "Google sign-in is not switched on for SNU Clipper yet." : "SNU Clipper's sign-in service did not accept the sign-in. Try again.");
  }
  await keep(await res.json());
  focusApp();
  return account();
}
function emailRefusal(status, body) {
  const code = body.error_code || body.code || "";
  const text = body.msg || body.message || body.error_description || "";
  console.error(`[account] email sign-in ${status}: ${code} ${text}`.slice(0, 300));
  if (code === "user_already_exists" || /already registered/i.test(text)) return new Error("This email already has a SNU Clipper account. Sign in instead.");
  if (code === "invalid_credentials" || /invalid login credentials/i.test(text)) return new Error("Wrong email or password.");
  if (code === "email_not_confirmed" || /not confirmed/i.test(text)) return new Error("Open the link in the email SNU Clipper sent you first, then sign in.");
  if (code === "weak_password" || /password/i.test(text)) return new Error("Choose a longer password: at least 8 characters.");
  if (code === "email_address_invalid" || code === "validation_failed" || /email/i.test(text)) return new Error("That email address does not look right.");
  if (code === "signup_disabled" || code === "email_provider_disabled") return new Error("New accounts are closed for now.");
  if (status === 429) return new Error("Too many tries. Wait a minute and try again.");
  return new Error("SNU Clipper's sign-in service did not accept that. Try again.");
}
async function authCall(path2, body) {
  try {
    return await fetch(`${SUPABASE_URL}/auth/v1/${path2}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2e4)
    });
  } catch {
    throw new Error("Could not reach SNU Clipper's sign-in service. Check your internet connection and try again.");
  }
}
async function signInWithEmail(email, password) {
  pendingSignIn?.abort();
  const res = await authCall("token?grant_type=password", { email: email.trim(), password });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw emailRefusal(res.status, body);
  await keep(body);
  return account();
}
async function signUpWithEmail(email, password, name) {
  pendingSignIn?.abort();
  if (password.length < 8) throw new Error("Choose a longer password: at least 8 characters.");
  const res = await authCall("signup", { email: email.trim(), password, data: name.trim() ? { name: name.trim() } : {} });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw emailRefusal(res.status, body);
  if (body.access_token && body.refresh_token && body.user) {
    await keep(body);
    return account();
  }
  if (Array.isArray(body.identities) && body.identities.length === 0) throw emailRefusal(422, { code: "user_already_exists" });
  return { signedIn: false, serverReady: await cloudOpen(), needsConfirm: true };
}
async function cloudToken(minLeftMs = RENEW_BEFORE_MS) {
  if (session && session.expiresAt - Date.now() > minLeftMs) return session.access;
  renewing ??= renew().finally(() => renewing = null);
  return renewing;
}
async function renew() {
  const stored = await readStored();
  const refresh = stored && decrypt(stored.refreshEnc);
  if (!stored || !refresh) {
    session = null;
    return null;
  }
  const res = await supabaseToken("refresh_token", { refresh_token: refresh });
  if (res.status >= 400 && res.status < 500) {
    session = null;
    await writeStored(null);
    return null;
  }
  if (!res.ok) throw new Error("SNU Clipper's sign-in service is not answering right now.");
  await keep(await res.json());
  return session.access;
}
async function account() {
  const serverReady = await cloudOpen();
  const stored = await readStored();
  if (!stored) return { signedIn: false, serverReady };
  const base = { signedIn: true, email: stored.email, name: stored.name, serverReady };
  let token;
  try {
    token = await cloudToken();
  } catch {
    return { ...base, error: "Could not check your minutes: no internet connection." };
  }
  if (!token) return { signedIn: false, serverReady };
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_account`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_app: electron.app.getVersion(), p_platform: `${process.platform}-${process.arch}` }),
      signal: AbortSignal.timeout(15e3)
    });
    if (res.ok) {
      const sum = await res.json();
      return { ...base, balance: sum?.balance ?? 0, used30d: sum?.last_30_days?.audio_seconds };
    }
    const row = await fetch(`${SUPABASE_URL}/rest/v1/accounts?select=balance&user_id=eq.${stored.userId}`, { headers, signal: AbortSignal.timeout(15e3) });
    if (!row.ok) return { ...base, error: "Could not check your minutes right now." };
    const rows = await row.json();
    return { ...base, balance: rows[0]?.balance ?? 0 };
  } catch {
    return { ...base, error: "Could not check your minutes: no internet connection." };
  }
}
async function signOut() {
  pendingSignIn?.abort();
  const token = session?.access;
  session = null;
  await writeStored(null);
  if (token) {
    void fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1e4) }).catch(() => void 0);
  }
  return { signedIn: false, serverReady: await cloudOpen() };
}
function cancelSignIn() {
  pendingSignIn?.abort();
}
function focusApp() {
  const win = electron.BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (process.platform === "darwin") electron.app.focus({ steal: true });
}
function donePage(ok) {
  const title = ok ? "Signed in to SNU Clipper" : "Sign-in did not finish";
  const line = ok ? "You can close this tab and go back to SNU Clipper." : "Go back to SNU Clipper and try again.";
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;background:#0b0b10;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${title}</h2><p style="color:#999">${line}</p></div></body>`;
}
const running$1 = /* @__PURE__ */ new Map();
const clipJobs = /* @__PURE__ */ new Map();
const jobEvents = new node_events.EventEmitter();
function sendToWindows$1(ev) {
  for (const w of electron.BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("engine:event", ev);
  }
}
const toWindows = hardware.eventThrottle(sendToWindows$1, (ev) => ev.type === "progress" ? `progress:${ev.projectId}` : ev.type === "side-task" ? `side:${ev.projectId}` : ev.type === "clip-progress" ? `clip:${ev.projectId}:${ev.highlightId}` : null);
function broadcast$2(ev) {
  jobEvents.emit("event", ev);
  toWindows.push(ev);
}
const REPEATED_NOISE = /No language specified/i;
function engineLogger(projectId, level) {
  let noiseSeen = false;
  return (d) => {
    const message = String(d).trim();
    if (!message) return;
    if (REPEATED_NOISE.test(message)) {
      if (noiseSeen) return;
      noiseSeen = true;
    }
    broadcast$2({ type: "log", projectId, level, message });
  };
}
function forkEngine(serviceName) {
  return electron.utilityProcess.fork(enginePath(), [], {
    serviceName,
    stdio: "pipe",
    env: { ...process.env, CLIPIE_ENGINE: "1" }
  });
}
async function startJob(options) {
  const settings = await getSettings();
  const id = `${Date.now().toString(36)}-${shortId()}`;
  const fromUrl = Boolean(options.sourceUrl && !options.inputPath);
  const fallbackName = fromUrl ? `YouTube ${hardware.parseYouTubeId(options.sourceUrl ?? "") ?? "video"}` : path.basename(options.inputPath, path.extname(options.inputPath));
  const name = options.projectName?.trim() || fallbackName;
  const outputDir = path.join(settings.outputDir, `${slugify(name)}-${id.slice(-6)}`);
  if (options.mode === "funny" && !(await memePackStatus()).usable) {
    throw new Error("Download the meme library first: funny clips need it. Start a new project and choose Funny clips.");
  }
  const sourceBytes = fromUrl ? 0 : (await node_fs.promises.stat(options.inputPath).catch(() => null))?.size ?? 0;
  await ensureDiskSpace(settings.outputDir, sourceBytes, options.clipCount, fromUrl);
  const live = options.mode === "live";
  if (live) delete options.transcript;
  if (options.transcript) options.transcript = await keepTranscript(options.transcript, outputDir);
  const project = {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "processing",
    options: { ...options, projectName: name },
    outputDir,
    sourceUrl: fromUrl ? options.sourceUrl : void 0,
    clips: []
  };
  await writeProject(project);
  return launch(project, settings);
}
const retrying = /* @__PURE__ */ new Set();
async function retryJob(projectId) {
  if (running$1.has(projectId) || retrying.has(projectId)) throw new Error("This project is already running.");
  retrying.add(projectId);
  try {
    return await retryChecked(projectId);
  } finally {
    retrying.delete(projectId);
  }
}
async function retryChecked(projectId) {
  const settings = await getSettings();
  const old = await findProject(settings.outputDir, projectId);
  if (!old) throw new Error("Project not found.");
  const watchAgain = old.options.mode === "live" && old.status === "done" && Boolean(old.liveStopped);
  if (old.status !== "failed" && old.status !== "cancelled" && !watchAgain) throw new Error("Only a project that failed or was stopped can be tried again.");
  const options = old.options;
  if (options.mode === "funny" && !(await memePackStatus()).usable) {
    throw new Error("Download the meme library first: funny clips need it. Start a new project and choose Funny clips.");
  }
  const downloaded = Boolean(options.inputPath) && await node_fs.promises.stat(options.inputPath).then((st) => st.isFile() && st.size > 0).catch(() => false);
  if (!old.sourceUrl && !downloaded) throw new Error("The video this project was made from is no longer there. Start a new project with it.");
  await ensureDiskSpace(settings.outputDir, 0, options.clipCount, Boolean(old.sourceUrl && !downloaded));
  const project = { ...old, status: "processing", error: void 0, liveStopped: void 0, clips: old.options.mode === "live" ? old.clips : [], updatedAt: Date.now() };
  await writeProject(project);
  return launch(project, settings, downloaded);
}
function settleCancelled(entry) {
  const id = entry.project.id;
  if (running$1.get(id) !== entry) return;
  const stopped = { ...entry.project, status: "cancelled", error: "Cancelled", updatedAt: Date.now() };
  entry.project = stopped;
  running$1.delete(id);
  void writeProject(stopped);
  broadcast$2({ type: "failed", projectId: id, error: "Cancelled", project: stopped });
}
async function launch(project, settings, haveSource = false) {
  const id = project.id;
  const options = project.options;
  const outputDir = project.outputDir;
  const live = options.mode === "live";
  const fromUrl = Boolean(project.sourceUrl) && !haveSource;
  const entry = { child: null, project, cancelled: false, abort: new AbortController(), live };
  running$1.set(id, entry);
  if (live) {
    void (async () => {
      try {
        broadcast$2({ type: "live-status", projectId: id, state: "connecting", watched: 0, clipsFound: 0, message: "Opening the stream…" });
        const simulate = !options.sourceUrl && Boolean(options.inputPath);
        const streamUrl = simulate ? options.inputPath : await resolveStreamUrl(project.sourceUrl ?? options.sourceUrl, (_p, message) => broadcast$2({ type: "live-status", projectId: id, state: "connecting", watched: 0, clipsFound: 0, message }), entry.abort.signal, { gaming: options.liveKind === "gaming" });
        if (entry.cancelled) return settleCancelled(entry);
        await runLiveEngine(entry, streamUrl, simulate);
      } catch (err) {
        if (!running$1.has(id)) return;
        if (keepLiveClips(entry, err.message)) return;
        const failed = { ...entry.project, status: entry.cancelled ? "cancelled" : "failed", error: entry.cancelled ? "Cancelled" : err.message, updatedAt: Date.now() };
        entry.project = failed;
        running$1.delete(id);
        void writeProject(failed);
        broadcast$2({ type: "failed", projectId: id, error: failed.error, project: failed });
      }
    })();
    return project;
  }
  if (fromUrl) {
    void (async () => {
      try {
        broadcast$2({ type: "progress", projectId: id, stage: "download", percent: 0, overall: 0, message: "Starting download…" });
        const dest = path.join(outputDir, "source");
        const captions = youtubeCaptions(entry).catch(() => void 0);
        const sound = await downloadSound(entry, dest);
        await captions;
        if (entry.cancelled) return settleCancelled(entry);
        if (sound) {
          await startWithSound(entry, sound, dest, settings.outputDir);
          return;
        }
        const res = await downloadVideo(
          project.sourceUrl,
          dest,
          (pct, message) => broadcast$2({ type: "progress", projectId: id, stage: "download", percent: pct, overall: pct * 0.2, message }),
          entry.abort.signal
        );
        if (entry.cancelled) return settleCancelled(entry);
        entry.project = { ...entry.project, options: { ...entry.project.options, inputPath: res.filePath }, updatedAt: Date.now() };
        if (res.title && !options.projectName?.trim()) entry.project.name = shortTitle(res.title, 80);
        await writeProject(entry.project);
        broadcast$2({ type: "log", projectId: id, level: "info", message: `Downloaded ${path.basename(res.filePath)}${res.title ? ` (${res.title})` : ""}` });
        if (res.via) broadcast$2({ type: "log", projectId: id, level: "info", message: `YouTube asked for proof; the video came through with: ${res.via}` });
        await runEngine(entry, settings.outputDir, 0.2);
      } catch (err) {
        if (!running$1.has(id)) return;
        const failed = { ...entry.project, status: entry.cancelled ? "cancelled" : "failed", error: entry.cancelled ? "Cancelled" : err.message, updatedAt: Date.now() };
        entry.project = failed;
        running$1.delete(id);
        void writeProject(failed);
        broadcast$2({ type: "failed", projectId: id, error: failed.error, project: failed });
      }
    })();
  } else {
    await youtubeCaptions(entry);
    await runEngine(entry, settings.outputDir, 0);
  }
  return entry.project;
}
async function keepTranscript(t, outputDir) {
  if (t.source === "youtube") return { source: "youtube", ...t.youtube ? { youtube: t.youtube } : {} };
  if (!t.text?.trim()) return void 0;
  if (Buffer.byteLength(t.text) > hardware.MAX_TRANSCRIPT_BYTES) throw new Error("This transcript is too big. Choose the subtitle or text file for the video.");
  await node_fs.promises.mkdir(outputDir, { recursive: true });
  const ext = /\.(srt|vtt|json3|srv3|txt|json|xml)$/i.exec(t.name ?? "")?.[1]?.toLowerCase() ?? "txt";
  const file2 = path.join(outputDir, `imported-transcript.${ext}`);
  await node_fs.promises.writeFile(file2, t.text, "utf8");
  return { source: "imported", name: t.name ?? "Pasted text", file: file2 };
}
async function youtubeCaptions(entry) {
  const t = entry.project.options.transcript;
  const url = entry.project.sourceUrl ?? entry.project.options.sourceUrl;
  if (t?.source !== "youtube" || !url) return;
  if (t.file && await node_fs.promises.stat(t.file).then((st) => st.size > 0, () => false)) return;
  const id = entry.project.id;
  const set2 = async (transcript) => {
    entry.project = { ...entry.project, options: { ...entry.project.options, transcript }, updatedAt: Date.now() };
    await writeProject(entry.project);
  };
  if (!t.youtube?.lang) return set2(void 0);
  try {
    const file2 = await fetchCaptions(url, t.youtube.lang, t.youtube.auto, entry.project.outputDir, entry.abort.signal);
    await set2({ ...t, file: file2, name: path.basename(file2) });
    broadcast$2({ type: "log", projectId: id, level: "info", message: `Got YouTube's ${t.youtube.auto ? "automatic " : ""}captions (${t.youtube.lang.replace(/-orig$/, "")}); the video does not need to be listened to.` });
  } catch (err) {
    if (entry.cancelled) return;
    const message = String(err.message ?? err).split("\n")[0];
    broadcast$2({ type: "log", projectId: id, level: "warn", message: `${message} Listening to the video instead.` });
    await set2(void 0);
  }
}
const SOUND_SHARE = 0.05;
async function downloadSound(entry, dest) {
  const id = entry.project.id;
  if (process.env.CLIPIE_SOUND_FIRST === "0") return null;
  try {
    return await downloadVideo(
      entry.project.sourceUrl,
      dest,
      (pct, message) => broadcast$2({ type: "progress", projectId: id, stage: "download", percent: pct, overall: pct * SOUND_SHARE, message }),
      entry.abort.signal,
      { audioOnly: true }
    );
  } catch (err) {
    const message = err.message ?? "";
    if (entry.cancelled || hardware.robotCheck(message) || /slow down/i.test(message)) throw err;
    broadcast$2({ type: "log", projectId: id, level: "warn", message: `The sound could not be fetched on its own (${message.split("\n")[0]}); downloading the whole video first.` });
    return null;
  }
}
async function startWithSound(entry, sound, dest, outputRoot) {
  const id = entry.project.id;
  if (sound.title && !entry.project.options.projectName?.trim()) {
    entry.project = { ...entry.project, name: shortTitle(sound.title, 80), updatedAt: Date.now() };
    await writeProject(entry.project);
  }
  broadcast$2({ type: "log", projectId: id, level: "info", message: `Downloaded the sound${sound.title ? ` of "${sound.title}"` : ""}; transcribing it while the video downloads.` });
  if (sound.via) broadcast$2({ type: "log", projectId: id, level: "info", message: `YouTube asked for proof; the sound came through with: ${sound.via}` });
  const side = (message, percent) => broadcast$2({ type: "side-task", projectId: id, message, ...percent !== void 0 ? { percent } : {} });
  side("Downloading the video…", 0);
  const video = downloadVideo(entry.project.sourceUrl, dest, (pct, message) => side(message, pct), entry.abort.signal, { startWith: sound.attempt });
  video.catch(() => void 0);
  await runEngine(entry, outputRoot, SOUND_SHARE, sound.filePath);
  video.then(
    async (res) => {
      side(null);
      if (entry.cancelled || !running$1.has(id)) return;
      entry.project = { ...entry.project, options: { ...entry.project.options, inputPath: res.filePath }, updatedAt: Date.now() };
      await writeProject(entry.project);
      broadcast$2({ type: "log", projectId: id, level: "info", message: `Downloaded ${path.basename(res.filePath)}${res.via && res.via !== sound.via ? ` (YouTube asked for proof; it came through with: ${res.via})` : ""}` });
      try {
        entry.child?.postMessage({ type: "video-ready", inputPath: res.filePath });
      } catch {
      }
    },
    (err) => {
      side(null);
      if (entry.cancelled || !running$1.has(id)) return;
      entry.videoError = err.message || String(err);
      const child2 = entry.child;
      if (!child2) return;
      try {
        child2.postMessage({ type: "video-failed", error: entry.videoError });
        child2.postMessage({ type: "cancel" });
      } catch {
      }
      setTimeout(() => {
        if (running$1.has(id)) killTree(child2.pid, () => child2.kill());
      }, 2500);
    }
  );
}
async function speechChoice(settings, secrets) {
  if (settings.cloudSpeech === "clipie") {
    const token = await cloudToken(45 * 6e4).catch(() => null);
    const have = (await modelStatuses()).filter((m) => m.downloaded).map((m) => m.model);
    return {
      transcription: "clipie",
      clipieUrl: await openCloudUrl() || void 0,
      clipieToken: token ?? void 0,
      localSpeechReady: settings.whisperAuto ? have.length > 0 : have.includes(settings.whisperModel)
    };
  }
  if (settings.cloudSpeech === "groq" && secrets.groqKey) {
    const have = (await modelStatuses()).filter((m) => m.downloaded).map((m) => m.model);
    return {
      transcription: "groq",
      groqKey: secrets.groqKey,
      groqSpeechModel: settings.groqSpeechModel,
      localSpeechReady: settings.whisperAuto ? have.length > 0 : have.includes(settings.whisperModel)
    };
  }
  return { transcription: settings.transcription };
}
async function runEngine(entry, _outputRoot, offset, soundPath) {
  const settings = await getSettings();
  const secrets = await getSecrets();
  const bins = resolveBinaries();
  const id = entry.project.id;
  const job = {
    type: "run",
    projectId: id,
    // The name may have come from the video's title after the download; clip folders use it.
    options: { ...entry.project.options, projectName: entry.project.name, ...soundPath ? { inputPath: soundPath } : {} },
    ...soundPath ? { videoPending: true } : {},
    speechRates: await getSpeechRates(),
    outputDir: entry.project.outputDir,
    clipsDir: settings.clipsDir,
    modelsDir: modelsDir(),
    whisperModel: ((os.cpus()?.length ?? 4) <= 4 || os.totalmem() < 8 * 1024 ** 3) && settings.whisperModel === "base" ? "tiny" : settings.whisperModel,
    ...settings.whisperAuto ? { whisperAuto: (await modelStatuses()).filter((m) => m.downloaded).map((m) => m.model) } : {},
    downloadedModels: (await modelStatuses()).filter((m) => m.downloaded).map((m) => m.model),
    ...await speechChoice(settings, secrets),
    accelerator: await resolveAccelerator(),
    writingModel: secrets.writingModel,
    openrouterKey: secrets.openrouterKey,
    llm: secrets.llm,
    llmFallbacks: secrets.llmFallbacks,
    openaiKey: secrets.openaiKey,
    ffmpegPath: bins.ffmpeg,
    ffprobePath: bins.ffprobe,
    fontsDir: fontsDir(),
    memeLibraryPath: memeLibraryPath(),
    memesDir: memesDir(),
    encoder: await hardware.sessionEncoder(bins),
    appVersion: electron.app.getVersion()
  };
  if (entry.cancelled) return settleCancelled(entry);
  const child2 = forkEngine("clipie-engine");
  entry.child = child2;
  child2.stdout?.on("data", engineLogger(id, "info"));
  child2.stderr?.on("data", engineLogger(id, "warn"));
  child2.on("message", (raw) => {
    const ev = raw;
    if (ev.type === "encoder") return void hardware.rememberEncoder(bins, ev.encoder);
    if (ev.type === "speech-rate") return void saveSpeechRate(ev.key, ev.rate).catch(() => void 0);
    if (ev.type === "clip-ready") {
      const clips = [...entry.project.clips.filter((c) => c.highlightId !== ev.clip.highlightId), ev.clip].sort((a, b) => a.index - b.index);
      entry.project = { ...entry.project, clips, ...ev.analysis ? { analysis: ev.analysis } : {} };
      broadcast$2(ev);
      return;
    }
    if (ev.type === "progress" && offset > 0) {
      broadcast$2({ ...ev, overall: Math.round((offset * 100 + ev.overall * (1 - offset)) * 10) / 10 });
      return;
    }
    if (ev.type === "done") {
      entry.project = { ...ev.project, name: entry.project.name, sourceUrl: entry.project.sourceUrl };
      running$1.delete(id);
      if (soundPath) void node_fs.promises.rm(soundPath, { force: true }).catch(() => void 0);
      void writeProject(entry.project);
      broadcast$2({ ...ev, project: entry.project });
      return;
    } else if (ev.type === "failed") {
      const error = entry.videoError ?? ev.error;
      const failed = { ...entry.project, status: entry.cancelled ? "cancelled" : "failed", error, updatedAt: Date.now() };
      entry.project = failed;
      void writeProject(failed);
      running$1.delete(id);
      broadcast$2({ ...ev, error, project: failed });
      return;
    }
    broadcast$2(ev);
  });
  child2.on("exit", (code) => {
    if (running$1.has(id)) {
      const failed = {
        ...entry.project,
        status: entry.cancelled ? "cancelled" : "failed",
        error: entry.cancelled ? "Cancelled" : entry.videoError ?? `Engine exited unexpectedly (code ${code}). Check the log for details.`,
        updatedAt: Date.now()
      };
      running$1.delete(id);
      void writeProject(failed);
      broadcast$2({ type: "failed", projectId: id, error: failed.error, project: failed });
    }
  });
  child2.postMessage(job);
}
function keepLiveClips(entry, error) {
  const id = entry.project.id;
  if (entry.project.clips.length === 0) return false;
  const done = {
    ...entry.project,
    status: "done",
    error: void 0,
    liveStopped: entry.cancelled ? void 0 : { reason: liveStopReason(error), watched: entry.watched ?? 0 },
    updatedAt: Date.now()
  };
  entry.project = done;
  running$1.delete(id);
  void writeProject(done);
  broadcast$2({ type: "done", projectId: id, project: done });
  return true;
}
function liveStopReason(error) {
  if (/connection|network|offline|ended|timed? ?out|could not be read/i.test(error)) return "The connection to the stream dropped.";
  return "Something went wrong while watching.";
}
async function runLiveEngine(entry, streamUrl, simulate) {
  const settings = await getSettings();
  const secrets = await getSecrets();
  const bins = resolveBinaries();
  const id = entry.project.id;
  const job = {
    type: "live",
    projectId: id,
    project: entry.project,
    streamUrl,
    simulate,
    outputDir: entry.project.outputDir,
    modelsDir: modelsDir(),
    transcription: settings.transcription,
    whisperModel: ((os.cpus()?.length ?? 4) <= 4 || os.totalmem() < 8 * 1024 ** 3) && settings.whisperModel === "base" ? "tiny" : settings.whisperModel,
    ...settings.whisperAuto ? { whisperAuto: (await modelStatuses()).filter((m) => m.downloaded).map((m) => m.model) } : {},
    accelerator: await resolveAccelerator(),
    writingModel: secrets.writingModel,
    openrouterKey: secrets.openrouterKey,
    llm: secrets.llm,
    llmFallbacks: secrets.llmFallbacks,
    openaiKey: secrets.openaiKey,
    ffmpegPath: bins.ffmpeg,
    ffprobePath: bins.ffprobe,
    fontsDir: fontsDir(),
    clipsDir: settings.clipsDir,
    encoder: await hardware.sessionEncoder(bins)
  };
  if (entry.cancelled) return settleCancelled(entry);
  const child2 = forkEngine("clipie-live");
  entry.child = child2;
  child2.stderr?.on("data", engineLogger(id, "warn"));
  child2.on("message", (raw) => {
    const ev = raw;
    if (ev.type === "encoder") return void hardware.rememberEncoder(bins, ev.encoder);
    if (ev.type === "done") {
      entry.project = { ...ev.project, name: entry.project.name, sourceUrl: entry.project.sourceUrl };
      running$1.delete(id);
      void writeProject(entry.project);
      broadcast$2({ ...ev, project: entry.project });
      return;
    }
    if (ev.type === "failed") {
      if (keepLiveClips(entry, ev.error)) return;
      const failed = { ...entry.project, status: entry.cancelled ? "cancelled" : "failed", error: ev.error, updatedAt: Date.now() };
      entry.project = failed;
      void writeProject(failed);
      running$1.delete(id);
      broadcast$2({ ...ev, project: failed });
      return;
    }
    if (ev.type === "clip-rendered") entry.project = ev.project;
    if (ev.type === "live-status") entry.watched = ev.watched;
    broadcast$2(ev);
  });
  child2.on("exit", (code) => {
    if (running$1.has(id)) {
      if (keepLiveClips(entry, "SNU Clipper's live watcher stopped unexpectedly.")) return;
      const failed = {
        ...entry.project,
        status: entry.cancelled ? "cancelled" : "failed",
        error: entry.cancelled ? "Cancelled" : `The live session stopped unexpectedly (code ${code}).`,
        updatedAt: Date.now()
      };
      running$1.delete(id);
      void writeProject(failed);
      broadcast$2({ type: "failed", projectId: id, error: failed.error, project: failed });
    }
  });
  child2.postMessage(job);
}
function cancelJob(projectId) {
  const entry = running$1.get(projectId);
  if (!entry) return;
  entry.cancelled = true;
  entry.abort.abort();
  const child2 = entry.child;
  if (!child2) {
    return;
  }
  try {
    child2.postMessage({ type: "cancel" });
  } catch {
  }
  setTimeout(() => {
    if (running$1.has(projectId)) killTree(child2.pid, () => child2.kill());
  }, entry.live ? 45e3 : 2500);
}
function killAll() {
  for (const entry of running$1.values()) {
    entry.cancelled = true;
    entry.abort.abort();
    const child2 = entry.child;
    if (child2) killTree(child2.pid, () => child2.kill());
  }
  for (const child2 of clipJobs.values()) if (child2) killTree(child2.pid, () => child2.kill());
  clipJobs.clear();
  for (const d of redownloads.values()) d.abort.abort();
  cancelMemePack();
}
function hasRunningJobs() {
  return running$1.size > 0 || clipJobs.size > 0 || memePackBusy();
}
function runningProject(projectId) {
  return running$1.get(projectId)?.project;
}
function isRunning(projectId) {
  return running$1.has(projectId) || [...clipJobs.keys()].some((k) => k.startsWith(`${projectId}:`));
}
async function renderClipJob(projectId, highlightId, clipSettings) {
  if (running$1.has(projectId)) throw new Error("This project is still processing.");
  const key = `${projectId}:${highlightId}`;
  if (clipJobs.has(key)) throw new Error("This clip is already being rendered.");
  clipJobs.set(key, null);
  let ready;
  let settings;
  try {
    settings = await getSettings();
    const project = await findProject(settings.outputDir, projectId);
    if (!project) throw new Error("Project not found.");
    if (!project.analysis?.highlights.some((h) => h.id === highlightId)) throw new Error("Clip not found.");
    const missing = !await node_fs.promises.stat(project.options.inputPath).then((s) => s.isFile()).catch(() => false);
    await ensureDiskSpace(settings.outputDir, 0, 1, missing);
    ready = missing ? await downloadAgain(project, highlightId) : project;
  } catch (err) {
    clipJobs.delete(key);
    throw err;
  }
  const bins = resolveBinaries();
  const job = {
    type: "render-clip",
    projectId,
    project: ready,
    highlightId,
    settings: clipSettings,
    ffmpegPath: bins.ffmpeg,
    ffprobePath: bins.ffprobe,
    fontsDir: fontsDir(),
    clipsDir: settings.clipsDir,
    memesDir: memesDir(),
    encoder: await hardware.sessionEncoder(bins)
  };
  const child2 = forkEngine("clipie-clip-render");
  clipJobs.set(key, child2);
  child2.stderr?.on("data", (d) => {
    const msg = String(d).trim();
    if (msg) broadcast$2({ type: "log", projectId, level: "warn", message: msg });
  });
  child2.on("message", (raw) => {
    const ev = raw;
    if (ev.type === "encoder") return void hardware.rememberEncoder(bins, ev.encoder);
    if (ev.type === "clip-rendered") {
      clipJobs.delete(key);
      void mergeRenderedClip(ready, ev.project, highlightId).then((merged) => broadcast$2({ ...ev, project: merged }));
      return;
    } else if (ev.type === "clip-failed") {
      clipJobs.delete(key);
    }
    broadcast$2(ev);
  });
  child2.on("exit", (code) => {
    if (clipJobs.get(key) === child2) {
      clipJobs.delete(key);
      broadcast$2({ type: "clip-failed", projectId, highlightId, error: `Render process exited unexpectedly (code ${code}).` });
    }
  });
  child2.postMessage(job);
}
async function removeDownload(project) {
  if (!project.sourceUrl || project.sourceRemoved) return project;
  const dir = path.join(project.outputDir, "source");
  if (path.dirname(project.options.inputPath) !== dir) return project;
  const bytes = await dirSize(dir);
  try {
    await node_fs.promises.rm(dir, { recursive: true, force: true });
  } catch (err) {
    broadcast$2({ type: "log", projectId: project.id, level: "warn", message: `Could not delete the downloaded video: ${err.message}` });
    return project;
  }
  broadcast$2({ type: "log", projectId: project.id, level: "info", message: `Deleted the downloaded video (${Math.round(bytes / 1e6)} MB) now that the clips are made. It downloads again if you change a clip's look.` });
  return { ...project, sourceRemoved: true };
}
let mergeQueue = Promise.resolve();
function mergeRenderedClip(started, rendered, highlightId) {
  const next = mergeQueue.then(async () => {
    const base = await readProject(started.outputDir).catch(() => null) ?? started;
    const clip = rendered.clips.find((c) => c.highlightId === highlightId);
    const clips = clip ? (base.clips.some((c) => c.highlightId === highlightId) ? base.clips.map((c) => c.highlightId === highlightId ? clip : c) : [...base.clips, clip]).sort((a, b) => a.index - b.index) : base.clips;
    const merged = { ...base, clips, options: { ...base.options, inputPath: rendered.options.inputPath }, sourceRemoved: rendered.sourceRemoved ?? base.sourceRemoved, updatedAt: Date.now() };
    await writeProject(merged);
    return merged;
  });
  mergeQueue = next.catch(() => void 0);
  return next;
}
function deleteClip(project, highlightId) {
  if (running$1.has(project.id)) return Promise.reject(new Error("This project is still working."));
  if (clipJobs.has(`${project.id}:${highlightId}`)) return Promise.reject(new Error("This clip is being made right now. Try again when it is done."));
  const next = mergeQueue.then(async () => {
    const base = await readProject(project.outputDir).catch(() => null) ?? project;
    const clip = base.clips.find((c) => c.highlightId === highlightId);
    if (!clip) return base;
    for (const file2 of [clip.filePath, clip.thumbnailPath, clip.srtPath]) {
      if (file2) await node_fs.promises.rm(file2, { force: true, maxRetries: 5, retryDelay: 200 }).catch(() => void 0);
    }
    const updated = { ...base, clips: base.clips.filter((c) => c.highlightId !== highlightId), updatedAt: Date.now() };
    await writeProject(updated);
    return updated;
  });
  mergeQueue = next.catch(() => void 0);
  return next;
}
const redownloads = /* @__PURE__ */ new Map();
function downloadAgain(project, highlightId) {
  const current2 = redownloads.get(project.id);
  if (current2) return current2.done;
  const abort = new AbortController();
  const done = fetchAgain(project, highlightId, abort.signal).finally(() => redownloads.delete(project.id));
  redownloads.set(project.id, { abort, done });
  return done;
}
async function fetchAgain(project, highlightId, signal) {
  if (!project.sourceUrl) {
    throw new Error(`The video this project was made from is no longer at ${project.options.inputPath}, so its clips cannot be re-rendered.`);
  }
  const progress = (percent, message) => broadcast$2({ type: "clip-progress", projectId: project.id, highlightId, percent: Math.min(0.9 * percent, 90), message });
  progress(0, "Downloading the video again…");
  const res = await downloadVideo(project.sourceUrl, path.join(project.outputDir, "source"), progress, signal);
  const updated = { ...project, sourceRemoved: false, options: { ...project.options, inputPath: res.filePath }, updatedAt: Date.now() };
  await writeProject(updated);
  broadcast$2({ type: "log", projectId: project.id, level: "info", message: "Downloaded the video again to re-render this clip." });
  return updated;
}
function shortTitle(title, max) {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s|,:;.-]+$/, "");
}
function cacheDir() {
  return path.join(electron.app.getPath("userData"), "cache");
}
async function saveTextCard(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Not a PNG card");
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > 2e7) throw new Error("Text card too large");
  const key = crypto.createHash("sha1").update(bytes).digest("hex");
  const out = path.join(cacheDir(), "texts", `${key}.png`);
  try {
    await node_fs.promises.access(out);
  } catch {
    await node_fs.promises.mkdir(path.dirname(out), { recursive: true });
    await node_fs.promises.writeFile(out, bytes);
  }
  return out;
}
async function saveLogo(file2) {
  const bytes = await node_fs.promises.readFile(file2);
  if (bytes.length > 3e7) throw new Error("That picture is too big for a logo (over 30 MB).");
  const key = crypto.createHash("sha1").update(bytes).digest("hex");
  const out = path.join(cacheDir(), "logos", `${key}.png`);
  if (!await exists(out)) {
    await node_fs.promises.mkdir(path.dirname(out), { recursive: true });
    const tmp = `${out}.tmp.png`;
    const res = await local.run(resolveBinaries().ffmpeg, ["-v", "error", "-y", "-i", file2, "-frames:v", "1", "-vf", "scale='min(1024,iw)':-2:flags=lanczos,format=rgba", tmp]);
    if (res.code !== 0) {
      await node_fs.promises.rm(tmp, { force: true });
      throw new Error("SNU Clipper could not read that picture. Try a PNG or JPG.");
    }
    await node_fs.promises.rename(tmp, out);
  }
  const size = await local.probe(resolveBinaries(), out);
  if (!size.width || !size.height) throw new Error("SNU Clipper could not read that picture. Try a PNG or JPG.");
  return { path: out, w: size.width, h: size.height };
}
const PEAKS = 120;
async function songPeaks(file2, out) {
  const tmp = `${out}.peaks.raw`;
  try {
    const res = await local.run(resolveBinaries().ffmpeg, ["-v", "error", "-y", "-i", file2, "-vn", "-ac", "1", "-ar", "200", "-f", "s16le", tmp]);
    if (res.code !== 0) return [];
    const raw = await node_fs.promises.readFile(tmp);
    const samples = Math.floor(raw.length / 2);
    if (!samples) return [];
    const out2 = [];
    for (let i = 0; i < PEAKS; i++) {
      let top = 0;
      const to = Math.min(samples, Math.floor((i + 1) * samples / PEAKS));
      for (let s = Math.floor(i * samples / PEAKS); s < to; s++) top = Math.max(top, Math.abs(raw.readInt16LE(s * 2)));
      out2.push(top);
    }
    const loudest = Math.max(...out2, 1);
    return out2.map((v) => Math.round(v / loudest * 99));
  } finally {
    await node_fs.promises.rm(tmp, { force: true }).catch(() => void 0);
  }
}
async function saveMusic(file2) {
  const size = (await node_fs.promises.stat(file2)).size;
  if (size > 3e8) throw new Error("That file is too big for background music (over 300 MB). Choose a shorter song.");
  const hash = crypto.createHash("sha1");
  for await (const chunk of node_fs.createReadStream(file2)) hash.update(chunk);
  const out = path.join(cacheDir(), "music", `${hash.digest("hex")}${path.extname(file2).toLowerCase()}`);
  if (!await exists(out)) {
    await node_fs.promises.mkdir(path.dirname(out), { recursive: true });
    await node_fs.promises.copyFile(file2, out);
  }
  const res = await local.run(resolveBinaries().ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type:format=duration", "-of", "json", out]);
  let duration = 0;
  let hasSound = false;
  try {
    const json = JSON.parse(res.stdout);
    hasSound = Boolean(json.streams?.length);
    duration = Number(json.format?.duration ?? 0);
  } catch {
  }
  if (res.code !== 0 || !hasSound || !(duration > 0)) {
    await node_fs.promises.rm(out, { force: true }).catch(() => void 0);
    throw new Error("SNU Clipper could not find any sound in that file. Try an MP3, M4A or WAV.");
  }
  return {
    path: out,
    name: path.basename(file2),
    duration,
    volume: hardware.MUSIC_DEFAULT_VOLUME,
    songStart: 0,
    clipStart: 0,
    peaks: await songPeaks(out, out)
  };
}
function mediaUrl(p) {
  return `clipie://media/${encodeURIComponent(p.replace(/\\/g, "/"))}`;
}
async function exists(p) {
  return node_fs.promises.access(p).then(() => true, () => false);
}
async function posterFor(filePath, at) {
  try {
    const st = await node_fs.promises.stat(filePath);
    const bins = resolveBinaries();
    const info = await local.probe(bins, filePath);
    const seconds = Math.max(0, Math.min(info.duration - 0.1, at ?? Math.min(3, info.duration * 0.2)));
    const key = crypto.createHash("sha1").update(`${filePath}|${st.size}|${st.mtimeMs}|${seconds.toFixed(2)}`).digest("hex");
    const out = path.join(cacheDir(), "posters", `${key}.jpg`);
    if (!await exists(out)) {
      await node_fs.promises.mkdir(path.dirname(out), { recursive: true });
      await local.thumbnail(bins, filePath, seconds, out, 720);
    }
    return { url: mediaUrl(out), width: info.width, height: info.height, duration: info.duration };
  } catch {
    return null;
  }
}
async function remotePosterFor(url) {
  const id = hardware.parseYouTubeId(url);
  if (!id) return null;
  const out = path.join(cacheDir(), "posters", `yt-${id}.jpg`);
  if (!await exists(out)) {
    await node_fs.promises.mkdir(path.dirname(out), { recursive: true });
    for (const name of ["maxresdefault", "hqdefault"]) {
      try {
        const res = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { signal: AbortSignal.timeout(15e3) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 2e3) continue;
        await node_fs.promises.writeFile(out, buf);
        break;
      } catch {
      }
    }
  }
  if (!await exists(out)) return null;
  return { url: mediaUrl(out), width: 1280, height: 720, duration: 0 };
}
let cache$1 = null;
let queue = Promise.resolve();
function file() {
  return path.join(electron.app.getPath("userData"), "folders.json");
}
async function getFolders() {
  if (cache$1) return cache$1;
  let raw = null;
  try {
    raw = await node_fs.promises.readFile(file(), "utf8");
  } catch {
  }
  try {
    cache$1 = raw === null ? hardware.emptyFolders() : hardware.normalizeFolders(JSON.parse(raw));
  } catch {
    await node_fs.promises.rename(file(), `${file()}.bad`).catch(() => void 0);
    cache$1 = hardware.emptyFolders();
  }
  return cache$1;
}
function change(fn) {
  const next = queue.then(async () => {
    const before = await getFolders();
    const after = fn(before);
    if (after !== before) await save(after);
    return after;
  });
  queue = next.catch(() => void 0);
  return next;
}
async function save(d) {
  await node_fs.promises.mkdir(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.tmp`;
  await node_fs.promises.writeFile(tmp, JSON.stringify(d, null, 2), "utf8");
  await node_fs.promises.rename(tmp, file()).catch(async () => {
    await node_fs.promises.writeFile(file(), JSON.stringify(d, null, 2), "utf8");
    await node_fs.promises.rm(tmp, { force: true });
  });
  cache$1 = d;
}
const createFolderNamed = (name) => change((d) => hardware.createFolder(d, name, crypto.randomUUID()));
const renameFolderTo = (id, name) => change((d) => hardware.renameFolder(d, id, name));
const removeFolder = (id) => change((d) => hardware.deleteFolder(d, id));
const moveProjects = (projectIds, folderId) => change((d) => hardware.moveToFolder(d, projectIds, folderId));
const forgetProject = (projectId) => change((d) => hardware.forgetProjects(d, [projectId]));
let cache = null;
const TTL = 60 * 60 * 1e3;
async function listFreeModels(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.models;
  const res = await fetch(hardware.OPENROUTER_MODELS_URL, { signal: AbortSignal.timeout(2e4) });
  if (!res.ok) throw new Error(`OpenRouter model list failed (${res.status}).`);
  const json = await res.json();
  const models = hardware.rankFreeModels(json.data ?? []);
  cache = { at: Date.now(), models };
  return models;
}
async function listProviderModels(id) {
  const secrets = await providerSecrets(id);
  if (!secrets.baseUrl) throw new Error("Enter the service's base URL first.");
  if (!secrets.key) throw new Error("Save a key for this service first.");
  const headers = id === "anthropic" ? { "x-api-key": secrets.key, "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${secrets.key}` };
  const res = await fetch(`${secrets.baseUrl}/models`, { headers, signal: AbortSignal.timeout(2e4) });
  if (res.status === 401 || res.status === 403) throw new Error("The service refused this key.");
  if (!res.ok) throw new Error(`The service answered ${res.status} when asked for its models.`);
  const json = await res.json();
  return (json.data ?? []).map((m) => m.id ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b));
}
async function testCloudSpeech() {
  const { key } = await providerSecrets("groq");
  if (!key) return { ok: false, message: "Save your Groq key first." };
  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(2e4) });
  } catch {
    return { ok: false, message: "Could not reach Groq. Check your internet connection and try again." };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, message: "Groq did not accept this key. Copy it again from console.groq.com/keys and save it." };
  if (res.status === 429) return { ok: true, message: "The key works, but Groq is asking to slow down right now. Projects wait a moment and carry on." };
  if (!res.ok) return { ok: false, message: "Groq is not answering properly right now. Try again in a few minutes." };
  const json = await res.json().catch(() => ({}));
  const ids = (json.data ?? []).map((m) => m.id ?? "");
  if (!ids.some((id) => id.startsWith("whisper-large-v3"))) {
    return { ok: false, message: "The key works, but Groq does not offer its Whisper speech models to it." };
  }
  return { ok: true, message: "The key works. Speech will be transcribed on Groq." };
}
let running = false;
function sendToWindows(ev) {
  for (const w of electron.BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("speed:event", ev);
  }
}
const broadcast$1 = hardware.eventThrottle(sendToWindows, (ev) => ev.type === "speed-progress" ? "speed" : null).push;
async function runSpeedTest(model = "tiny") {
  if (running) throw new Error("A speed test is already running.");
  running = true;
  const child2 = electron.utilityProcess.fork(enginePath(), [], {
    serviceName: "snu-speedtest",
    stdio: "pipe",
    env: { ...process.env, CLIPIE_ENGINE: "1" }
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      running = false;
      fn();
    };
    child2.on("message", (raw) => {
      const ev = raw;
      broadcast$1(ev);
      if (ev.type === "speed-done" && ev.result) {
        void saveAccelerationTest(ev.result);
        finish(() => resolve(ev.result));
      } else if (ev.type === "speed-failed") {
        finish(() => reject(new Error(ev.error ?? "The speed test failed.")));
      }
    });
    child2.on("exit", (code) => {
      finish(() => reject(new Error(`The speed test stopped unexpectedly (code ${code}).`)));
    });
    const job = { type: "speed-test", modelsDir: modelsDir(), model };
    child2.postMessage(job);
  });
}
const { autoUpdater } = electronUpdater;
const run = node_util.promisify(node_child_process.execFile);
const RECHECK_MS = 20 * 60 * 1e3;
const STALL_MS = 45e3;
const MAX_TRIES_ONLINE = 4;
const smoke = process.env.CLIPIE_SMOKE_UPDATE_RUN === "1";
let state = { status: "idle", currentVersion: "", canInstall: true };
let latest = null;
let installWhenDownloaded = false;
let quietCheck = false;
let downloading = false;
function broadcast() {
  for (const w of electron.BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("update:state", state);
  }
}
function set(patch) {
  state = { ...state, ...patch };
  if (smoke) console.log(`[update] ${(/* @__PURE__ */ new Date()).toISOString()} ${JSON.stringify({ ...state, notes: void 0 })}`);
  broadcast();
}
function fail(err) {
  installWhenDownloaded = false;
  if (smoke) console.log(`[update] raw error: ${String(err?.stack ?? err)}`);
  set({ status: "error", waiting: false, error: hardware.updateErrorMessage(err) });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function macBundlePath() {
  return path.resolve(electron.app.getPath("exe"), "../../..");
}
function linuxPackage() {
  if (process.env.APPIMAGE) return "appimage";
  try {
    const kind = node_fs.readFileSync(path.join(process.resourcesPath, "package-type"), "utf8").trim();
    return kind === "deb" || kind === "rpm" ? kind : "other";
  } catch {
    return "other";
  }
}
function onAppleSilicon() {
  return process.arch === "arm64" || electron.app.runningUnderARM64Translation === true;
}
function feedRepo() {
  try {
    const text = node_fs.readFileSync(path.join(process.resourcesPath, "app-update.yml"), "utf8");
    const owner = /^owner:\s*(.+)$/m.exec(text)?.[1]?.trim();
    const repo = /^repo:\s*(.+)$/m.exec(text)?.[1]?.trim();
    if (owner && repo) return { owner, repo };
  } catch {
  }
  return hardware.RELEASES_REPO;
}
function manualDownloadUrl() {
  const arch = process.platform === "darwin" && onAppleSilicon() ? "arm64" : process.arch;
  return hardware.latestDownloadUrl(hardware.manualDownloadName(process.platform, arch, process.platform === "linux" ? linuxPackage() : void 0), feedRepo());
}
async function writable(dir) {
  try {
    await node_fs.promises.access(dir, node_fs.promises.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
async function installBlocker() {
  if (!electron.app.isPackaged) return void 0;
  if (process.platform === "linux") {
    const kind = linuxPackage();
    if (kind === "deb" || kind === "rpm") {
      return `This copy was installed from a .${kind} package, which can't update itself. SNU Clipper opens the new .${kind} in your browser: open it to install over this one.`;
    }
    if (kind === "other") return "This copy of SNU Clipper can't update itself. SNU Clipper opens the new version in your browser instead.";
    if (!await writable(path.dirname(process.env.APPIMAGE))) {
      return `SNU Clipper can't write to ${path.dirname(process.env.APPIMAGE)}, where its AppImage is. SNU Clipper opens the new version in your browser instead.`;
    }
    return void 0;
  }
  if (process.platform !== "darwin") return void 0;
  const bundle = macBundlePath();
  if (bundle.startsWith("/Volumes/") && !await writable(path.dirname(bundle))) {
    return "SNU Clipper is running from the disk image. Drag it to your Applications folder, open it from there, then update.";
  }
  if (bundle.includes("/AppTranslocation/")) {
    return "macOS is running SNU Clipper from a temporary copy. Drag SNU Clipper to your Applications folder, open it from there, then update.";
  }
  if (!await writable(path.dirname(bundle)) || !await writable(bundle)) {
    return `SNU Clipper can't write to ${path.dirname(bundle)}. SNU Clipper opens the new version in your browser instead.`;
  }
  return void 0;
}
function blockerHasDownload(reason) {
  return /in your browser/.test(reason);
}
async function refreshBlocker() {
  const reason = await installBlocker();
  set({ canInstall: !reason, installBlockedReason: reason, downloadUrl: reason && blockerHasDownload(reason) ? manualDownloadUrl() : void 0 });
  return reason;
}
function initUpdater() {
  state = { status: "idle", currentVersion: electron.app.getVersion(), canInstall: true };
  void refreshBlocker();
  if (process.platform === "darwin" && electron.app.isPackaged) void tidyMacLeftovers();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = process.platform !== "darwin";
  autoUpdater.logger = smoke ? console : null;
  autoUpdater.on("checking-for-update", () => {
    if (!quietCheck) set({ status: "checking", error: void 0 });
  });
  autoUpdater.on("update-available", (info) => {
    latest = info;
    if (state.status === "downloading" || state.status === "installing" || state.status === "ready") return;
    set({ status: "available", newVersion: info.version, notes: typeof info.releaseNotes === "string" ? info.releaseNotes : void 0, error: void 0 });
  });
  autoUpdater.on("update-not-available", () => {
    latest = null;
    if (state.status === "downloading" || state.status === "installing") return;
    set({ status: "up-to-date", newVersion: void 0, error: void 0 });
  });
  autoUpdater.on("download-progress", (p) => {
    const percent = Math.floor(p.percent);
    if (percent !== state.percent || state.waiting) set({ status: "downloading", percent, waiting: false });
  });
  autoUpdater.on("update-downloaded", (info) => {
    if (!installWhenDownloaded) {
      set({ status: "ready", newVersion: info.version, percent: 100, waiting: false });
      return;
    }
    set({ status: "installing", newVersion: info.version, percent: 100, waiting: false });
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
  });
  autoUpdater.on("error", (err) => {
    if (quietCheck || downloading) return;
    fail(err);
  });
  if (electron.app.isPackaged) {
    setTimeout(() => void check(true), 2e3);
    setInterval(() => {
      if (state.status !== "downloading" && state.status !== "installing") void check(true);
    }, RECHECK_MS);
  }
  const fake = process.env.CLIPIE_SMOKE_UPDATE;
  if (fake) setTimeout(() => set({ status: fake, newVersion: "0.3.0", percent: 42, error: fake === "error" ? hardware.UPDATE_MESSAGES.offline : void 0 }), 500);
  if (smoke) {
    autoUpdater.once("update-available", () => void downloadAndInstall(true));
  }
}
function getUpdateState() {
  return state;
}
async function check(quiet = false) {
  if (!electron.app.isPackaged) {
    set({ status: "up-to-date", error: quiet ? void 0 : "Updates only work in an installed build." });
    return state;
  }
  if (state.status === "downloading" || state.status === "installing") return state;
  quietCheck = quiet;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    if (!quiet) fail(err);
  } finally {
    quietCheck = false;
  }
  return state;
}
async function openDownload() {
  await electron.shell.openExternal(state.downloadUrl ?? manualDownloadUrl());
}
async function waitForNetwork() {
  const { lookup } = await import("node:dns/promises");
  const up = async () => electron.net.isOnline() && await lookup("github.com").then(() => true, () => false);
  let wasDown = false;
  for (let wait = 2e3; ; wait = Math.min(wait * 2, 1e4)) {
    if (await up()) {
      if (wasDown) set({ waiting: false });
      return wasDown;
    }
    if (!wasDown) set({ waiting: true });
    wasDown = true;
    await sleep(wait);
  }
}
async function untilOnline(attempt) {
  let fineButFailing = 0;
  for (; ; ) {
    try {
      return await attempt();
    } catch (err) {
      if (!hardware.isNetworkTrouble(err)) throw err;
      if (smoke) console.log(`[update] network trouble, will retry: ${String(err?.message ?? err)}`);
      const wasDown = await waitForNetwork();
      if (!wasDown && ++fineButFailing >= MAX_TRIES_ONLINE) throw err;
      if (!wasDown) await sleep(2e3 * fineButFailing);
    }
  }
}
async function download() {
  if (process.platform === "darwin") return downloadAndInstall();
  return downloadWithUpdater(false);
}
async function downloadWithUpdater(install) {
  installWhenDownloaded = install;
  downloading = true;
  try {
    set({ status: "downloading", percent: 0, error: void 0, waiting: false });
    await untilOnline(() => autoUpdater.downloadUpdate());
  } catch (err) {
    fail(err);
  } finally {
    downloading = false;
  }
  return state;
}
function installNow() {
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
}
async function downloadAndInstall(skipPrompt = false) {
  if (state.status === "downloading" || state.status === "installing") return state;
  if (!latest) {
    await check();
    if (!latest) return state;
  }
  const blocker = await refreshBlocker();
  if (blocker) {
    set({ status: "error", error: blocker });
    if (smoke) {
      console.log(`[update] blocked: ${blocker}${state.downloadUrl ? ` (would open ${state.downloadUrl})` : ""}`);
    } else if (state.downloadUrl) {
      void openDownload();
    } else {
      const win = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0];
      const opts = { type: "info", buttons: ["OK"], message: "SNU Clipper can't update itself from here", detail: blocker };
      void (win ? electron.dialog.showMessageBox(win, opts) : electron.dialog.showMessageBox(opts));
    }
    return state;
  }
  if (!skipPrompt && hasRunningJobs()) {
    const win = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0];
    const opts = {
      type: "question",
      buttons: ["Update now", "Later"],
      defaultId: 1,
      cancelId: 1,
      message: "A project is still processing",
      detail: "SNU Clipper restarts to finish the update, which stops the running job. Update anyway?"
    };
    const { response } = win ? await electron.dialog.showMessageBox(win, opts) : await electron.dialog.showMessageBox(opts);
    if (response !== 0) return state;
  }
  if (process.platform !== "darwin") {
    if (state.status === "ready") {
      installWhenDownloaded = true;
      set({ status: "installing" });
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
      return state;
    }
    return downloadWithUpdater(true);
  }
  try {
    await installMac(latest);
  } catch (err) {
    fail(err);
  }
  return state;
}
const STAGING_PREFIX = ".nizam-update-";
function macWorkDir(version) {
  return path.join(electron.app.getPath("temp"), `nizam-update-${version}`);
}
async function tidyMacLeftovers() {
  const bundle = macBundlePath();
  const dir = path.dirname(bundle);
  await node_fs.promises.rm(`${bundle}.previous`, { recursive: true, force: true }).catch(() => void 0);
  for (const name of await node_fs.promises.readdir(dir).catch(() => [])) {
    if (name.startsWith(STAGING_PREFIX)) await node_fs.promises.rm(path.join(dir, name), { recursive: true, force: true }).catch(() => void 0);
  }
  const temp = electron.app.getPath("temp");
  for (const name of await node_fs.promises.readdir(temp).catch(() => [])) {
    const m = /^nizam-update-(\d+\.\d+\.\d+)$/.exec(name);
    if (m && !hardware.isNewerVersion(m[1], electron.app.getVersion())) await node_fs.promises.rm(path.join(temp, name), { recursive: true, force: true }).catch(() => void 0);
  }
}
class HttpStatusError extends Error {
  constructor(status) {
    super(`Download failed (HTTP ${status}).`);
    this.status = status;
  }
  status;
}
async function fetchInto(url, dest, size) {
  let have = await node_fs.promises.stat(dest).then((s) => s.size, () => 0);
  if (size && have > size) {
    await node_fs.promises.rm(dest, { force: true });
    have = 0;
  }
  if (size && have === size) return;
  const ctrl = new AbortController();
  let timer;
  const stalled = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(new Error("download stalled")), STALL_MS);
  };
  stalled();
  try {
    const res = await electron.net.fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {}, signal: ctrl.signal });
    if (res.status === 416) {
      await node_fs.promises.rm(dest, { force: true });
      throw new Error("download stopped early (range not satisfiable)");
    }
    if (!res.ok || !res.body) throw new HttpStatusError(res.status);
    const resumed = res.status === 206;
    if (!resumed) have = 0;
    const total = size || (Number(res.headers.get("content-length")) || 0) + have;
    const out = node_fs.createWriteStream(dest, { flags: resumed ? "a" : "w" });
    const closed = new Promise((resolve, reject) => {
      out.once("close", () => resolve());
      out.once("error", reject);
    });
    let received = have;
    try {
      const reader = res.body.getReader();
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        stalled();
        if (!out.write(value)) await new Promise((r) => out.once("drain", () => r()));
        received += value.length;
        const percent = total ? Math.min(99, Math.floor(received / total * 100)) : 0;
        if (percent !== state.percent || state.waiting) set({ percent, waiting: false });
      }
    } finally {
      out.end();
      await closed;
    }
    if (size && received < size) throw new Error("download stopped early");
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error("download stalled");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
async function sha512File(file2) {
  const hash = crypto.createHash("sha512");
  for await (const chunk of node_fs.createReadStream(file2)) hash.update(chunk);
  return hash.digest("base64");
}
async function plistVersion(bundle) {
  const { stdout } = await run("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", path.join(bundle, "Contents/Info.plist")]);
  return stdout.trim();
}
async function installMac(info) {
  const file2 = hardware.macZipFor(info.files, process.arch, onAppleSilicon());
  if (!file2) throw new Error(`Version ${info.version} has no download for this Mac yet. Try again later, or download it from the website.`);
  const { owner, repo } = feedRepo();
  const url = smoke && process.env.CLIPIE_SMOKE_UPDATE_URL || `https://github.com/${owner}/${repo}/releases/download/v${info.version}/${encodeURIComponent(file2.url)}`;
  const work = macWorkDir(info.version);
  await node_fs.promises.mkdir(work, { recursive: true });
  const zip = path.join(work, file2.url);
  set({ status: "downloading", newVersion: info.version, percent: 0, error: void 0, waiting: false });
  if (file2.size) {
    const need = file2.size * 3.5;
    const free = await node_fs.promises.statfs(path.dirname(macBundlePath())).then((s) => s.bavail * s.bsize, () => Infinity);
    if (free < need) throw new Error("ENOSPC: not enough space for the update");
  }
  await untilOnline(() => fetchInto(url, zip, file2.size ?? 0));
  if (file2.sha512 && await sha512File(zip) !== file2.sha512) {
    await node_fs.promises.rm(zip, { force: true });
    throw new Error("The download was damaged (checksum mismatch).");
  }
  set({ status: "installing", percent: 100 });
  const bundle = macBundlePath();
  const staging = path.join(path.dirname(bundle), `${STAGING_PREFIX}${info.version}`);
  await node_fs.promises.rm(staging, { recursive: true, force: true });
  try {
    await run("/usr/bin/ditto", ["-x", "-k", zip, staging]);
    const appName = (await node_fs.promises.readdir(staging)).find((n) => n.endsWith(".app"));
    if (!appName) throw new Error("The update archive does not contain the app.");
    const fresh = path.join(staging, appName);
    const version = await plistVersion(fresh).catch(() => "");
    if (version !== info.version) throw new Error("The download was damaged (checksum mismatch).");
    await node_fs.promises.access(path.join(fresh, "Contents/MacOS", path.basename(electron.app.getPath("exe"))), node_fs.promises.constants.X_OK);
    const script = path.join(work, "install.sh");
    const log = path.join(electron.app.getPath("logs"), "update.log");
    await node_fs.promises.mkdir(path.dirname(log), { recursive: true });
    await node_fs.promises.writeFile(script, hardware.MAC_SWAP_SCRIPT, { mode: 493 });
    node_child_process.spawn("/bin/bash", [script, String(process.pid), bundle, fresh, work, staging, log], { detached: true, stdio: "ignore" }).unref();
  } catch (err) {
    await node_fs.promises.rm(staging, { recursive: true, force: true }).catch(() => void 0);
    throw err;
  }
  setTimeout(() => electron.app.quit(), 900);
  setTimeout(() => electron.app.exit(0), 15e3).unref();
}
const VIDEO_EXT = ["mp4", "mov", "mkv", "webm", "m4v", "avi", "mts", "m2ts", "wmv", "flv", "3gp"];
function registerIpc() {
  electron.ipcMain.handle("settings:get", () => getSettings());
  electron.ipcMain.handle("settings:update", async (_e, u) => {
    const next = await updateSettings(u);
    if (u.theme || u.accent) setWindowAppearance({ theme: next.theme, accent: next.accent });
    return next;
  });
  electron.ipcMain.handle("settings:pickOutputDir", async (e) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
    if (res.canceled || !res.filePaths[0]) return null;
    await updateSettings({ outputDir: res.filePaths[0] });
    return res.filePaths[0];
  });
  electron.ipcMain.handle("settings:pickModelsDir", async (e) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, {
      title: "Where should SNU Clipper keep speech models?",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: (await getSettings()).modelsDir
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return { dir: res.filePaths[0], ...await inspectModelsDir(res.filePaths[0]) };
  });
  electron.ipcMain.handle("settings:setModelsDir", (_e, dir, move) => moveModelsTo(dir, move));
  electron.ipcMain.handle("memes:status", () => memePackStatus());
  electron.ipcMain.handle("memes:download", () => void downloadMemePack());
  electron.ipcMain.handle("memes:cancel", () => cancelMemePack());
  electron.ipcMain.handle("memes:delete", () => deleteMemePack());
  electron.ipcMain.handle("models:status", () => modelStatuses());
  electron.ipcMain.handle("models:download", (_e, model) => downloadModel(model));
  electron.ipcMain.handle("models:cancel", () => cancelDownload());
  electron.ipcMain.handle("models:delete", (_e, model) => deleteModel(model));
  electron.ipcMain.handle("ai:listModels", (_e, force) => listFreeModels(Boolean(force)));
  electron.ipcMain.handle("ai:listProviderModels", (_e, id) => listProviderModels(id));
  electron.ipcMain.handle("ai:testCloudSpeech", () => testCloudSpeech());
  electron.ipcMain.handle("ai:connectOpenRouter", () => connectOpenRouter());
  electron.ipcMain.handle("ai:cancelConnectOpenRouter", () => cancelConnectOpenRouter());
  electron.ipcMain.handle("cloud:account", () => account());
  electron.ipcMain.handle("cloud:signIn", () => signIn());
  electron.ipcMain.handle("cloud:cancelSignIn", () => cancelSignIn());
  electron.ipcMain.handle("cloud:signOut", () => signOut());
  electron.ipcMain.handle("cloud:signInEmail", (_e, email, password) => signInWithEmail(String(email), String(password)));
  electron.ipcMain.handle("cloud:signUpEmail", (_e, email, password, name) => signUpWithEmail(String(email), String(password), String(name ?? "")));
  electron.ipcMain.handle("speed:test", (_e, model) => runSpeedTest(model));
  electron.ipcMain.handle("update:state", () => getUpdateState());
  electron.ipcMain.handle("update:check", () => check());
  electron.ipcMain.handle("update:download", () => download());
  electron.ipcMain.handle("update:install", () => installNow());
  electron.ipcMain.handle("update:run", () => downloadAndInstall());
  electron.ipcMain.handle("update:open-download", () => openDownload());
  electron.ipcMain.handle("storage:overview", async () => storageOverview((await getSettings()).outputDir));
  electron.ipcMain.handle("storage:clearTemp", async () => clearTemp((await getSettings()).outputDir));
  electron.ipcMain.handle("storage:clearDownloads", async () => clearDownloads((await getSettings()).outputDir));
  electron.ipcMain.handle("settings:pickClipsDir", async (e) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const current2 = (await getSettings()).clipsDir;
    const res = await electron.dialog.showOpenDialog(win, {
      title: "Where should SNU Clipper save your clips?",
      properties: ["openDirectory", "createDirectory"],
      ...current2 ? { defaultPath: current2 } : {}
    });
    if (res.canceled || !res.filePaths[0]) return null;
    await updateSettings({ clipsDir: res.filePaths[0] });
    return res.filePaths[0];
  });
  electron.ipcMain.handle("storage:deleteAllModels", () => deleteAllModels());
  electron.ipcMain.handle("files:pickVideo", async (e) => {
    if (process.env.CLIPIE_E2E_VIDEO) return describeFile(process.env.CLIPIE_E2E_VIDEO);
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Video", extensions: VIDEO_EXT }]
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return describeFile(res.filePaths[0]);
  });
  electron.ipcMain.handle("files:describe", (_e, p) => describeFile(p));
  electron.ipcMain.handle("files:poster", (_e, p, at) => posterFor(p, at));
  electron.ipcMain.handle("files:remotePoster", (_e, url) => remotePosterFor(url));
  electron.ipcMain.handle("files:saveTextCard", (_e, dataUrl) => saveTextCard(dataUrl));
  electron.ipcMain.handle("files:pickScreenshot", async (e) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Screenshot", extensions: ["png", "jpg", "jpeg", "webp", "heic", "pdf"] }]
    });
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
  });
  electron.ipcMain.handle("files:pickLogo", async (e) => {
    if (process.env.CLIPIE_E2E_LOGO) return saveLogo(process.env.CLIPIE_E2E_LOGO);
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Picture", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }]
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return saveLogo(res.filePaths[0]);
  });
  electron.ipcMain.handle("files:pickMusic", async (e) => {
    if (process.env.CLIPIE_E2E_MUSIC) return saveMusic(process.env.CLIPIE_E2E_MUSIC);
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Music", extensions: ["mp3", "m4a", "aac", "wav", "ogg", "opus", "flac", "wma", "mp4", "mov", "webm", "mkv"] }]
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return saveMusic(res.filePaths[0]);
  });
  electron.ipcMain.handle("files:openPath", (_e, p) => electron.shell.openPath(p));
  electron.ipcMain.handle("files:showInFolder", (_e, p) => electron.shell.showItemInFolder(p));
  electron.ipcMain.handle("files:openExternal", (_e, url) => {
    if (/^https?:/.test(url)) return electron.shell.openExternal(url);
    if (url.toLowerCase().startsWith(`mailto:${hardware.PAYMENTS.proofEmail.toLowerCase()}?`)) return electron.shell.openExternal(url);
    return void 0;
  });
  electron.ipcMain.handle("youtube:browsers", () => installedBrowsers());
  electron.ipcMain.handle("youtube:captions", (_e, url) => captionList(url));
  electron.ipcMain.handle("jobs:start", (_e, opts) => startJob(opts));
  electron.ipcMain.handle("jobs:cancel", (_e, id) => cancelJob(id));
  electron.ipcMain.handle("jobs:retry", (_e, id) => retryJob(id));
  electron.ipcMain.handle("jobs:renderClip", (_e, projectId, highlightId, s) => renderClipJob(projectId, highlightId, s));
  electron.ipcMain.handle("projects:list", async () => (
    // A running project's finished clips are only on disk once it is done: a refresh mid-render
    // used to make them vanish from the processing screen.
    (await listProjectSummaries((await getSettings()).outputDir)).map((p) => {
      const now = runningProject(p.id);
      if (!now) return p;
      const { transcript: _t, ...rest } = now;
      return rest;
    })
  ));
  electron.ipcMain.handle("projects:transcript", async (_e, id) => (await findProject((await getSettings()).outputDir, String(id)))?.transcript ?? null);
  electron.ipcMain.handle("projects:releaseSource", async (_e, id) => {
    const p = await findProject((await getSettings()).outputDir, id);
    if (!p) throw new Error("Project not found.");
    if (isRunning(p.id)) throw new Error("This project is still working.");
    const updated = await removeDownload(p);
    if (updated !== p) await writeProject(updated);
    return updated;
  });
  electron.ipcMain.handle("projects:deleteClip", async (_e, id, highlightId) => {
    const p = await findProject((await getSettings()).outputDir, String(id));
    if (!p) throw new Error("Project not found.");
    return deleteClip(p, String(highlightId));
  });
  electron.ipcMain.handle("projects:delete", async (_e, id) => {
    const root = (await getSettings()).outputDir;
    const p = (await listProjectSummaries(root)).find((x) => x.id === id);
    if (p) await deleteProject(root, p);
    await forgetProject(id);
  });
  electron.ipcMain.handle("folders:get", () => getFolders());
  electron.ipcMain.handle("folders:create", (_e, name) => createFolderNamed(String(name ?? "")));
  electron.ipcMain.handle("folders:rename", (_e, id, name) => renameFolderTo(id, String(name ?? "")));
  electron.ipcMain.handle("folders:delete", (_e, id) => removeFolder(id));
  electron.ipcMain.handle("folders:move", (_e, projectIds, folderId) => moveProjects(Array.isArray(projectIds) ? projectIds.filter((x) => typeof x === "string") : [], typeof folderId === "string" ? folderId : null));
  electron.ipcMain.handle("clipboard:write", (_e, text) => electron.clipboard.writeText(text));
  electron.ipcMain.handle("app:version", () => electron.app.getVersion());
}
async function describeFile(p) {
  try {
    const st = await node_fs.promises.stat(p);
    if (!st.isFile()) return null;
    const ext = path.extname(p).slice(1).toLowerCase();
    if (!VIDEO_EXT.includes(ext)) return null;
    mediaAllowList.set(path.resolve(p), path.resolve(p));
    return { path: p, name: path.basename(p), sizeBytes: st.size };
  } catch {
    return null;
  }
}
const captionLists = /* @__PURE__ */ new Map();
function captionList(url) {
  const key = url.trim();
  let p = captionLists.get(key);
  if (!p) {
    p = fetchCaptionList(key);
    captionLists.set(key, p);
    p.catch(() => captionLists.delete(key));
  }
  return p;
}
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "clipie", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true } }
]);
let mainWindow = null;
function logError(what, err) {
  const text = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[snu] ${what}: ${text}`);
  try {
    const dir = electron.app.getPath("logs");
    node_fs.mkdirSync(dir, { recursive: true });
    node_fs.appendFileSync(path.join(dir, "main.log"), `${(/* @__PURE__ */ new Date()).toISOString()} v${electron.app.getVersion()} ${process.platform}-${process.arch} ${what}: ${text}
`);
  } catch {
  }
}
function logInfo(text) {
  console.log(`[snu] ${text}`);
  try {
    const dir = electron.app.getPath("logs");
    node_fs.mkdirSync(dir, { recursive: true });
    node_fs.appendFileSync(path.join(dir, "main.log"), `${(/* @__PURE__ */ new Date()).toISOString()} v${electron.app.getVersion()} ${text}
`);
  } catch {
  }
}
process.on("uncaughtExceptionMonitor", (err) => logError("uncaught exception", err));
process.on("unhandledRejection", (err) => logError("unhandled rejection", err));
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "SNU Clipper",
    backgroundColor: windowColors().background,
    // The app draws its own title bar (it holds the update button). macOS keeps its traffic lights,
    // centred in that bar; Windows and Linux get native minimise/maximise/close drawn over its right end.
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 14, y: 12 },
    ...process.platform === "darwin" ? {} : { titleBarOverlay: titleBarOverlay() },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      // Read by the preload so the page paints in the chosen theme from its very first frame.
      additionalArguments: [appearanceArg(windowAppearance())]
    }
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.on("console-message", (...args) => {
    const first = args[0];
    const isEventObject = typeof first === "object" && first !== null && "message" in first;
    const level = isEventObject ? first.level : args[1];
    const message = isEventObject ? first.message : args[2];
    const source = isEventObject ? `${first.sourceId}:${first.lineNumber}` : `${args[4]}:${args[3]}`;
    if (level === "error" || level === 3) logError("renderer", `${message}  (${source})`);
    else if (level === 2 || level === "warning") console.error(`[renderer] ${message}  (${source})`);
  });
  win.webContents.on("render-process-gone", (_e, d) => logError("renderer gone", `${d.reason} (exit ${d.exitCode})`));
  win.webContents.on("did-fail-load", (_e, code, desc, url) => logError("page failed to load", `${code} ${desc} ${url}`));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void electron.shell.openExternal(url);
    return { action: "deny" };
  });
  const hash = process.env.CLIPIE_E2E_HASH ? process.env.CLIPIE_E2E_HASH : process.env.CLIPIE_SMOKE_OPEN_LATEST ? "open-latest" : process.env.CLIPIE_SMOKE_SECTION ? `section-${process.env.CLIPIE_SMOKE_SECTION}${process.env.CLIPIE_SMOKE_STEP ? `-step-${process.env.CLIPIE_SMOKE_STEP}` : ""}${process.env.CLIPIE_SMOKE_FILE ? `&smoke-file-${encodeURIComponent(process.env.CLIPIE_SMOKE_FILE)}` : ""}${process.env.CLIPIE_SMOKE_LAYOUT ? `&smoke-layout-${process.env.CLIPIE_SMOKE_LAYOUT}` : ""}${smokeTranscriptHash()}` : void 0;
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL + (hash ? `#${hash}` : ""));
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"), hash ? { hash } : void 0);
  }
  return win;
}
async function registerMediaProtocol() {
  electron.protocol.handle("clipie", async (request) => {
    const url = new URL(request.url);
    if (url.hostname === "font") {
      const raw = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const isUi = raw.startsWith("ui/");
      const name = path.basename(raw);
      const file2 = path.join(isUi ? uiFontsDir() : fontsDir(), name);
      if (!/^[\w.-]+\.ttf$/i.test(name)) return new Response("Forbidden", { status: 403 });
      try {
        const body = await node_fs.promises.readFile(file2);
        return new Response(new Uint8Array(body), {
          headers: { "content-type": "font/ttf", "access-control-allow-origin": "*", "cache-control": "max-age=86400" }
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }
    if (url.hostname !== "media") return new Response("Not found", { status: 404 });
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const abs = path.resolve(process.platform === "win32" ? filePath : "/" + filePath.replace(/^\/+/, ""));
    const settings = await getSettings();
    const roots = [path.resolve(settings.outputDir), path.resolve(cacheDir()), ...settings.clipsDir ? [path.resolve(settings.clipsDir)] : []];
    const allowed = roots.some((r) => isInsideDir(r, abs, true)) || abs === path.resolve(mediaAllowList.get(abs) ?? "");
    if (!allowed) return new Response("Forbidden", { status: 403 });
    try {
      await node_fs.promises.access(abs);
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const res = await electron.net.fetch(node_url.pathToFileURL(abs).toString(), { headers: request.headers });
    const headers = new Headers(res.headers);
    headers.set("access-control-allow-origin", "*");
    return new Response(res.body, { status: res.status, headers });
  });
}
const mediaAllowList = /* @__PURE__ */ new Map();
function smokeTranscriptHash() {
  let out = process.env.CLIPIE_SMOKE_URL ? `&smoke-url-${encodeURIComponent(process.env.CLIPIE_SMOKE_URL)}` : "";
  const file2 = process.env.CLIPIE_SMOKE_TRANSCRIPT;
  if (file2) {
    try {
      out += `&smoke-transcript-${encodeURIComponent(path.basename(file2))}~${encodeURIComponent(node_fs.readFileSync(file2, "utf8").slice(0, 3e3))}`;
    } catch {
    }
  }
  return out;
}
const isTestRun = Boolean(process.env.CLIPIE_SMOKE || process.env.CLIPIE_HEADLESS_INPUT || process.env.CLIPIE_HEADLESS_DOWNLOAD);
if (!isTestRun && !electron.app.requestSingleInstanceLock()) {
  electron.app.exit(0);
}
electron.app.on("second-instance", () => {
  if (!electron.app.isReady()) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});
async function ensureDesktopShortcut() {
  // Windows only. Portable build + packaged exe; never in test/headless runs.
  if (process.platform !== "win32" || isTestRun || !electron.app.isPackaged) return;
  try {
    const s = await load();
    if (s.desktopShortcutCreated === true) return;
    const desktop = electron.app.getPath("desktop");
    const link = path.join(desktop, "SNU Clipper.lnk");
    // "create" returns false when the file already exists -> treat as success.
    const ok = electron.shell.writeShortcutLink(link, "create", {
      target: process.execPath,
      cwd: path.dirname(process.execPath),
      icon: process.execPath,
      iconIndex: 0,
      description: "SNU Clipper - offline AI video clipper"
    });
    await save$1({ ...s, desktopShortcutCreated: true });
    logInfo(`[shortcut] desktop link ${ok ? "created" : "already present"}`);
  } catch (err) {
    logError("desktop shortcut", err);
  }
}

electron.app.whenReady().then(async () => {
  electron.app.setAppUserModelId("app.snu.desktop");
  await registerMediaProtocol();
  registerIpc();
  initUpdater();
  if (!isTestRun) void ensureDesktopShortcut();
  if (process.env.CLIPIE_HEADLESS_DOWNLOAD) {
    const out = process.env.CLIPIE_HEADLESS_OUT || path.join(electron.app.getPath("temp"), "clipie-headless-download");
    try {
      const res = await downloadVideo(process.env.CLIPIE_HEADLESS_DOWNLOAD, out, (pct, message) => console.log(`[headless] ${Math.round(pct)}% ${message}`));
      console.log(`[headless] DOWNLOADED ${JSON.stringify(res)}`);
      electron.app.exit(0);
    } catch (err) {
      console.error(`[headless] FAILED ${err.message}`);
      electron.app.exit(1);
    }
    return;
  }
  if (!isTestRun) {
    void getSettings().then(async (s) => {
      const fixed = await markInterruptedProjects(s.outputDir);
      if (fixed > 0) console.log(`[snu] marked ${fixed} interrupted project(s)`);
      await clearTemp(s.outputDir);
      await sweepOldDownloads(s.outputDir);
      await tidyModels((m) => logInfo(`[models] ${m}`)).catch((err) => logError("models folder tidy", err));
      setInterval(() => void sweepOldDownloads(s.outputDir).catch(() => void 0), 24 * 60 * 60 * 1e3).unref?.();
    }).catch(() => void 0);
  }
  electron.session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders } });
  });
  setWindowAppearance(await getAppearance().catch(() => DEFAULT_APPEARANCE));
  mainWindow = createWindow();
  mainWindow.webContents.once("did-finish-load", () => {
    hardware.primeHardware();
    void hardware.sessionEncoder(resolveBinaries());
  });
  if (process.env.CLIPIE_SMOKE === "1") {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const out = process.env.CLIPIE_SMOKE_OUT || path.join(electron.app.getPath("temp"), "clipie-smoke.png");
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const img = await mainWindow.webContents.capturePage();
            const png = img.toPNG();
            const looksBlank = png.length < 6e5;
            if (!looksBlank || attempt === 3) {
              await node_fs.promises.writeFile(out, png);
              console.log(`[smoke] screenshot written to ${out}${looksBlank ? " (still looks blank)" : ""}`);
              break;
            }
          } catch (err) {
            console.error("[smoke] failed", err);
            break;
          }
          await new Promise((r) => setTimeout(r, 900));
        }
        electron.app.quit();
      }, Number(process.env.CLIPIE_SMOKE_DELAY_MS || 2500));
    });
  }
  if (process.env.CLIPIE_SMOKE_MODELS_DIR) {
    void (async () => {
      const target = process.env.CLIPIE_SMOKE_MODELS_DIR;
      try {
        const before = (await getSettings()).modelsDir;
        const look = await inspectModelsDir(target);
        console.log(`[models] from ${before}`);
        console.log(`[models] inspect ${target}: ok=${look.ok} movable=${look.movable.count} (${look.movable.bytes} bytes)${look.reason ? " " + look.reason : ""}`);
        if (look.ok) {
          const res = await moveModelsTo(target, process.env.CLIPIE_SMOKE_MODELS_MOVE === "1");
          console.log(`[models] moved=${res.moved} failed=${JSON.stringify(res.failed)}`);
          console.log(`[models] settings now say ${(await getSettings()).modelsDir}`);
          console.log(`[models] statuses ${JSON.stringify((await modelStatuses()).map((m) => [m.model, m.downloaded, m.path]))}`);
        }
      } catch (err) {
        console.error("[models] failed", err);
      }
      electron.app.quit();
    })();
  }
  if (process.env.CLIPIE_HEADLESS_INPUT) {
    const input = process.env.CLIPIE_HEADLESS_INPUT;
    const onDisk = await node_fs.promises.access(input).then(() => true, () => false);
    const sourceUrl = !onDisk && hardware.looksLikeUrl(input) ? input.includes("://") ? input : `https://${input}` : void 0;
    let lastStage = "";
    let lastStep = "";
    jobEvents.on("event", (ev) => {
      if (ev.type === "progress") {
        if (ev.stage !== lastStage) {
          lastStage = ev.stage;
          console.log(`[headless] == ${ev.stage}`);
        }
        const step = ev.message.replace(/[\d.]+%?/g, "#");
        if (step !== lastStep) {
          lastStep = step;
          console.log(`[headless] ~ ${ev.message}`);
        }
      } else if (ev.type === "live-status") {
        if (ev.state !== lastStage) {
          lastStage = ev.state;
          console.log(`[headless] == live: ${ev.state}`);
        }
        if (ev.facecam) console.log(`[headless] facecam found=${ev.facecam.found}`);
      } else if (ev.type === "live-candidate") {
        console.log(`[headless] candidate ${ev.candidate.start.toFixed(1)}-${ev.candidate.end.toFixed(1)}s score=${ev.candidate.score} ${ev.accepted ? "KEPT" : "skipped"}`);
      } else if (ev.type === "clip-ready") {
        console.log(`[headless] clip-ready ${ev.clip.index + 1} (${ev.clip.duration.toFixed(1)}s)`);
      } else if (ev.type === "log") {
        console.log(`[headless] [${ev.level}] ${ev.message}`);
      } else if (ev.type === "done") {
        console.log(`[headless] DONE ${JSON.stringify({ outputDir: ev.project.outputDir, clips: ev.project.clips.map((c) => ({ file: path.basename(c.filePath), duration: c.duration })), source: ev.project.analysis?.source })}`);
        electron.app.exit(0);
      } else if (ev.type === "failed") {
        console.error(`[headless] FAILED ${ev.error}`);
        electron.app.exit(1);
      }
    });
    try {
      const mode = process.env.CLIPIE_HEADLESS_MODE || "highlights";
      const p = await startJob({
        ...local.DEFAULT_JOB_DEFAULTS,
        mode,
        clipCount: Number(process.env.CLIPIE_HEADLESS_CLIPS || 2),
        minClipSeconds: Number(process.env.CLIPIE_HEADLESS_MIN || local.DEFAULT_JOB_DEFAULTS.minClipSeconds),
        maxClipSeconds: Number(process.env.CLIPIE_HEADLESS_MAX || local.DEFAULT_JOB_DEFAULTS.maxClipSeconds),
        liveThreshold: Number(process.env.CLIPIE_HEADLESS_THRESHOLD || local.DEFAULT_JOB_DEFAULTS.liveThreshold),
        liveMaxMinutes: Number(process.env.CLIPIE_HEADLESS_MINUTES || local.DEFAULT_JOB_DEFAULTS.liveMaxMinutes),
        // CLIPIE_HEADLESS_LAYOUT / _CAPTIONS test a packaged build's framing and caption styles.
        ...process.env.CLIPIE_HEADLESS_LAYOUT ? { layout: process.env.CLIPIE_HEADLESS_LAYOUT } : {},
        ...process.env.CLIPIE_HEADLESS_CAPTIONS ? { captionStyle: process.env.CLIPIE_HEADLESS_CAPTIONS } : {},
        // CLIPIE_HEADLESS_TRANSCRIPT=<file> uses that transcript the way the wizard's "I already
        // have a transcript" does; CLIPIE_HEADLESS_YT_CAPTIONS=<lang>[:auto] uses YouTube's captions.
        ...process.env.CLIPIE_HEADLESS_TRANSCRIPT ? { transcript: { source: "imported", name: path.basename(process.env.CLIPIE_HEADLESS_TRANSCRIPT), text: await node_fs.promises.readFile(process.env.CLIPIE_HEADLESS_TRANSCRIPT, "utf8") } } : process.env.CLIPIE_HEADLESS_YT_CAPTIONS ? { transcript: { source: "youtube", youtube: { lang: process.env.CLIPIE_HEADLESS_YT_CAPTIONS.split(":")[0], auto: process.env.CLIPIE_HEADLESS_YT_CAPTIONS.endsWith(":auto") } } } : {},
        ...process.env.CLIPIE_HEADLESS_LANGUAGE ? { language: process.env.CLIPIE_HEADLESS_LANGUAGE } : {},
        // CLIPIE_HEADLESS_LIVE_KIND=gaming watches the stream as Live Plays.
        ...process.env.CLIPIE_HEADLESS_LIVE_KIND === "gaming" ? { liveKind: "gaming" } : {},
        inputPath: sourceUrl ? "" : input,
        sourceUrl,
        projectName: process.env.CLIPIE_HEADLESS_NAME || "Headless test"
      });
      console.log(`[headless] started ${p.id} -> ${p.outputDir}`);
    } catch (err) {
      console.error(`[headless] could not start: ${err.message}`);
      electron.app.exit(1);
    }
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform === "darwin") {
    cancelDownload();
    return;
  }
  electron.app.quit();
});
electron.app.on("before-quit", () => {
  markQuitting();
  killAll();
  cancelDownload();
  stopPotServer();
});
exports.mediaAllowList = mediaAllowList;
