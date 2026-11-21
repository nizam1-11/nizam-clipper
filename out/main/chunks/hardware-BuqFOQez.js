"use strict";
const os = require("node:os");
const electron = require("electron");
const local = require("./local-uqjgyXoD.js");
const BEAT_TYPES = [
  "joke_punchline",
  "taunt",
  "roast",
  "sarcasm",
  "self_own",
  "awkward",
  "exaggeration",
  "shock",
  "fail",
  "cringe",
  "wholesome",
  "confusion",
  "victory",
  "sad",
  "sus"
];
const MEME_PACK_USABLE_SHARE = 0.8;
const memeFileName = (m) => `${m.id}.${m.kind === "video" ? "mp4" : "m4a"}`;
const LLM_PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-v1-…",
    keysUrl: "https://openrouter.ai/keys",
    defaultModel: "auto",
    note: "Free models, chosen automatically. About 50 requests a day without credits."
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyHint: "gsk_…",
    keysUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    note: "Very fast open models, with a free tier."
  },
  {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    baseUrl: "https://api.openai.com/v1",
    keyHint: "sk-…",
    keysUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4.1-mini",
    note: "Paid per use on your OpenAI account."
  },
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com/v1",
    keyHint: "sk-ant-…",
    keysUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-haiku-4-5-20251001",
    note: "Paid per use on your Anthropic account."
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    keyHint: "sk-…",
    keysUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-chat",
    note: "Low-cost models, paid per use."
  },
  {
    id: "qwen",
    label: "Qwen (Alibaba Cloud)",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keyHint: "sk-…",
    keysUrl: "https://modelstudio.console.alibabacloud.com/",
    defaultModel: "qwen-plus",
    note: "Qwen models on Alibaba Cloud, paid per use."
  },
  {
    id: "custom",
    label: "Custom (any OpenAI-compatible API)",
    baseUrl: "",
    keyHint: "your key",
    defaultModel: "",
    note: "Any OpenAI-compatible service: a URL, key and model."
  }
];
const findProvider = (id) => LLM_PROVIDERS.find((p) => p.id === id) ?? LLM_PROVIDERS[0];
function normalizeBaseUrl(url) {
  let u = url.trim().replace(/\/+$/, "");
  const local2 = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);
  if (u && !/^https?:\/\//i.test(u)) u = `${local2 ? "http" : "https"}://${u}`;
  return u.replace(/\/chat\/completions$/i, "");
}
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const MAX_AUTO_ATTEMPTS = 4;
const OPENROUTER_FREE_ROUTER = "openrouter/free";
const EXCLUDE = /safety|guard|moderat|embed|code|lyria|clip-preview|note-preview|tts|whisper|laguna/i;
const MIN_CONTEXT = 32e3;
function isFreeTextModel(m) {
  const pricing = m.pricing ?? {};
  const free = Number(pricing.prompt ?? "1") === 0 && Number(pricing.completion ?? "1") === 0;
  if (!free) return false;
  const out = m.architecture?.output_modalities ?? ["text"];
  if (!out.includes("text") || out.length > 1) return false;
  if (EXCLUDE.test(m.id)) return false;
  return (m.context_length ?? 0) >= MIN_CONTEXT;
}
function toFreeModel(m) {
  return {
    id: m.id,
    name: m.name ?? m.id,
    contextLength: m.context_length ?? 0,
    maxOutputTokens: m.top_provider?.max_completion_tokens ?? null
  };
}
const PREFERRED = [
  /nemotron-3-ultra/i,
  /nemotron-3-super/i,
  /gemma-4-31b/i,
  /inkling(?!-small)/i,
  /nemotron-3\.5-lightning/i,
  /gemma-4-26b/i,
  /llama.*70b/i,
  /deepseek/i,
  /qwen3.*(235|72|32)b/i,
  /mistral.*(large|medium|small)/i,
  /gpt-oss-120b/i
];
function paramsBillions(id) {
  const m = /(\d+(?:\.\d+)?)b(?![a-z])/i.exec(id);
  return m ? Number(m[1]) : 0;
}
function score(m) {
  if (m.id === OPENROUTER_FREE_ROUTER) return -1;
  const pref = PREFERRED.findIndex((re) => re.test(m.id));
  const prefScore = pref === -1 ? 0 : (PREFERRED.length - pref) * 1e3;
  return prefScore + Math.min(paramsBillions(m.id), 600) + Math.min(m.contextLength / 1e5, 5);
}
function rankFreeModels(raw) {
  return raw.filter(isFreeTextModel).map(toFreeModel).sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}
