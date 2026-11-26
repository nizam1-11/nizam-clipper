"use strict";
const electron = require("electron");
const DEFAULT_APPEARANCE = { theme: "dark", accent: "coral" };
const ACCENTS = [
  { id: "coral", label: "Gold", a: "#E5B94C", b: "#F4D06A" },
  { id: "violet", label: "Crimson", a: "#CC2B37", b: "#D6323F" },
  { id: "teal", label: "Ember", a: "#C23A16", b: "#D4401E" },
  { id: "pink", label: "Rose", a: "#C82647", b: "#D63253" },
  { id: "sky", label: "Amber", a: "#C8871A", b: "#EAB23C" },
  { id: "lime", label: "Champagne", a: "#B9872E", b: "#E6C879" }
];
const isThemeMode = (v) => v === "system" || v === "dark" || v === "light";
const isAccent = (v) => ACCENTS.some((a) => a.id === v);
const APPEARANCE_ARG = "--clipie-appearance=";
function parseAppearanceArg(argv) {
  const raw = argv.find((s) => s.startsWith(APPEARANCE_ARG))?.slice(APPEARANCE_ARG.length) ?? "";
  const [theme, accent] = raw.split(":");
  return {
    theme: isThemeMode(theme) ? theme : DEFAULT_APPEARANCE.theme,
    accent: isAccent(accent) ? accent : DEFAULT_APPEARANCE.accent
  };
}
const api = {
  platform: process.platform,
  appearance: parseAppearanceArg(process.argv),
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    update: (u) => electron.ipcRenderer.invoke("settings:update", u),
    pickOutputDir: () => electron.ipcRenderer.invoke("settings:pickOutputDir"),
    pickClipsDir: () => electron.ipcRenderer.invoke("settings:pickClipsDir"),
    pickModelsDir: () => electron.ipcRenderer.invoke("settings:pickModelsDir"),
    setModelsDir: (dir, move) => electron.ipcRenderer.invoke("settings:setModelsDir", dir, move)
  },
  models: {
    status: () => electron.ipcRenderer.invoke("models:status"),
    download: (model) => electron.ipcRenderer.invoke("models:download", model),
    cancel: () => electron.ipcRenderer.invoke("models:cancel"),
    delete: (model) => electron.ipcRenderer.invoke("models:delete", model),
    onEvent: (cb) => {
      const handler = (_, ev) => cb(ev);
      electron.ipcRenderer.on("models:event", handler);
      return () => electron.ipcRenderer.removeListener("models:event", handler);
    }
  },
  ai: {
    listModels: (force) => electron.ipcRenderer.invoke("ai:listModels", Boolean(force)),
    listProviderModels: (provider) => electron.ipcRenderer.invoke("ai:listProviderModels", provider),
    testCloudSpeech: () => electron.ipcRenderer.invoke("ai:testCloudSpeech"),
    connectOpenRouter: () => electron.ipcRenderer.invoke("ai:connectOpenRouter"),
    cancelConnectOpenRouter: () => electron.ipcRenderer.invoke("ai:cancelConnectOpenRouter")
  },
  cloud: {
    account: () => electron.ipcRenderer.invoke("cloud:account"),
    signIn: () => electron.ipcRenderer.invoke("cloud:signIn"),
    cancelSignIn: () => electron.ipcRenderer.invoke("cloud:cancelSignIn"),
    signOut: () => electron.ipcRenderer.invoke("cloud:signOut"),
    signInEmail: (email, password) => electron.ipcRenderer.invoke("cloud:signInEmail", email, password),
    signUpEmail: (email, password, name) => electron.ipcRenderer.invoke("cloud:signUpEmail", email, password, name)
  },
  updates: {
    state: () => electron.ipcRenderer.invoke("update:state"),
    check: () => electron.ipcRenderer.invoke("update:check"),
    download: () => electron.ipcRenderer.invoke("update:download"),
    install: () => electron.ipcRenderer.invoke("update:install"),
    run: () => electron.ipcRenderer.invoke("update:run"),
    openDownload: () => electron.ipcRenderer.invoke("update:open-download"),
    onState: (cb) => {
      const handler = (_, s) => cb(s);
      electron.ipcRenderer.on("update:state", handler);
      return () => electron.ipcRenderer.removeListener("update:state", handler);
    }
  },
  speed: {
    test: (model) => electron.ipcRenderer.invoke("speed:test", model),
    onEvent: (cb) => {
      const handler = (_, ev) => cb(ev);
      electron.ipcRenderer.on("speed:event", handler);
      return () => electron.ipcRenderer.removeListener("speed:event", handler);
    }
  },
  storage: {
    overview: () => electron.ipcRenderer.invoke("storage:overview"),
    clearTemp: () => electron.ipcRenderer.invoke("storage:clearTemp"),
    clearDownloads: () => electron.ipcRenderer.invoke("storage:clearDownloads"),
    deleteAllModels: () => electron.ipcRenderer.invoke("storage:deleteAllModels")
  },
  files: {
    pickVideo: () => electron.ipcRenderer.invoke("files:pickVideo"),
    describe: (p) => electron.ipcRenderer.invoke("files:describe", p),
    pathForFile: (f) => electron.webUtils.getPathForFile(f),
    openPath: (p) => electron.ipcRenderer.invoke("files:openPath", p),
    showInFolder: (p) => electron.ipcRenderer.invoke("files:showInFolder", p),
    openExternal: (url) => electron.ipcRenderer.invoke("files:openExternal", url),
    mediaUrl: (p) => {
      return `clipie://media/${encodeURIComponent(p.replace(/\\/g, "/"))}`;
    },
    poster: (p, at) => electron.ipcRenderer.invoke("files:poster", p, at),
    remotePoster: (url) => electron.ipcRenderer.invoke("files:remotePoster", url),
    saveTextCard: (dataUrl) => electron.ipcRenderer.invoke("files:saveTextCard", dataUrl),
    pickLogo: () => electron.ipcRenderer.invoke("files:pickLogo"),
    pickMusic: () => electron.ipcRenderer.invoke("files:pickMusic"),
    pickScreenshot: () => electron.ipcRenderer.invoke("files:pickScreenshot")
  },
  jobs: {
    start: (opts) => electron.ipcRenderer.invoke("jobs:start", opts),
    cancel: (id) => electron.ipcRenderer.invoke("jobs:cancel", id),
    /** Run a failed or stopped project again, in its own folder, with what it already has. */
    retry: (id) => electron.ipcRenderer.invoke("jobs:retry", id),
    renderClip: (projectId, highlightId, settings) => electron.ipcRenderer.invoke("jobs:renderClip", projectId, highlightId, settings),
    onEvent: (cb) => {
      const handler = (_, ev) => cb(ev);
      electron.ipcRenderer.on("engine:event", handler);
      return () => electron.ipcRenderer.removeListener("engine:event", handler);
    }
  },
  projects: {
    list: () => electron.ipcRenderer.invoke("projects:list"),
    transcript: (id) => electron.ipcRenderer.invoke("projects:transcript", id),
    delete: (id) => electron.ipcRenderer.invoke("projects:delete", id),
    deleteClip: (id, highlightId) => electron.ipcRenderer.invoke("projects:deleteClip", id, highlightId),
    releaseSource: (id) => electron.ipcRenderer.invoke("projects:releaseSource", id),
    exportZip: (id) => electron.ipcRenderer.invoke("projects:exportZip", id),
    importZip: () => electron.ipcRenderer.invoke("projects:importZip")
  },
  folders: {
    get: () => electron.ipcRenderer.invoke("folders:get"),
    create: (name) => electron.ipcRenderer.invoke("folders:create", name),
    rename: (id, name) => electron.ipcRenderer.invoke("folders:rename", id, name),
    delete: (id) => electron.ipcRenderer.invoke("folders:delete", id),
    move: (projectIds, folderId) => electron.ipcRenderer.invoke("folders:move", projectIds, folderId)
  },
  memes: {
    status: () => electron.ipcRenderer.invoke("memes:status"),
    download: () => electron.ipcRenderer.invoke("memes:download"),
    cancel: () => electron.ipcRenderer.invoke("memes:cancel"),
    delete: () => electron.ipcRenderer.invoke("memes:delete"),
    onStatus: (cb) => {
      const handler = (_e, s) => cb(s);
      electron.ipcRenderer.on("memes:status", handler);
      return () => electron.ipcRenderer.removeListener("memes:status", handler);
    }
  },
  youtube: {
    browsers: () => electron.ipcRenderer.invoke("youtube:browsers"),
    captions: (url) => electron.ipcRenderer.invoke("youtube:captions", url)
  },
  clipboard: {
    write: (t) => electron.ipcRenderer.invoke("clipboard:write", t)
  },
  app: {
    version: () => electron.ipcRenderer.invoke("app:version")
  }
};
electron.contextBridge.exposeInMainWorld("clipie", api);