const OFFLINE = /Failed to resolve|nodename nor servname|Name or service not known|Temporary failure in name resolution|getaddrinfo|No address associated|Errno (8|-2|-3|7|11001|11002)\b|Network is unreachable|No route to host|Network unreachable|Failed to establish a new connection|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|net::ERR_INTERNET_DISCONNECTED|net::ERR_NAME_NOT_RESOLVED|Connection reset|timed out|could not reach YouTube/i;
const MESSAGES = {
  offline: "No internet connection. Check your network, then try again.",
  storage: "Your computer is out of storage. Free some space and try again.",
  memory: "Your computer ran out of memory making this clip. Close other apps, or pick a smaller video size in More options.",
  busy: "The service is busy right now. Try again in a few minutes.",
  keyRefused: "The AI key was refused. Check it in Settings → AI writing.",
  keyEmpty: "The AI key is out of credits or hit its daily limit. Add credits, wait, or use another key in Settings → AI writing.",
  generic: "Something went wrong. Try again. If it keeps happening, copy the details below and send them to us."
};
const TECHNICAL = /\bERROR:|Errno|Traceback|Exception|HTTPSConnection|TransportError|urlopen|exited with code|stderr|\bat [\w.<>]+ \(|\[(youtube|generic|download|ffmpeg)\]|HTTP Error \d{3}|\bstatus code\b|\b(4|5)\d\d\b.*\b(error|status)\b|\{".*":|invalid_request|ENOENT|EACCES|EPERM|SIG(KILL|SEGV|ABRT)|Cannot read propert|undefined is not|is not a function|fetch failed|socket hang up|\bE(CONN\w+|TIMEDOUT|NOTFOUND|AI_AGAIN|NETUNREACH|HOSTUNREACH)\b|getaddrinfo|net::ERR_/i;
const DETAILS = "\n\n⁣details⁣\n";
function withDetails(message, details) {
  return details && details !== message ? `${message}${DETAILS}${details}` : message;
}
function friendlyError(raw) {
  const text = String(raw?.message ?? raw ?? "").replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, "").trim();
  if (!text) return { message: "" };
  const split = text.indexOf(DETAILS);
  if (split >= 0) return { message: text.slice(0, split), details: text.slice(split + DETAILS.length) };
  const pick = (message) => message === text ? { message } : { message, details: text };
  if (/no space left|ENOSPC|disk full|not enough space/i.test(text)) return pick(MESSAGES.storage);
  if (/Cannot allocate memory|out of memory|ENOMEM|std::bad_alloc/i.test(text)) return pick(MESSAGES.memory);
  if (!TECHNICAL.test(text) && text.length < 400) return { message: text };
  if (OFFLINE.test(text)) return pick(MESSAGES.offline);
  if (/\b401\b|invalid.{0,20}(api )?key|unauthori[sz]ed|incorrect api key/i.test(text)) return pick(MESSAGES.keyRefused);
  if (/\b402\b|insufficient.{0,20}(credit|quota|balance)|credits?|quota/i.test(text)) return pick(MESSAGES.keyEmpty);
  if (/\b429\b|rate.?limit|too many requests/i.test(text)) return pick(MESSAGES.busy);
  if (/\b5\d\d\b|service unavailable|bad gateway|overloaded/i.test(text)) return pick(MESSAGES.busy);
  if (/private video/i.test(text)) return pick("That video is private, so Nizam cannot open it.");
  if (/confirm your age|age.restricted/i.test(text)) return pick("That video is age-restricted and needs a signed-in account. Nizam cannot open it.");
  if (/video (is )?unavailable|has been removed|not available/i.test(text)) return pick("That video is not available (removed, private or blocked in your country).");
  if (/members.only|join this channel/i.test(text)) return pick("That video is for channel members only.");
  if (/unsupported url/i.test(text)) return pick("Nizam cannot get a video from that link. Try a YouTube link, or download the video and drop the file in.");
  return pick(MESSAGES.generic);
}
const TRANSCRIPT_FORMAT_LABEL = {
  srt: "SRT subtitles",
  vtt: "WebVTT subtitles",
  json3: "YouTube captions (json3)",
  srv3: "YouTube captions (srv3)",
  "timed-text": "text with times",
  plain: "plain text (no times)"
};
const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024;
const IMPORT_MESSAGES = {
  empty: "This transcript is empty. Paste the words, or choose a different file.",
  unreadable: "Nizam could not read this as a transcript. Use an .srt or .vtt subtitle file, YouTube captions (.json3 or .srv3), or plain text.",
  tooFew: "This transcript has almost no words in it. Check it is the right file.",
  tooBig: "This file is too big to be a transcript. Choose the subtitle or text file for the video.",
  binary: "This looks like a video or another kind of file, not a transcript. Choose the subtitle or text file instead."
};
function parseClock(s) {
  const m = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?\s*$/.exec(s);
  if (!m) return NaN;
  const h = m[1] ? Number(m[1]) : 0;
  const frac = m[4] ? Number(m[4].padEnd(3, "0")) / 1e3 : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac;
}
const round = (n) => Math.round(n * 1e3) / 1e3;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name.toLowerCase()] ?? all;
  });
}
function cleanText(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, "").replace(/\{\\[^}]*\}/g, "")).replace(/[​‎‏﻿]/g, "").replace(/\s+/g, " ").trim();
}
function splitWords(text) {
  return text.split(/\s+/).map((w) => w.trim()).filter((w) => w && !/^[-–—•·]+$/.test(w));
}
function spreadCue(cue) {
  if (cue.words?.length) return cue.words;
  const words = splitWords(cleanText(cue.text));
  if (!words.length) return [];
  const span = Math.max(0.05 * words.length, cue.end - cue.start);
  const weight = (w) => Math.max(1, [...w.replace(/[^\p{L}\p{N}]/gu, "")].length) + 1;
  const total = words.reduce((a, w) => a + weight(w), 0);
  const out = [];
  let at = cue.start;
  for (const w of words) {
    const len = weight(w) / total * span;
    out.push({ text: w, start: round(at), end: round(at + len) });
    at += len;
  }
  return out;
}
function cuesToWords(cues) {
  const sorted = cues.filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end)).sort((a, b) => a.start - b.start);
  const words = [];
  for (const cue of sorted) {
    for (const w of spreadCue(cue)) {
      if (!w.text) continue;
      const prev = words[words.length - 1];
      const start = prev ? Math.max(w.start, prev.start) : w.start;
      if (prev && prev.end > start) prev.end = Math.max(prev.start + 0.02, start);
      words.push({ text: w.text, start: round(start), end: round(Math.max(start + 0.02, w.end)) });
    }
  }
  return words;
}
function dropRepeats(cues) {
  const out = [];
  let lastLine = "";
  for (const cue of cues) {
    if (cue.words?.length) {
      out.push(cue);
      lastLine = cue.text;
      continue;
    }
    const lines = cue.text.split("\n").map(cleanText).filter(Boolean);
    while (lines.length && lastLine && lines[0] === lastLine) lines.shift();
    if (!lines.length) continue;
    const text = lines.join(" ");
    lastLine = lines[lines.length - 1];
    out.push({ ...cue, text });
  }
  return out;
}
const ARROW = /((?:\d{1,3}:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)/;
function parseArrowBlocks(text, vtt) {
  const cues = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => ARROW.test(l));
    if (at < 0) continue;
    if (vtt && /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    const m = ARROW.exec(lines[at]);
    const start = parseClock(m[1]);
    const end = parseClock(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const body = lines.slice(at + 1).join("\n");
    const cue = { start, end: Math.max(start, end), text: body };
    if (vtt) {
      const timed = vttWordTimes(body, start, cue.end);
      if (timed) cue.words = timed;
    }
    cues.push(cue);
  }
  return cues;
}
function vttWordTimes(body, start, end) {
  const line = body.split("\n").find((l) => /<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/.test(l));
  if (!line) return null;
  const parts = line.split(/<((?:\d{1,3}:)?\d{1,2}:\d{2}\.\d{3})>/);
  const out = [];
  let at = start;
  for (let i = 0; i < parts.length; i += 2) {
    const text = cleanText(parts[i]);
    const nextAt = i + 1 < parts.length ? parseClock(parts[i + 1]) : end;
    for (const w of spreadCue({ start: at, end: Math.max(at + 0.05, nextAt), text })) out.push(w);
    if (i + 1 < parts.length && Number.isFinite(nextAt)) at = nextAt;
  }
  return out.length ? out : null;
}
function parseSrt(text) {
  return dropRepeats(parseArrowBlocks(text, false));
}
function parseVtt(text) {
  const cues = parseArrowBlocks(text.replace(/^﻿?WEBVTT[^\n]*\n/, ""), true);
  if (cues.some((c) => c.words?.length)) return cues.filter((c) => c.words?.length).map((c) => ({ ...c, text: c.words.map((w) => w.text).join(" ") }));
  return dropRepeats(cues);
}
function parseJson3(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.events)) return null;
  const cues = [];
  for (const ev of data.events) {
    if (!ev.segs?.length || ev.aAppend) continue;
    const start = (ev.tStartMs ?? 0) / 1e3;
    const end = start + (ev.dDurationMs ?? 0) / 1e3;
    const pieces = ev.segs.filter((s) => s.utf8 !== void 0);
    const lineText = cleanText(pieces.map((s) => s.utf8).join(""));
    if (!lineText) continue;
    const timedPieces = pieces.length > 1 && pieces.some((s) => (s.tOffsetMs ?? 0) > 0);
    if (!timedPieces) {
      cues.push({ start, end, text: pieces.map((s) => s.utf8).join("") });
      continue;
    }
    const words = [];
    pieces.forEach((s, i) => {
      const from = start + (s.tOffsetMs ?? 0) / 1e3;
      const nextOffset = pieces.slice(i + 1).find((p) => p.tOffsetMs !== void 0)?.tOffsetMs;
      const to = nextOffset !== void 0 ? start + nextOffset / 1e3 : Math.min(Math.max(from + 0.2, end), from + 1.2);
      for (const w of spreadCue({ start: from, end: Math.max(from + 0.05, to), text: cleanText(s.utf8 ?? "") })) words.push(w);
    });
    cues.push({ start, end, text: lineText, words });
  }
  return cues;
}
function parseSrv3(text) {
  if (!/<timedtext[\s>]/.test(text) && !/<p\s+t="\d+"/.test(text)) return null;
  const cues = [];
  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let m;
  while (m = pRe.exec(text)) {
    const attrs = m[1];
    const t = /\bt="(\d+)"/.exec(attrs);
    if (!t) continue;
    const d = /\bd="(\d+)"/.exec(attrs);
    const start = Number(t[1]) / 1e3;
    const end = start + (d ? Number(d[1]) : 0) / 1e3;
    const inner = m[2];
    const segs = [...inner.matchAll(/<s\b([^>]*)>([\s\S]*?)<\/s>/g)];
    if (segs.length > 1 && segs.some((s) => /\bt="\d+"/.test(s[1]))) {
      const words = [];
      segs.forEach((s, i) => {
        const off = Number(/\bt="(\d+)"/.exec(s[1])?.[1] ?? 0) / 1e3;
        const nextOff = segs.slice(i + 1).map((n) => /\bt="(\d+)"/.exec(n[1])?.[1]).find((v) => v !== void 0);
        const from = start + off;
        const to = nextOff !== void 0 ? start + Number(nextOff) / 1e3 : Math.min(Math.max(from + 0.2, end), from + 1.2);
        for (const w of spreadCue({ start: from, end: Math.max(from + 0.05, to), text: cleanText(s[2]) })) words.push(w);
      });
      if (words.length) cues.push({ start, end, text: words.map((w) => w.text).join(" "), words });
      continue;
    }
    const body = cleanText(inner.replace(/<br\s*\/?>/g, " "));
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}
const LEAD_TIME = /^\s*[[(]?((?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)[\])]?\s*(?:[-–—|:]\s*)?(.*)$/;
function parseTimedText(text, duration) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const marks = [];
  let timed = 0;
  for (const line of lines) {
    const m = LEAD_TIME.exec(line);
    const at = m ? parseClock(m[1]) : NaN;
    if (m && Number.isFinite(at)) {
      timed++;
      marks.push({ at, text: m[2] ?? "" });
    } else if (marks.length) {
      const last = marks[marks.length - 1];
      last.text = last.text ? `${last.text} ${line}` : line;
    }
  }
  if (timed < 2 || timed < lines.length * 0.3) return null;
  for (let i = 1; i < marks.length; i++) if (marks[i].at < marks[i - 1].at - 1) return null;
  const cues = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].at;
    const next = marks[i + 1]?.at;
    const words = splitWords(cleanText(marks[i].text)).length;
    const end = next ?? Math.min(duration ?? Infinity, start + Math.max(1, words / 2.5));
    if (marks[i].text.trim()) cues.push({ start, end: Math.max(start + 0.2, end), text: marks[i].text });
  }
  return cues;
}
function detectFormat(text, fileName) {
  const t = text.replace(/^﻿/, "").trimStart();
  const ext = (fileName ?? "").toLowerCase().split(".").pop() ?? "";
  if (/^WEBVTT/.test(t)) return "vtt";
  if (t.startsWith("{") && /"events"\s*:/.test(t.slice(0, 2e3))) return "json3";
  if (/^<\?xml|^<timedtext/.test(t) && /<p\s+t="\d+"/.test(t)) return "srv3";
  if (ARROW.test(t.slice(0, 4e3))) return ext === "vtt" ? "vtt" : "srt";
  if (ext === "json3" || ext === "srv3") return ext;
  if (parseTimedText(t.slice(0, 2e4))) return "timed-text";
  return "plain";
}
function looksBinary(text) {
  const sample = text.slice(0, 4e3);
  if (!sample) return false;
  let odd = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0 || c === 65533 || c < 32 && c !== 9 && c !== 10 && c !== 13) odd++;
  }
  return odd / sample.length > 0.05;
}
function parseTranscript(text, fileName, duration) {
  if (!text || !text.trim()) return { ok: false, error: IMPORT_MESSAGES.empty };
  if (looksBinary(text)) return { ok: false, error: IMPORT_MESSAGES.binary };
  const format = detectFormat(text, fileName);
  let cues = null;
  if (format === "srt") cues = parseSrt(text);
  else if (format === "vtt") cues = parseVtt(text);
  else if (format === "json3") cues = parseJson3(text);
  else if (format === "srv3") cues = parseSrv3(text);
  else if (format === "timed-text") cues = parseTimedText(text, duration);
  if (format === "plain") {
    if (/\.(srt|vtt|json3?|srv3|xml)$/i.test(fileName ?? "")) return { ok: false, error: IMPORT_MESSAGES.unreadable };
    if (/^\s*[{<]/.test(text)) return { ok: false, error: IMPORT_MESSAGES.unreadable };
    const plainWords = splitWords(cleanText(text));
    if (!plainWords.length) return { ok: false, error: IMPORT_MESSAGES.empty };
    if (plainWords.length < 5) return { ok: false, error: IMPORT_MESSAGES.tooFew };
    return { ok: true, transcript: { format, words: [], plainWords, wordCount: plainWords.length, lastTime: 0 } };
  }
  if (!cues) return { ok: false, error: IMPORT_MESSAGES.unreadable };
  const words = cuesToWords(cues);
  if (!words.length) return { ok: false, error: cues.length ? IMPORT_MESSAGES.empty : IMPORT_MESSAGES.unreadable };
  if (words.length < 5) return { ok: false, error: IMPORT_MESSAGES.tooFew };
  const lineTimed = cues.some((c) => !c.words?.length);
  return { ok: true, transcript: { format, words, wordCount: words.length, lastTime: words[words.length - 1].end, ...lineTimed ? { cues } : {} } };
}
function fmtMinutes(s) {
  if (s < 90) return `${Math.max(1, Math.round(s))} seconds`;
  const m = Math.round(s / 60);
  return m >= 90 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
function coverageWarning(t, videoSeconds, range) {
  if (!videoSeconds || videoSeconds <= 0 || !t.words.length) return null;
  const from = range ? range.start : 0;
  const to = range ? range.end : videoSeconds;
  const within = t.words.filter((w) => w.start >= from && w.start < to);
  if (!within.length) return range ? "This transcript has no words in the part of the video you chose. Check the transcript, or choose another part." : "This transcript's times do not match this video. Check it is the transcript for this video.";
  const first = t.words[0].start;
  if (first > videoSeconds + 5) return "This transcript's times do not match this video. Check it is the transcript for this video.";
  if (t.lastTime > videoSeconds * 1.1 + 10) return `This transcript runs to ${fmtMinutes(t.lastTime)} but the video is ${fmtMinutes(videoSeconds)}. It may be for a different video.`;
  const covered = Math.min(to, within[within.length - 1].end) - Math.max(from, within[0].start);
  const length = to - from;
  if (length > 120 && covered < length * 0.6) {
    return `This transcript only covers about ${fmtMinutes(covered)} of ${fmtMinutes(length)}, so clips can only come from that part.`;
  }
  return null;
}
function plainCoverageWarning(t, videoSeconds) {
  if (!videoSeconds || t.format !== "plain" || !t.plainWords) return null;
  const talk = t.plainWords.length / 2.6;
  if (videoSeconds > 180 && talk < videoSeconds * 0.25) {
    return `This text is about ${fmtMinutes(talk)} of talk, and the video is ${fmtMinutes(videoSeconds)}. If it only covers part of the video, clips can only come from that part.`;
  }
  return null;
}
function quickListenFits(words, model) {
  if (model !== "tiny" && model !== "base") return true;
  let latin = 0;
  let letters = 0;
  for (const w of words.slice(0, 400)) {
    for (const ch of w) {
      if (!new RegExp("\\p{L}", "u").test(ch)) continue;
      letters++;
      if (new RegExp("\\p{Script=Latin}", "u").test(ch)) latin++;
    }
  }
  return letters === 0 || latin / letters >= 0.6;
}
const baseLang = (lang) => lang.toLowerCase().split(/[-_]/)[0];
function captionTracksFrom(info) {
  const manual = Object.keys(info.subtitles ?? {}).filter((k) => k !== "live_chat" && !/^und$/i.test(k));
  const autoKeys = Object.keys(info.automatic_captions ?? {});
  const orig = autoKeys.find((k) => /-orig$/.test(k));
  let auto = orig ? orig.replace(/-orig$/, "") : null;
  if (!auto && info.language && autoKeys.includes(info.language)) auto = info.language;
  return { manual, auto, ...orig ? { autoKey: orig } : {}, ...info.duration ? { duration: info.duration } : {} };
}
const AUTO_CAPTIONS_ON_BY_DEFAULT = /* @__PURE__ */ new Set();
function chooseCaptions(tracks, language) {
  const want = language && language !== "auto" ? baseLang(language) : tracks.auto ? baseLang(tracks.auto) : null;
  const written = want ? tracks.manual.find((k) => k.toLowerCase() === want) ?? tracks.manual.find((k) => baseLang(k) === want) : tracks.manual.length === 1 ? tracks.manual[0] : void 0;
  if (written) return { lang: written, auto: false, on: true };
  if (tracks.auto && (!want || baseLang(tracks.auto) === want)) {
    return { lang: tracks.autoKey ?? tracks.auto, auto: true, on: AUTO_CAPTIONS_ON_BY_DEFAULT.has(baseLang(tracks.auto)) };
  }
  return null;
}
const MUSIC_DEFAULT_VOLUME = 0.25;
const MIN_SECONDS = 0.5;
const FADE_IN = 0.5;
const FADE_OUT = 1;
function planMusic(music, clipSeconds) {
  const start = Math.max(0, music.clipStart || 0);
  const end = Math.min(clipSeconds, music.clipEnd ?? clipSeconds);
  const seconds = end - start;
  const volume = Math.max(0, Math.min(1, music.volume));
  if (seconds < MIN_SECONDS || volume <= 0) return null;
  const songStart = music.duration > 0 ? Math.max(0, Math.min(music.duration - 0.1, music.songStart || 0)) : 0;
  return { start, seconds, volume, songStart, fadeIn: Math.min(FADE_IN, seconds / 3), fadeOut: Math.min(FADE_OUT, seconds / 3) };
}
const PAYMENTS = {
  /** Where buyers send their proof. */
  proofEmail: "payments@example.com",
  /** How long confirmation can take, in hours. */
  confirmHours: 24,
  /** Nizam Cloud minutes, bought the same ways and added to the account's email by hand. */
  minutePacks: [
    { id: "min150", label: "150 minutes", minutes: 150, usd: 5, pkr: 1400 },
    { id: "min330", label: "330 minutes", minutes: 330, usd: 10, pkr: 2800, note: "Popular" },
    { id: "min900", label: "900 minutes", minutes: 900, usd: 25, pkr: 7e3, note: "Best value" }
  ],
  methods: [
    {
      id: "card",
      label: "Card (Visa, Mastercard)",
      sub: "Any country · through Payoneer",
      currency: "USD",
      requestFirst: true,
      steps: [
        "Send us your email with the button below. We reply with a secure Payoneer card payment link for your minutes, usually within a few hours.",
        "Open the link and pay with your card.",
        "Come back here and send the receipt."
      ],
      fields: [{ label: "Payoneer account", value: "payments@example.com" }]
    },
    {
      id: "binance",
      label: "USDT (Binance)",
      sub: "Any country · crypto",
      currency: "USD",
      steps: [
        "From Binance or any wallet, send USDT to the address below. Choose the network BNB Smart Chain (BEP20) — USDT sent on another network is lost.",
        "Send the amount in USDT (plus the network fee, if your wallet adds it on top).",
        "Take a screenshot of the completed transfer, with its transaction ID (TxID)."
      ],
      fields: [
        { label: "USDT address", value: "YOUR-USDT-ADDRESS", copy: true },
        { label: "Network", value: "BNB Smart Chain (BEP20 / BSC) only" },
        { label: "Binance Pay ID", value: "", copy: true, optional: true }
      ]
    },
    {
      id: "ach",
      memo: true,
      label: "US bank transfer (ACH)",
      sub: "From a US bank account",
      currency: "USD",
      steps: [
        "In your US bank, add a new recipient with the details below (ACH only — wire transfers are not received).",
        "Send the amount, with your email in the memo.",
        "Take a screenshot of the completed transfer."
      ],
      fields: [
        { label: "Beneficiary name", value: "YOUR NAME", copy: true },
        { label: "Account number", value: "YOUR-ACCOUNT-NUMBER", copy: true },
        { label: "Routing number (ACH)", value: "YOUR-ROUTING-NUMBER", copy: true },
        { label: "Account type", value: "Checking" },
        { label: "Bank name", value: "YOUR-BANK-NAME" }
      ]
    },
    {
      id: "jazzcash",
      label: "JazzCash",
      sub: "Pakistan",
      currency: "PKR",
      steps: ["Send the amount to this JazzCash account.", "Take a screenshot of the confirmation, with its transaction ID."],
      fields: [
        { label: "Account title", value: "YOUR NAME" },
        { label: "Mobile number", value: "YOUR-MOBILE-NUMBER", copy: true }
      ]
    },
    {
      id: "easypaisa",
      label: "Easypaisa",
      sub: "Pakistan",
      currency: "PKR",
      steps: ["Send the amount to this Easypaisa account.", "Take a screenshot of the confirmation, with its transaction ID."],
      fields: [
        { label: "Account title", value: "YOUR NAME" },
        { label: "Mobile number", value: "YOUR-MOBILE-NUMBER", copy: true }
      ]
    }
  ],
  termsUrl: "https://clipie.vercel.app/terms",
  privacyUrl: "https://clipie.vercel.app/privacy"
};
function availableMethods() {
  return PAYMENTS.methods.filter((m) => m.fields.filter((f) => !f.optional).every((f) => f.value.trim()));
}
function packPrice(pack, method) {
  return method.currency === "PKR" ? `Rs ${pack.pkr.toLocaleString("en-US")}` : `$${pack.usd}`;
}
const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms);
    t.unref?.();
    return t;
  },
  clearTimeout: (h) => clearTimeout(h)
};
function eventThrottle(send, keyOf, ms = 100, clock = realClock) {
  const lastSent = /* @__PURE__ */ new Map();
  const held = /* @__PURE__ */ new Map();
  const sendHeld = (key) => {
    const h = held.get(key);
    if (!h) return;
    held.delete(key);
    clock.clearTimeout(h.timer);
    lastSent.set(key, clock.now());
    send(h.ev);
  };
  const flush = () => {
    for (const key of [...held.keys()]) sendHeld(key);
  };
  return {
    flush,
    push(ev) {
      const key = keyOf(ev);
      if (key === null) {
        flush();
        send(ev);
        return;
      }
      const now = clock.now();
      const last = lastSent.get(key);
      const h = held.get(key);
      if (!h && (last === void 0 || now - last >= ms)) {
        lastSent.set(key, now);
        send(ev);
        return;
      }
      if (h) {
        h.ev = ev;
        return;
      }
      const wait = Math.max(0, ms - (now - (last ?? now)));
      held.set(key, { ev, timer: clock.setTimeout(() => sendHeld(key), wait) });
    }
  };
}
const RELEASES_REPO = { owner: "Inshal-Amir", repo: "Clipie-releases" };
const NETWORK_TROUBLE = new RegExp(
  `${OFFLINE.source}|net::ERR_(INTERNET_DISCONNECTED|NETWORK_CHANGED|CONNECTION_\\w+|TIMED_OUT|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE|INCOMPLETE_CHUNKED_ENCODING|CONTENT_LENGTH_MISMATCH|HTTP2_\\w+|SSL_PROTOCOL_ERROR|EMPTY_RESPONSE|NETWORK_IO_SUSPENDED|PROXY_CONNECTION_FAILED)|\\bterminated\\b|other side closed|premature close|ECONNABORTED|EPIPE|The operation was aborted|download stalled|download stopped early`,
  "i"
);
function isNetworkTrouble(err) {
  return NETWORK_TROUBLE.test(String(err?.message ?? err ?? ""));
}
const UPDATE_MESSAGES = {
  offline: "No internet connection. Nizam checks again once you're back online.",
  damaged: "The download arrived damaged, so Nizam did not install it. Click to try again.",
  notYet: "The new version is still being published. Try again in a few minutes.",
  busy: "GitHub, where updates come from, is busy right now. Try again in a few minutes.",
  storage: "There isn't enough free space on this computer for the update. Free some space, then try again.",
  permission: "Nizam isn't allowed to replace its own files here. Download the new version from the website and install it over this one.",
  generic: "The update could not finish. Click to try again, or download the new version from the website."
};
function updateErrorMessage(err) {
  const text = String(err?.message ?? err ?? "").trim();
  if (!text) return UPDATE_MESSAGES.generic;
  if (/checksum|sha512 checksum mismatch|ERR_CHECKSUM_MISMATCH|damaged/i.test(text)) return UPDATE_MESSAGES.damaged;
  if (/no space left|ENOSPC|disk full|not enough space/i.test(text)) return UPDATE_MESSAGES.storage;
  if (/\bEACCES\b|\bEPERM\b|permission denied|operation not permitted|read-only file system|EROFS/i.test(text)) return UPDATE_MESSAGES.permission;
  if (isNetworkTrouble(text)) return UPDATE_MESSAGES.offline;
  if (/ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|ERR_UPDATER_LATEST_VERSION_NOT_FOUND|ERR_UPDATER_NO_PUBLISHED_VERSIONS|\b404\b/.test(text)) return UPDATE_MESSAGES.notYet;
  if (/\b(403|429)\b|rate.?limit|too many requests|\b5\d\d\b|bad gateway|service unavailable/i.test(text)) return UPDATE_MESSAGES.busy;
  if (/^[A-Z][^\n{}<>]*[.!]$/.test(text) && !/\b(Error|ERR_|errno|HttpError|status code)\b/.test(text) && text.length < 300) return text;
  return UPDATE_MESSAGES.generic;
}
function macZipFor(files, arch, appleSilicon) {
  const want = appleSilicon ? ["arm64", arch] : [arch];
  for (const a of want) {
    const hit = files.find((f) => f.url === `Nizam-mac-${a}.zip`) ?? files.find((f) => f.url.endsWith(".zip") && f.url.includes(a));
    if (hit) return hit;
  }
  return void 0;
}
function manualDownloadName(platform, arch, linux = "appimage") {
  if (platform === "darwin") return `Nizam-mac-${arch === "arm64" ? "arm64" : "x64"}.dmg`;
  if (platform === "win32") return "Nizam-windows-x64.exe";
  if (linux === "deb") return "Nizam-linux-amd64.deb";
  if (linux === "rpm") return "Nizam-linux-x86_64.rpm";
  return "Nizam-linux-x86_64.AppImage";
}
function latestDownloadUrl(name, repo = RELEASES_REPO) {
  return `https://github.com/${repo.owner}/${repo.repo}/releases/latest/download/${encodeURIComponent(name)}`;
}
function isNewerVersion(a, b) {
  const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}
const MAC_SWAP_SCRIPT = [
  "#!/bin/bash",
  'PID="$1"; OLD="$2"; NEW="$3"; WORK="$4"; STAGING="$5"; LOG="$6"',
  'say() { echo "$(date "+%F %T") $*" >> "$LOG"; }',
  'say "waiting for $PID to quit"',
  'for _ in $(seq 1 600); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done',
  'if kill -0 "$PID" 2>/dev/null; then say "still running, update left for next time"; rm -rf "$STAGING"; exit 1; fi',
  'BACKUP="$OLD.previous"',
  'rm -rf "$BACKUP"',
  'if mv "$OLD" "$BACKUP"; then',
  '  if mv "$NEW" "$OLD"; then',
  '    say "swapped in $OLD"; rm -rf "$BACKUP"',
  "  else",
  '    say "could not move the new version in, putting the old one back"; rm -rf "$OLD"; mv "$BACKUP" "$OLD"',
  "  fi",
  "else",
  '  say "could not move $OLD aside"',
  "fi",
  'xattr -dr com.apple.quarantine "$OLD" 2>/dev/null',
  // CLIPIE_SWAP_OPEN lets the unit test run the swap without opening anything.
  '${CLIPIE_SWAP_OPEN:-open} "$OLD"',
  'rm -rf "$STAGING" "$WORK"',
  ""
].join("\n");
const BOT_CHECK = /Sign in to confirm you(?:'|’)?re not a bot|not a bot|captcha/i;
const AGE_WALL = /confirm your age/i;
const RATE_LIMIT = /This content isn't available, try again later|HTTP Error 429/;
const CLIENT_FAILURE = /The page needs to be reloaded/;
const COOKIE_FAILURE = /could not find \w+ cookies database|cookies? database|Could not copy \w+ cookie|failed to (?:decrypt|load) cookies|Failed to decrypt with DPAPI|app.bound|Cookies\.binarycookies|unsupported browser specified for cookies|keyring/i;
const EXTRACTOR_FAILURE = /Unable to extract|Requested format is not available|nsig|n challenge|[Ss]ignature extraction failed|Please report this issue|Unable to download API page|Failed to extract any player response/;
function classifyYtDlp(stderr, offline, usedCookies = false) {
  if (usedCookies && COOKIE_FAILURE.test(stderr) && !/ERROR:.*(not a bot|confirm your age)/i.test(stderr)) return "cookies";
  if (BOT_CHECK.test(stderr)) return "bot";
  if (AGE_WALL.test(stderr)) return "age";
  if (RATE_LIMIT.test(stderr)) return "rateLimit";
  if (CLIENT_FAILURE.test(stderr)) return "client";
  if (offline.test(stderr)) return "offline";
  return "other";
}
function wantsFreshYtDlp(stderr) {
  return BOT_CHECK.test(stderr) || CLIENT_FAILURE.test(stderr) || EXTRACTOR_FAILURE.test(stderr);
}
const FALLBACK_CLIENTS = ["web_embedded,tv_downgraded", "visionos"];
const POT_CLIENTS = ["mweb,web_safari"];
function attemptChain(opts) {
  const base = [
    { name: "defaults" },
    ...FALLBACK_CLIENTS.map((clients) => ({ name: clients, clients })),
    ...opts.pot ? [{ name: "defaults + PO token", pot: true }, ...POT_CLIENTS.map((clients) => ({ name: `${clients} + PO token`, clients, pot: true }))] : []
  ];
  if (!opts.ipv6) return base;
  return [...base, ...base.map((a) => ({ ...a, name: `${a.name} (IPv4)`, forceIpv4: true }))];
}
const COOKIE_BROWSERS = ["firefox", "chrome", "edge", "brave", "safari"];
const BROWSER_NAMES = { firefox: "Firefox", chrome: "Chrome", edge: "Edge", brave: "Brave", safari: "Safari" };
function isCookieBrowser(v) {
  return typeof v === "string" && COOKIE_BROWSERS.includes(v);
}
function jsRuntimeArgs(execPath) {
  return ["--js-runtimes", `node:${execPath}`, "--remote-components", "ejs:github"];
}
function attemptArgs(attempt, ctx) {
  const args = jsRuntimeArgs(ctx.execPath);
  if (attempt.clients) args.push("--extractor-args", `youtube:player_client=${attempt.clients}`);
  if (attempt.pot && ctx.potBaseUrl && ctx.pluginDir) {
    args.push("--plugin-dirs", ctx.pluginDir, "--extractor-args", `youtubepot-bgutilhttp:base_url=${ctx.potBaseUrl}`);
  }
  if (attempt.forceIpv4) args.push("--force-ipv4");
  if (ctx.cookies) args.push("--cookies-from-browser", ctx.cookies);
  return args;
}
const ROBOT_MESSAGE = "YouTube is asking Nizam to prove it is not a robot.";
const ROBOT_TAIL = "This happens after many downloads from one network and usually lifts within an hour.";
function robotCheck(message) {
  if (!message.startsWith(ROBOT_MESSAGE)) return null;
  const note = message.slice(ROBOT_MESSAGE.length).trim();
  return note && note !== ROBOT_TAIL ? { note } : {};
}
function cookieTrouble(browser, platform, stderr) {
  const name = BROWSER_NAMES[browser];
  if (browser === "safari" && platform === "darwin") {
    return `Nizam could not read Safari's YouTube session: macOS needs to allow it first. Open System Settings → Privacy & Security → Full Disk Access, turn on Nizam, then try again. Or choose another browser.`;
  }
  if ((browser === "chrome" || browser === "edge" || browser === "brave") && platform === "win32") {
    return `Nizam could not read ${name}'s YouTube session: on Windows, ${name} locks its cookies so other apps cannot read them. Firefox works: sign in to YouTube in Firefox and choose it here.`;
  }
  if (/could not find \w+ cookies database|cookies? database/i.test(stderr)) {
    return `Nizam could not find ${name}'s YouTube session. Open YouTube in ${name}, sign in, then try again. Or choose another browser.`;
  }
  return `Nizam could not read ${name}'s YouTube session. Close ${name} and try again, or choose another browser.`;
}
const MAX_FOLDER_NAME = 40;
function emptyFolders() {
  return { folders: [], placed: {} };
}
function normalizeFolders(raw) {
  const out = emptyFolders();
  if (!raw || typeof raw !== "object") return out;
  const r = raw;
  const seen = /* @__PURE__ */ new Set();
  for (const f of Array.isArray(r.folders) ? r.folders : []) {
    if (!f || typeof f !== "object") continue;
    const { id, name, createdAt } = f;
    const clean = cleanFolderName(typeof name === "string" ? name : "");
    if (typeof id !== "string" || !id || seen.has(id) || !clean) continue;
    seen.add(id);
    out.folders.push({ id, name: clean, createdAt: Number(createdAt) || 0 });
  }
  if (r.placed && typeof r.placed === "object") {
    for (const [projectId, folderId] of Object.entries(r.placed)) {
      if (typeof folderId === "string" && seen.has(folderId)) out.placed[projectId] = folderId;
    }
  }
  return out;
}
function cleanFolderName(name) {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_FOLDER_NAME).trim();
}
function uniqueName(d, name, exceptId) {
  const taken = new Set(d.folders.filter((f) => f.id !== exceptId).map((f) => f.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const next = `${name.slice(0, MAX_FOLDER_NAME - String(n).length - 1)} ${n}`;
    if (!taken.has(next.toLowerCase())) return next;
  }
}
function createFolder(d, name, id, now = Date.now()) {
  const clean = cleanFolderName(name);
  if (!clean || d.folders.some((f) => f.id === id)) return d;
  return { ...d, folders: [...d.folders, { id, name: uniqueName(d, clean), createdAt: now }] };
}
function renameFolder(d, id, name) {
  const clean = cleanFolderName(name);
  if (!clean || !d.folders.some((f) => f.id === id)) return d;
  const unique = uniqueName(d, clean, id);
  return { ...d, folders: d.folders.map((f) => f.id === id ? { ...f, name: unique } : f) };
}
function deleteFolder(d, id) {
  const placed = {};
  for (const [projectId, folderId] of Object.entries(d.placed)) if (folderId !== id) placed[projectId] = folderId;
  return { folders: d.folders.filter((f) => f.id !== id), placed };
}
function moveToFolder(d, projectIds, folderId) {
  if (folderId !== null && !d.folders.some((f) => f.id === folderId)) return d;
  const placed = { ...d.placed };
  for (const id of projectIds) {
    if (folderId === null) delete placed[id];
    else placed[id] = folderId;
  }
  return { ...d, placed };
}
function forgetProjects(d, projectIds) {
  if (!projectIds.some((id) => id in d.placed)) return d;
  const placed = { ...d.placed };
  for (const id of projectIds) delete placed[id];
  return { ...d, placed };
}
function folderOf(d, projectId) {
  return d.placed[projectId] ?? null;
}
function inFolder(d, projects, folderId) {
  return folderId === null ? projects : projects.filter((p) => d.placed[p.id] === folderId);
}
function folderCounts(d, projectIds) {
  const byFolder = Object.fromEntries(d.folders.map((f) => [f.id, 0]));
  for (const id of projectIds) {
    const f = d.placed[id];
    if (f !== void 0 && f in byFolder) byFolder[f]++;
  }
  return { all: projectIds.length, byFolder };
}
function parseYouTubeId(input) {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u;
  try {
    u = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") return valid(u.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return valid(u.searchParams.get("v") ?? "");
    const m = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
    if (m) return m[1];
  }
  return null;
}
function looksLikeUrl(input) {
  return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(input.trim());
}
function valid(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
const UNITS = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, KB: 1e3, MB: 1e6, GB: 1e9 };
function bytes(value, unit) {
  const n = Number(value);
  return Number.isFinite(n) && UNITS[unit] ? n * UNITS[unit] : void 0;
}
function parseDownloadLine(line) {
  const pct = /\[download\]\s+([\d.]+)%/.exec(line);
  if (!pct) return null;
  const out = { percent: Number(pct[1]) };
  const total = /of\s+~?\s*([\d.]+)\s*([KMGT]?i?B)\b/.exec(line);
  if (total) out.total = bytes(total[1], total[2]);
  const speed = /at\s+([\d.]+)\s*([KMGT]?i?B)\/s/.exec(line);
  if (speed) out.speed = bytes(speed[1], speed[2]);
  const eta = /ETA\s+(?:(\d+):)?(\d+):(\d+)/.exec(line);
  if (eta) out.eta = Number(eta[1] ?? 0) * 3600 + Number(eta[2]) * 60 + Number(eta[3]);
  return out;
}
function size(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}
function left(sec) {
  if (sec < 60) return "under a minute left";
  const min = Math.round(sec / 60);
  return min < 60 ? `about ${min} min left` : `about ${Math.floor(min / 60)} h ${min % 60} min left`;
}
function describeDownload(what, p) {
  const parts = [`Downloading ${what}… ${Math.round(p.percent)}%`];
  if (p.total) parts.push(`${size(p.total * p.percent / 100)} of ${size(p.total)}`);
  if (p.speed) parts.push(p.speed >= 1e6 ? `${(p.speed / 1e6).toFixed(1)} MB/s` : `${Math.max(1, Math.round(p.speed / 1e3))} KB/s`);
  if (p.eta !== void 0 && p.eta > 0 && Math.round(p.percent) < 100) parts.push(left(p.eta));
  return parts.join(" · ");
}
let gpuCache = null;
let gpuQuery = null;
async function gpuName() {
  try {
    const info = await Promise.race([
      electron.app.getGPUInfo("basic"),
      new Promise((resolve) => setTimeout(() => resolve(null), 8e3))
    ]);
    const devices = info?.gpuDevice ?? [];
    const device = devices.find((d) => d.active) ?? devices[0];
    if (!device) return null;
    if (device.deviceString) return device.deviceString;
    const vendor = device.vendorId === 4318 ? "NVIDIA" : device.vendorId === 4098 ? "AMD" : device.vendorId === 32902 ? "Intel" : device.vendorId === 4203 ? "Apple" : null;
    return vendor ? `${vendor} graphics` : null;
  } catch {
    return null;
  }
}
function primeHardware() {
  if (gpuCache || gpuQuery) return;
  gpuQuery = gpuName().then((value) => {
    gpuCache = { value };
    gpuQuery = null;
  });
}
function recommendModel(input) {
  const { cores, ramGb } = input;
  const appleSilicon = input.platform === "darwin" && input.arch === "arm64";
  if (ramGb < 6 || cores <= 2) {
    return { model: "tiny", reason: `${cores} cores and ${ramGb} GB of memory: anything bigger would crawl` };
  }
  if (ramGb < 10 || cores <= 4) {
    return { model: "base", reason: `${cores} cores and ${ramGb} GB of memory suit the balanced model` };
  }
  if (appleSilicon && ramGb >= 16) {
    return { model: "small", reason: `Apple Silicon with ${ramGb} GB runs the small model quickly and keeps punctuation` };
  }
  if (ramGb >= 16 && cores >= 8) {
    return { model: "small", reason: `${cores} cores and ${ramGb} GB: small gives the best accuracy per minute of waiting` };
  }
  return { model: "base", reason: `${cores} cores and ${ramGb} GB of memory suit the balanced model` };
}
function detectHardware() {
  primeHardware();
  const cores = os.cpus().length || 1;
  const ramGb = Math.round(os.totalmem() / 1024 ** 3);
  const gpu = gpuCache?.value ?? null;
  const { model, reason } = recommendModel({ cores, ramGb, arch: process.arch, platform: process.platform });
  return {
    platform: process.platform,
    arch: process.arch,
    cores,
    ramGb,
    gpu,
    gpuBackend: local.platformAccelerator(),
    recommended: model,
    recommendedReason: reason
  };
}
const encoders = /* @__PURE__ */ new Map();
async function ffmpegKey(ffmpeg) {
  const res = await local.run(ffmpeg, ["-hide_banner", "-version"]).catch(() => null);
  return `${ffmpeg}
${res?.stdout.split("\n")[0] ?? ""}`;
}
async function sessionEncoder(bins) {
  const key = await ffmpegKey(bins.ffmpeg);
  let found = encoders.get(key);
  if (!found) {
    found = local.detectEncoder(bins).catch(() => null);
    encoders.set(key, found);
  }
  return await found ?? void 0;
}
async function rememberEncoder(bins, encoder) {
  encoders.set(await ffmpegKey(bins.ffmpeg), Promise.resolve(encoder));
}
exports.BEAT_TYPES = BEAT_TYPES;
exports.BROWSER_NAMES = BROWSER_NAMES;
exports.COOKIE_BROWSERS = COOKIE_BROWSERS;
exports.IMPORT_MESSAGES = IMPORT_MESSAGES;
exports.LLM_PROVIDERS = LLM_PROVIDERS;
exports.MAC_SWAP_SCRIPT = MAC_SWAP_SCRIPT;
exports.MAX_AUTO_ATTEMPTS = MAX_AUTO_ATTEMPTS;
exports.MAX_TRANSCRIPT_BYTES = MAX_TRANSCRIPT_BYTES;
exports.MEME_PACK_USABLE_SHARE = MEME_PACK_USABLE_SHARE;
exports.MESSAGES = MESSAGES;
exports.MUSIC_DEFAULT_VOLUME = MUSIC_DEFAULT_VOLUME;
exports.OFFLINE = OFFLINE;
exports.OPENROUTER_FREE_ROUTER = OPENROUTER_FREE_ROUTER;
exports.OPENROUTER_MODELS_URL = OPENROUTER_MODELS_URL;
exports.PAYMENTS = PAYMENTS;
exports.RELEASES_REPO = RELEASES_REPO;
exports.ROBOT_MESSAGE = ROBOT_MESSAGE;
exports.ROBOT_TAIL = ROBOT_TAIL;
exports.TRANSCRIPT_FORMAT_LABEL = TRANSCRIPT_FORMAT_LABEL;
exports.UPDATE_MESSAGES = UPDATE_MESSAGES;
exports.attemptArgs = attemptArgs;
exports.attemptChain = attemptChain;
exports.availableMethods = availableMethods;
exports.captionTracksFrom = captionTracksFrom;
exports.chooseCaptions = chooseCaptions;
exports.classifyYtDlp = classifyYtDlp;
exports.cleanFolderName = cleanFolderName;
exports.cookieTrouble = cookieTrouble;
exports.coverageWarning = coverageWarning;
exports.createFolder = createFolder;
exports.cuesToWords = cuesToWords;
exports.deleteFolder = deleteFolder;
exports.describeDownload = describeDownload;
exports.detectFormat = detectFormat;
exports.detectHardware = detectHardware;
exports.emptyFolders = emptyFolders;
exports.eventThrottle = eventThrottle;
exports.findProvider = findProvider;
exports.folderCounts = folderCounts;
exports.folderOf = folderOf;
exports.forgetProjects = forgetProjects;
exports.friendlyError = friendlyError;
exports.inFolder = inFolder;
exports.isCookieBrowser = isCookieBrowser;
exports.isFreeTextModel = isFreeTextModel;
exports.isNetworkTrouble = isNetworkTrouble;
exports.isNewerVersion = isNewerVersion;
exports.jsRuntimeArgs = jsRuntimeArgs;
exports.latestDownloadUrl = latestDownloadUrl;
exports.looksLikeUrl = looksLikeUrl;
exports.macZipFor = macZipFor;
exports.manualDownloadName = manualDownloadName;
exports.memeFileName = memeFileName;
exports.moveToFolder = moveToFolder;
exports.normalizeBaseUrl = normalizeBaseUrl;
exports.normalizeFolders = normalizeFolders;
exports.packPrice = packPrice;
exports.parseClock = parseClock;
exports.parseDownloadLine = parseDownloadLine;
exports.parseJson3 = parseJson3;
exports.parseSrt = parseSrt;
exports.parseSrv3 = parseSrv3;
exports.parseTimedText = parseTimedText;
exports.parseTranscript = parseTranscript;
exports.parseVtt = parseVtt;
exports.parseYouTubeId = parseYouTubeId;
exports.plainCoverageWarning = plainCoverageWarning;
exports.planMusic = planMusic;
exports.primeHardware = primeHardware;
exports.quickListenFits = quickListenFits;
exports.rankFreeModels = rankFreeModels;
exports.recommendModel = recommendModel;
exports.rememberEncoder = rememberEncoder;
exports.renameFolder = renameFolder;
exports.robotCheck = robotCheck;
exports.sessionEncoder = sessionEncoder;
exports.spreadCue = spreadCue;
exports.updateErrorMessage = updateErrorMessage;
exports.wantsFreshYtDlp = wantsFreshYtDlp;
exports.withDetails = withDetails;
