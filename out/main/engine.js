"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
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
const path = require("node:path");
const os = require("node:os");
const node_fs = require("node:fs");
const node_child_process = require("node:child_process");
const local = require("./chunks/local-uqjgyXoD.js");
const hardware = require("./chunks/hardware-BuqFOQez.js");
const worker = require("./chunks/worker-BXmrFsf_.js");
const crypto = require("node:crypto");
require("electron");
const MAX_BRIEF_CHARS = 8e3;
function buildBrief(o) {
  const parts = [];
  const typed = tidy(o.instructions ?? "");
  if (typed) parts.push(typed);
  for (const f of o.instructionFiles ?? []) {
    const body = tidy(f.text);
    if (body) parts.push(`From the file "${f.name}":
${body}`);
  }
  const full = parts.join("\n\n");
  if (full.length <= MAX_BRIEF_CHARS) return { text: full, truncated: false, chars: full.length };
  return { text: `${full.slice(0, MAX_BRIEF_CHARS).replace(/\s+\S*$/, "")} […]`, truncated: true, chars: full.length };
}
function tidy(text) {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
const ROLE = {
  propose: "Pick moments that fit these instructions. If they ask for a topic, a kind of moment, a person or a length, prefer those moments; if they rule something out, do not propose it. When the instructions and the rules above disagree on what makes a good clip, the instructions win; the answer format and the whole-sentence rule stay as they are.",
  laughs: "Use these instructions when deciding which laughs are worth a clip: skip anything they rule out.",
  compare: "A clip that breaks these instructions loses to one that follows them. When both follow them (or neither does), judge as above.",
  coldread: 'Answer "follows" for every clip: false if it breaks these instructions (a topic, word, person or kind of content they rule out, or not the kind of moment they ask for), and name the instruction in "note". Judge "stands_alone" on its own, as before; do not set it to false only because of the instructions.',
  copy: "Follow these instructions for the titles, hooks, descriptions and hashtags: their tone, language, words to use or avoid, names, tags and any required text.",
  summary: "Follow these instructions for wording, language and what to mention or leave out.",
  script: "Follow these instructions for wording and language where they apply to a cleaned-up transcript; never invent content.",
  memes: "Do not choose a meme or sound that these instructions rule out, or that would clash with them."
};
function briefFor(stage, brief) {
  if (!brief.trim()) return "";
  return `

The creator gave instructions for this video. ${ROLE[stage]}
<instructions>
${brief}
</instructions>`;
}
const TIME = String.raw`(?:(\d{1,2}):)?(\d{1,3}):(\d{2})(?!\d)`;
const JOIN = String.raw`\s*(?:-|–|—|→|~|to|till|until|upto|up to|se|sy|say|sey|and|aur)\s*`;
const RANGE = new RegExp(`${TIME}${JOIN}${TIME}`, "gi");
const SINGLE = new RegExp(TIME, "g");
const NOT_A_PLACE = /^\s*(?:am|pm|baje|bjy|o'?clock|long|length|lamb[ia]|duration|min(?:ute)?s? long)\b/i;
function seconds(h, m, s) {
  const sec = Number(s);
  if (sec >= 60) return null;
  return (h ? Number(h) * 3600 : 0) + Number(m) * 60 + sec;
}
function briefWindows(text, duration2, maxClipSeconds = 60) {
  if (!text || !/\d:\d\d/.test(text)) return [];
  const found = [];
  const used = [];
  for (const m of text.matchAll(RANGE)) {
    const at = m.index ?? 0;
    used.push([at, at + m[0].length]);
    if (NOT_A_PLACE.test(text.slice(at + m[0].length, at + m[0].length + 16))) continue;
    const a = seconds(m[1], m[2], m[3]);
    const b = seconds(m[4], m[5], m[6]);
    if (a === null || b === null) continue;
    const [from, to] = a <= b ? [a, b] : [b, a];
    found.push({ start: from - 5, end: Math.max(to, from + 15) + 5 });
  }
  for (const m of text.matchAll(SINGLE)) {
    const at = m.index ?? 0;
    if (used.some(([x, y]) => at >= x && at < y)) continue;
    if (NOT_A_PLACE.test(text.slice(at + m[0].length, at + m[0].length + 16))) continue;
    const t = seconds(m[1], m[2], m[3]);
    if (t === null) continue;
    found.push({ start: t - 30, end: t + Math.max(60, maxClipSeconds) + 30 });
  }
  const inside = found.map((w) => ({ start: Math.max(0, w.start), end: Math.min(duration2, w.end) })).filter((w) => w.end - w.start >= 5).sort((x, y) => x.start - y.start);
  const merged = [];
  for (const w of inside) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}
function transcriptInWindows(t, windows) {
  if (!windows.length) return t;
  const inside = (start, end) => {
    const mid = (start + end) / 2;
    return windows.some((w) => mid >= w.start && mid <= w.end);
  };
  return {
    ...t,
    words: t.words.filter((w) => inside(w.start, w.end)),
    segments: t.segments.map((s) => s.words ? { ...s, words: s.words.filter((w) => inside(w.start, w.end)) } : s).filter((s) => s.words ? s.words.length > 0 : inside(s.start, s.end))
  };
}
function describeWindows(windows) {
  return windows.map((w) => `${clock(w.start)}-${clock(w.end)}`).join(", ");
}
function clock(t) {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
const AST = "Xenova/ast-finetuned-audioset-10-10-0.4593";
const SR$4 = 16e3;
const LAUGH = ["Laughter", "Baby laughter", "Giggle", "Snicker", "Belly laugh", "Chuckle, chortle"];
const CROWD = ["Applause", "Cheering", "Clapping", "Crowd"];
async function classifier(modelsDir, onProgress) {
  const tf = await import("@huggingface/transformers");
  tf.env.cacheDir = modelsDir;
  tf.env.allowLocalModels = true;
  tf.env.allowRemoteModels = true;
  const files = /* @__PURE__ */ new Map();
  const clf = await tf.pipeline("audio-classification", AST, {
    dtype: "q8",
    progress_callback: (p) => {
      if (p.status !== "progress" || !p.file || !onProgress) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      const all = [...files.values()];
      const total = all.reduce((a, f) => a + f.total, 0);
      if (total) onProgress(all.reduce((a, f) => a + f.loaded, 0) / total * 100);
    }
  });
  return clf;
}
async function downloadLaughterModel(modelsDir, onProgress) {
  await classifier(modelsDir, onProgress);
}
async function laughWindows(o) {
  const clf = await classifier(o.modelsDir);
  const starts = [];
  for (const end of o.lineEnds) {
    const s = Math.max(o.offset, end - 0.4);
    if (!starts.length || s - starts[starts.length - 1] >= 1) starts.push(s);
  }
  const out = [];
  for (const [i, s] of starts.entries()) {
    if (o.signal?.aborted) throw new Error("Cancelled");
    const a = Math.round((s - o.offset) * SR$4);
    const win = o.samples.subarray(a, a + 3 * SR$4);
    if (win.length < SR$4 / 2) continue;
    const r = await clf(win, { top_k: 40 });
    const score = (names) => Math.max(0, ...r.filter((x) => names.includes(x.label)).map((x) => x.score));
    out.push({ start: round$7(s), end: round$7(s + 3), laugh: round$7(score(LAUGH)), crowd: round$7(score(CROWD)) });
    if (i % 10 === 9) o.onProgress((i + 1) / starts.length * 100);
  }
  return out;
}
const LO = Math.log10(5e-3);
const HI = Math.log10(0.3);
const level = (x) => Math.min(1, Math.max(0, (Math.log10(Math.max(x, 1e-6)) - LO) / (HI - LO)));
const heard = (e) => Math.max(level(e.laugh), level(e.crowd) * 0.9);
const laughAfter = (evs, t, within = 3) => Math.max(0, ...evs.filter((e) => e.start >= t - 0.6 && e.start <= t + within).map(heard));
function laughEvents(evs, min) {
  const out = [];
  for (const e of evs.filter((w) => heard(w) >= min)) {
    const last = out[out.length - 1];
    if (last && e.start - last.end < 1.5) last.end = e.end;
    else out.push({ start: e.start, end: e.end });
  }
  return out;
}
function round$7(n) {
  return Math.round(n * 1e3) / 1e3;
}
const ENDS_SENTENCE = /[.!?…]["'”’)]*$|[۔؟।]["'”’)]*$/;
const THOUGHT_PAUSE = 0.65;
function buildSentences(words2) {
  const out = [];
  if (!words2.length) return out;
  let from = 0;
  const flush = (to, closed) => {
    if (to < from) return;
    const slice = words2.slice(from, to + 1);
    const text = slice.map((w) => w.text).join(" ").trim();
    if (text) out.push({ start: slice[0].start, end: slice[slice.length - 1].end, text, from, to, closed });
    from = to + 1;
  };
  for (let i = 0; i < words2.length; i++) {
    const w = words2[i];
    const next = words2[i + 1];
    const gap = next ? next.start - w.end : Infinity;
    if (ENDS_SENTENCE.test(w.text)) {
      flush(i, true);
      continue;
    }
    if (gap >= THOUGHT_PAUSE && i - from >= 3) flush(i, false);
  }
  flush(words2.length - 1, false);
  return out;
}
function snapToSentences(start, end, sentences, opts) {
  const limit = opts.limit ?? { start: -Infinity, end: Infinity };
  if (!sentences.length) return clamp$5({ start, end }, limit);
  const usable = sentences.filter((s) => s.end > limit.start && s.start < limit.end);
  if (!usable.length) return clamp$5({ start, end }, limit);
  const inStart = usable.find((s) => start >= s.start - 0.15 && start < s.end);
  const after = usable.find((s) => s.start >= start - 0.15);
  const first = inStart ?? after ?? usable[usable.length - 1];
  let s0 = Math.max(limit.start, first.start);
  const startIdx = usable.indexOf(first);
  let last = first;
  for (let i = startIdx; i < usable.length; i++) {
    const candidate = usable[i];
    if (candidate.end - s0 > opts.maxSeconds) break;
    last = candidate;
    if (candidate.end >= end) break;
  }
  let e0 = Math.min(limit.end, last.end);
  if (e0 - s0 < opts.minSeconds) {
    for (let i = usable.indexOf(last) + 1; i < usable.length; i++) {
      const candidate = usable[i];
      if (candidate.end - s0 > opts.maxSeconds) break;
      e0 = Math.min(limit.end, candidate.end);
      if (e0 - s0 >= opts.minSeconds) break;
    }
  }
  if (e0 - s0 > opts.maxSeconds) {
    const room = s0 + opts.maxSeconds;
    const within = usable.filter((s) => s.start > s0 && s.start <= room);
    e0 = within.length ? within[within.length - 1].start : room;
  }
  if (e0 <= s0) e0 = Math.min(limit.end, s0 + opts.minSeconds);
  return clamp$5({ start: s0, end: e0 }, limit);
}
function wordsWithin(words2, range2) {
  return words2.filter((w) => w.start >= range2.start - 1e-3 && w.end <= range2.end + 1e-3);
}
function landsOnSentences(range2, sentences, tolerance = 0.05) {
  const startsClean = sentences.some((s) => Math.abs(s.start - range2.start) <= tolerance);
  const endsClean = sentences.some((s) => Math.abs(s.end - range2.end) <= tolerance);
  return startsClean && endsClean;
}
function clamp$5(range2, limit) {
  const start = Math.max(range2.start, limit.start === -Infinity ? range2.start : limit.start);
  const end = Math.min(range2.end, limit.end === Infinity ? range2.end : limit.end);
  return { start: round$6(start), end: round$6(Math.max(start + 0.1, end)) };
}
function round$6(n) {
  return Math.round(n * 1e3) / 1e3;
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array2, separator = "|") {
  return array2.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value2) {
  if (typeof value2 === "bigint")
    return value2.toString();
  return value2;
}
function cached(getter) {
  return {
    get value() {
      {
        const value2 = getter();
        Object.defineProperty(this, "value", { value: value2 });
        return value2;
      }
    }
  };
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
function assignProp(target, prop, value2) {
  Object.defineProperty(target, prop, {
    value: value2,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function esc$1(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__ */ cached(() => {
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
const propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function stringifyPrimitive(value2) {
  if (typeof value2 === "bigint")
    return value2.toString() + "n";
  if (typeof value2 === "string")
    return `"${value2}"`;
  return `${value2}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
  });
}
const NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key2 of Reflect.ownKeys(mask)) {
        if (!Object.prototype.hasOwnProperty.call(currDef.shape, key2)) {
          throw new Error(`Unrecognized key: "${String(key2)}"`);
        }
        if (!mask[key2])
          continue;
        assignProp(newShape, key2, currDef.shape[key2]);
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key2 of Reflect.ownKeys(mask)) {
        if (!Object.prototype.hasOwnProperty.call(currDef.shape, key2)) {
          throw new Error(`Unrecognized key: "${String(key2)}"`);
        }
        if (!mask[key2])
          continue;
        delete newShape[key2];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key2 of Reflect.ownKeys(shape)) {
      if (Object.getOwnPropertyDescriptor(existingShape, key2) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function merge(a, b) {
  if (!b?._zod?.def) {
    throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
  }
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class, schema, mask, name = "partial") {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key2 of Reflect.ownKeys(mask)) {
          if (!Object.prototype.hasOwnProperty.call(oldShape, key2)) {
            throw new Error(`Unrecognized key: "${String(key2)}"`);
          }
          if (!mask[key2])
            continue;
          shape[key2] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key2]
          }) : oldShape[key2];
        }
      } else {
        for (const key2 of Reflect.ownKeys(oldShape)) {
          shape[key2] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key2]
          }) : oldShape[key2];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key2 of Reflect.ownKeys(mask)) {
          if (!Object.prototype.hasOwnProperty.call(shape, key2)) {
            throw new Error(`Unrecognized key: "${String(key2)}"`);
          }
          if (!mask[key2])
            continue;
          shape[key2] = new Class({
            type: "nonoptional",
            innerType: oldShape[key2]
          });
        }
      } else {
        for (const key2 of Reflect.ownKeys(oldShape)) {
          shape[key2] = new Class({
            type: "nonoptional",
            innerType: oldShape[key2]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path2, issues) {
  return issues.map((iss) => {
    var _a2;
    (_a2 = iss).path ?? (_a2.path = []);
    iss.path.unshift(path2);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function attachSchema(issues, start, inst) {
  var _a2;
  for (let i = start; i < issues.length; i++) {
    (_a2 = issues[i]).schema ?? (_a2.schema = inst);
  }
}
function finalizeIssue(iss, ctx, config2) {
  var _a2;
  const traits = iss.inst?._zod?.traits;
  if (traits?.has("$ZodType")) {
    if (traits.has("$ZodCheck"))
      (_a2 = iss).schema ?? (_a2.schema = iss.inst);
    else
      iss.schema = iss.inst;
  }
  const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const { inst: _inst, schema: _schema, continue: _continue, input: _input, ...rest } = iss;
  rest.path ?? (rest.path = []);
  rest.message = message;
  if (ctx?.reportInput) {
    rest.input = _input;
  }
  return rest;
}
const highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
  const units = str.length;
  if (!highSurrogate.test(str))
    return units;
  let count = units;
  for (let i = 0; i < units - 1; i++) {
    if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
      count--;
      i++;
    }
  }
  return count;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function members(proto, table) {
  for (const key2 in table) {
    const desc = Object.getOwnPropertyDescriptor(table, key2);
    if (desc.get)
      Object.defineProperty(proto, key2, { ...desc, enumerable: false });
    else
      defineBound(proto, key2, desc.value);
  }
}
function own(inst, key2, value2, enumerable = true) {
  Object.defineProperty(inst, key2, { configurable: true, writable: true, enumerable, value: value2 });
  return value2;
}
function hide(inst, key2, value2) {
  return own(inst, key2, value2, false);
}
function defineBound(proto, key2, fn) {
  Object.defineProperty(proto, key2, {
    configurable: true,
    get() {
      return this == null ? fn : own(this, key2, fn.bind(this));
    },
    set(value2) {
      own(this, key2, value2);
    }
  });
}
function claim(inst, sentinel) {
  const proto = Object.getPrototypeOf(inst);
  return sentinel in proto ? void 0 : proto;
}
let installing;
let broke = false;
const breaker = {
  configurable: true,
  get() {
    broke = true;
    return void 0;
  }
};
function defineLazyInternal(inst, key2, compute) {
  const proto = Object.getPrototypeOf(inst._zod);
  if (key2 in proto && installing !== inst._zod) {
    installing = void 0;
    return;
  }
  installing = inst._zod;
  Object.defineProperty(proto, key2, {
    configurable: true,
    get() {
      Object.defineProperty(this, key2, breaker);
      const outer = broke;
      broke = false;
      try {
        const value2 = compute(this);
        if (broke)
          delete this[key2];
        else
          Object.defineProperty(this, key2, { configurable: true, writable: true, value: value2 });
        broke = broke || outer;
        return value2;
      } catch (err) {
        delete this[key2];
        broke = broke || outer;
        throw err;
      }
    },
    set(value2) {
      Object.defineProperty(this, key2, { configurable: true, writable: true, value: value2 });
    }
  });
}
function installLazyProp(inst, key2, make, enumerable) {
  const proto = claim(inst, key2);
  if (!proto)
    return;
  Object.defineProperty(proto, key2, {
    configurable: true,
    get() {
      const desc = { configurable: true, writable: true, enumerable, value: void 0 };
      Object.defineProperty(this, key2, desc);
      desc.value = make(this);
      Object.defineProperty(this, key2, desc);
      return desc.value;
    },
    set(value2) {
      Object.defineProperty(this, key2, { configurable: true, writable: true, enumerable, value: value2 });
    }
  });
}
const CONSTANT_CATCH = "~constantCatch";
function constantCatch(value2) {
  const fn = () => value2;
  fn[CONSTANT_CATCH] = true;
  return fn;
}
var _a$1;
const _zodDesc$1 = { value: void 0, enumerable: false };
let _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
  const E = _E;
  if (E) {
    const saved = E.stackTraceLimit;
    if (typeof saved === "number") {
      try {
        E.stackTraceLimit = 0;
      } catch {
        _E = null;
        return new Definition();
      }
      try {
        return new Definition();
      } finally {
        E.stackTraceLimit = saved;
      }
    }
  }
  return new Definition();
}
function $constructor(name, initializer2, proto, params) {
  const zodProto = {};
  function Internals(def) {
    this.def = def;
    this.constr = _;
    this.traits = /* @__PURE__ */ new Set();
  }
  Internals.prototype = zodProto;
  const protoMembers = proto;
  const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
  function init(inst, def) {
    if (!inst._zod) {
      _zodDesc$1.value = new Internals(def);
      try {
        Object.defineProperty(inst, "_zod", _zodDesc$1);
      } finally {
        _zodDesc$1.value = void 0;
      }
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer2(inst, def);
    if (initialized) {
      const own2 = Object.getPrototypeOf(inst);
      const ctorProto = inst._zod.constr.prototype;
      let up = own2;
      while (up && up !== ctorProto)
        up = Object.getPrototypeOf(up);
      const target = up ?? own2;
      if (!initialized.has(target)) {
        initialized.add(target);
        members(target, protoMembers);
      }
    }
    const proto2 = _.prototype;
    for (const k in proto2) {
      if (!Object.prototype.hasOwnProperty.call(proto2, k))
        continue;
      if (!(k in inst)) {
        inst[k] = proto2[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    const inst = params?.Parent ? newError(Definition) : this;
    init(inst, def);
    const deferred = inst._zod.deferred;
    if (deferred) {
      for (const fn of deferred) {
        fn();
      }
      inst._zod.deferred = void 0;
    }
    const pp = globalThis.__zod_globalConfig?.postProcessor;
    if (pp)
      pp(inst);
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
class $ZodAsyncError extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
}
class $ZodEncodeError extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
}
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}
function _getMessage() {
  const internals = this._zod;
  internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
  return internals.message;
}
function _setMessage(value2) {
  this._zod.message = value2;
}
const _messageDesc = {
  get: _getMessage,
  set: _setMessage,
  enumerable: true,
  configurable: true
};
const _zodDesc = { value: void 0, enumerable: false };
const _issuesDesc = { value: void 0, enumerable: false };
const _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
const initializer$1 = (inst, def) => {
  inst.name = "$ZodError";
  _zodDesc.value = inst._zod;
  Object.defineProperty(inst, "_zod", _zodDesc);
  _issuesDesc.value = def;
  Object.defineProperty(inst, "issues", _issuesDesc);
  _zodDesc.value = void 0;
  _issuesDesc.value = void 0;
  Object.defineProperty(inst, "message", _messageDesc);
  const proto = Object.getPrototypeOf(inst);
  if (!_installedToString.has(proto)) {
    _installedToString.add(proto);
    Object.defineProperty(proto, "toString", {
      configurable: true,
      enumerable: false,
      get() {
        const value2 = () => this.message;
        Object.defineProperty(this, "toString", { value: value2, configurable: true, writable: true });
        return value2;
      },
      set(value2) {
        Object.defineProperty(this, "toString", { value: value2, configurable: true, writable: true });
      }
    });
  }
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, void 0, {
  Parent: Error
});
function node(obj, key2, make) {
  if (!Object.prototype.hasOwnProperty.call(obj, key2)) {
    if (key2 === "__proto__") {
      Object.defineProperty(obj, key2, { value: make(), writable: true, enumerable: true, configurable: true });
    } else {
      obj[key2] = make();
    }
  }
  return obj[key2];
}
function flattenError(error2, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error2.issues) {
    if (sub.path.length > 0) {
      node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error2, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error3, path2 = []) => {
    for (const issue2 of error3.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path2, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path2, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path2, ...issue2.path]);
      } else {
        const fullpath = [...path2, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (el === "_errors") {
              if (terminal)
                curr._errors.push(mapper(issue2));
              i++;
              continue;
            }
            if (!Object.prototype.hasOwnProperty.call(curr, el)) {
              Object.defineProperty(curr, el, {
                value: { _errors: [] },
                enumerable: true,
                writable: true,
                configurable: true
              });
            }
            const node2 = curr[el];
            if (terminal) {
              node2._errors.push(mapper(issue2));
            }
            curr = node2;
            i++;
          }
        }
      }
    }
  };
  processError(error2);
  return fieldErrors;
}
function finalizeParams(callee, params) {
  return { callee: params?.callee ?? callee, Err: params?.Err };
}
const _parse = (_Err) => {
  const fn = (schema, value2, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value: value2, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError();
    }
    if (result.issues.length) {
      const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, _params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
const _parseAsync = (_Err) => {
  const fn = async (schema, value2, _ctx, params) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value: value2, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    if (result.issues.length) {
      const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
const _safeParse = (_Err) => (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value: value2, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value: value2, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
const _encode = (_Err) => {
  const parse2 = _parse(_Err);
  const fn = (schema, value2, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return parse2(schema, value2, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
const _decode = (_Err) => {
  const parse2 = _parse(_Err);
  const fn = (schema, value2, _ctx, _params) => {
    return parse2(schema, value2, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
const _encodeAsync = (_Err) => {
  const parseAsync2 = _parseAsync(_Err);
  const fn = async (schema, value2, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return await parseAsync2(schema, value2, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
const _decodeAsync = (_Err) => {
  const parseAsync2 = _parseAsync(_Err);
  const fn = async (schema, value2, _ctx, _params) => {
    return await parseAsync2(schema, value2, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
const _safeEncode = (_Err) => (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value2, ctx);
};
const _safeDecode = (_Err) => (schema, value2, _ctx) => {
  return _safeParse(_Err)(schema, value2, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value2, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value2, _ctx) => {
  return _safeParseAsync(_Err)(schema, value2, _ctx);
};
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
  return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
const duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const uuid = (version2) => {
  if (!version2)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
  return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
function anchor(source) {
  return new RegExp(`^${source}$`);
}
const date = /* @__PURE__ */ anchor(dateSource);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const opts = ["Z"];
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const qualified = `${timeSource({ precision: args.precision, seconds: true })}(?:${opts.join("|")})`;
  const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a2;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a2 = inst._zod).onattach ?? (_a2.onattach = []);
});
const _whenHasLength = (payload) => {
  const val = payload.value;
  return !nullish(val) && val.length !== void 0;
};
const numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
const $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    var _a2;
    (_a2 = inst2._zod.bag).multipleOf ?? (_a2.multipleOf = def.value);
  });
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? (
      // `value % 0n` throws, and nothing is a multiple of zero — the number branch already fails this way via NaN
      def.value !== BigInt(0) && payload.value % def.value === BigInt(0)
    ) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = _whenHasLength);
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = _whenHasLength);
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = _whenHasLength);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a2, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a2 = inst._zod).check ?? (_a2.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});
class Doc {
  constructor(args = [], closed = {}) {
    this.content = [];
    this.indent = 0;
    this.args = args;
    this.closed = closed;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const content = this?.content ?? [``];
    const factory = new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${content.join("\n")}
};`);
    return factory(...Object.values(this.closed));
  }
}
const version = {
  major: 4,
  minor: 5,
  patch: 4
};
const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a2;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const defChecks = inst._zod.def.checks;
  const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      if (payload.memo)
        return payload;
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          attachSchema(payload.issues, currLen, inst);
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
}, {
  // Wrappers extend this by installing a richer factory over it; reading it eagerly would defeat the laziness.
  get "~standard"() {
    return hide(this, "~standard", standardProps(this));
  },
  set "~standard"(value2) {
    own(this, "~standard", value2);
  }
});
const toStandardResult = (r) => r.success ? { value: r.data } : { issues: r.error?.issues };
function standardProps(inst) {
  return {
    validate: (value2) => {
      try {
        return toStandardResult(safeParse$1(inst, value2));
      } catch (_) {
        return safeParseAsync$1(inst, value2).then(toStandardResult);
      }
    },
    vendor: "zod",
    version: 1
  };
}
const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
const URL_BAD_FORMAT = 1;
const URL_UNPARSEABLE = 2;
function parseURLObject(trimmed, def) {
  if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) {
    return URL_BAD_FORMAT;
  }
  try {
    return new URL(trimmed);
  } catch {
    return URL_UNPARSEABLE;
  }
}
const asciiTabOrNewline = /[\t\n\r]/g;
function stripTabAndNewline(value2) {
  return value2.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
  hostname.lastIndex = 0;
  return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
  protocol.lastIndex = 0;
  return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      const url = parseURLObject(trimmed, def);
      if (url === URL_BAD_FORMAT) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid URL format",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (url === URL_UNPARSEABLE) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (def.hostname && !urlHostnameOk(url, def.hostname)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid hostname",
          pattern: def.hostname.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      if (def.protocol && !urlProtocolOk(url, def.protocol)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid protocol",
          pattern: def.protocol.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1))
    throw new Error(`Invalid nanoid length: ${def.length}`);
  def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
  if (def.local || def.precision === -1) {
    inst._zod.bag.laxFormat = true;
    inst._zod.onattach.push((s) => {
      s._zod.bag.laxFormat = true;
    });
  }
});
const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv4`;
});
const ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value2) {
  if (!ipv6Alphabet.test(value2))
    return false;
  try {
    new URL(`http://[${value2}]`);
    return true;
  } catch {
    return false;
  }
}
const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv6`;
  inst._zod.check = (payload) => {
    if (!isValidIPv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value2) {
  const parts = value2.split("/");
  if (parts.length !== 2)
    return false;
  const [address, prefix] = parts;
  if (!prefix)
    return false;
  const prefixNum = Number(prefix);
  if (`${prefixNum}` !== prefix)
    return false;
  if (prefixNum < 0 || prefixNum > 128)
    return false;
  return isValidIPv6(address);
}
const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidCIDRv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64";
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64url);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64url";
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
const $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo2 ? memo2.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
    const proms = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key2, input, optin, optout) {
  const isPresent = key2 in input;
  const isOptionalOut = optout === "optional";
  if (!isPresent && isOptionalOut && optin === "optional") {
    return;
  }
  if (result.issues.length) {
    if (optin !== void 0 && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key2, result.issues));
  }
  if (!isPresent && optin === void 0) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key2]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent) {
      final.value[key2] = void 0;
    }
  } else {
    final.value[key2] = result.value;
  }
}
const NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  const ownSymbols = Object.getOwnPropertySymbols(def.shape);
  const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
  const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
  for (const k of allKeys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    allKeys,
    symbolKeys,
    // string-only: handleCatchall matches it against `for...in`, which never yields a symbol
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const optin = _catchall.optin;
  const optout = _catchall.optout;
  for (const key2 in input) {
    if (keySet.has(key2))
      continue;
    if (key2 === "__proto__") {
      if (t === "never")
        unrecognized.push(key2);
      continue;
    }
    if (t === "never") {
      unrecognized.push(key2);
      continue;
    }
    const r = _catchall.run({ value: input[key2], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r3) => handlePropertyResult(r3, payload, key2, input, optin, optout)));
    } else {
      handlePropertyResult(r, payload, key2, input, optin, optout);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst,
      // Describes the shape of the input, not the validity of the parsed value, so it never aborts. The parse still fails; the schema's own checks just get to run first, and an enclosing intersection can reconcile the key against a sibling operand.
      continue: true
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
const propShapes = /* @__PURE__ */ new WeakMap();
const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!desc?.get) {
    const sh = def.shape;
    propShapes.set(def, sh);
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        propShapes.set(def, newSh);
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazyInternal(inst, "propValues", (zod) => {
    const shape = zod.def.shape;
    const propValues = {};
    for (const key2 in shape) {
      const field = shape[key2]._zod;
      if (field.values) {
        if (!Object.prototype.hasOwnProperty.call(propValues, key2)) {
          assignProp(propValues, key2, /* @__PURE__ */ new Set());
        }
        for (const v of field.values)
          propValues[key2].add(v);
        if (field.optin !== void 0)
          propValues[key2].add(void 0);
      }
    }
    return propValues;
  });
  const isObject$1 = isObject;
  const catchall = def.catchall;
  let value2;
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    value2 ?? (value2 = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
    const proms = [];
    const shape = value2.shape;
    for (const key2 of value2.allKeys) {
      if (key2 === "__proto__")
        continue;
      const el = shape[key2];
      const optin = el._zod.optin;
      const optout = el._zod.optout;
      const r = el._zod.run({ value: input[key2], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r3) => handlePropertyResult(r3, payload, key2, input, optin, optout)));
      } else {
        handlePropertyResult(r, payload, key2, input, optin, optout);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const memo2 = globalConfig.memoizer;
  const generateFastpass = (shape) => {
    const normalized = _normalized.value;
    const syms = normalized.symbolKeys;
    const doc = new Doc(["payload", "ctx"], { shape, inst, memo: memo2, syms });
    const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    const prefixStr = (id, k) => `
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
          }`;
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter2 = 0;
    for (const key2 of normalized.allKeys) {
      ids[key2] = `key_${counter2++}`;
    }
    doc.write(memo2 ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
    for (const key2 of normalized.allKeys) {
      if (key2 === "__proto__")
        continue;
      const id = ids[key2];
      const k = typeof key2 === "symbol" ? `syms[${syms.indexOf(key2)}]` : esc$1(key2);
      const isPresent = `${k} in input`;
      const schema = shape[key2];
      const optin = schema?._zod?.optin;
      const isOptionalIn = optin !== void 0;
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(k)};`);
      if (isOptionalIn && isOptionalOut) {
        const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
        doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        
        if (${id}.value === undefined) {
          if (${isPresent}) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    return doc.compile();
  };
  let fastpass;
  const isObject$1 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval$1 = allowsEval;
  const fastEnabled = jit && allowsEval$1.value;
  const catchall = def.catchall;
  let value2;
  inst._zod.parse = (payload, ctx) => {
    value2 ?? (value2 = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value2, inst);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
  defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazyInternal(inst, "values", (zod) => {
    if (zod.def.options.every((o) => o._zod.values)) {
      return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    if (zod.def.options.every((o) => o._zod.pattern)) {
      const patterns = zod.def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key2) => bKeys.indexOf(key2) !== -1);
    const newObj = { ...a, ...b };
    if (Object.prototype.hasOwnProperty.call(newObj, "__proto__"))
      delete newObj.__proto__;
    for (const key2 of sharedKeys) {
      if (key2 === "__proto__")
        continue;
      const sharedValue = mergeValues(a[key2], b[key2]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key2, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key2] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  const keyIssues = /* @__PURE__ */ new Map();
  const collect = (iss, side) => {
    let keys;
    if (iss.code === "unrecognized_keys" && !iss.path?.length) {
      unrecIssue ?? (unrecIssue = iss);
      keys = iss.keys;
    } else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
      const k = String(iss.path[0]);
      if (!keyIssues.has(k))
        keyIssues.set(k, iss);
      keys = [k];
    } else {
      return false;
    }
    for (const k of keys) {
      if (!unrecKeys.has(k))
        unrecKeys.set(k, {});
      unrecKeys.get(k)[side] = true;
    }
    return true;
  };
  for (const iss of left.issues) {
    if (!collect(iss, "l"))
      result.issues.push(iss);
  }
  for (const iss of right.issues) {
    if (!collect(iss, "r"))
      result.issues.push(iss);
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length) {
    const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
    if (aggregated.length)
      result.issues.push({ ...unrecIssue, keys: aggregated });
    for (const k of bothKeys) {
      if (!aggregated.includes(k) && keyIssues.has(k))
        result.issues.push(keyIssues.get(k));
    }
  }
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    if (aborted(result))
      return result;
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  const patternValues = values.filter((k) => propertyKeyTypes.has(typeof k));
  inst._zod.pattern = new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  globalConfig.memoizer?.guard(inst);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    return payload;
  };
});
function handleOptionalResult(payload, result) {
  payload.value = result.issues.length ? void 0 : result.value;
  return payload;
}
const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  inst._zod.optout = "optional";
  defineLazyInternal(inst, "values", (zod) => {
    const values = zod.def.innerType._zod.values;
    return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === void 0) {
      if (def.innerType._zod.optin !== "defaulted")
        return payload;
      const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
      if (result instanceof Promise)
        return result.then((result2) => handleOptionalResult(payload, result2));
      return handleOptionalResult(payload, result);
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazyInternal(inst, "values", (zod) => {
    return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => {
    const v = zod.def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handleCatchResult(payload, result, def, ctx) {
  if (!result.issues.length) {
    payload.value = result.value;
    if (result.memo)
      payload.memo = true;
    return payload;
  }
  payload.value = def.catchValue({
    ...result,
    value: payload.value,
    error: {
      issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
    },
    input: payload.value
  });
  return payload;
}
const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleCatchResult(payload, result2, def, ctx));
    }
    return handleCatchResult(payload, result, def, ctx);
  };
});
const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  if (!payload.memo)
    payload.value = Object.freeze(payload.value);
  return payload;
}
const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r3) => handleRefineResult(r3, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
class $ZodCyclicError extends Error {
  constructor() {
    super(`Cannot parse a reference cycle that closes through a transform`);
    this.name = "ZodCyclicError";
  }
}
const STATE = "~memo";
const NO_ISSUES = [];
function cloneIssues(issues) {
  return issues.map((iss) => iss.path ? { ...iss, path: iss.path.slice() } : { ...iss });
}
const recursive = /* @__PURE__ */ new WeakMap();
function isRecursive(inst, stack) {
  const cached2 = recursive.get(inst);
  if (cached2 !== void 0)
    return cached2;
  if (stack.has(inst))
    return true;
  stack.add(inst);
  let result = false;
  const check = (child) => {
    if (!result && child?._zod && isRecursive(child, stack))
      result = true;
  };
  const def = inst._zod.def;
  const kind = def.type;
  switch (kind) {
    case "object": {
      for (const key2 of Reflect.ownKeys(def.shape))
        check(def.shape[key2]);
      check(def.catchall);
      break;
    }
    case "array":
      check(def.element);
      break;
    case "tuple":
      for (const el of def.items)
        check(el);
      check(def.rest);
      break;
    case "record":
    case "map":
      check(def.keyType);
      check(def.valueType);
      break;
    case "set":
      check(def.valueType);
      break;
    case "union":
      for (const el of def.options)
        check(el);
      break;
    case "intersection":
      check(def.left);
      check(def.right);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
    case "promise":
    case "success":
      check(def.innerType);
      break;
    case "pipe":
      check(def.in);
      check(def.out);
      break;
    case "function":
      check(def.input);
      check(def.output);
      break;
    // reading `_zod.innerType` resolves the getter once and caches it
    case "lazy":
      check(inst._zod.innerType);
      break;
    // a leaf by choice: `parts` are regex fragments, not data positions
    case "template_literal":
    // leaves
    case "string":
    case "number":
    case "int":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
    case "null":
    case "void":
    case "never":
    case "any":
    case "unknown":
    case "date":
    case "nan":
    case "enum":
    case "literal":
    case "file":
    case "transform":
    case "custom":
      break;
    default: {
      for (const key2 in def) {
        const desc = Object.getOwnPropertyDescriptor(def, key2);
        if (!desc || desc.get)
          continue;
        const value2 = desc.value;
        if (!value2 || typeof value2 !== "object")
          continue;
        if (value2._zod)
          check(value2);
        else if (Array.isArray(value2))
          for (const el of value2)
            check(el);
      }
    }
  }
  stack.delete(inst);
  recursive.set(inst, result);
  return result;
}
function bucketFor(state, inst) {
  let bucket = state.buckets.get(inst);
  if (!bucket) {
    bucket = /* @__PURE__ */ new Map();
    state.buckets.set(inst, bucket);
  }
  return bucket;
}
let handoff;
const open = [];
const memo = {
  alloc(_inst, payload, empty) {
    const bucket = handoff;
    if (!bucket)
      return empty;
    handoff = void 0;
    const entry = { value: empty, issues: null };
    bucket.set(payload.value, entry);
    open.push(entry);
    return empty;
  },
  guard(inst) {
    var _a2;
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value))
          throw new $ZodCyclicError();
        return base(payload, ctx);
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  },
  attach(inst) {
    var _a2;
    let isRecursiveInst;
    let lastCtx;
    let lastBucket;
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (isRecursiveInst === void 0) {
          isRecursiveInst = isRecursive(inst, /* @__PURE__ */ new Set());
          if (!isRecursiveInst) {
            inst._zod.parse = base;
            if (inst._zod.run === wrapped)
              inst._zod.run = base;
            return base(payload, ctx);
          }
        }
        const input = payload.value;
        if (input === null || typeof input !== "object")
          return base(payload, ctx);
        let state = ctx[STATE];
        if (!state) {
          state = { buckets: /* @__PURE__ */ new Map(), backEdges: void 0 };
          ctx[STATE] = state;
        }
        let bucket;
        if (lastCtx === ctx) {
          bucket = lastBucket;
        } else {
          bucket = bucketFor(state, inst);
          lastCtx = ctx;
          lastBucket = bucket;
        }
        const hit = bucket.get(input);
        if (hit) {
          payload.value = hit.value;
          if (hit.issues) {
            if (hit.issues.length)
              payload.issues.push(...cloneIssues(hit.issues));
          } else {
            payload.memo = true;
            state.backEdges ?? (state.backEdges = /* @__PURE__ */ new Set());
            state.backEdges.add(hit.value);
          }
          return payload;
        }
        handoff = bucket;
        const depth = open.length;
        const result = base(payload, ctx);
        handoff = void 0;
        const entry = open.length > depth ? open.pop() : void 0;
        if (result instanceof Promise) {
          return result.then((r) => {
            if (entry)
              entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
            return r;
          });
        }
        if (entry)
          entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
        return result;
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  }
};
function memoizer() {
  return memo;
}
function isBackEdge(ctx, value2) {
  const backEdges = ctx[STATE]?.backEdges;
  return backEdges !== void 0 && value2 !== null && typeof value2 === "object" && backEdges.has(value2);
}
const error = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    credit_card: "credit card number",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    // Compatibility: "nan" -> "NaN" for display
    nan: "NaN"
    // All other type names omitted - they fall back to raw values via ?? operator
  };
  function getTypeName(type, input) {
    if (type === "number" && typeof input === "number" && !Number.isFinite(input)) {
      return String(input);
    }
    return TypeDictionary[type] ?? type;
  }
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = getTypeName(issue2.expected);
        const receivedType = parsedType(issue2.input);
        const received = getTypeName(receivedType, issue2.input);
        return `Invalid input: expected ${expected}, received ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.exact ? "exactly " : issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.exact ? "exactly " : issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue2.origin}`;
      case "invalid_union":
        if (issue2.options && Array.isArray(issue2.options) && issue2.options.length > 0) {
          const opts = issue2.options.map((o) => `'${o}'`).join(" | ");
          return `Invalid discriminator value. Expected ${opts}`;
        }
        if (issue2.inclusive === false) {
          return "Invalid input: more than one option matched";
        }
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue2.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
function en() {
  return {
    localeError: error()
  };
}
var _a;
class $ZodRegistry {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
  return new Class({
    type: "string",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
  return new Class({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
  return new Class({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
  return new Class({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
  return new Class({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
  return new Class({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
  return new Class({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
  return new Class({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
  return new Class({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
  return new Class({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
  return new Class({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
  return new Class({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
  return new Class({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
  return new Class({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
  return new Class({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
  return new Class({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _coercedNumber(Class, params) {
  return new Class({
    type: "number",
    coerce: true,
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value2, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value2, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value2, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value2, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value2, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value: value2
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
  return new Class({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
function assignProps(target, ...sources) {
  for (const source of sources) {
    for (const key2 of Reflect.ownKeys(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, key2)) {
        assignProp(target, key2, source[key2]);
      }
    }
  }
  return target;
}
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {
    }),
    io: params?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    sharedDefsExtractedFor: void 0,
    sharedEmitDoneFor: void 0,
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    intersections: [],
    deferred: [],
    external: params?.external ?? void 0
  };
}
function handleUnrepresentable(schema, ctx, json, params, message) {
  const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({ zodSchema: schema, path: params.path, message }) : ctx.unrepresentable;
  if (result === "any")
    return false;
  if (result === void 0 || result === "throw")
    throw new Error(message);
  Object.assign(json, result);
  return true;
}
function process$1(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a2;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  ctx.sharedDefsExtractedFor = void 0;
  ctx.sharedEmitDoneFor = void 0;
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      process$1(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    assignProps(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a2 = result.schema).default ?? (_a2.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function encodeJSONPointerSegment(segment) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external)
    return;
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}` };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    if (entry[1] === root && !entry[1].schema.id) {
      return { ref: uriPrefix };
    }
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + encodeJSONPointerSegment(defId) };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key2 in schema2) {
      delete schema2[key2];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
        continue;
      }
    }
  }
  if (ctx.external)
    ctx.sharedDefsExtractedFor = ctx.external;
}
function compactTypeUnion(schema) {
  const options = schema.anyOf;
  if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0)
    return;
  const types = [];
  for (const option of options) {
    if (!option || typeof option !== "object")
      return;
    compactTypeUnion(option);
    const keys = Object.keys(option);
    if (keys.length !== 1 || keys[0] !== "type")
      return;
    const type = option.type;
    for (const member of Array.isArray(type) ? type : [type]) {
      if (typeof member !== "string")
        return;
      if (!types.includes(member))
        types.push(member);
    }
  }
  delete schema.anyOf;
  schema.type = types.length === 1 ? types[0] : types;
}
const FOLDABLE_KEYS = /* @__PURE__ */ new Set(["type", "properties", "required", "additionalProperties"]);
const UNION_KEYS = ["oneOf", "anyOf"];
function undeclaredConstraint(member) {
  const extra = member.additionalProperties;
  if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null)
    return null;
  return Object.keys(extra).length ? extra : null;
}
function foldObjects(members2) {
  const objects = [];
  for (const member of members2) {
    if (typeof member !== "object" || member.type !== "object")
      return null;
    for (const key2 in member) {
      if (!FOLDABLE_KEYS.has(key2))
        return null;
    }
    objects.push(member);
  }
  const properties = {};
  const required2 = /* @__PURE__ */ new Set();
  for (const object2 of objects) {
    for (const key2 in object2.properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key2))
        continue;
      const parts = [];
      for (const other of objects) {
        const part = other.properties?.[key2] ?? undeclaredConstraint(other);
        if (part === null || part === void 0)
          continue;
        if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part)))
          parts.push(part);
      }
      const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
      assignProp(properties, key2, merged);
    }
    for (const key2 of object2.required ?? [])
      required2.add(key2);
  }
  const folded = { type: "object", properties };
  if (required2.size)
    folded.required = [...required2];
  if (objects.every((object2) => object2.additionalProperties === false)) {
    folded.additionalProperties = false;
  } else {
    const constraints = [];
    for (const object2 of objects) {
      const constraint = undeclaredConstraint(object2);
      if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint)))
        constraints.push(constraint);
    }
    if (constraints.length === 1)
      folded.additionalProperties = constraints[0];
    else if (constraints.length > 1)
      folded.additionalProperties = { allOf: constraints };
  }
  return folded;
}
function foldIntersection(json) {
  const allOf = json.allOf;
  if (!Array.isArray(allOf) || allOf.length < 2)
    return;
  for (const key2 of FOLDABLE_KEYS)
    if (key2 in json)
      return;
  const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
  let folded = null;
  if (!unions.length) {
    folded = foldObjects(allOf);
  } else {
    const union2 = unions[0];
    const keyword = UNION_KEYS.find((k) => Array.isArray(union2[k]));
    if (Object.keys(union2).length !== 1)
      return;
    const rest = allOf.filter((m) => m !== union2);
    const branches = union2[keyword].map((branch) => foldObjects([...rest, branch]));
    if (branches.some((b) => !b))
      return;
    folded = { [keyword]: branches };
  }
  if (!folded)
    return;
  delete json.allOf;
  assignProps(json, folded);
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        assignProps(schema2, refSchema);
      }
      assignProps(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key2 in schema2) {
          if (key2 === "$ref" || key2 === "allOf")
            continue;
          if (!(key2 in _cached)) {
            delete schema2[key2];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key2 in schema2) {
          if (key2 === "$ref" || key2 === "allOf")
            continue;
          if (key2 in refSeen.def && JSON.stringify(schema2[key2]) === JSON.stringify(refSeen.def[key2])) {
            delete schema2[key2];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key2 in schema2) {
            if (key2 === "$ref" || key2 === "allOf")
              continue;
            if (key2 in parentSeen.def && JSON.stringify(schema2[key2]) === JSON.stringify(parentSeen.def[key2])) {
              delete schema2[key2];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of [...ctx.seen.entries()].reverse()) {
      flattenRef(entry[0]);
    }
    if (ctx.target !== "openapi-3.0") {
      for (const entry of ctx.seen.entries()) {
        compactTypeUnion(entry[1].def ?? entry[1].schema);
      }
    }
    for (const rewrite of ctx.deferred)
      rewrite();
    if (ctx.intersections.length) {
      const carriers = /* @__PURE__ */ new Map();
      for (const seen of ctx.seen.values()) {
        for (const json of [seen.schema, seen.def]) {
          const allOf = json?.allOf;
          if (!Array.isArray(allOf))
            continue;
          const existing = carriers.get(allOf);
          if (existing)
            existing.push(json);
          else
            carriers.set(allOf, [json]);
        }
      }
      for (const allOf of ctx.intersections) {
        for (const json of carriers.get(allOf) ?? [])
          foldIntersection(json);
      }
    }
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") ;
  else ;
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== void 0 && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.def && seen.defId) {
        if (seen.def.id === seen.defId)
          delete seen.def.id;
        assignProp(defs, seen.defId, seen.def);
      }
    }
  }
  if (ctx.external)
    ctx.sharedEmitDoneFor = ctx.external;
  if (ctx.external) ;
  else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key2 in def.shape) {
      if (isTransforming(def.shape[key2], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
const stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time" || laxFormat) {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const patternList = [...patterns];
    if (patternList.length === 1)
      json.pattern = patternList[0].source;
    else if (patternList.length > 1) {
      json.allOf = [
        ...patternList.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
const numberProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format === "string" && format.includes("int"))
    json.type = "integer";
  else
    json.type = "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json.minimum = minimum;
  }
  if (exMax) {
    if (legacy) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (typeof multipleOf === "number") {
    if (Number.isFinite(multipleOf) && multipleOf !== 0)
      json.multipleOf = Math.abs(multipleOf);
    else
      handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${multipleOf} cannot be represented in JSON Schema`);
  }
};
const neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
};
const enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.length === 0) {
    json.not = {};
    return;
  }
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
const customProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
const transformProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
const arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = process$1(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
function inputOptin(schema) {
  const def = schema._zod.def;
  if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) {
    return inputOptin(def.out);
  }
  if (def.type === "catch") {
    return inputOptin(def.innerType);
  }
  return schema._zod.optin;
}
const objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const shape = def.shape;
  const symbolKeys = Object.getOwnPropertySymbols(shape);
  if (symbolKeys.length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) {
    return;
  }
  json.type = "object";
  json.properties = {};
  for (const key2 in shape) {
    assignProp(json.properties, key2, process$1(shape[key2], ctx, {
      ...params,
      path: [...params.path, "properties", key2]
    }));
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key2) => {
    const field = def.shape[key2];
    if (ctx.io === "input") {
      return inputOptin(field) === void 0;
    } else {
      return field._zod.optout === void 0;
    }
  }));
  if (requiredKeys.size > 0) {
    json.required = Array.from(requiredKeys);
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = process$1(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
const unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => process$1(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
const intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = process$1(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = process$1(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
  ctx.intersections.push(allOf);
};
const nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const UNREPRESENTABLE_DEFAULT = /* @__PURE__ */ Symbol();
function serializeDefaultValue(value2, schema, ctx, json, params) {
  let unrepresentable = false;
  const serialized = JSON.stringify(value2, (_, val) => {
    if (typeof val !== "bigint")
      return val;
    unrepresentable = true;
    return null;
  });
  if (!unrepresentable)
    return JSON.parse(serialized);
  handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
  return UNREPRESENTABLE_DEFAULT;
}
const defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  const value2 = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value2 !== UNREPRESENTABLE_DEFAULT)
    json.default = value2;
};
const prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io !== "input")
    return;
  const value2 = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value2 !== UNREPRESENTABLE_DEFAULT)
    json._prefault = value2;
};
const catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
    return;
  }
  json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  process$1(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key2, make) {
  Object.defineProperty(proto, key2, {
    configurable: true,
    enumerable: false,
    get() {
      const value2 = make(this);
      Object.defineProperty(this, key2, { value: value2, configurable: true, writable: true });
      return value2;
    },
    set(value2) {
      Object.defineProperty(this, key2, { value: value2, configurable: true, writable: true });
    }
  });
}
const initializer = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  const proto = Object.getPrototypeOf(inst);
  if (_installedErrorProtos.has(proto))
    return;
  _installedErrorProtos.add(proto);
  _lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
  _lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
  _lazyMethod(proto, "addIssue", (self) => (issue2) => {
    self.issues.push(issue2);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  _lazyMethod(proto, "addIssues", (self) => (issues2) => {
    self.issues.push(...issues2);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  Object.defineProperty(proto, "isEmpty", {
    configurable: true,
    enumerable: false,
    get() {
      return this.issues.length === 0;
    }
  });
};
const ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer, void 0, {
  Parent: Error
});
const parse$1 = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
function _ensureDefaultLocale() {
  if (!globalConfig.localeError)
    config(en());
}
function _ensureDefaultMemoizer() {
  if (!globalConfig.memoizer)
    config({ memoizer: memoizer() });
}
const ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  _ensureDefaultLocale();
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
  return inst;
}, {
  check(...chks) {
    const def = this.def;
    return this.clone(mergeDefs(def, {
      checks: [
        ...def.checks ?? [],
        ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
      ]
    }), { parent: true });
  },
  with(...chks) {
    return this.check(...chks);
  },
  clone(def, params) {
    return clone(this, def, params);
  },
  brand() {
    return this;
  },
  register(reg, meta) {
    reg.add(this, meta);
    return this;
  },
  refine(check, params) {
    return this.check(refine(check, params));
  },
  superRefine(refinement, params) {
    return this.check(superRefine(refinement, params));
  },
  overwrite(fn) {
    return this.check(/* @__PURE__ */ _overwrite(fn));
  },
  optional() {
    return optional(this);
  },
  exactOptional() {
    return exactOptional(this);
  },
  nullable() {
    return nullable(this);
  },
  nullish() {
    return optional(nullable(this));
  },
  nonoptional(params) {
    return nonoptional(this, params);
  },
  array() {
    return array(this);
  },
  or(arg) {
    return union([this, arg]);
  },
  and(arg) {
    return intersection(this, arg);
  },
  transform(tx) {
    return pipe(this, transform(tx));
  },
  default(d) {
    return _default(this, d);
  },
  prefault(d) {
    return prefault(this, d);
  },
  catch(params) {
    return _catch(this, params);
  },
  pipe(target) {
    return pipe(this, target);
  },
  readonly() {
    return readonly(this);
  },
  describe(description) {
    const cl = this.clone();
    globalRegistry.add(cl, { description });
    return cl;
  },
  meta(...args) {
    if (args.length === 0)
      return globalRegistry.get(this);
    const cl = this.clone();
    globalRegistry.add(cl, args[0]);
    return cl;
  },
  isOptional() {
    return this.safeParse(void 0).success;
  },
  isNullable() {
    return this.safeParse(null).success;
  },
  apply(fn, ...args) {
    return args.length === 0 ? fn(this) : fn(this, ...args);
  },
  // Overrides core's `~standard` to add `jsonSchema`. Must stay a prototype entry: redefining it per instance demotes instances to dictionary mode.
  get "~standard"() {
    return hide(this, "~standard", {
      ...standardProps(this),
      jsonSchema: {
        input: createStandardJSONSchemaMethod(this, "input"),
        output: createStandardJSONSchemaMethod(this, "output")
      }
    });
  },
  set "~standard"(value2) {
    own(this, "~standard", value2);
  },
  parse: function _parse2(data, params) {
    return parse$1(this, data, params, { callee: _parse2 });
  },
  parseAsync: async function _parseAsync2(data, params) {
    return await parseAsync(this, data, params, { callee: _parseAsync2 });
  },
  safeParse(data, params) {
    return safeParse(this, data, params);
  },
  async safeParseAsync(data, params) {
    return safeParseAsync(this, data, params);
  },
  // `spa` is an alias: same function object as `safeParseAsync`, as before.
  get spa() {
    return this?.safeParseAsync;
  },
  set spa(value2) {
    own(this, "spa", value2);
  },
  encode: function _encode2(data, params) {
    return encode(this, data, params, { callee: _encode2 });
  },
  decode: function _decode2(data, params) {
    return decode(this, data, params, { callee: _decode2 });
  },
  encodeAsync: async function _encodeAsync2(data, params) {
    return await encodeAsync(this, data, params, { callee: _encodeAsync2 });
  },
  decodeAsync: async function _decodeAsync2(data, params) {
    return await decodeAsync(this, data, params, { callee: _decodeAsync2 });
  },
  safeEncode(data, params) {
    return safeEncode(this, data, params);
  },
  safeDecode(data, params) {
    return safeDecode(this, data, params);
  },
  async safeEncodeAsync(data, params) {
    return safeEncodeAsync(this, data, params);
  },
  async safeDecodeAsync(data, params) {
    return safeDecodeAsync(this, data, params);
  },
  toJSONSchema(params) {
    return createToJSONSchemaMethod(this, {})(params);
  },
  // Reads through to the registry on every access, so it must not cache.
  get description() {
    return globalRegistry.get(this)?.description;
  },
  // No setter: `schema._def = x` throws, as it did when `_def` was a non-writable own property.
  get _def() {
    return this._zod.def;
  }
});
const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
  const bag = inst._zod.bag;
  inst.format = bag.format ?? null;
  inst.minLength = bag.minimum ?? null;
  inst.maxLength = bag.maximum ?? null;
}, {
  regex(...args) {
    return this.check(/* @__PURE__ */ _regex(...args));
  },
  includes(...args) {
    return this.check(/* @__PURE__ */ _includes(...args));
  },
  startsWith(...args) {
    return this.check(/* @__PURE__ */ _startsWith(...args));
  },
  endsWith(...args) {
    return this.check(/* @__PURE__ */ _endsWith(...args));
  },
  min(...args) {
    return this.check(/* @__PURE__ */ _minLength(...args));
  },
  max(...args) {
    return this.check(/* @__PURE__ */ _maxLength(...args));
  },
  length(...args) {
    return this.check(/* @__PURE__ */ _length(...args));
  },
  nonempty(...args) {
    return this.check(/* @__PURE__ */ _minLength(1, ...args));
  },
  lowercase(params) {
    return this.check(/* @__PURE__ */ _lowercase(params));
  },
  uppercase(params) {
    return this.check(/* @__PURE__ */ _uppercase(params));
  },
  trim() {
    return this.check(/* @__PURE__ */ _trim());
  },
  normalize(...args) {
    return this.check(/* @__PURE__ */ _normalize(...args));
  },
  toLowerCase() {
    return this.check(/* @__PURE__ */ _toLowerCase());
  },
  toUpperCase() {
    return this.check(/* @__PURE__ */ _toUpperCase());
  },
  slugify() {
    return this.check(/* @__PURE__ */ _slugify());
  }
});
const ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
}, {
  email(params) {
    return this.check(/* @__PURE__ */ _email(ZodEmail, params));
  },
  url(params) {
    return this.check(/* @__PURE__ */ _url(ZodURL, params));
  },
  jwt(params) {
    return this.check(/* @__PURE__ */ _jwt(ZodJWT, params));
  },
  emoji(params) {
    return this.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
  },
  guid(params) {
    return this.check(/* @__PURE__ */ _guid(ZodGUID, params));
  },
  uuid(params) {
    return this.check(/* @__PURE__ */ _uuid(ZodUUID, params));
  },
  uuidv4(params) {
    return this.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
  },
  uuidv6(params) {
    return this.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
  },
  uuidv7(params) {
    return this.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
  },
  nanoid(params) {
    return this.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
  },
  cuid(params) {
    return this.check(/* @__PURE__ */ _cuid(ZodCUID, params));
  },
  cuid2(params) {
    return this.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
  },
  ulid(params) {
    return this.check(/* @__PURE__ */ _ulid(ZodULID, params));
  },
  base64(params) {
    return this.check(/* @__PURE__ */ _base64(ZodBase64, params));
  },
  base64url(params) {
    return this.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
  },
  xid(params) {
    return this.check(/* @__PURE__ */ _xid(ZodXID, params));
  },
  ksuid(params) {
    return this.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
  },
  ipv4(params) {
    return this.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
  },
  ipv6(params) {
    return this.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
  },
  cidrv4(params) {
    return this.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
  },
  cidrv6(params) {
    return this.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
  },
  e164(params) {
    return this.check(/* @__PURE__ */ _e164(ZodE164, params));
  },
  datetime(params) {
    return this.check(/* @__PURE__ */ _isoDateTime(ZodISODateTime, params));
  },
  date(params) {
    return this.check(/* @__PURE__ */ _isoDate(ZodISODate, params));
  },
  time(params) {
    return this.check(/* @__PURE__ */ _isoTime(ZodISOTime, params));
  },
  duration(params) {
    return this.check(/* @__PURE__ */ _isoDuration(ZodISODuration, params));
  }
});
function string(params) {
  return /* @__PURE__ */ _string(ZodString, params);
}
const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
  const bag = inst._zod.bag;
  inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
  inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
  inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
  inst.isFinite = true;
  inst.format = bag.format ?? null;
}, {
  gt(value2, params) {
    return this.check(/* @__PURE__ */ _gt(value2, params));
  },
  gte(value2, params) {
    return this.check(/* @__PURE__ */ _gte(value2, params));
  },
  min(value2, params) {
    return this.check(/* @__PURE__ */ _gte(value2, params));
  },
  lt(value2, params) {
    return this.check(/* @__PURE__ */ _lt(value2, params));
  },
  lte(value2, params) {
    return this.check(/* @__PURE__ */ _lte(value2, params));
  },
  max(value2, params) {
    return this.check(/* @__PURE__ */ _lte(value2, params));
  },
  int(params) {
    return this.check(int(params));
  },
  safe(params) {
    return this.check(int(params));
  },
  positive(params) {
    return this.check(/* @__PURE__ */ _gt(0, params));
  },
  nonnegative(params) {
    return this.check(/* @__PURE__ */ _gte(0, params));
  },
  negative(params) {
    return this.check(/* @__PURE__ */ _lt(0, params));
  },
  nonpositive(params) {
    return this.check(/* @__PURE__ */ _lte(0, params));
  },
  multipleOf(value2, params) {
    return this.check(/* @__PURE__ */ _multipleOf(value2, params));
  },
  step(value2, params) {
    return this.check(/* @__PURE__ */ _multipleOf(value2, params));
  },
  finite() {
    return this;
  }
});
const ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
const ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
});
function unknown() {
  return /* @__PURE__ */ _unknown(ZodUnknown);
}
const ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
});
function never(params) {
  return /* @__PURE__ */ _never(ZodNever, params);
}
const ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
}, {
  min(n, params) {
    return this.check(/* @__PURE__ */ _minLength(n, params));
  },
  nonempty(params) {
    return this.check(/* @__PURE__ */ _minLength(1, params));
  },
  max(n, params) {
    return this.check(/* @__PURE__ */ _maxLength(n, params));
  },
  length(n, params) {
    return this.check(/* @__PURE__ */ _length(n, params));
  },
  unwrap() {
    return this.element;
  }
});
function array(element, params) {
  return /* @__PURE__ */ _array(ZodArray, element, params);
}
const ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
  keyof() {
    return _enum(Object.keys(this._zod.def.shape));
  },
  catchall(catchall) {
    return this.clone({ ...this._zod.def, catchall });
  },
  passthrough() {
    return this.clone({ ...this._zod.def, catchall: unknown() });
  },
  loose() {
    return this.clone({ ...this._zod.def, catchall: unknown() });
  },
  strict() {
    return this.clone({ ...this._zod.def, catchall: never() });
  },
  strip() {
    return this.clone({ ...this._zod.def, catchall: void 0 });
  },
  extend(incoming) {
    return extend(this, incoming);
  },
  safeExtend(incoming) {
    return safeExtend(this, incoming);
  },
  merge(other) {
    return merge(this, other);
  },
  pick(mask) {
    return pick(this, mask);
  },
  omit(mask) {
    return omit(this, mask);
  },
  partial(...args) {
    return partial(ZodOptional, this, args[0]);
  },
  exactPartial(...args) {
    return partial(ZodExactOptional, this, args[0], "exactPartial");
  },
  required(...args) {
    return required(ZodNonOptional, this, args[0]);
  }
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject(def);
}
const ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
const ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
const ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
  inst.enum = def.entries;
  inst.options = Object.values(def.entries);
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value2 of values) {
      if (keys.has(value2)) {
        newEntries[value2] = def.entries[value2];
      } else
        throw new Error(`Key ${value2} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value2 of values) {
      if (keys.has(value2)) {
        delete newEntries[value2];
      } else
        throw new Error(`Key ${value2} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    payload.value = output;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
const ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
const ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
const ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
const ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
  });
}
const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
const ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
  return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return /* @__PURE__ */ _superRefine(fn, params);
}
function number(params) {
  return /* @__PURE__ */ _coercedNumber(ZodNumber, params);
}
function normWord(w) {
  return w.toLowerCase().normalize("NFKC").replace(/[’`]/g, "'").replace(/[^\p{L}\p{M}\p{N}']+/gu, "").replace(/^'+|'+$/g, "");
}
function normWords(text) {
  return text.split(/\s+/).map(normWord).filter(Boolean);
}
const CONNECTORS = /* @__PURE__ */ new Set([
  // English
  "and",
  "but",
  "so",
  "because",
  "cause",
  "cuz",
  "or",
  "which",
  "then",
  "also",
  "plus",
  "anyway",
  "anyways",
  "although",
  "though",
  "whereas",
  "therefore",
  "hence",
  "thus",
  "otherwise",
  "besides",
  "except",
  "until",
  // Roman Urdu / Hindi
  "aur",
  "or",
  "lekin",
  "magar",
  "par",
  "toh",
  "kyunki",
  "kyonki",
  "kiunke",
  "phir",
  "fir",
  "isliye",
  "islye",
  "yani",
  "yaani",
  "balke",
  "balki",
  "warna",
  "varna",
  "jabke",
  "halanke",
  // Urdu script
  "اور",
  "لیکن",
  "مگر",
  "پر",
  "تو",
  "کیونکہ",
  "پھر",
  "اسلیے",
  "لہذا",
  "یعنی",
  "بلکہ",
  "ورنہ",
  "جبکہ",
  "حالانکہ",
  "کہ",
  // Devanagari
  "और",
  "लेकिन",
  "मगर",
  "पर",
  "तो",
  "क्योंकि",
  "फिर",
  "इसलिए",
  "यानी",
  "यानि",
  "बल्कि",
  "वरना",
  "जबकि",
  "हालांकि",
  "कि"
]);
const CONNECTOR_PHRASES = [
  "that's why",
  "that is why",
  "which is why",
  "and then",
  "so yeah",
  "and so",
  "but then",
  "because of that",
  "is liye",
  "iss liye",
  "kyun ke",
  "kyun ki",
  "کیوں کہ",
  "us ke baad",
  "is ke baad",
  "اس لیے",
  "اس کے بعد",
  "اسی لیے",
  "इस लिए",
  "इसके बाद",
  "उसके बाद",
  "इसी लिए"
];
const RESPONSES = /* @__PURE__ */ new Set([
  "yeah",
  "yes",
  "yep",
  "no",
  "nope",
  "right",
  "exactly",
  "true",
  "absolutely",
  "definitely",
  "sure",
  "okay",
  "ok",
  "mhm",
  "hmm",
  "haan",
  "han",
  "ji",
  "bilkul",
  "sahi",
  "nahi",
  "ہاں",
  "جی",
  "بالکل",
  "صحیح",
  "نہیں",
  "हाँ",
  "हां",
  "जी",
  "बिल्कुल",
  "सही",
  "नहीं"
]);
const RESPONSE_PHRASES = [
  "of course",
  "for sure",
  "i know",
  "me too",
  "fair enough",
  "that's true",
  "that's right",
  "you're right",
  "i agree",
  "not really",
  "i mean",
  "oh yeah",
  "oh my god",
  "no way",
  "same here",
  "ji haan",
  "haan ji",
  "جی ہاں",
  "जी हाँ",
  "जी हां"
];
const ALWAYS_RESPONSE = /* @__PURE__ */ new Set(["yeah", "yep", "exactly", "haan", "bilkul", "ہاں", "بالکل", "हाँ", "हां", "बिल्कुल"]);
const BACK_PRONOUNS = /* @__PURE__ */ new Set([
  "he",
  "she",
  "they",
  "him",
  "her",
  "them",
  "his",
  "their",
  "it",
  "that",
  "those",
  "it's",
  "that's",
  "he's",
  "she's",
  "they're",
  "they've",
  "he'd",
  "she'd",
  "they'd",
  "there's",
  "wo",
  "woh",
  "vo",
  "voh",
  "unhon",
  "unhone",
  "unhen",
  "unko",
  "usne",
  "usko",
  "uska",
  "uski",
  "وہ",
  "انہوں",
  "انھوں",
  "انہیں",
  "ان",
  "اس",
  "اسے",
  "اسکو",
  "اسکا",
  "اسکی",
  "वो",
  "वह",
  "उस",
  "उसने",
  "उसको",
  "उसका",
  "उसकी",
  "उन",
  "उन्होंने",
  "उन्हें",
  "उनको"
]);
const TRAILING = /* @__PURE__ */ new Set([
  "and",
  "but",
  "so",
  "because",
  "or",
  "the",
  "a",
  "an",
  "to",
  "of",
  "with",
  "like",
  "that",
  "which",
  "if",
  "when",
  "is",
  "are",
  "was",
  "my",
  "your",
  "aur",
  "lekin",
  "magar",
  "ke",
  "ki",
  "ka",
  "ko",
  "se",
  "mein",
  "toh",
  "kyunki",
  "jo",
  "agar",
  "اور",
  "لیکن",
  "مگر",
  "کہ",
  "کے",
  "کی",
  "کا",
  "کو",
  "سے",
  "میں",
  "تو",
  "کیونکہ",
  "جو",
  "اگر",
  "और",
  "लेकिन",
  "मगर",
  "कि",
  "के",
  "की",
  "का",
  "को",
  "से",
  "में",
  "तो",
  "क्योंकि",
  "जो",
  "अगर"
]);
const ROMAN_TO = /* @__PURE__ */ new Set(["to"]);
const QUESTION_END = /[?؟]["'”’)]*\s*$/;
const HARD_END = /[.!?…۔؟।]["'”’)]*\s*$/;
const SOFT_END = /[,;:—–-]["'”’)]*\s*$/;
function openerFlaw(text, lang) {
  const raw = text.trim().split(/\s+/);
  const words2 = raw.map(normWord);
  const first = words2[0] ?? "";
  if (!first) return null;
  const two = `${first} ${words2[1] ?? ""}`;
  if (CONNECTOR_PHRASES.some((p) => two === p || two.startsWith(`${p} `))) return "connector";
  if (CONNECTORS.has(first)) return "connector";
  if (ROMAN_TO.has(first) && (lang === "ur" || lang === "hi") && !/^to$/i.test(raw[1] ?? "")) return "connector";
  if (ALWAYS_RESPONSE.has(first)) return "response";
  for (const p of RESPONSE_PHRASES) {
    const n = p.split(" ").length;
    if (words2.slice(0, n).join(" ") === p && (raw.length === n || /[,.!?،۔।]$/.test(raw[n - 1] ?? ""))) return "response";
  }
  if (raw.length <= 2 && /[.!]["'”’)]*$/.test(raw[raw.length - 1]) && !/[?؟]/.test(text)) return "response";
  if (RESPONSES.has(first) && (raw.length === 1 || /[,.!?،۔।]$/.test(raw[0]))) return "response";
  if (BACK_PRONOUNS.has(first)) return "pronoun";
  return null;
}
function endFlaw(text, closed = HARD_END.test(text)) {
  const t = text.trim();
  if (QUESTION_END.test(t)) return "question";
  if (SOFT_END.test(t)) return "trailing";
  const words2 = normWords(t);
  const last = words2[words2.length - 1] ?? "";
  if (!closed && TRAILING.has(last)) return "trailing";
  return null;
}
const HARD_OPENER = /* @__PURE__ */ new Set(["connector", "response", "fragment"]);
function openerFlawAt(s, i, lang) {
  const f = openerFlaw(s[i].text, lang);
  if (f) return f;
  if (i > 0 && !s[i - 1].closed && new RegExp(`^["'“‘(]?\\p{Ll}`, "u").test(s[i].text.trim())) return "fragment";
  if (i > 0 && s[i - 1].joinsNext) return "split";
  return null;
}
function endFlawAt(s, i) {
  return endFlaw(s[i].text, s[i].closed) ?? (s[i].joinsNext ? "split" : null);
}
const len = (s, e) => s[e.last].end - s[e.first].start;
function fixEdges(proposal, s, lim) {
  if (!s.length) return null;
  let first = Math.max(0, Math.min(s.length - 1, proposal.first));
  let last = Math.max(first, Math.min(s.length - 1, proposal.last));
  const moves = [];
  const fits = (f, l) => s[l].end - s[f].start <= lim.maxSeconds + 0.01;
  const openFlaw = (i) => openerFlawAt(s, i, lim.lang);
  const hardOpen = (i) => {
    const f = openFlaw(i);
    return f !== null && HARD_OPENER.has(f);
  };
  const flawAtStart = openFlaw(first);
  if (flawAtStart) {
    const hard = HARD_OPENER.has(flawAtStart);
    const back = [first - 1, ...hard || flawAtStart === "split" ? [first - 2] : []].filter((f) => f >= 0 && fits(f, last));
    const to = back.find((f) => !openFlaw(f)) ?? (hard ? back.find((f) => !hardOpen(f)) : void 0);
    if (to !== void 0) {
      moves.push(`start back ${first - to} (${flawAtStart})`);
      first = to;
    } else if (hard || flawAtStart === "split") {
      for (let f = first + 1; f <= Math.min(last, first + 2); f++) {
        if (!hardOpen(f) && s[last].end - s[f].start >= lim.minSeconds * 0.8) {
          moves.push(`start forward ${f - first} (${flawAtStart})`);
          first = f;
          break;
        }
      }
    }
  }
  const flawAtEnd = endFlawAt(s, last);
  const last0 = last;
  if (flawAtEnd) {
    for (let k = 1; k <= 2; k++) {
      const l = last + k;
      if (l >= s.length || !fits(first, l)) break;
      if (!endFlawAt(s, l)) {
        moves.push(`end forward ${k} (${flawAtEnd})`);
        last = l;
        break;
      }
    }
    if (last === last0 && flawAtEnd === "split") {
      for (let l = last - 1; l >= Math.max(first, last - 2); l--) {
        if (!endFlawAt(s, l) && s[l].end - s[first].start >= lim.minSeconds) {
          moves.push(`end back ${last - l} (split)`);
          last = l;
          break;
        }
      }
    }
  }
  while (len(s, { first, last }) < lim.minSeconds - 0.01) {
    if (last + 1 < s.length && fits(first, last + 1)) {
      last++;
      moves.push("end forward (too short)");
    } else if (first > 0 && fits(first - 1, last) && !hardOpen(first - 1)) {
      first--;
      moves.push("start back (too short)");
    } else break;
  }
  while (len(s, { first, last }) > lim.maxSeconds + 0.01 && last > first) {
    let cut = last - 1;
    for (let l = last - 1; l >= first; l--) {
      if (!fits(first, l)) continue;
      cut = l;
      if (!endFlawAt(s, l)) break;
    }
    moves.push(`end back ${last - cut} (too long)`);
    last = cut;
  }
  const seconds2 = len(s, { first, last });
  if (seconds2 < Math.min(lim.minSeconds, 3) - 0.01) return null;
  const flaws = [];
  const o = openFlaw(first);
  if (o) flaws.push(`${o}-open`);
  const e = endFlawAt(s, last);
  if (e) flaws.push(`${e}-end`);
  if (seconds2 < lim.minSeconds - 0.5) flaws.push("too-short");
  let end = s[last].end;
  if (seconds2 > lim.maxSeconds + 0.5) {
    flaws.push("too-long");
    end = s[first].start + lim.maxSeconds;
  }
  return { first, last, start: s[first].start, end, flaws, moves: collapse(moves) };
}
function collapse(moves) {
  const out = [];
  let n = 1;
  moves.forEach((m, i) => {
    if (moves[i + 1] === m) return void n++;
    out.push(n > 1 ? `${m} x${n}` : m);
    n = 1;
  });
  return out;
}
function isHardFlaw(flaw) {
  return flaw === "connector-open" || flaw === "response-open" || flaw === "fragment-open" || flaw === "question-end" || flaw === "trailing-end" || flaw === "too-short" || flaw === "too-long";
}
function flawPenalty(flaws) {
  let p = 0;
  for (const f of flaws) p += f === "pronoun-open" ? 6 : f.startsWith("split") ? 10 : f === "too-long" || f === "too-short" ? 12 : 18;
  return p;
}
function overlapSeconds(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}
const HOOK_WORDS = [
  "how",
  "why",
  "secret",
  "mistake",
  "never",
  "always",
  "best",
  "worst",
  "tip",
  "trick",
  "hack",
  "important",
  "problem",
  "solution",
  "fix",
  "bug",
  "fast",
  "faster",
  "simple",
  "actually",
  "wrong",
  "right",
  "learn",
  "learned",
  "lesson",
  "should",
  "must",
  "avoid",
  "stop",
  "start",
  "free",
  "new",
  "before",
  "after",
  "result",
  "results",
  "surprising",
  "crazy",
  "insane",
  "love",
  "hate",
  "favorite",
  "because",
  "example",
  "demo",
  "let me show",
  "here's",
  "the key",
  "the trick",
  "pro tip",
  // Roman Urdu / Hindi
  "kaise",
  "kyun",
  "kyon",
  "raaz",
  "galti",
  "sabse",
  "zaroori",
  "masla",
  "sach",
  "kabhi",
  "hamesha",
  "yaad",
  "dekho",
  "suno",
  // Urdu script
  "کیسے",
  "کیوں",
  "راز",
  "غلطی",
  "سب سے",
  "ضروری",
  "مسئلہ",
  "سچ",
  "کبھی",
  "ہمیشہ",
  "دیکھو",
  "سنو",
  "یاد",
  // Devanagari
  "कैसे",
  "क्यों",
  "राज़",
  "गलती",
  "सबसे",
  "ज़रूरी",
  "जरूरी",
  "समस्या",
  "सच",
  "कभी",
  "हमेशा",
  "देखो",
  "सुनो",
  "याद"
].map((h) => normWords(h).join(" "));
const HOOK_SINGLE = new Set(HOOK_WORDS.filter((h) => !h.includes(" ")));
const HOOK_PHRASES = HOOK_WORDS.filter((h) => h.includes(" "));
function heuristicAnalysis(transcript, options) {
  const segs = transcript.segments;
  const highlights = [];
  if (segs.length === 0) {
    return {
      summary: "No speech was detected in this video.",
      chapters: [],
      highlights: [],
      script: "",
      social: emptySocial(),
      source: "heuristic"
    };
  }
  const units = transcript.words.length ? buildSentences(transcript.words).map((s) => ({ start: s.start, end: s.end, text: s.text })) : segs;
  const candidates2 = [];
  for (let i = 0; i < units.length; i++) {
    let j = i;
    while (j < units.length && units[j].end - units[i].start <= options.maxClipSeconds) {
      const len2 = units[j].end - units[i].start;
      if (len2 >= options.minClipSeconds) {
        candidates2.push({ from: i, to: j, score: scoreWindow$1(units.slice(i, j + 1), len2, options) });
      }
      j++;
    }
    if (j === units.length && candidates2.length === 0 && i === 0) {
      candidates2.push({ from: 0, to: units.length - 1, score: 1 });
    }
  }
  candidates2.sort((a, b) => b.score - a.score);
  const taken = [];
  for (const c of candidates2) {
    if (highlights.length >= options.clipCount) break;
    const start = units[c.from].start;
    const end = units[c.to].end;
    if (taken.some(([s, e]) => overlap(s, e, start, end) > 0.3)) continue;
    taken.push([start, end]);
    const text = units.slice(c.from, c.to + 1).map((s) => s.text).join(" ");
    highlights.push({
      id: `h${highlights.length + 1}`,
      start,
      end,
      title: makeTitle(text),
      hook: firstSentence(text).split(/\s+/).slice(0, 9).join(" ").replace(/[,.;:!?]+$/, ""),
      description: truncate(text, 180),
      hashtags: defaultHashtags(options.audience),
      reason: "Picked for a scroll-stopping first line, a resolved payoff and a clean whole-thought cut (no API key set).",
      score: Math.round(Math.min(100, c.score * 10))
    });
  }
  highlights.sort((a, b) => a.start - b.start);
  const full = segs.map((s) => s.text).join(" ");
  const chapters = segs.filter((_, i) => i % Math.max(1, Math.floor(segs.length / 6)) === 0).slice(0, 8).map((s) => ({ start: s.start, title: makeTitle(s.text) }));
  return {
    summary: truncate(full, 400),
    chapters,
    highlights,
    script: paragraphs(segs),
    social: {
      youtubeTitle: makeTitle(full),
      youtubeDescription: truncate(full, 300),
      tiktokCaption: `${firstSentence(full)} ${defaultHashtags(options.audience).map((h) => `#${h}`).join(" ")}`,
      linkedinPost: truncate(full, 600),
      tweet: truncate(firstSentence(full), 240)
    },
    source: "heuristic"
  };
}
function scoreWindow$1(segs, len2, options) {
  return scoreSpan(segs.map((x) => x.text), len2, options);
}
const VIRAL_OPENER = [
  "biggest", "worst", "nobody", "no one", "everyone", "everybody", "stop", "avoid",
  "wrong", "secret", "hidden", "real reason", "here's why", "here's how", "watch this",
  "the truth", "the problem", "what nobody", "you need", "listen", "look",
  "sabse bada", "asli", "sach", "kabhi mat", "dekho", "suno",
  "the biggest", "biggest mistake", "worst mistake", "what nobody", "i tested", "you make"
].map((h) => normWords(h).join(" "));
const FILLER_OPENER = /^(so|basically|okay|ok|alright|welcome|guys|today|um|uh|like|yeah|aur|toh|phir|matlab|well)\b/i;
const GENERIC_SETUP = /^(there are|there is|some people|many people|a lot of people|today we|in this video|let us talk)\b/i;
function hookPower(text) {
  const raw = String(text ?? "").trim();
  const w = normWords(raw);
  if (!w.length) return 0;
  const first8 = ` ${w.slice(0, 8).join(" ")} `;
  let p = 0;
  for (const word of w.slice(0, 8)) if (HOOK_SINGLE.has(word)) p += 1.3;
  for (const phrase of HOOK_PHRASES) if (first8.includes(` ${phrase} `)) p += 2.5;
  for (const phrase of VIRAL_OPENER) if (first8.includes(` ${phrase} `)) p += 2.5;
  if (/\b(you|your|tum|aap)\b/i.test(first8)) p += 1.2;
  if (GENERIC_SETUP.test(raw)) p -= 2;
  if (/[?؟]/.test(raw)) p += 2;
  if (/\p{N}/u.test(first8)) p += 1.5;
  if (w.length >= 5 && w.length <= 20) p += 1.2;
  else if (w.length > 28) p -= 1;
  if (FILLER_OPENER.test(raw)) p -= 3;
  if (/^(and|but|so|because|then|yeah|aur|lekin|magar|toh|phir|kyunki)\b/i.test(raw)) p -= 4;
  return p;
}
function payoffPower(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return 0;
  let p = 0;
  if (/[.!?…۔؟।]["'”’)]*$/.test(raw)) p += 1.5;
  if (/[?؟]["'”’)]*$/.test(raw)) p -= 2;
  if (/[,;:—–-]["'”’)]*$/.test(raw)) p -= 2;
  // An ellipsis or a trailing filler is not a payoff even though it ends in a dot.
  if (/\.\.\.|\u2026\s*$/.test(raw)) p -= 1.5;
  if (/\b(uh|um|you know|basically|like|yeah|and|so|aur|toh)\s*[.,;:…]*$/i.test(raw)) p -= 3;
  const tail = ` ${normWords(raw).slice(-12).join(" ")} `;
  for (const phrase of HOOK_PHRASES) if (tail.includes(` ${phrase} `)) p += 0.8;
  if (/\p{N}/u.test(raw.slice(-40))) p += 1;
  return p;
}
function loopBonus(firstText, lastText) {
  const a = new Set(normWords(String(firstText ?? "")).filter((w) => w.length > 3));
  if (!a.size) return 0;
  let n = 0;
  for (const w of normWords(String(lastText ?? ""))) if (w.length > 3 && a.has(w)) n++;
  return Math.min(2, n);
}
function scoreSpan(texts, len2, options) {
  const joined = texts.join(" ");
  const words2 = normWords(joined);
  const density = words2.length / Math.max(1, len2);
  let hooks = 0;
  for (const w of words2) if (HOOK_SINGLE.has(w)) hooks++;
  const spaced = ` ${words2.join(" ")} `;
  for (const p of HOOK_PHRASES) if (spaced.includes(` ${p} `)) hooks++;
  hooks = Math.min(hooks, 6);
  const questions = (joined.match(/[?؟]/g) ?? []).length;
  const numbers = (joined.match(new RegExp("\\p{N}+", "gu")) ?? []).length;
  const ideal = (options.minClipSeconds + options.maxClipSeconds) / 2;
  const lengthFit = 1 - Math.min(1, Math.abs(len2 - ideal) / ideal);
  const lang = options.language;
  const opener = openerFlaw(texts[0] ?? "", lang);
  const firstChar = (texts[0] ?? "").trim().charAt(0);
  const startsClean = !opener && /[\p{Lu}\p{Lo}"'\p{N}]/u.test(firstChar) ? 0.5 : 0;
  const openCost = opener === "connector" || opener === "response" ? 2.5 : opener === "pronoun" ? 0.8 : 0;
  const lastText = texts[texts.length - 1] ?? "";
  const ending = endFlaw(lastText);
  const endsClean = !ending && /[.!?…۔؟।]["'”’)]*$/.test(lastText.trim()) ? 0.5 : 0;
  const endCost = ending === "question" ? 1.5 : ending === "trailing" ? 2 : 0;
  // Viral shape: a scroll-stopping opener and a resolved payoff matter far more
  // than hook words somewhere in the middle of the clip.
  const firstText = texts[0] ?? "";
  const viralOpen = hookPower(firstText);
  const viralPayoff = payoffPower(lastText);
  const viralLoop = loopBonus(firstText, lastText);
  return density * 0.8 + hooks * 0.35 + questions * 0.5 + Math.min(numbers, 5) * 0.25 + lengthFit * 1.2
    + startsClean + endsClean - openCost - endCost
    + viralOpen * 2.4 + viralPayoff * 1.1 + viralLoop * 0.6;
}
function overlap(s1, e1, s2, e2) {
  return Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
}
function makeTitle(text) {
  const s = firstSentence(text).replace(/[.!?۔؟।]+$/, "");
  const words2 = s.split(/\s+/).slice(0, 9).join(" ");
  return words2.charAt(0).toUpperCase() + words2.slice(1);
}
function firstSentence(text) {
  const m = /^(.*?[.!?۔؟।])(\s|$)/.exec(text.trim());
  return (m ? m[1] : text.trim().split(/\s+/).slice(0, 14).join(" ")).trim();
}
function truncate(text, n) {
  const t = text.trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}
function paragraphs(segs) {
  const out = [];
  let cur = [];
  let curStart = segs[0]?.start ?? 0;
  for (const s of segs) {
    cur.push(s.text);
    if (s.end - curStart > 25) {
      out.push(cur.join(" "));
      cur = [];
      curStart = s.end;
    }
  }
  if (cur.length) out.push(cur.join(" "));
  return out.join("\n\n");
}
function defaultHashtags(audience) {
  const base = ["shorts", "viral", "learn"];
  if (/dev|program|code|software|tech/i.test(audience)) return ["coding", "programming", "developer", "tech", ...base];
  return [...base, "tips"];
}
function emptySocial() {
  return { youtubeTitle: "", youtubeDescription: "", tiktokCaption: "", linkedinPost: "", tweet: "" };
}
const HighlightSchema = object({
  start: number(),
  end: number(),
  title: string().catch(""),
  hook: string().catch(""),
  description: string().catch(""),
  hashtags: union([array(string()), string()]).catch([]).transform((v) => Array.isArray(v) ? v : v.split(/[\s,]+/)),
  reason: string().catch(""),
  score: number().catch(50)
});
const EMPTY_SOCIAL = { youtubeTitle: "", youtubeDescription: "", tiktokCaption: "", linkedinPost: "", tweet: "" };
const AnalysisSchema = object({
  summary: string().catch(""),
  chapters: array(object({ start: number(), title: string().catch("") })).catch([]),
  highlights: array(HighlightSchema),
  social: object({
    youtubeTitle: string().catch(""),
    youtubeDescription: string().catch(""),
    tiktokCaption: string().catch(""),
    linkedinPost: string().catch(""),
    tweet: string().catch("")
  }).catch(EMPTY_SOCIAL)
});
class OpenRouterError extends Error {
  constructor(status, body) {
    super(describe(status, body));
    this.status = status;
  }
  status;
}
function describe(status, body) {
  let detail = body;
  try {
    const j = JSON.parse(body);
    if (j.error?.message) detail = j.error.message;
  } catch {
  }
  detail = detail.replace(/\s+/g, " ").trim().slice(0, 200);
  const name = hardware.findProvider(endpoint.provider).label;
  if (status === 401) return `The ${name} API key is invalid. Check Settings → AI writing.`;
  if (status === 402) return `${name} has no credits or the free quota is used up (402). ${detail}`;
  if (status === 429) return `${name} rate limit hit (429). ${detail}`;
  if (status === 404 && endpoint.provider !== "openrouter") return `${name} does not know this model (404). Pick another in Settings → AI writing. ${detail}`;
  return `${name} error ${status}: ${detail}`;
}
function retryable(err) {
  if (err instanceof OpenRouterError) return err.status !== 401 && err.status !== 402;
  return true;
}
const SCRIPT_CHUNK_WORDS = 1200;
const MAX_SCRIPT_CHUNKS = 12;
async function openrouterAnalysis(o) {
  const { transcript, options } = o;
  const candidates2 = await candidateModels(o);
  o.log(`AI writing candidates: ${candidates2.join(", ")}`);
  let lastError = null;
  for (let i = 0; i < candidates2.length; i++) {
    const model = candidates2[i];
    if (o.signal?.aborted) throw new Error("Cancelled");
    o.onProgress(5, `Asking ${shortName(model)} for highlights…`);
    try {
      const parsed = await requestAnalysis(o, model);
      o.onProgress(55, "Snapping highlights to sentence boundaries…");
      const highlights = normalizeHighlights(parsed.highlights, transcript, options);
      if (highlights.length === 0) {
        o.log(`${model} returned no usable highlights; using built-in detection for the clips.`);
        highlights.push(...heuristicAnalysis(transcript, options).highlights);
      }
      const script = await writeScript(o, model);
      return {
        summary: parsed.summary.trim(),
        chapters: parsed.chapters.sort((a, b) => a.start - b.start),
        highlights,
        script,
        social: parsed.social,
        source: "ai",
        model
      };
    } catch (err) {
      if (o.signal?.aborted) throw err;
      lastError = err;
      o.log(`${model} failed: ${lastError.message}`);
      if (!retryable(err) || i === candidates2.length - 1) break;
      o.log("Trying the next free model…");
    }
  }
  throw lastError ?? new Error("AI writing failed.");
}
let endpoint = { provider: "openrouter", baseUrl: hardware.findProvider("openrouter").baseUrl };
let fallbacks = [];
let override = null;
let onSwitch = () => void 0;
function setLlmEndpoint(e, next = []) {
  endpoint = e?.baseUrl ? { provider: e.provider, baseUrl: hardware.normalizeBaseUrl(e.baseUrl) } : { provider: "openrouter", baseUrl: hardware.findProvider("openrouter").baseUrl };
  fallbacks = [...next];
  override = null;
}
function onLlmSwitch(fn) {
  onSwitch = fn;
}
function keyRanOut(err) {
  if (!(err instanceof OpenRouterError)) return false;
  if (err.status === 401 || err.status === 402 || err.status === 403) return true;
  return err.status === 429 && /per.?day|daily|quota|credit|insufficient|exceeded your|billing/i.test(err.message);
}
async function candidateModels(o) {
  if (override) return [override.model];
  if (endpoint.provider !== "openrouter") return [o.model && o.model !== local.WRITING_MODEL_AUTO ? o.model : hardware.findProvider(endpoint.provider).defaultModel].filter(Boolean);
  if (o.model && o.model !== local.WRITING_MODEL_AUTO) return [o.model];
  try {
    const res = await fetch(hardware.OPENROUTER_MODELS_URL, { signal: o.signal });
    if (res.ok) {
      const json = await res.json();
      const ranked = hardware.rankFreeModels(json.data ?? []).map((m) => m.id);
      const picks = ranked.filter((id) => id !== hardware.OPENROUTER_FREE_ROUTER).slice(0, hardware.MAX_AUTO_ATTEMPTS - 1);
      if (ranked.includes(hardware.OPENROUTER_FREE_ROUTER) || picks.length === 0) picks.push(hardware.OPENROUTER_FREE_ROUTER);
      if (picks.length) return picks;
    } else {
      o.log(`Could not list OpenRouter models (${res.status}); using the free router.`);
    }
  } catch (err) {
    o.log(`Could not list OpenRouter models (${err.message}); using the free router.`);
  }
  return [hardware.OPENROUTER_FREE_ROUTER];
}
async function requestAnalysis(o, model) {
  const { transcript, options } = o;
  const lines = transcript.segments.map((s) => `[${fmt$2(s.start)} → ${fmt$2(s.end)}] ${s.text}`);
  const durationMin = (transcript.duration / 60).toFixed(1);
  const reel = options.mode === "reel";
  const system = [
    "You are SNU Clipper, an expert short-form video editor and content strategist.",
    reel ? "You receive a timestamped transcript of a short raw recording that will be published as ONE reel. Write the copy for it and return exactly one highlight covering the entire transcript (start = the first timestamp, end = the last timestamp)." : "You receive a timestamped transcript of a raw video and must find the moments that work as standalone social clips (TikTok, Reels, YouTube Shorts, LinkedIn).",
    "",
    reel ? "Rules for the single highlight:" : "Rules for highlights:",
    reel ? "- Return exactly one highlight spanning the whole transcript. Its title and hook describe the reel as a whole." : `- Return ${options.clipCount} highlight${options.clipCount === 1 ? "" : "s"}, best first. That is how many the person asked for. Only return fewer if the transcript genuinely has no more moments that stand alone; never pad with weak ones.`,
    reel ? "- Ignore length limits: the reel is as long as the recording." : `- Each highlight must be between ${options.minClipSeconds} and ${options.maxClipSeconds} seconds long.`,
    "- start/end MUST be exact segment boundaries copied from the transcript timestamps so cuts land on sentence edges. Never cut mid-sentence: a clip begins where a thought begins and ends where it lands.",
    ...reel ? [] : ["- Highlights must not overlap."],
    "- Viral structure is required. Open on the single strongest line so the hook lands in the FIRST 2 SECONDS: a specific claim, question, number, mistake or surprising result. If the first sentence is a greeting, setup, filler or continues the previous thought, start on the later line that actually grabs attention.",
    "- Build a curiosity gap in the hook and pay it off inside the clip: one complete idea, no rambling, no repeated lines.",
    "- End on the payoff — the answer, result, punchline, reaction or proof — on a resolved sentence. Never stop on a setup, an unanswered question or trailing chatter.",
    "- Prefer a tight clip a stranger watches to the end and shares over a longer but calm, context-dependent one.",
    `- Audience: ${options.audience}. Prefer moments with concrete takeaways, demos, opinions, or stories over generic intros and outros.`,
    "- Titles and hooks must be in the transcript's language. Do not invent facts that are not in the transcript.",
    "",
    "Also produce a 2-4 sentence summary, YouTube-style chapters, and ready-to-post social copy.",
    "",
    "Respond with ONLY a JSON object, no markdown fences and no commentary, with exactly this shape:",
    '{"summary": string, "chapters": [{"start": number, "title": string}], "highlights": [{"start": number, "end": number, "title": string (max 60 chars), "hook": string (max 8 words, shown on screen), "description": string (1-2 sentences), "hashtags": [string without #, 5-8 items], "reason": string, "score": number 0-100}], "social": {"youtubeTitle": string, "youtubeDescription": string, "tiktokCaption": string (with hashtags), "linkedinPost": string (80-150 words, written as the speaker), "tweet": string (under 260 chars)}}'
  ].join("\n") + briefFor("propose", buildBrief(options).text);
  const user = `Video duration: ${durationMin} minutes. Language: ${transcript.language}.

Transcript:
${lines.join("\n")}`;
  o.log(`Transcript segments: ${transcript.segments.length}, duration ${durationMin} min, model ${model}`);
  const text = await chat({
    apiKey: o.apiKey,
    model,
    system,
    user,
    maxTokens: 9e3,
    temperature: 0.4,
    signal: o.signal,
    onDelta: (chars) => o.onProgress(Math.min(50, 5 + chars / 150), `Writing analysis with ${shortName(model)}… (${chars} chars)`)
  });
  return AnalysisSchema.parse(extractJson(text));
}
async function writeScript(o, model) {
  const chunks = chunkSegments(o.transcript.segments, SCRIPT_CHUNK_WORDS);
  const out = [];
  const system = [
    "You turn a raw spoken transcript into a clean, publish-ready script in the speaker's own voice.",
    "Remove filler words (um, uh, like, you know), false starts, repetition and rambling; keep every idea, fact and the original language; do not add anything that isn't in the transcript.",
    "Output plain text only: paragraphs separated by blank lines, no headings, no markdown, no commentary."
  ].join("\n") + briefFor("script", buildBrief(o.options).text);
  for (let i = 0; i < chunks.length; i++) {
    if (o.signal?.aborted) throw new Error("Cancelled");
    const raw = chunks[i];
    o.onProgress(60 + i / chunks.length * 35, `Writing the clean script (${i + 1}/${chunks.length})…`);
    if (i >= MAX_SCRIPT_CHUNKS) {
      out.push(raw);
      continue;
    }
    try {
      const text = await chat({
        apiKey: o.apiKey,
        model,
        system,
        user: `Transcript part ${i + 1} of ${chunks.length}:

${raw}`,
        maxTokens: Math.min(8e3, Math.max(1200, Math.round(raw.split(/\s+/).length * 2.2))),
        temperature: 0.3,
        signal: o.signal,
        retryOn429: true
      });
      const cleaned = text.trim();
      out.push(cleaned.length > raw.length * 0.25 ? cleaned : raw);
    } catch (err) {
      if (o.signal?.aborted) throw err;
      o.log(`Script part ${i + 1} failed (${err.message}); keeping the transcript text for that part.`);
      out.push(raw);
    }
  }
  return out.join("\n\n").trim();
}
function chunkSegments(segments, maxWords) {
  const chunks = [];
  let cur = [];
  let words2 = 0;
  for (const s of segments) {
    const n = s.text.split(/\s+/).filter(Boolean).length;
    if (words2 + n > maxWords && cur.length) {
      chunks.push(cur.join(" "));
      cur = [];
      words2 = 0;
    }
    cur.push(s.text.trim());
    words2 += n;
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks.length ? chunks : [""];
}
async function chat(o) {
  for (; ; ) {
    try {
      return await chatWithRetry(override ? { ...o, apiKey: override.apiKey, model: override.model } : o);
    } catch (err) {
      const next = keyRanOut(err) && !o.signal?.aborted ? fallbacks.shift() : void 0;
      if (!next) throw err;
      const from = hardware.findProvider(endpoint.provider).label;
      endpoint = { provider: next.llm.provider, baseUrl: hardware.normalizeBaseUrl(next.llm.baseUrl) };
      override = { apiKey: next.key, model: next.model };
      onSwitch(`${from} could not go on (${err.message.slice(0, 120)}); switching to ${hardware.findProvider(next.llm.provider).label} (${next.model}).`);
    }
  }
}
async function chatWithRetry(o) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await chatOnce(o);
    } catch (err) {
      if (o.retryOn429 && attempt === 0 && err instanceof OpenRouterError && err.status === 429 && !o.signal?.aborted) {
        await sleep$2(6e3, o.signal);
        continue;
      }
      throw err;
    }
  }
}
async function chatOnce(o) {
  const noReasoning = o.noReasoning ?? true;
  try {
    return await chatRequest(o, noReasoning);
  } catch (err) {
    if (noReasoning && o.reasoningFallback !== false && needsReasoning(err)) return chatRequest(o, false);
    throw err;
  }
}
function needsReasoning(err) {
  return err instanceof OpenRouterError && err.status === 400 && /reasoning is mandatory/i.test(err.message);
}
function chatBody(o, provider, noReasoning, withTemperature = true) {
  return {
    model: o.model,
    messages: [
      { role: "system", content: o.system },
      { role: "user", content: o.user }
    ],
    ...withTemperature ? { temperature: o.temperature } : {},
    // OpenAI's newer models refuse max_tokens and want max_completion_tokens.
    ...provider === "openai" ? { max_completion_tokens: o.maxTokens } : { max_tokens: o.maxTokens },
    // OpenRouter only: reasoning tokens are billed against max_tokens but never reach us (we only
    // read delta.content), so on a reasoning model they can eat half the budget and truncate the
    // JSON into a "length" finish. Other services reject a field they do not know.
    ...noReasoning && provider === "openrouter" ? { reasoning: { enabled: false } } : {},
    stream: true
  };
}
async function chatRequest(o, noReasoning, withTemperature = true) {
  const { provider, baseUrl } = endpoint;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${o.apiKey}`,
      "Content-Type": "application/json",
      ...provider === "openrouter" ? { "HTTP-Referer": "https://snu.app", "X-Title": "SNU Clipper" } : {}
    },
    body: JSON.stringify(chatBody(o, provider, noReasoning, withTemperature)),
    signal: o.signal
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (withTemperature && res.status === 400 && /temperature/i.test(body)) return chatRequest(o, noReasoning, false);
    throw new OpenRouterError(res.status, body);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finish2 = null;
  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let json;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    if (json.error) throw new OpenRouterError(Number(json.error.code) || 500, JSON.stringify(json));
    const choice = json.choices?.[0];
    if (choice?.delta?.content) {
      text += choice.delta.content;
      o.onDelta?.(text.length);
    }
    if (choice?.finish_reason) finish2 = choice.finish_reason;
  };
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  if (buffer) handleLine(buffer);
  if (!text.trim()) throw new Error(`${o.model} returned an empty answer.`);
  if (finish2 === "length") throw new Error(`${o.model} stopped early (output limit reached).`);
  return text;
}
function sleep$2(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
function extractJson(text) {
  let s = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error("No JSON object in the model answer.");
  const balanced = endOfObject(s, first);
  const candidates2 = balanced === -1 ? [] : [s.slice(first, balanced + 1)];
  if (balanced !== last) candidates2.push(s.slice(first, last + 1));
  let lastError;
  for (const candidate of candidates2) {
    for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"')]) {
      try {
        return JSON.parse(attempt);
      } catch (err) {
        lastError = err;
      }
    }
  }
  for (const candidate of candidates2) {
    for (const fix of [requoteSingles, escapeInnerQuotes]) {
      try {
        return JSON.parse(fix(candidate).replace(/,\s*([}\]])/g, "$1"));
      } catch {
      }
    }
  }
  throw lastError ?? new Error("No JSON object in the model answer.");
}
function escapeInnerQuotes(s) {
  let out = "";
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inString) {
      if (c === '"') inString = true;
      out += c;
      continue;
    }
    if (c === "\\") {
      out += c + (s[++i] ?? "");
      continue;
    }
    if (c === '"') {
      if (/^\s*([,:}\]]|$)/.test(s.slice(i + 1))) {
        inString = false;
        out += c;
      } else out += '\\"';
      continue;
    }
    out += c === "\n" ? "\\n" : c;
  }
  return out;
}
function requoteSingles(s) {
  let out = "";
  let mode = "none";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (mode === "double") {
      out += c;
      if (c === "\\") {
        out += s[++i] ?? "";
        continue;
      }
      if (c === '"') mode = "none";
      continue;
    }
    if (mode === "single") {
      if (c === "\\" && s[i + 1] === "'") {
        out += "'";
        i++;
        continue;
      }
      if (c === "'" && /^\s*[,:}\]]/.test(s.slice(i + 1))) {
        out += '"';
        mode = "none";
        continue;
      }
      out += c === '"' ? '\\"' : c;
      continue;
    }
    if (c === '"') mode = "double";
    else if (c === "'") {
      out += '"';
      mode = "single";
      continue;
    }
    out += c;
  }
  return out;
}
function endOfObject(s, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}
function shortName(model) {
  return model.split("/").pop()?.replace(/:free$/, "") ?? model;
}
function fmt$2(s) {
  return s.toFixed(2);
}
function normalizeHighlights(raw, transcript, options) {
  const words2 = transcript.words;
  if (!words2.length) return [];
  const sentences = buildSentences(words2);
  const limit = { start: words2[0].start, end: words2[words2.length - 1].end };
  const out = [];
  const sorted = [...raw].sort((a, b) => b.score - a.score);
  for (const h of sorted) {
    const { start, end } = snapToSentences(h.start, h.end, sentences, {
      minSeconds: options.minClipSeconds,
      maxSeconds: options.maxClipSeconds,
      limit
    });
    if (end - start < 3) continue;
    if (out.some((x) => Math.min(x.end, end) - Math.max(x.start, start) > 1)) continue;
    out.push({
      id: `h${out.length + 1}`,
      start: round$5(start),
      end: round$5(end),
      title: h.title.trim() || "Clip",
      hook: h.hook.trim(),
      description: h.description.trim(),
      hashtags: h.hashtags.map((t) => t.replace(/^#/, "").trim()).filter(Boolean),
      reason: h.reason,
      score: Math.max(0, Math.min(100, Math.round(h.score)))
    });
    if (out.length >= options.clipCount) break;
  }
  out.sort((a, b) => a.start - b.start);
  out.forEach((h, i) => h.id = `h${i + 1}`);
  return out;
}
function round$5(n) {
  return Math.round(n * 1e3) / 1e3;
}
let liveModel = null;
async function writeClipCopy(o) {
  if (!liveModel || o.model !== local.WRITING_MODEL_AUTO) {
    const models = await candidateModels({ model: o.model, log: o.log, signal: o.signal });
    liveModel = models[0];
  }
  const model = liveModel;
  const system = [
    "You write social copy for one short video clip.",
    `Audience: ${o.audience}.`,
    "You get the exact words spoken in the clip. Do not invent anything that is not in them.",
    "Respond with ONLY a JSON object:",
    '{"title": string (max 60 chars), "hook": string (max 8 words, shown on screen), "description": string (1-2 sentences), "hashtags": [5-8 strings without #]}'
  ].join("\n") + briefFor("copy", o.instructions ?? "");
  try {
    const text = await chat({
      apiKey: o.apiKey,
      model,
      system,
      user: `Clip transcript:
${o.text}`,
      maxTokens: 700,
      temperature: 0.5,
      signal: o.signal
    });
    const parsed = extractJson(text);
    const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean) : [];
    if (!parsed.title) return null;
    return {
      title: String(parsed.title).trim(),
      hook: String(parsed.hook ?? "").trim(),
      description: String(parsed.description ?? "").trim(),
      hashtags
    };
  } catch (err) {
    o.log(`Clip copy failed (${err.message}); using the transcript instead.`);
    return null;
  }
}
function linesOf(words2) {
  const out = [];
  const push = (from, to) => {
    if (to - from + 1 > 24) {
      let cut = from + 11;
      let gap = -1;
      for (let k = from + 6; k < to - 5; k++) {
        const g = words2[k + 1].start - words2[k].end;
        if (g > gap) gap = g, cut = k;
      }
      push(from, cut);
      push(cut + 1, to);
      return;
    }
    const text = words2.slice(from, to + 1).map((w) => w.text).join(" ").replace(/\s+([,.!?।۔؟])/g, "$1").trim();
    out.push({ from, to, start: words2[from].start, end: words2[to].end, text });
  };
  for (const s of buildSentences(words2)) push(s.from, s.to);
  return out.map((l, i) => ({ id: `L${i + 1}`, ...l }));
}
const BEATS_SYSTEM = `You are the editor of a channel that cuts funny short clips out of long podcasts, shows and vlogs. You read a transcript and find every comedic beat: a joke's punchline, a taunt or roast, sarcasm, someone owning themselves, an awkward silence, an exaggeration, a shocking admission, a fail, a cringe moment.

Each transcript line looks like: L12 [3:41.2] text. A line may be followed by marks:
  [laugh 0.72]  laughter or a crowd was heard right after the line (0-1, how sure the detector is)
  [pause 1.4s]  silence before the next line
Laughter is strong evidence that the line before it landed, but a taunt or dry sarcasm is funny with no laugh at all, and people also laugh politely at things that are not funny. Judge the words.

For each beat give:
  "setup": the line id where the build-up starts (the clip starts here, so include what a viewer needs to get the joke, usually 1-4 lines before the punch)
  "punch": the line id where it lands
  "lands_on": the exact word or two, copied from the punch line, on which the laugh lands (usually the last word of the punchline)
  "type": one of ${hardware.BEAT_TYPES.join(", ")}
  "situation": one plain English sentence saying what happened, in general terms a meme could match ("he bragged about his cooking and the others mocked him")
  "intensity": 1-5, how funny it is to a general audience (5 = people will share it)
  "why": a few words

Open on the funniest or most surprising line so the laugh lands in the first 2 seconds; cut the setup short. Be selective. Only list beats a viewer would actually laugh at or share; ordinary banter, agreement ("yeah, yeah") and people merely retelling a story are not beats. A good 3-minute stretch of a funny podcast has maybe 2-4 real beats; an ordinary stretch has none. Use intensity 5 only for the few moments that would make a clip on their own.

Transcripts may be Hindi, Urdu or Hinglish; answer in English but copy "lands_on" exactly as written in the line. Answer with JSON only: {"beats":[...]}`;
let modelCache = null;
async function ask$1(a, system, user, maxTokens) {
  modelCache ??= await candidateModels({ model: a.model, log: a.log, signal: a.signal });
  let last;
  for (const model of modelCache) {
    try {
      const text = await chat({ apiKey: a.apiKey, model, system, user, maxTokens, temperature: 0.3, signal: a.signal, retryOn429: true });
      return extractJson(text);
    } catch (err) {
      if (a.signal?.aborted) throw err;
      last = err;
      a.log(`${model}: ${err.message.slice(0, 140)}`);
      if (err instanceof OpenRouterError && (err.status === 401 || err.status === 402)) break;
    }
  }
  throw last ?? new Error("No model answered.");
}
const mmss$1 = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const r2$1 = (n) => Math.round(n * 100) / 100;
async function findBeats(lines, evs, a, onProgress) {
  if (!a.apiKey) return { beats: baselineBeats(lines, evs), source: "laughter only" };
  const marked = lines.map((l, i) => {
    const laugh = laughAfter(evs, l.end, 2.5);
    const gap = i + 1 < lines.length ? lines[i + 1].start - l.end : 0;
    return `${l.id} [${mmss$1(l.start)}] ${l.text}${laugh >= 0.4 ? ` [laugh ${r2$1(laugh)}]` : ""}${gap >= 0.8 ? ` [pause ${gap.toFixed(1)}s]` : ""}`;
  });
  const chunks = [];
  for (let s = 0; s < lines.length; ) {
    let e = s;
    while (e + 1 < lines.length && lines[e + 1].end - lines[s].start < 210) e++;
    chunks.push([s, e]);
    if (e + 1 >= lines.length) break;
    let next = e;
    while (next > s && lines[e].end - lines[next].start < 30) next--;
    s = Math.max(s + 1, next);
  }
  const byId = new Map(lines.map((l) => [l.id, l]));
  const found = /* @__PURE__ */ new Map();
  const accept = (b, extra) => {
    const punch = b.punch ? byId.get(b.punch) : void 0;
    if (!punch || !b.type || !hardware.BEAT_TYPES.includes(b.type)) return false;
    const setup = b.setup && byId.get(b.setup) || punch;
    if (extra && found.has(punch.id)) return false;
    const prev = found.get(punch.id);
    if (prev && (prev.intensity ?? 0) >= (b.intensity ?? 0)) return false;
    found.set(punch.id, {
      ...b,
      punch: punch.id,
      setup: setup.start <= punch.start ? setup.id : punch.id,
      type: b.type,
      situation: String(b.situation ?? ""),
      intensity: Math.max(1, Math.min(5, Number(b.intensity) || 3))
    });
    return true;
  };
  let failures = 0;
  for (const [k, [s, e]] of chunks.entries()) {
    onProgress(k / (chunks.length + 1) * 100);
    try {
      const json = await ask$1(a, BEATS_SYSTEM, marked.slice(s, e + 1).join("\n"), 6e3);
      for (const b of json?.beats ?? []) accept(b);
    } catch (err) {
      if (a.signal?.aborted) throw err;
      failures++;
    }
  }
  if (failures === chunks.length) {
    a.log("The writing model did not answer; funny moments are taken from the laughter alone.");
    return { beats: baselineBeats(lines, evs), source: "laughter only" };
  }
  const beatEnds = [...found.values()].map((b) => byId.get(b.punch).end);
  const orphans = laughEvents(evs, 0.7).filter((lg) => !beatEnds.some((t) => lg.start >= t - 1 && lg.start <= t + 3));
  if (orphans.length) {
    const blocks = orphans.slice(0, 25).map((lg, k) => {
      const i = Math.max(0, lines.findIndex((l) => l.end >= lg.start - 0.6));
      return `Laugh ${k + 1} at ${mmss$1(lg.start)}:
${marked.slice(Math.max(0, i - 6), i + 1).join("\n")}`;
    });
    try {
      const json = await ask$1(
        a,
        `${BEATS_SYSTEM}

This time you get short excerpts that each end where the audience laughed. For each, find the beat that caused the laugh (same fields), or skip it if the laugh was only politeness or a reaction to something not in the words.`,
        blocks.join("\n\n"),
        4e3
      );
      let added = 0;
      for (const b of json?.beats ?? []) if (accept(b, true)) added++;
      if (added) a.log(`A second look at ${orphans.length} laughs found ${added} more beat${added === 1 ? "" : "s"}.`);
    } catch (err) {
      if (a.signal?.aborted) throw err;
    }
  }
  onProgress(100);
  return { beats: [...found.values()], source: "ai" };
}
function baselineBeats(lines, evs) {
  const out = [];
  lines.forEach((l, i) => {
    const laugh = laughAfter(evs, l.end, 2);
    if (laugh >= 0.55) {
      out.push({ setup: lines[Math.max(0, i - 2)].id, punch: l.id, lands_on: l.text.split(/\s+/).pop(), type: "joke_punchline", situation: l.text, intensity: Math.min(5, Math.max(1, Math.round(laugh * 5))), why: "laughter heard" });
    }
  });
  return out;
}
const norm = (t) => t.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
function landingWord(words2, line, landsOn) {
  const want = String(landsOn ?? "").split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) return line.to;
  const lastWant = want[want.length - 1];
  for (let k = line.to; k >= line.from; k--) {
    const w = norm(words2[k].text);
    if (w && (w === lastWant || lastWant.length > 3 && (w.includes(lastWant) || lastWant.includes(w)))) return k;
  }
  return line.to;
}
function chooseClips(o) {
  const { words: words2, lines, evs } = o;
  const index = new Map(lines.map((l, i) => [l.id, i]));
  const roomLaughs = laughEvents(evs, 0.55).length >= 3;
  const W_LAUGH = roomLaughs ? 0.55 : 0;
  if (!roomLaughs) o.log("Nobody laughs out loud in this video, so jokes are ranked on the words alone.");
  const maxLen = Math.max(15, Math.min(60, o.maxSeconds || 45));
  const scored = o.beats.map((b) => {
    const pi = index.get(b.punch);
    const si = index.get(b.setup) ?? pi;
    const w = landingWord(words2, lines[pi], b.lands_on);
    const laugh = laughAfter(evs, words2[w].end, 3);
    const score = (1 - W_LAUGH) * (b.intensity / 5) + W_LAUGH * laugh;
    return { b, pi, si, w, at: words2[w].end, laugh, score };
  }).filter((x) => (roomLaughs ? x.score >= 0.5 : x.b.intensity >= 4) || x.b.intensity >= 5 && ["taunt", "roast", "sarcasm", "awkward", "cringe"].includes(x.b.type)).sort((a, b) => a.at - b.at);
  const ranges = scored.map((x) => {
    let end = Math.max(x.at + 1.2, ...evs.filter((e) => e.start >= x.at - 0.5 && e.start <= x.at + 4 && heard(e) >= 0.5).map((e) => e.end - 0.5));
    const reaction = lines[x.pi + 1];
    if (reaction && reaction.start - x.at < 1.5 && reaction.end - x.at < 6) end = Math.max(end, reaction.end);
    return { start: lines[x.si].start, end, beats: [x] };
  });
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < 3 && r.end - last.start <= maxLen) last.end = Math.max(last.end, r.end), last.beats.push(...r.beats);
    else merged.push({ ...r, beats: [...r.beats] });
  }
  const clips = merged.map((c) => {
    let i = lines.findIndex((l) => l.start >= c.start - 0.01);
    while (c.end - c.start < 12 && i > 0 && c.end - lines[i - 1].start <= 60) c.start = lines[--i].start;
    const after = lines.find((l) => l.start >= c.end - 0.05);
    if (c.end - c.start < 12 && after && after.end - c.start <= 20) c.end = after.end;
    const best = Math.max(...c.beats.map((x) => x.score));
    const laughed = Math.max(...c.beats.map((x) => x.laugh));
    return {
      start: r2$1(Math.max(0, c.start - 0.25)),
      end: r2$1(Math.min(o.duration, c.end + 0.4)),
      score: r2$1(best + 0.15 * Math.min(3, c.beats.length - 1) + (roomLaughs && laughed >= 0.5 ? 0.3 : 0)),
      beats: c.beats.map((x) => ({ type: x.b.type, situation: x.b.situation, intensity: x.b.intensity, at: r2$1(x.at), word: words2[x.w].text, laugh: r2$1(x.laugh), score: r2$1(x.score) }))
    };
  });
  const chosen = [];
  for (const c of clips.sort((a, b) => b.score - a.score)) {
    if (chosen.length >= o.want) break;
    if (!chosen.some((x) => c.start < x.end && x.start < c.end)) chosen.push(c);
  }
  return chosen.sort((a, b) => a.start - b.start);
}
const maxMemes = (c) => Math.max(1, Math.min(3, Math.floor((c.end - c.start) / 12)));
const MEME_GAP = 5;
const STOP = new Set("a an the and or but of to in on at for with is are was were be been it its this that he she they them his her their someone something when after about who what as by from so".split(" "));
const tokens = (t) => new Set(t.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w)));
function candidates(b, library, lang, usedBefore) {
  const desi = ["hi", "ur", "pa"].includes(lang);
  const want = tokens(b.situation);
  const understood = (m) => m.lang === "none" || m.lang === lang || desi && ["hi", "ur"].includes(m.lang);
  const scored = library.filter(understood).map((m) => {
    let s = m.types.includes(b.type) ? 1 : 0;
    const have = tokens(`${m.name} ${m.meaning ?? ""} ${m.used_when} ${m.mood}`);
    let common = 0;
    for (const w of want) if (have.has(w)) common++;
    s += Math.min(0.6, common * 0.15);
    if (m.region === "desi" === desi) s += 0.3;
    s -= 0.35 * (usedBefore.get(m.id) ?? 0);
    return { m, s };
  });
  scored.sort((x, y) => y.s - x.s);
  const sounds = scored.filter((x) => x.m.kind === "sound").slice(0, 4);
  const videos = scored.filter((x) => x.m.kind === "video").slice(0, 2);
  return [...sounds, ...videos].filter((x) => x.s > 0.2).sort((x, y) => y.s - x.s).map((x) => x.m);
}
const PICK_SYSTEM = `You add memes to a funny short clip, the way a good editor does: sparingly, only where a meme makes the moment funnier. For each beat you get the moment and up to six candidate memes from the library. Choose the one that fits best, or "none" when nothing fits or the moment is funnier clean. Never use the same meme twice in a clip. Use at most MAX_MEMES memes in this clip and at most one video meme (a video meme interrupts the clip, so save it for the biggest moment). Fewer is usually better: one well-placed meme beats three. Prefer a sound when the moment already has its own laugh or reaction on screen; a video cut-in is for a moment that needs the extra punch. Memes already used in earlier clips of this video: USED_BEFORE; avoid repeating them unless nothing else fits.

Also write the clip's copy: "title" (max 60 characters, the joke in a few words, in the language people in the clip speak, Latin script for Hindi/Urdu), "hook" (max 8 words shown on screen above the clip, teasing the joke without giving it away), "hashtags" (5-8, without #).

Answer with JSON only: {"title":"...","hook":"...","hashtags":["..."],"picks":[{"beat":1,"meme":"meme-id or none","why":"a few words"}]}`;
async function pickMemes(o) {
  const usedBefore = /* @__PURE__ */ new Map();
  const out = [];
  for (const [ci, c] of o.clips.entries()) {
    o.onProgress(ci / o.clips.length * 100);
    const offers = c.beats.map((b) => candidates(b, o.library, o.lang, usedBefore));
    const text = o.lines.filter((l) => l.start >= c.start - 0.05 && l.end <= c.end + 0.05).map((l) => `${l.id} ${l.text}`).join("\n");
    let answer = null;
    if (o.ask.apiKey) {
      const beatsText = c.beats.map((b, i) => {
        const opts = offers[i].map((m) => `    - ${m.id} (${m.kind}${m.quote ? `, says "${m.quote}"` : ""}): ${m.used_when}`);
        return `Beat ${i + 1}: ${b.type}, lands on "${b.word}". ${b.situation}
${opts.join("\n") || "    (no candidates)"}`;
      }).join("\n\n");
      try {
        answer = await ask$1(o.ask, PICK_SYSTEM.replace("MAX_MEMES", String(maxMemes(c))).replace("USED_BEFORE", [...usedBefore.keys()].join(", ") || "none"), `Clip transcript:
${text}

${beatsText}`, 1500);
      } catch (err) {
        if (o.ask.signal?.aborted) throw err;
      }
    }
    if (!answer?.picks) {
      const top = c.beats.map((b, i) => ({ i, s: b.score })).sort((x, y) => y.s - x.s).slice(0, 2).map((x) => x.i);
      const used2 = /* @__PURE__ */ new Set();
      answer = {
        ...answer,
        picks: c.beats.map((_, i) => {
          const m = top.includes(i) ? offers[i].find((x) => !used2.has(x.id) && x.kind === "sound") : void 0;
          if (m) used2.add(m.id);
          return { beat: i + 1, meme: m?.id ?? "none", why: "closest match" };
        })
      };
    }
    const used = /* @__PURE__ */ new Set();
    let videos = 0;
    const chosen = [];
    for (const p of answer.picks ?? []) {
      const bi = Number(p.beat) - 1;
      const m = offers[bi]?.find((x) => x.id === p.meme);
      if (!m || used.has(m.id) || chosen.length >= maxMemes(c) || m.kind === "video" && videos >= 1) continue;
      used.add(m.id);
      if (m.kind === "video") videos++;
      chosen.push({ beat: bi, m, why: p.why });
    }
    for (const x of chosen) usedBefore.set(x.m.id, (usedBefore.get(x.m.id) ?? 0) + 1);
    const memes = place(c, chosen, o.words);
    const first = c.beats[0];
    out.push({
      id: `h${ci + 1}`,
      start: c.start,
      end: c.end,
      title: clean(answer.title, 60) || shorten(text.replace(/^L\d+ /gm, ""), 60),
      hook: clean(answer.hook, 60),
      description: c.beats.map((b) => b.situation).filter(Boolean).join(" "),
      hashtags: (answer.hashtags ?? []).map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 8),
      reason: `${c.beats.length} funny beat${c.beats.length === 1 ? "" : "s"}${first ? `, lands on “${first.word}”` : ""}${memes.length ? `; memes: ${memes.map((m) => m.id).join(", ")}` : ""}.`,
      score: Math.round(Math.min(1, c.score / 1.6) * 100),
      beats: c.beats,
      memes
    });
  }
  o.onProgress(100);
  return out;
}
function clean(s, max) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? shorten(t, max) : t;
}
function shorten(t, max) {
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}
function place(c, chosen, words2) {
  const speechAfter = (t) => words2.find((w) => w.start > t + 0.05)?.start ?? Infinity;
  const items = [];
  for (const { beat, m, why } of chosen) {
    const b = c.beats[beat];
    const t = b.at;
    const base = { id: m.id, kind: m.kind, len: m.duration, beat, why };
    if (m.kind === "video" || m.placement === "cut_in") {
      items.push({ ...base, mode: "insert", at: Math.min(c.end - 0.05, t + 0.05) });
      continue;
    }
    if (m.placement === "under_line") {
      const setup = words2.find((w) => w.start >= c.start)?.start ?? c.start;
      items.push({ ...base, mode: "overlay", at: Math.max(c.start, Math.min(t - m.hit, setup)), gain: 0.35, duck: false });
      continue;
    }
    let hitAt = t + (m.placement === "in_pause" ? 0.15 : 0.06);
    const talk = speechAfter(t);
    if (m.lang !== "none" && hitAt - m.hit + m.duration - talk > 0.35) {
      const pause = words2.find((w, k) => w.end >= t - 0.01 && w.end <= t + 1.5 && (words2[k + 1]?.start ?? Infinity) - w.end >= 0.5);
      if (pause) hitAt = pause.end + 0.06;
      else if (m.duration > 1.2) {
        items.push({ ...base, mode: "insert", at: Math.min(c.end - 0.05, t + 0.05) });
        continue;
      }
    }
    items.push({ ...base, mode: "overlay", at: Math.max(c.start, hitAt - m.hit), gain: 1, duck: true });
  }
  items.sort((x, y) => x.at - y.at);
  const kept = [];
  for (const it of items) {
    const prev = kept[kept.length - 1];
    if (prev && it.at - prev.at < MEME_GAP) {
      if (c.beats[it.beat].score > c.beats[prev.beat].score) kept[kept.length - 1] = it;
      continue;
    }
    kept.push(it);
  }
  return kept.map((k) => ({ ...k, at: r2$1(k.at) }));
}
function clipUnits(words2, maxWords = 24, maxSeconds = 12) {
  const out = [];
  const push = (from, to, closed, joinsNext = false) => {
    const n = to - from + 1;
    const seconds2 = words2[to].end - words2[from].start;
    if ((n > maxWords || seconds2 > maxSeconds) && n >= 12) {
      let cut = from + Math.floor(n / 2);
      let gap = -1;
      for (let k = from + 5; k < to - 5; k++) {
        const g = words2[k + 1].start - words2[k].end;
        if (g > gap) gap = g, cut = k;
      }
      push(from, cut, false, true);
      push(cut + 1, to, closed, joinsNext);
      return;
    }
    const text = words2.slice(from, to + 1).map((w) => w.text).join(" ").trim();
    if (text) out.push({ start: words2[from].start, end: words2[to].end, text, from, to, closed, ...joinsNext ? { joinsNext } : {} });
  };
  for (const s of buildSentences(words2)) push(s.from, s.to, s.closed);
  return out;
}
const SR$3 = 16e3;
const FRAME_S = 0.02;
const YELL_DB = 10;
const YELL_PITCH = 1.2;
const YELL_DB_NO_PITCH = 13;
const SPIKE_DB = 12;
function frameDb(samples) {
  const per = Math.round(SR$3 * FRAME_S);
  const n = Math.max(1, Math.floor(samples.length / per));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * per; j < (i + 1) * per; j++) sum += samples[j] * samples[j];
    out[i] = 10 * Math.log10(Math.max(1e-9, sum / per));
  }
  return out;
}
function pitchAt(samples, at) {
  const rate = SR$3 / 2;
  const len2 = 320;
  const minLag = Math.floor(rate / 500);
  const maxLag = Math.ceil(rate / 75);
  if (at < 0 || at + 2 * (len2 + maxLag) > samples.length) return 0;
  const x = new Float32Array(len2 + maxLag);
  for (let i = 0; i < x.length; i++) x[i] = (samples[at + 2 * i] + samples[at + 2 * i + 1]) / 2;
  let energy = 0;
  for (let i = 0; i < len2; i++) energy += x[i] * x[i];
  if (energy < 1e-6) return 0;
  const rs = new Float32Array(maxLag + 2);
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    let e2 = 0;
    for (let i = 0; i < len2; i++) {
      c += x[i] * x[i + lag];
      e2 += x[i + lag] * x[i + lag];
    }
    rs[lag] = c / Math.sqrt(energy * e2 + 1e-12);
    best = Math.max(best, rs[lag]);
  }
  if (best < 0.5) return 0;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (rs[lag] >= 0.85 * best && rs[lag] >= rs[lag - 1] && rs[lag] >= rs[lag + 1]) return rate / lag;
  }
  return 0;
}
function median$3(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function gamingMarks(sentences, o) {
  const out = sentences.map(() => ({ yell: 0, spike: 0 }));
  const samples = o.samples;
  if (!samples || samples.length < SR$3 || !sentences.length) return out;
  const offset = o.offset ?? 0;
  const db = frameDb(samples);
  const frameAt = (t) => Math.max(0, Math.min(db.length - 1, Math.floor((t - offset) / FRAME_S)));
  const level2 = [];
  const loudest = [];
  for (const s of sentences) {
    const a = frameAt(s.start);
    const b = Math.max(a + 1, frameAt(s.end));
    const idx = Array.from({ length: b - a }, (_, k) => a + k).sort((x, y) => db[y] - db[x]);
    const top = idx.slice(0, Math.max(1, Math.floor(idx.length / 2)));
    const power = top.reduce((acc, i) => acc + 10 ** (db[i] / 10), 0) / top.length;
    level2.push(10 * Math.log10(Math.max(1e-9, power)));
    loudest.push(idx.slice(0, 5));
  }
  const baseLevel = median$3(level2);
  const pitchOf = (i) => {
    const f0s = loudest[i].map((f) => pitchAt(samples, Math.round(f * FRAME_S * SR$3))).filter((f) => f > 0);
    return f0s.length >= 2 ? median$3(f0s) : 0;
  };
  const pitch = /* @__PURE__ */ new Map();
  const step = Math.max(1, Math.floor(sentences.length / 200));
  for (let i = 0; i < sentences.length; i += step) pitch.set(i, pitchOf(i));
  const basePitch = median$3([...pitch.values()].filter((p) => p > 0));
  sentences.forEach((_, i) => {
    if (level2[i] - baseLevel >= YELL_DB && !pitch.has(i)) pitch.set(i, pitchOf(i));
  });
  sentences.forEach((_, i) => {
    const over = level2[i] - baseLevel;
    const p = pitch.get(i) ?? 0;
    const higher = basePitch > 0 && p > 0 ? p / basePitch : 0;
    if (isYell(over, higher)) out[i].yell = Math.round(over * 10) / 10;
  });
  const speech = new Uint8Array(db.length);
  for (const w of o.words ?? []) {
    for (let f = frameAt(w.start - 0.15); f <= frameAt(w.end + 0.15); f++) speech[f] = 1;
  }
  const overall = median$3(Array.from(db.filter((_, i) => i % 5 === 0)));
  const spikes = scanSpikes(db, speech, overall).map((sp) => ({ t: offset + sp.frame * FRAME_S, jump: sp.jump }));
  for (const sp of spikes) {
    const k = spikeLine(sentences, sp.t);
    if (k < 0) continue;
    out[k].spike = Math.max(out[k].spike, spikeStrength(sp.jump));
  }
  return out;
}
function isYell(over, higher) {
  return over >= YELL_DB && higher >= YELL_PITCH || over >= YELL_DB_NO_PITCH && higher === 0;
}
function spikeStrength(jump) {
  return Math.min(1, Math.round(((jump - SPIKE_DB) / 12 + 0.5) * 100) / 100);
}
function scanSpikes(db, speech, overall, from = 0, to = db.length) {
  const spikes = [];
  const back = Math.round(2 / FRAME_S);
  for (let i = Math.max(back, from); i + 5 < Math.min(to + 5, db.length); i++) {
    if (speech[i] || speech[i + 4]) continue;
    let now = -Infinity;
    for (let k = i; k < i + 5; k++) now = Math.max(now, db[k]);
    if (now < overall + 6) continue;
    const before = median$3(Array.from(db.subarray(i - back, i)).filter((_, k) => k % 4 === 0));
    const jump = now - before;
    if (jump < SPIKE_DB) continue;
    const last = spikes[spikes.length - 1];
    if (last && (i - last.frame) * FRAME_S < 2) {
      if (jump > last.jump) last.jump = jump;
      continue;
    }
    spikes.push({ frame: i, jump });
    i += 25;
  }
  return spikes;
}
function spikeLine(sentences, t) {
  let k = sentences.findIndex((s) => t >= s.start && t <= s.end);
  if (k < 0) k = sentences.findIndex((s) => s.start > t && s.start - t <= 3);
  if (k < 0) {
    for (let j = sentences.length - 1; j >= 0; j--) {
      if (sentences[j].end <= t && t - sentences[j].end <= 1.5) return j;
    }
  }
  return k;
}
function gamingBonus(sig, first, last) {
  let yells = 0;
  let spikes = 0;
  let late = 0;
  for (let i = first; i <= last && i < sig.length; i++) {
    const s = sig[i];
    if (!s) continue;
    if ((s.yell ?? 0) > 0) {
      yells++;
      if (i >= last - 2) late = Math.max(late, 1);
    }
    if ((s.spike ?? 0) > 0) {
      spikes += s.spike ?? 0;
      if (i >= first + 1) late = Math.max(late, 0.5);
    }
  }
  return Math.round(Math.min(18, Math.min(2, yells) * 5 + Math.min(2, spikes) * 4 + late * 3));
}
function gamingProposeSystem(o, k) {
  return `You are the editor of a gaming channel that cuts short vertical clips (TikTok, Reels, YouTube Shorts) out of a streamer's long live-stream recording. You read part of the transcript of what the streamer said and pick the moments that would make a stranger stop scrolling, watch to the end and share.

Each line is one sentence: S12 [3:41] text (a line ending in "…" is a long sentence that carries on in the next line). A line may end with marks from the audio:
  [yell] the streamer shouted, much louder and higher than usual   [spike] a sudden loud game sound (a kill, an explosion, a win or death jingle) at or just before this line
  [laugh 0.7] laughter right after it (0-1)   [loud] said with more energy than usual   [fast] said faster than usual   [pause 1.4s] silence before the line
The marks are strong hints here: in a stream the best moments are where something happens in the game and the streamer reacts. The words still decide.

What makes a gaming clip:
- Something happens in the game: a clutch, a big play, a kill streak, a win, an achievement, a rare find, a boss down, a close call, a hilarious fail, a rage moment, a jump scare.
- Or the streamer's reaction is the show: a scream, a meltdown, a big laugh, a perfect one-liner, a reaction to chat.
- It stands alone: someone who saw nothing before understands what is at stake. Start where the situation is set up (what they are trying to do, what is about to happen), not in the middle of it. Never start on a sentence that continues the previous one (and, but, so, because, which, then, yeah, aur, lekin, toh, phir) or on a pronoun pointing back.
- It ends on the payoff: the result and the reaction to it (include the scream or the laugh after the play). Never stop just before it.
- Skip the starting-soon screen, waiting in lobbies and queues, reading donations and sponsor reads, settings and technical trouble, and long quiet stretches.
- Length: between ${o.minClipSeconds} and ${o.maxClipSeconds} seconds (use the times; a clip ends about where the line after "last" starts).
- The transcript may be English, Urdu, Hindi, Hinglish or Roman Urdu, full of game slang and transcription mistakes; judge the meaning.
- Audience: ${o.audience || "gamers"}.
Give up to ${k} clips from this part, best first; fewer if the part has nothing good. Clips must not overlap.
For each: "first" and "last" (ids), "why" (a few words: what happens), "hook_line" (the id of the line that grabs attention), "score" 0-100 (how likely a viewer watches to the end and shares).
Answer with JSON only: {"clips":[{"first":"S12","last":"S20","why":"...","hook_line":"S12","score":80}]}`;
}
const SR$2 = 16e3;
function laughAt(evs, t, within = 2.5) {
  let best = 0;
  for (const e of evs) {
    if (e.start < t - 0.6 || e.start > t + within) continue;
    best = Math.max(best, level(e.laugh), level(e.crowd) * 0.9);
  }
  return best;
}
function median$2(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function sentenceSignals(sentences, o) {
  const gaming = o.gamingWords ? gamingMarks(sentences, { samples: o.samples, offset: o.offset, words: o.gamingWords }) : null;
  const offset = o.offset ?? 0;
  const db = sentences.map(() => NaN);
  if (o.samples && o.samples.length > SR$2) {
    const frames = local.loudnessFrames(o.samples, SR$2, local.FRAME_MS);
    const perSec = 1e3 / local.FRAME_MS;
    sentences.forEach((s, i) => {
      const a = Math.max(0, Math.floor((s.start - offset) * perSec));
      const b = Math.min(frames.length, Math.ceil((s.end - offset) * perSec));
      if (b - a < 3) return;
      const vals = Array.from(frames.subarray(a, b)).sort((x, y) => y - x).slice(0, Math.max(1, Math.floor((b - a) / 2)));
      const rms = Math.sqrt(vals.reduce((acc, v) => acc + v * v, 0) / vals.length);
      db[i] = 20 * Math.log10(Math.max(rms, 1e-6));
    });
  }
  const base = median$2(db.filter(Number.isFinite));
  const rates = sentences.map((s) => (s.to - s.from + 1) / Math.max(0.3, s.end - s.start));
  const baseRate = median$2(rates.filter((_, i) => sentences[i].to - sentences[i].from >= 3)) || median$2(rates) || 1;
  return sentences.map((s, i) => ({
    loud: Number.isFinite(db[i]) ? Math.round((db[i] - base) * 10) / 10 : 0,
    rate: Math.round(rates[i] / baseRate * 100) / 100,
    pauseBefore: i === 0 ? 0 : Math.max(0, Math.round((s.start - sentences[i - 1].end) * 100) / 100),
    laugh: o.laughter?.length ? Math.round(laughAt(o.laughter, s.end) * 100) / 100 : 0,
    ...gaming ? gaming[i] : {}
  }));
}
function marksFor(sig, words2) {
  if (!sig) return "";
  const out = [];
  if ((sig.spike ?? 0) > 0) out.push("[spike]");
  if ((sig.yell ?? 0) > 0) out.push("[yell]");
  if (sig.laugh >= 0.4) out.push(`[laugh ${sig.laugh.toFixed(1)}]`);
  if (sig.loud >= 4 && words2 >= 3) out.push("[loud]");
  if (sig.rate >= 1.4 && words2 >= 5) out.push("[fast]");
  if (sig.pauseBefore >= 1.2) out.push(`[pause ${sig.pauseBefore.toFixed(1)}s]`);
  return out.join("");
}
function signalBonus(sig, first, last) {
  if (!sig.length) return 0;
  let laugh = 0;
  let loud = 0;
  for (let i = first; i <= last && i < sig.length; i++) {
    laugh = Math.max(laugh, sig[i].laugh * (i >= last - 1 ? 1 : 0.6));
    if (sig[i].loud >= 4) loud++;
  }
  const pause = sig[first]?.pauseBefore >= 1 ? 2 : 0;
  const base = Math.round(Math.min(12, laugh * 8 + Math.min(3, loud) + pause));
  return sig[0]?.yell !== void 0 ? base + gamingBonus(sig, first, last) : base;
}
function laughterModelPresent(modelsDir) {
  if (!modelsDir) return false;
  return node_fs.existsSync(path.join(modelsDir, "Xenova", "ast-finetuned-audioset-10-10-0.4593", "onnx", "model_quantized.onnx"));
}
const sid = (i) => `S${i + 1}`;
function parseId(v, count) {
  const m = /^\s*[sS]?\s*(\d+)\s*$/.exec(String(v ?? ""));
  if (!m) return null;
  const i = Number(m[1]) - 1;
  return i >= 0 && i < count ? i : null;
}
function idsToTimes(first, last, s) {
  return { start: s[first].start, end: s[Math.max(first, last)].end };
}
function value(c) {
  return c.score + c.bonus - flawPenalty(c.flaws);
}
function checkCandidates(raw, s, sig, lim, keep) {
  const fixed = [];
  for (const p of raw) {
    const c = fixEdges(p, s, lim);
    if (!c) continue;
    fixed.push({ ...p, first: c.first, last: c.last, start: c.start, end: c.end, flaws: c.flaws, moves: c.moves, bonus: signalBonus(sig, c.first, c.last) });
  }
  fixed.sort((a, b) => value(b) - value(a));
  const accepted = [];
  for (const c of fixed) {
    const clash = accepted.findIndex((a2) => overlapSeconds(a2, c) > 1);
    if (clash === -1) {
      accepted.push(c);
      continue;
    }
    const a = accepted[clash];
    const first = Math.min(a.first, c.first);
    const last = Math.max(a.last, c.last);
    if (s[last].end - s[first].start > lim.maxSeconds) continue;
    const merged = fixEdges({ first, last }, s, lim);
    if (!merged || merged.flaws.some(isHardFlaw)) continue;
    if (accepted.some((x, k) => k !== clash && overlapSeconds(x, merged) > 1)) continue;
    accepted[clash] = {
      ...a,
      first: merged.first,
      last: merged.last,
      start: merged.start,
      end: merged.end,
      flaws: merged.flaws,
      moves: [...a.moves, `merged with ${sid(c.first)}-${sid(c.last)}`],
      score: Math.max(a.score, c.score),
      why: a.why || c.why,
      bonus: signalBonus(sig, merged.first, merged.last)
    };
  }
  const clean2 = accepted.filter((c) => !c.flaws.some(isHardFlaw));
  const flawed = accepted.filter((c) => c.flaws.some(isHardFlaw));
  const out = [...clean2.sort((a, b) => value(b) - value(a)), ...flawed.sort((a, b) => value(b) - value(a))];
  return out.slice(0, keep);
}
function rulesProposals(s, sig, options, n, within = [0, s.length - 1]) {
  const scored = [];
  const [lo, hi] = within;
  const lang = options.language;
  const openCost = s.map((_, i) => {
    const f = openerFlawAt(s, i, lang);
    return f === "split" ? 15 : f === "fragment" ? 20 : 0;
  });
  const endCost = s.map((_, i) => endFlawAt(s, i) === "split" ? 15 : 0);
  for (let i = lo; i <= hi; i++) {
    for (let j = i; j <= hi; j++) {
      const seconds2 = s[j].end - s[i].start;
      if (seconds2 > options.maxClipSeconds) break;
      if (seconds2 < options.minClipSeconds) continue;
      const texts = s.slice(i, j + 1).map((x) => x.text);
      const words2 = scoreSpan(texts, seconds2, options);
      // The first line must earn the stop; the last line must close the loop.
      const viralOpen = hookPower(s[i].text);
      const viralEnd = payoffPower(s[j].text);
      scored.push({ first: i, last: j, score: words2 * 5 + viralOpen * 1.5 + viralEnd + signalBonus(sig, i, j) - openCost[i] - endCost[j] });
    }
  }
  if (!scored.length && hi >= lo) scored.push({ first: lo, last: hi, score: 30 });
  scored.sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of scored) {
    if (out.length >= n) break;
    const span = { start: s[c.first].start, end: s[c.last].end };
    if (out.some((o) => overlapSeconds({ start: s[o.first].start, end: s[o.last].end }, span) > 0.3)) continue;
    out.push({ first: c.first, last: c.last, score: Math.max(0, Math.min(100, Math.round(c.score))), why: "Picked by SNU Clipper's own search: hook-first opener, payoff ending, pace, audio and clean edges.", origin: "rules" });
  }
  return out;
}
class BudgetError extends Error {
}
class Budget {
  constructor(cap) {
    this.cap = cap;
  }
  cap;
  used = 0;
  /** Calls that came back usable. */
  ok = 0;
  byStage = {};
  skipped = [];
  /** Set when the key is refused or the daily cap is hit: no more calls this job. */
  dead = null;
  models = /* @__PURE__ */ new Set();
  remaining() {
    return this.dead ? 0 : Math.max(0, this.cap - this.used);
  }
  take(stage) {
    if (this.dead) throw new BudgetError(`model switched off: ${this.dead}`);
    if (this.used >= this.cap) throw new BudgetError(`request budget of ${this.cap} used up`);
    this.used++;
    this.byStage[stage] = (this.byStage[stage] ?? 0) + 1;
  }
  skip(stage, why) {
    this.skipped.push(`${stage} (${why})`);
  }
}
function isFatal(err) {
  if (err instanceof OpenRouterError) {
    if (err.status === 401) return "the OpenRouter key was refused";
    if (err.status === 402) return "no credits or free quota left";
    if (err.status === 429 && /per[- ]day|daily|free-models-per-day/i.test(err.message)) return "the daily free-model limit is reached";
  }
  return null;
}
function isRateLimit(err) {
  return err instanceof OpenRouterError && err.status === 429;
}
function withBrief(chat2, brief) {
  if (!brief.trim()) return chat2;
  const wrapped = ((req) => chat2({ ...req, system: req.system + briefFor(req.stage, brief) }));
  if (chat2.badAnswer) wrapped.badAnswer = (model) => chat2.badAnswer?.(model);
  return wrapped;
}
async function ask(o) {
  let lastErr;
  let model;
  for (let attempt = 0; attempt < (o.allowRetry ? Math.max(1, o.attempts ?? 2) : 1); attempt++) {
    if (o.signal?.aborted) throw new Error("Cancelled");
    if (attempt > 0 && o.budget.remaining() <= (o.reserve ?? 0)) break;
    o.budget.take(o.req.stage);
    try {
      model = void 0;
      const answer = await o.chat({ ...o.req, attempt });
      const text = typeof answer === "string" ? answer : answer.text;
      model = typeof answer === "string" ? void 0 : answer.model;
      const value2 = o.parse(o.text ? text : extractJson(text));
      if (model) o.budget.models.add(model);
      o.budget.ok++;
      return { value: value2, model };
    } catch (err) {
      if (o.signal?.aborted) throw err;
      lastErr = err;
      const fatal = isFatal(err);
      o.log(`${o.req.stage}: ${err.message.slice(0, 160)}`);
      if (fatal) {
        o.budget.dead = fatal;
        break;
      }
      if (model) o.chat.badAnswer?.(model);
      if (isRateLimit(err) && o.allowRetry) await sleep$1(o.rateLimitWaitMs ?? 6e3, o.signal);
    }
  }
  throw new BudgetError(`${o.req.stage} failed: ${lastErr?.message ?? "no answer"}`);
}
async function pool(tasks, n) {
  const out = new Array(tasks.length).fill(void 0);
  let next = 0;
  const worker2 = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        out[i] = await tasks[i]();
      } catch (err) {
        if (err.message === "Cancelled") throw err;
        out[i] = void 0;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tasks.length)) }, worker2));
  return out;
}
function sleep$1(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
const CALL_TIMEOUT_MS = 12e4;
const STALL_MS = 6e4;
function openRouterChat(o) {
  let models = null;
  let current = 0;
  const reasoning = /* @__PURE__ */ new Set();
  const fn = async (req) => {
    models ??= await candidateModels({ model: o.model, log: o.log, signal: o.signal });
    const idx = (current + req.attempt) % models.length;
    const model = models[idx];
    const timeout = AbortSignal.timeout(CALL_TIMEOUT_MS);
    const stall = new AbortController();
    const watchStall = !reasoning.has(model);
    let stallTimer = watchStall ? setTimeout(() => stall.abort(), STALL_MS) : null;
    const signal = AbortSignal.any([...o.signal ? [o.signal] : [], timeout, stall.signal]);
    try {
      const text = await chat({
        onDelta: () => {
          if (!watchStall) return;
          if (stallTimer) clearTimeout(stallTimer);
          stallTimer = setTimeout(() => stall.abort(), STALL_MS);
        },
        apiKey: o.apiKey,
        model,
        system: req.system,
        user: req.user,
        // Reasoning tokens count against max_tokens: a route that must reason gets room for both,
        // or its JSON never starts.
        maxTokens: reasoning.has(model) ? req.maxTokens + 4e3 : req.maxTokens,
        temperature: req.temperature ?? 0.3,
        signal,
        noReasoning: !reasoning.has(model),
        reasoningFallback: false
      });
      return { text, model };
    } catch (err) {
      if (o.signal?.aborted) throw err;
      if (needsReasoning(err)) {
        reasoning.add(model);
        throw err;
      }
      if (idx === current && current < models.length - 1 && !isFatal(err)) current++;
      if (timeout.aborted) throw new Error(`${model} took longer than ${CALL_TIMEOUT_MS / 1e3}s`);
      if (stall.signal.aborted) throw new Error(`${model} sent nothing for ${STALL_MS / 1e3}s`);
      throw err;
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
    }
  };
  fn.badAnswer = (model) => {
    if (models && models[current] === model && current < models.length - 1) current++;
  };
  return fn;
}
function markLines(s, sig) {
  return s.map((x, i) => {
    const words2 = x.to - x.from + 1;
    const text = `${x.text.replace(/\s+([,.!?।۔؟])/g, "$1")}${x.joinsNext ? " …" : ""}`;
    return `${sid(i)} [${clock(x.start)}] ${text}${marksFor(sig[i], words2) ? ` ${marksFor(sig[i], words2)}` : ""}`;
  });
}
function chunkSentences(s, chunkSeconds = 540, overlapSeconds2 = 45, maxChunks = 6) {
  if (!s.length) return [];
  const total = s[s.length - 1].end - s[0].start;
  const size = Math.max(chunkSeconds, total / maxChunks + overlapSeconds2);
  const out = [];
  for (let from = 0; from < s.length; ) {
    let to = from;
    while (to + 1 < s.length && s[to + 1].end - s[from].start <= size) to++;
    if (to + 1 < s.length && s[s.length - 1].end - s[to + 1].start < size / 4) to = s.length - 1;
    out.push([from, to]);
    if (to >= s.length - 1) break;
    let next = to;
    while (next > from && s[to].end - s[next].start < overlapSeconds2) next--;
    from = Math.max(from + 1, next + 1);
  }
  return out;
}
function proposeSystem(o, k) {
  if (o.mode === "gaming") return gamingProposeSystem(o, k);
  return `You are the editor of a channel that cuts short vertical clips (TikTok, Reels, YouTube Shorts) out of long videos. You read part of a transcript and pick the moments that would make a stranger stop scrolling in the FIRST 2 SECONDS, watch to the end and share.

Each line is one sentence: S12 [3:41] text (a line ending in "…" is a long sentence that carries on in the next line). A line may end with marks from the audio:
  [laugh 0.7] people laughed right after it (0-1)   [loud] said with more energy than usual
  [fast] said faster than usual   [pause 1.4s] silence before the line
The marks are hints; the words decide.

A clip is a run of whole sentences from "first" to "last" (ids, inclusive). Rules:
- Length: between ${o.minClipSeconds} and ${o.maxClipSeconds} seconds (use the times; a clip ends about where the line after "last" starts).
- It stands alone: someone who saw nothing before must understand it. "first" starts a thought: a claim, a question, a story opening, a strong statement. Never start on a sentence that continues the previous one (and, but, so, because, which, then, yeah, exactly, aur, lekin, magar, toh, phir, kyunki, اور، لیکن، مگر، تو، پھر، کیونکہ، और, लेकिन, तो, फिर, क्योंकि), and never on a pronoun pointing back (he, she, they, that, it, wo, وہ، اس، वो, उस) when who or what it means was said before "first" — start earlier instead.
- It ends on the payoff: the answer, the punchline, the conclusion, the reaction. Never stop on a setup, an unanswered question or half a list; if the payoff comes one or two lines later, include them.
- One idea per clip. Skip intros, outros, sponsor reads, greetings and small talk.
- Viral shape: "first" must be the strongest line of the moment — the claim, question, number, mistake or surprising result — so the hook lands in the first 2 seconds. If the natural first line is a setup, greeting or filler, move "first" forward to the line that grabs attention (stay within the length limits).
- The hook must promise something specific and the clip must deliver it: build a small curiosity gap, then land the answer, result, punchline or reaction at "last". Never stop on a setup or an unanswered question.
- Cut repeated and slow lines even if the clip becomes shorter. Score higher when a stranger would stop immediately, stay to the payoff and want to rewatch or share.
- The transcript may be English, Urdu, Hindi, Hinglish or Roman Urdu and may contain transcription mistakes; judge the meaning.
- Audience: ${o.audience || "a general audience"}.
Give up to ${k} clips from this part, best first; fewer if the part has nothing good. Clips must not overlap.
For each: "first" and "last" (ids), "why" (a few words: what makes it work), "hook_line" (the id of the line that grabs attention), "score" 0-100 (how likely a viewer watches to the end and shares).
Answer with JSON only: {"clips":[{"first":"S12","last":"S20","why":"...","hook_line":"S12","score":80}]}`;
}
function parseProposals(json, count, chunk) {
  const list = json?.clips;
  if (!Array.isArray(list)) throw new Error("no clips list in the answer");
  const out = [];
  for (const item of list) {
    const r = item;
    const first = parseId(r.first, count);
    let last = parseId(r.last ?? r.first, count);
    if (first === null || last === null) continue;
    if (last < first) last = first;
    if (first < chunk[0] || first > chunk[1] || last > chunk[1] + 3) continue;
    const hook = parseId(r.hook_line, count);
    out.push({
      first,
      last,
      score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 50))),
      why: String(r.why ?? "").trim().slice(0, 200),
      ...hook !== null ? { hookLine: hook } : {},
      origin: "model"
    });
  }
  return out;
}
function swissPairs(points, prior, played) {
  const order = points.map((_, i) => i).sort((x, y) => points[y] - points[x] || prior[y] - prior[x]);
  const free = new Set(order);
  const pairs = [];
  for (const i of order) {
    if (!free.has(i)) continue;
    free.delete(i);
    const j = order.find((k) => free.has(k) && !played.has(key(i, k))) ?? order.find((k) => free.has(k));
    if (j === void 0) break;
    free.delete(j);
    pairs.push({ a: i, b: j });
  }
  return pairs;
}
function bradleyTerry(n, results, prior) {
  const mean = prior.reduce((a, x) => a + x, 0) / Math.max(1, n);
  const sd = Math.sqrt(prior.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, n)) || 1;
  const mu = prior.map((x) => (x - mean) / sd * 0.5);
  const theta = [...mu];
  for (let it = 0; it < 300; it++) {
    const grad = theta.map((t, i) => -0.3 * (t - mu[i]));
    for (const [w, l] of results) {
      const p = 1 / (1 + Math.exp(theta[l] - theta[w]));
      grad[w] += 1 - p;
      grad[l] -= 1 - p;
    }
    for (let i = 0; i < n; i++) theta[i] += 0.1 * grad[i];
  }
  return theta;
}
const key = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
async function swissRank(n, prior, judge, o) {
  const wins = new Array(n).fill(0);
  const games = new Array(n).fill(0);
  const points = new Array(n).fill(0);
  const played = /* @__PURE__ */ new Set();
  const results = [];
  let calls = 0;
  let rounds = 0;
  for (let r = 0; r < o.rounds && n >= 2; r++) {
    const pairs = swissPairs(points, prior, played);
    const batches = [];
    for (let k = 0; k < pairs.length; k += o.pairsPerCall) batches.push(pairs.slice(k, k + o.pairsPerCall));
    if (calls + batches.length > o.maxCalls) break;
    calls += batches.length;
    const answers = [];
    const parallel = Math.max(1, o.parallel ?? 2);
    for (let k = 0; k < batches.length; k += parallel) {
      const part = await Promise.all(batches.slice(k, k + parallel).map((b) => judge(b).catch((err) => {
        if (err.message === "Cancelled") throw err;
        return null;
      })));
      answers.push(...part);
    }
    if (answers.every((a) => a === null)) break;
    rounds++;
    const inRound = /* @__PURE__ */ new Set();
    batches.forEach((batch, bi) => {
      batch.forEach((p, pi) => {
        const w = answers[bi]?.[pi];
        inRound.add(p.a).add(p.b);
        played.add(key(p.a, p.b));
        if (w === null || w === void 0) return;
        games[p.a]++;
        games[p.b]++;
        const winner = w === 0 ? p.a : p.b;
        results.push([winner, winner === p.a ? p.b : p.a]);
        wins[winner]++;
        points[winner]++;
      });
    });
    for (let i = 0; i < n; i++) if (!inRound.has(i)) points[i] += 0.5;
  }
  const strength = bradleyTerry(n, results, prior);
  const order = [...Array(n).keys()].sort((x, y) => strength[y] - strength[x] || prior[y] - prior[x]);
  return { order, wins, games, rounds, calls };
}
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const COMPARE_SYSTEM = `You compare short vertical clips cut from the same long video. For each pair, decide which clip a viewer is more likely to watch to the end and share. What matters most: the hook lands in the FIRST 2 SECONDS because the clip starts on its strongest line (not a greeting, setup or filler), one complete idea, a payoff at the end (the answer, the punchline, the conclusion), and making sense without having seen the rest of the video. If two clips are otherwise equal, prefer the one whose first line creates a specific promise and whose last line resolves it. Ignore transcription mistakes and do not prefer a clip just because it is longer or listed first. The transcript may be English, Urdu, Hindi or a mix.
Answer with JSON only: {"results":[{"pair":1,"winner":"A","reason":"a few words"}]}`;
function clipText(c, s, maxChars = 1400) {
  const text = s.slice(c.first, c.last + 1).map((x) => x.text).join(" ").replace(/\s+/g, " ").trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
function compareUser(pairs, cands, s, sig = []) {
  const involved = [...new Set(pairs.flatMap((p) => [p.a, p.b]))];
  const label = new Map(involved.map((i, k) => [i, `C${k + 1}`]));
  const laughs = (c) => Math.max(0, ...[c.last - 1, c.last].filter((i) => i >= c.first).map((i) => sig[i]?.laugh ?? 0)) >= 0.5;
  const lines = involved.map((i) => `${label.get(i)} (${mmss(cands[i].start)}-${mmss(cands[i].end)}, ${Math.round(cands[i].end - cands[i].start)} s${laughs(cands[i]) ? ", people laugh at the end" : ""}): ${clipText(cands[i], s)}`);
  const flip = pairs.map((_, k) => k % 2 === 1);
  const rows = pairs.map((p, k) => {
    const [x, y] = flip[k] ? [p.b, p.a] : [p.a, p.b];
    return `Pair ${k + 1}: A = ${label.get(x)}, B = ${label.get(y)}`;
  });
  return { user: `Clips:
${lines.join("\n\n")}

Pairs:
${rows.join("\n")}`, flip };
}
function parseCompare(json, count, flip) {
  const list = json?.results;
  if (!Array.isArray(list)) throw new Error("no results in the answer");
  const out = new Array(count).fill(null);
  list.forEach((item, k) => {
    const r = item;
    const idx = Number(r.pair ?? k + 1) - 1;
    const w = String(r.winner ?? "").trim().toUpperCase();
    if (!(idx >= 0 && idx < count) || w !== "A" && w !== "B") return;
    const aWon = w === "A";
    out[idx] = aWon !== flip[idx] ? 0 : 1;
  });
  if (out.every((x) => x === null)) throw new Error("no usable winners in the answer");
  return out;
}
const CONTEXT = 3;
const COLDREAD_SYSTEM = `You check short clips before they are posted. Each clip is shown with a few sentences of context: lines marked ">" are inside the clip, lines marked " " are just before or after it and are NOT in the clip. Read the ">" lines as a viewer who has seen nothing else.
For each clip answer:
- "point": one short sentence saying what the clip says or shows (in English).
- "stands_alone": true only if a stranger understands it, is hooked by the FIRST 2 SECONDS, and feels finished; false if it needs what came before, starts mid-thought (on "and", "but", "so", "aur", "lekin", "toh", a reply, or a pronoun whose meaning was said earlier), opens on a greeting/setup/filler instead of the strongest line, or stops before its payoff.
- "first" and "last": the sentence ids the clip should start and end on. Keep them unless moving them fixes a real problem: start earlier to include a missing setup, start later to skip a line that continues something else, end later to include the answer or punchline, end earlier to drop trailing chatter. Only use ids shown for that clip.
- "note": a few words on what you changed, or "".
Answer with JSON only: {"clips":[{"clip":1,"point":"...","stands_alone":true,"first":"S12","last":"S20","note":""}]}`;
function coldReadSystem(withBrief2, base = COLDREAD_SYSTEM) {
  if (!withBrief2) return base;
  return base.replace(
    '- "note":',
    `- "follows": true if the clip fits the creator's instructions (given below), false if it breaks them or is not the kind of moment they asked for.
- "note":`
  ).replace('"note":""}]}', '"follows":true,"note":""}]}');
}
function coldReadUser(finalists, s) {
  return finalists.map((c, k) => {
    const from = Math.max(0, c.first - CONTEXT);
    const to = Math.min(s.length - 1, c.last + CONTEXT);
    const rows = [];
    for (let i = from; i <= to; i++) rows.push(`${i >= c.first && i <= c.last ? ">" : " "} ${sid(i)} ${s[i].text}`);
    return `Clip ${k + 1} (${Math.round(c.end - c.start)} s):
${rows.join("\n")}`;
  }).join("\n\n");
}
function parseColdRead(json, count, sentences) {
  const list = json?.clips;
  if (!Array.isArray(list)) throw new Error("no clips in the answer");
  const out = [];
  list.forEach((item, k) => {
    const r = item;
    const clip = Number(r.clip ?? k + 1) - 1;
    if (!(clip >= 0 && clip < count)) return;
    const alone = r.stands_alone;
    const follows = r.follows;
    out.push({
      clip,
      point: String(r.point ?? "").trim().slice(0, 240),
      standsAlone: !(alone === false || String(alone).toLowerCase() === "false"),
      first: parseId(r.first, sentences),
      last: parseId(r.last, sentences),
      note: String(r.note ?? "").trim().slice(0, 160),
      follows: follows === void 0 || follows === null ? null : !(follows === false || String(follows).toLowerCase() === "false")
    });
  });
  return out;
}
function applyVerdict(c, v, s, lim) {
  if (!v) return { candidate: c, changed: false, weak: false };
  const withPoint = { ...c, point: v.point || c.point };
  const first = v.first ?? c.first;
  const last = v.last ?? c.last;
  const inReach = Math.abs(first - c.first) <= CONTEXT && Math.abs(last - c.last) <= CONTEXT && last >= first;
  if ((first !== c.first || last !== c.last) && inReach) {
    const checked = fixEdges({ first, last }, s, lim);
    if (checked && !checked.flaws.some(isHardFlaw) && checked.first === first && checked.last === last) {
      return {
        candidate: {
          ...withPoint,
          first,
          last,
          start: checked.start,
          end: checked.end,
          flaws: checked.flaws,
          moves: [...c.moves, `cold read: ${sid(c.first)}-${sid(c.last)} -> ${sid(first)}-${sid(last)}${v.note ? ` (${v.note})` : ""}`]
        },
        changed: true,
        weak: false
      };
    }
  }
  const suggested = v.first !== null && v.first !== c.first || v.last !== null && v.last !== c.last;
  return { candidate: withPoint, changed: false, weak: !v.standsAlone && !suggested };
}
function isFunnyHardFlaw(f) {
  return f === "punch-open" || f === "mid-laugh" || f === "connector-open" || f === "response-open" || f === "fragment-open" || f === "too-long";
}
function funnyFlawPenalty(flaws) {
  let p = 0;
  for (const f of flaws) p += isFunnyHardFlaw(f) ? 25 : f === "too-short" ? 6 : f === "pronoun-open" ? 4 : 8;
  return p;
}
const LAUGH_HEARD = 0.5;
function reactionAt(evs, at) {
  const laugh = laughAfter(evs, at, 3);
  const sorted = evs.filter((e) => e.start >= at - 0.6).sort((a, b) => a.start - b.start);
  let cur = sorted.find((e) => e.start <= at + 3 && heard(e) >= LAUGH_HEARD);
  if (!cur) return { laugh, laughEnd: null };
  for (const e of sorted) {
    if (e.start <= cur.start) continue;
    if (e.start - cur.start > 3.2) break;
    if (heard(e) >= 0.4) cur = e;
  }
  return { laugh, laughEnd: Math.min(at + 12, cur.start + 2.2) };
}
function laughingAt(evs, t) {
  return evs.some((e) => e.start >= t - 1.2 && e.start <= t + 0.3 && heard(e) >= 0.55);
}
function placeBeat(b, ctx) {
  const u = ctx.s[b.punch];
  const w = landingWord(ctx.words, u, b.landsOn);
  const at = ctx.words[w].end;
  const r = reactionAt(ctx.evs, at);
  const W = ctx.roomLaughs ? 0.55 : 0;
  return { ...b, w, at, laugh: r.laugh, laughEnd: r.laughEnd, score: (1 - W) * (b.intensity / 5) + W * r.laugh };
}
function fitFunny(beats, ctx, override2) {
  const { s, lim } = ctx;
  if (!s.length || !beats.length) return null;
  const n = s.length;
  const minSetup = lim.minSetup ?? 3;
  const byAt = [...beats].sort((a, b) => a.at - b.at);
  const firstBeat = byAt[0];
  const lastBeat = byAt[byAt.length - 1];
  const firstPunch = Math.min(...beats.map((b) => b.punch));
  const lastPunch = Math.max(...beats.map((b) => b.punch));
  let first = Math.max(0, Math.min(override2?.first ?? Math.min(...beats.map((b) => b.setup)), firstPunch));
  let last = Math.min(n - 1, Math.max(override2?.last ?? Math.max(...beats.map((b) => Math.min(Math.max(b.end, b.punch), b.punch + 2))), lastPunch));
  const moves = [];
  const openFlaw = (i) => openerFlawAt(s, i, lim.lang);
  const hardOpen = (i) => {
    const f = openFlaw(i);
    return f !== null && HARD_OPENER.has(f);
  };
  const setupOk = (f) => f === 0 || firstBeat.at - s[f].start >= minSetup - 0.01;
  const laughEnd = lastBeat.laughEnd;
  const settle2 = Math.max(lastBeat.at, laughEnd ?? 0);
  const endOf = (l) => Math.max(s[l].end, Math.min(laughEnd ?? 0, (s[l + 1]?.start ?? Infinity) - 0.05, s[l].end + 3));
  const fits = (f, l) => endOf(l) - s[f].start <= lim.maxSeconds + 0.01;
  if (!setupOk(first)) {
    const back = [];
    for (let f = first - 1; f >= Math.max(0, first - 5); f--) {
      if (!fits(f, last)) break;
      back.push(f);
    }
    const to = back.find((f) => setupOk(f) && !openFlaw(f)) ?? back.find((f) => setupOk(f) && !hardOpen(f));
    if (to !== void 0) {
      moves.push(`start back ${first - to} (needs the setup)`);
      first = to;
    }
  }
  const flawAtStart = openFlaw(first);
  if (flawAtStart) {
    const hard = HARD_OPENER.has(flawAtStart);
    const back = [first - 1, ...hard || flawAtStart === "split" ? [first - 2] : []].filter((f) => f >= 0 && fits(f, last));
    const to = back.find((f) => !openFlaw(f)) ?? (hard ? back.find((f) => !hardOpen(f)) : void 0);
    if (to !== void 0) {
      moves.push(`start back ${first - to} (${flawAtStart})`);
      first = to;
    } else if (hard) {
      for (let f = first + 1; f <= Math.min(firstPunch, first + 2); f++) {
        if (!hardOpen(f) && setupOk(f)) {
          moves.push(`start forward ${f - first} (${flawAtStart})`);
          first = f;
          break;
        }
      }
    }
  }
  while (last > lastPunch && s[last].end - settle2 > 6) {
    last--;
    moves.push("end back (after the moment)");
  }
  if (laughEnd !== null) {
    while (last + 1 < n && s[last + 1].start < laughEnd - 0.3 && s[last + 1].end - lastBeat.at <= 9 && fits(first, last + 1)) {
      last++;
      moves.push("end forward (laugh continues)");
    }
  } else if (endFlawAt(s, last) === "trailing" && last + 1 < n && s[last + 1].end - lastBeat.at <= 6 && fits(first, last + 1)) {
    last++;
    moves.push("end forward (trailing)");
  }
  const len2 = () => endOf(last) - s[first].start;
  if (len2() > lim.maxSeconds + 0.01) {
    let moved = false;
    for (let f = first + 1; f <= firstPunch; f++) {
      if (!setupOk(f)) break;
      if (hardOpen(f)) continue;
      if (endOf(last) - s[f].start <= lim.maxSeconds + 0.01) {
        moves.push(`start forward ${f - first} (too long)`);
        first = f;
        moved = true;
        break;
      }
    }
    while (!moved && len2() > lim.maxSeconds + 0.01 && last > lastPunch) {
      last--;
      moves.push("end back (too long)");
    }
  }
  let grew = 0;
  while (len2() < lim.minSeconds - 0.01 && first > 0 && grew < 4 && fits(first - 1, last) && !hardOpen(first - 1) && s[first].start - s[first - 1].end < 2.5) {
    first--;
    grew++;
  }
  if (grew) {
    if (openFlaw(first) && first > 0 && !openFlaw(first - 1) && fits(first - 1, last)) first--, grew++;
    moves.push(`start back ${grew} (too short)`);
  }
  const next = s[last + 1]?.start ?? Infinity;
  const target = laughEnd !== null ? Math.max(laughEnd, s[last].end + 0.3) : s[last].end + 0.5;
  let end = Math.max(s[last].end, Math.min(target, next - 0.05, s[last].end + 3));
  const flaws = [];
  if (!setupOk(first)) flaws.push("punch-open");
  const o = openFlaw(first);
  if (o) flaws.push(`${o}-open`);
  if (laughEnd !== null && laughEnd > end + 0.8 && laughingAt(ctx.evs, end)) flaws.push("mid-laugh");
  if (endFlawAt(s, last) === "trailing" && laughEnd === null) flaws.push("trailing-end");
  const seconds2 = end - s[first].start;
  if (seconds2 > lim.maxSeconds + 0.5) {
    flaws.push("too-long");
    end = s[first].start + lim.maxSeconds;
  } else if (seconds2 < Math.min(lim.minSeconds, 8) - 0.5) flaws.push("too-short");
  if (end - s[first].start < 2) return null;
  return { first, last, start: s[first].start, end, flaws, moves };
}
function groupBeats(beats, ctx) {
  const out = [];
  for (const b of [...beats].sort((x, y) => x.at - y.at)) {
    const alone = fitFunny([b], ctx);
    if (!alone) continue;
    const prev = out[out.length - 1];
    if (prev && (b.setup <= prev.fit.last || alone.start - prev.fit.end < 3)) {
      const merged = fitFunny([...prev.beats, b], ctx);
      if (merged && !merged.flaws.some(isFunnyHardFlaw)) {
        out[out.length - 1] = { beats: [...prev.beats, b], fit: { ...merged, moves: [...merged.moves, `merged ${prev.beats.length + 1} beats`] } };
        continue;
      }
    }
    out.push({ beats: [b], fit: alone });
  }
  return out;
}
function laughterBeats(s, evs, within = [0, s.length - 1]) {
  const out = [];
  for (let i = within[0]; i <= within[1] && i < s.length; i++) {
    const laugh = laughAfter(evs, s[i].end, 2);
    if (laugh < 0.55) continue;
    if (out.length && out[out.length - 1].punch === i - 1) continue;
    out.push({
      setup: Math.max(0, i - 2),
      punch: i,
      end: i,
      landsOn: s[i].text.split(/\s+/).pop(),
      type: "joke_punchline",
      situation: s[i].text,
      intensity: Math.min(5, Math.max(1, Math.round(laugh * 5))),
      why: "laughter heard",
      origin: "laughter"
    });
  }
  return out;
}
const FUNNY_REQUEST_CAP = 15;
const STRONG_SILENT = ["taunt", "roast", "sarcasm", "awkward", "cringe"];
const r2 = (n) => Math.round(n * 100) / 100;
function funnyProposeSystem(k) {
  return `You are the editor of a channel that cuts funny short clips (TikTok, Reels, YouTube Shorts) out of long podcasts, shows and vlogs. You read part of a transcript and find the comedic beats: a joke's punchline, a taunt or roast, sarcasm, someone owning themselves, an awkward silence, an exaggeration, a shocking admission, a fail, a cringe moment.

Each line is one sentence: S12 [3:41] text (a line ending in "…" carries on in the next line). A line may end with marks from the audio:
  [laugh 0.7] laughter or a crowd was heard right after it (0-1)   [loud] said with more energy than usual
  [fast] said faster than usual   [pause 1.4s] silence before the line
Laughter is strong evidence that the line before it landed, but a taunt or dry sarcasm is funny with no laugh at all, and people also laugh politely at things that are not funny. Judge the words.

For each beat give:
  "setup": the id of the line where the build-up starts. The clip starts here, so a viewer who saw nothing before must get the joke from this line on: include what the joke refers to (usually 1-4 lines before the punch). Never start on the punchline itself, and never on a line that continues the one before (and, but, so, yeah, aur, lekin, toh, phir, اور، لیکن، تو، और, लेकिन, तो).
  "punch": the id of the line where it lands
  "end": the id of the last line of the reaction (the laugh, the comeback, "no way"): usually the punch or one or two lines after it, never the chatter after the moment is over
  "lands_on": the exact word or two, copied from the punch line, on which the laugh lands
  "type": one of ${hardware.BEAT_TYPES.join(", ")}
  "situation": one plain English sentence saying what happened, in general terms a meme could match ("he bragged about his cooking and the others mocked him")
  "intensity": 1-5, how funny it is to a general audience (5 = people will share it)
  "why": a few words

Open on the funniest or most surprising line so the laugh lands in the first 2 seconds; cut the setup short. Be selective. Only list beats a viewer would actually laugh at or share; ordinary banter, agreement ("yeah, yeah") and people merely retelling a story are not beats. Nine minutes of a funny podcast have maybe 3-8 real beats; an ordinary stretch has none. Use intensity 5 only for the few moments that would make a clip on their own. Give at most ${k} beats from this part.
The transcript may be English, Urdu, Hindi, Hinglish or Roman Urdu and may contain transcription mistakes; answer in English but copy "lands_on" exactly as written in the line.
Answer with JSON only: {"beats":[{"setup":"S10","punch":"S12","end":"S13","lands_on":"...","type":"roast","situation":"...","intensity":4,"why":"..."}]}`;
}
const SECOND_LOOK_SYSTEM = `You are the editor of a channel that cuts funny short clips out of long podcasts, shows and vlogs. You get short excerpts of a transcript that each end where the audience laughed out loud. Lines look like: S12 [3:41] text, with [laugh 0.8] after a line the room laughed at.
For each excerpt, find the comedic beat that caused the laugh, or skip it if the laugh was only politeness or a reaction to something not in the words. For each beat give "setup" (id of the line where the build-up starts, so a stranger gets the joke; never the punchline itself), "punch" (id of the line where it lands), "end" (id of the last line of the reaction), "lands_on" (the exact word or two from the punch line), "type" (one of ${hardware.BEAT_TYPES.join(", ")}), "situation" (one plain English sentence), "intensity" (1-5), "why" (a few words). Only use ids shown in that excerpt.
Answer with JSON only: {"beats":[{"setup":"S10","punch":"S12","end":"S13","lands_on":"...","type":"joke_punchline","situation":"...","intensity":4,"why":"..."}]}`;
const FUNNY_COMPARE_SYSTEM = `You compare funny short vertical clips cut from the same long video. For each pair, decide which clip would make more people laugh and share it. What matters: a stranger who saw nothing else gets the joke (its setup is inside the clip), it gets to the funny part quickly, the punchline is strong, and the reaction is in it. A line may end with [laugh 0.8]: the room laughed there (0-1). A laugh helps, but the words decide: polite laughs at nothing funny do not count. Ignore transcription mistakes and do not prefer a clip just because it is longer or listed first. The transcript may be English, Urdu, Hindi or a mix.
Answer with JSON only: {"results":[{"pair":1,"winner":"A","reason":"a few words"}]}`;
const FUNNY_COLDREAD_SYSTEM = `You check funny clips before they are posted. Each clip is shown with a few lines of context: lines marked ">" are inside the clip, lines marked " " are just before or after it and are NOT in the clip. A line may end with [laugh 0.8] where the room laughed. Read the ">" lines as a viewer who has seen nothing else.
For each clip answer:
- "point": the joke in one short English sentence.
- "stands_alone": true if a stranger gets the joke from the ">" lines alone; false if the setup it needs is missing (it refers to something said before the clip), it starts on the punchline, or it stops before the punchline or the reaction.
- "first" and "last": the ids the clip should start and end on. Keep them unless moving them fixes a real problem: start earlier to include a missing setup, start later to skip chatter before the setup, end later to include the punchline or the reaction, end earlier to drop chatter after the laugh. Only use ids shown for that clip.
- "note": a few words on what you changed, or "".
Answer with JSON only: {"clips":[{"clip":1,"point":"...","stands_alone":true,"first":"S12","last":"S20","note":""}]}`;
function memesSystem(used) {
  return `You add memes to funny short clips, the way a good editor does: sparingly, only where a meme makes the moment funnier. For each clip you get its transcript and its beats, each beat with up to six candidate memes from the library. For each beat choose the one that fits best, or "none" when nothing fits or the moment is funnier clean. Never use the same meme twice in a clip, and do not reuse a meme across clips unless nothing else fits. Use at most the number of memes given for each clip and at most one video meme per clip (a video meme interrupts the clip, so save it for the biggest moment). Fewer is usually better: one well-placed meme beats three. Prefer a sound when the moment already has its own laugh or reaction on screen; a video cut-in is for a moment that needs the extra punch. Memes already used in earlier clips of this video: ${used.join(", ") || "none"}.

Also write each clip's copy: "title" (max 60 characters, the joke in a few words, in the language people in the clip speak, Latin script for Hindi/Urdu), "hook" (max 8 words shown on screen above the clip, teasing the joke without giving it away), "hashtags" (5-8, without #).

Answer with JSON only: {"clips":[{"clip":1,"title":"...","hook":"...","hashtags":["..."],"picks":[{"beat":1,"meme":"meme-id or none","why":"a few words"}]}]}`;
}
function parseBeats(json, count, ranges, origin) {
  const list = json?.beats;
  if (!Array.isArray(list)) throw new Error("no beats list in the answer");
  const out = [];
  for (const item of list) {
    const r = item;
    const punch = parseId(r.punch, count);
    if (punch === null) continue;
    const range2 = ranges.find(([a, b]) => punch >= a && punch <= b);
    if (!range2) continue;
    let setup = parseId(r.setup, count) ?? punch;
    if (setup > punch) setup = punch;
    setup = Math.max(setup, range2[0], punch - 8);
    let end = parseId(r.end, count) ?? punch;
    end = Math.min(Math.max(end, punch), punch + 3, count - 1);
    const type = String(r.type ?? "").trim().toLowerCase();
    out.push({
      setup,
      punch,
      end,
      landsOn: r.lands_on === void 0 ? void 0 : String(r.lands_on),
      type: hardware.BEAT_TYPES.includes(type) ? type : "joke_punchline",
      situation: String(r.situation ?? "").trim().slice(0, 240),
      intensity: Math.max(1, Math.min(5, Math.round(Number(r.intensity) || 3))),
      why: String(r.why ?? "").trim().slice(0, 160),
      origin
    });
  }
  return out;
}
function parseMemeAnswer(json, count) {
  const list = json?.clips;
  if (!Array.isArray(list)) throw new Error("no clips in the answer");
  const out = new Array(count).fill(null);
  list.forEach((item, k) => {
    const r = item;
    const idx = Number(r.clip ?? k + 1) - 1;
    if (!(idx >= 0 && idx < count)) return;
    const picks = Array.isArray(r.picks) ? r.picks : [];
    const tags = Array.isArray(r.hashtags) ? r.hashtags : String(r.hashtags ?? "").split(/[\s,]+/);
    out[idx] = {
      title: r.title === void 0 ? void 0 : String(r.title),
      hook: r.hook === void 0 ? void 0 : String(r.hook),
      hashtags: tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean),
      picks: picks.map((p) => {
        const q = p;
        return { beat: Number(q.beat), meme: String(q.meme ?? "none").trim(), why: q.why === void 0 ? void 0 : String(q.why) };
      })
    };
  });
  if (out.every((x) => x === null)) throw new Error("no usable clips in the answer");
  return out;
}
function funnyValue(beats, flaws, roomLaughs) {
  const best = Math.max(...beats.map((b) => b.score));
  const laughed = Math.max(...beats.map((b) => b.laugh));
  const roar = roomLaughs ? Math.round(80 * Math.max(0, laughed - 0.55)) : 0;
  return 100 * best + 12 * Math.min(3, beats.length - 1) + (roomLaughs && laughed >= 0.5 ? 15 : 0) + roar - funnyFlawPenalty(flaws);
}
function strongBeat(b, roomLaughs) {
  if (b.intensity >= 5 && STRONG_SILENT.includes(b.type)) return true;
  return roomLaughs ? b.score >= 0.5 : b.intensity >= 4;
}
function funnyCandidates(spans, ctx, keep) {
  const byPunch = /* @__PURE__ */ new Map();
  for (const b of spans) {
    const prev = byPunch.get(b.punch);
    if (!prev || b.intensity > prev.intensity) byPunch.set(b.punch, b);
  }
  const placed = [...byPunch.values()].map((b) => placeBeat(b, ctx));
  const usable = placed.filter((b) => strongBeat(b, ctx.roomLaughs) || (ctx.roomLaughs ? b.score >= 0.4 : b.intensity >= 3));
  const groups = groupBeats(usable, ctx);
  const all = groups.map((g) => ({
    ...g.fit,
    beats: g.beats,
    value: funnyValue(g.beats, g.fit.flaws, ctx.roomLaughs),
    strong: g.beats.some((b) => strongBeat(b, ctx.roomLaughs))
  }));
  all.sort((a, b) => Number(b.strong) - Number(a.strong) || b.value - a.value);
  const clean2 = all.filter((c) => !c.flaws.some(isFunnyHardFlaw));
  const flawed = all.filter((c) => c.flaws.some(isFunnyHardFlaw));
  const out = [];
  for (const c of [...clean2, ...flawed]) {
    if (out.length >= keep) break;
    if (out.some((x) => overlapSeconds(x, c) > 1)) continue;
    out.push(c);
  }
  return out;
}
function laughMark(sig, i) {
  return (sig[i]?.laugh ?? 0) >= 0.4 ? ` [laugh ${sig[i].laugh.toFixed(1)}]` : "";
}
function clipLines(c, s, sig, maxChars = 1600) {
  let text = "";
  for (let i = c.first; i <= c.last; i++) {
    const line = `${s[i].text}${laughMark(sig, i)}`;
    if (text.length + line.length > maxChars) return `${text}…`;
    text += (text ? "\n" : "") + line;
  }
  return text;
}
function funnyCompareUser(pairs, cands, s, sig) {
  const involved = [...new Set(pairs.flatMap((p) => [p.a, p.b]))];
  const label = new Map(involved.map((i, k) => [i, `C${k + 1}`]));
  const blocks = involved.map((i) => `${label.get(i)} (${clock(cands[i].start)}-${clock(cands[i].end)}, ${Math.round(cands[i].end - cands[i].start)} s):
${clipLines(cands[i], s, sig)}`);
  const flip = pairs.map((_, k) => k % 2 === 1);
  const rows = pairs.map((p, k) => {
    const [x, y] = flip[k] ? [p.b, p.a] : [p.a, p.b];
    return `Pair ${k + 1}: A = ${label.get(x)}, B = ${label.get(y)}`;
  });
  return { user: `Clips:
${blocks.join("\n\n")}

Pairs:
${rows.join("\n")}`, flip };
}
const FUNNY_CONTEXT = 3;
function funnyColdReadUser(cands, s, sig) {
  return cands.map((c, k) => {
    const from = Math.max(0, c.first - FUNNY_CONTEXT);
    const to = Math.min(s.length - 1, c.last + FUNNY_CONTEXT);
    const rows = [];
    for (let i = from; i <= to; i++) rows.push(`${i >= c.first && i <= c.last ? ">" : " "} ${sid(i)} ${s[i].text}${laughMark(sig, i)}`);
    return `Clip ${k + 1} (${Math.round(c.end - c.start)} s):
${rows.join("\n")}`;
  }).join("\n\n");
}
function applyFunnyVerdict(c, v, ctx) {
  if (!v) return { candidate: c, changed: false, weak: false };
  const withPoint = { ...c, point: v.point || c.point };
  const first = v.first ?? c.first;
  const last = v.last ?? c.last;
  const punches = c.beats.map((b) => b.punch);
  const inReach = Math.abs(first - c.first) <= FUNNY_CONTEXT && Math.abs(last - c.last) <= FUNNY_CONTEXT && last >= first && first <= Math.min(...punches) && last >= Math.max(...punches);
  if ((first !== c.first || last !== c.last) && inReach) {
    const fit = fitFunny(c.beats, ctx, { first, last });
    if (fit && fit.first === first && !fit.flaws.some(isFunnyHardFlaw)) {
      return {
        candidate: { ...withPoint, ...fit, moves: [...c.moves, `cold read: ${sid(c.first)}-${sid(c.last)} -> ${sid(fit.first)}-${sid(fit.last)}${v.note ? ` (${v.note})` : ""}`], value: funnyValue(c.beats, fit.flaws, ctx.roomLaughs) },
        changed: true,
        weak: false
      };
    }
  }
  const suggested = v.first !== null && v.first !== c.first || v.last !== null && v.last !== c.last;
  return { candidate: withPoint, changed: false, weak: !v.standsAlone && !suggested };
}
async function runFunnyAgentic(o) {
  const t0 = Date.now();
  const { transcript, options } = o;
  const want = Math.max(1, Math.round(options.clipCount));
  const trace = [];
  const cancelled = () => {
    if (o.signal?.aborted) throw new Error("Cancelled");
  };
  const stats = {
    requests: 0,
    cap: o.cap ?? FUNNY_REQUEST_CAP,
    byStage: {},
    skipped: [],
    models: [],
    beats: 0,
    secondLook: 0,
    checked: 0,
    compareRounds: 0,
    edgeFixes: 0,
    replaced: 0,
    wallMs: 0,
    trace
  };
  const s = clipUnits(transcript.words, 24, 12);
  if (!s.length) return { highlights: [], source: "heuristic", stats };
  const evs = o.laughter;
  const sig = sentenceSignals(s, { samples: o.samples, offset: o.sampleOffset, laughter: evs });
  const roomLaughs = laughEvents(evs, 0.55).length >= 3;
  if (!roomLaughs) o.log("Nobody laughs out loud in this video, so jokes are ranked on the words alone.");
  const lim = {
    minSeconds: Math.min(options.minClipSeconds || 15, 20),
    maxSeconds: Math.max(10, Math.min(options.maxClipSeconds || 45, 90)),
    lang: transcript.language || options.language,
    minSetup: 3
  };
  const ctx = { s, words: transcript.words, evs, lim, roomLaughs };
  const lang = (transcript.language || options.language || "en").slice(0, 2);
  const rawChat = o.chat ?? (o.apiKey ? openRouterChat({ apiKey: o.apiKey, model: o.model, log: o.log, signal: o.signal }) : null);
  const brief = buildBrief(options);
  if (brief.text) o.log(rawChat ? `Following the creator's instructions (${brief.chars} characters${brief.truncated ? `, the first ${MAX_BRIEF_CHARS} used` : ""}).` : "Instructions were given, but they need an AI service to be followed; the built-in search cannot read them.");
  const chatFn = rawChat ? withBrief(rawChat, brief.text) : null;
  const budget = new Budget(stats.cap);
  const common = chatFn ? { budget, chat: chatFn, log: o.log, signal: o.signal, rateLimitWaitMs: o.rateLimitWaitMs } : null;
  const memeCalls = Math.ceil(want / 3);
  const spans = [];
  if (!common) {
    o.log("No AI key: funny moments come from the laughter alone. Add a key in Settings → AI writing to find taunts and dry jokes too.");
    spans.push(...laughterBeats(s, evs));
    trace.push(`propose: laughter only, ${spans.length} beats`);
  } else {
    const chunks = chunkSentences(s);
    const lines = markLines(s, sig);
    const total = Math.max(1, s[s.length - 1].end - s[0].start);
    const reserve = 3 + memeCalls;
    const allowRetry = budget.cap - chunks.length * 2 >= reserve;
    let done = 0;
    o.onProgress(5, `Finding the jokes (${chunks.length} part${chunks.length === 1 ? "" : "s"})…`);
    const answers = await pool(
      chunks.map((ch) => async () => {
        const share = (s[ch[1]].end - s[ch[0]].start) / total;
        const k = Math.min(12, Math.max(4, Math.ceil(3 * want * share) + 2));
        const r = await ask({
          ...common,
          req: { stage: "propose", system: funnyProposeSystem(k), user: lines.slice(ch[0], ch[1] + 1).join("\n"), maxTokens: 600 + 260 * k, temperature: 0.4 },
          parse: (j) => parseBeats(j, s.length, [[ch[0], ch[1]]], "model"),
          allowRetry,
          attempts: chunks.length <= 2 ? 3 : 2,
          reserve
        });
        o.onProgress(5 + ++done / chunks.length * 35, `Finding the jokes (${done}/${chunks.length})…`);
        return r.value;
      }),
      3
    );
    cancelled();
    answers.forEach((a, k) => {
      const ch = chunks[k];
      if (a) {
        spans.push(...a);
        trace.push(`propose ${sid(ch[0])}-${sid(ch[1])}: ${a.map((b) => `${sid(b.setup)}>${sid(b.punch)}>${sid(b.end)} ${b.type} ${b.intensity} "${b.landsOn ?? ""}"`).join(" | ") || "nothing"}`);
      } else {
        const fill = laughterBeats(s, evs, ch);
        spans.push(...fill);
        trace.push(`propose ${sid(ch[0])}-${sid(ch[1])}: failed, ${fill.length} laughter beats instead`);
      }
    });
    if (!answers.some(Boolean)) budget.skip("propose", budget.dead ?? "no answer");
    if (answers.some(Boolean) && !budget.dead && budget.remaining() >= memeCalls + 2) {
      const ats = spans.map((b) => placeBeat(b, ctx).at);
      const orphans = laughEvents(evs, 0.7).filter((lg) => !ats.some((t) => lg.start >= t - 1 && lg.start <= t + 3)).slice(0, 12);
      if (orphans.length) {
        o.onProgress(42, "A second look at the laughs…");
        const ranges = [];
        const blocks = orphans.map((lg, k) => {
          let i = s.findIndex((u) => u.end >= lg.start - 0.6);
          if (i < 0) i = s.length - 1;
          const range2 = [Math.max(0, i - 6), Math.min(s.length - 1, i + 1)];
          ranges.push(range2);
          return `Laugh ${k + 1} at ${clock(lg.start)}:
${lines.slice(range2[0], range2[1] + 1).join("\n")}`;
        });
        try {
          const r = await ask({
            ...common,
            req: { stage: "laughs", system: SECOND_LOOK_SYSTEM, user: blocks.join("\n\n"), maxTokens: 500 + 220 * orphans.length, temperature: 0.3 },
            parse: (j) => parseBeats(j, s.length, ranges, "second-look"),
            allowRetry: budget.remaining() > memeCalls + 3,
            reserve: memeCalls + 2
          });
          const have = new Set(spans.map((b) => b.punch));
          const added = r.value.filter((b) => !have.has(b.punch));
          spans.push(...added);
          stats.secondLook = added.length;
          trace.push(`second look at ${orphans.length} laughs: ${added.map((b) => `${sid(b.setup)}>${sid(b.punch)} ${b.type} ${b.intensity}`).join(" | ") || "nothing new"}`);
          if (added.length) o.log(`A second look at ${orphans.length} laughs found ${added.length} more beat${added.length === 1 ? "" : "s"}.`);
        } catch (err) {
          cancelled();
          budget.skip("laughs", err.message);
        }
      }
    }
  }
  if (spans.some((b) => b.origin !== "laughter")) {
    const ats = spans.map((b) => placeBeat(b, ctx).at);
    const missed = laughterBeats(s, evs).filter((b) => {
      const at = placeBeat(b, ctx).at;
      return laughAfter(evs, s[b.punch].end, 2) >= 0.75 && !ats.some((t) => Math.abs(t - at) < 4);
    });
    if (missed.length) {
      spans.push(...missed);
      trace.push(`strong laughs kept without a model beat: ${missed.map((b) => sid(b.punch)).join(" ")}`);
    }
  }
  stats.beats = spans.length;
  o.onProgress(48, "Cutting each joke from setup to laugh…");
  const pool1 = funnyCandidates(spans, ctx, Math.min(10, want * 2));
  stats.checked = pool1.length;
  traceFunny(trace, "checked", pool1);
  let ranked = [...pool1];
  let compared = false;
  if (common && pool1.length > want && !budget.dead) {
    const maxCalls = Math.min(3, budget.remaining() - memeCalls - 1);
    const pairsPerCall = Math.max(1, Math.min(6, Math.floor(pool1.length / 2)));
    if (maxCalls >= 1) {
      o.onProgress(55, "Comparing the jokes…");
      try {
        const res = await swissRank(
          pool1.length,
          pool1.map((c) => c.value + (c.strong ? 30 : 0)),
          async (pairs) => {
            const { user, flip } = funnyCompareUser(pairs, pool1, s, sig);
            const r = await ask({ ...common, req: { stage: "compare", system: FUNNY_COMPARE_SYSTEM, user, maxTokens: 200 + 90 * pairs.length, temperature: 0.2 }, parse: (j) => parseCompare(j, pairs.length, flip), allowRetry: budget.remaining() > memeCalls + 2, attempts: 2, reserve: memeCalls + 1 });
            return r.value;
          },
          { rounds: 3, pairsPerCall, maxCalls, parallel: 2 }
        );
        stats.compareRounds = res.rounds;
        if (res.rounds > 0) {
          compared = true;
          const blended = (i) => pool1[i].value + (pool1[i].strong ? 30 : 0) + (res.games[i] ? 60 * (res.wins[i] / res.games[i] - 0.5) : 0);
          ranked = [...pool1.keys()].sort((a, b) => blended(b) - blended(a)).map((i) => ({ ...pool1[i], wins: res.wins[i], games: res.games[i] }));
          trace.push(`compare: ${res.rounds} rounds, ${res.calls} calls; order ${ranked.map((c) => `${sid(c.first)}(${c.wins}/${c.games})`).join(" ")}`);
        } else budget.skip("compare", budget.dead ?? "no answer");
      } catch (err) {
        cancelled();
        budget.skip("compare", err.message);
      }
    } else budget.skip("compare", "no requests left");
  }
  cancelled();
  const order = (xs) => [
    ...xs.filter((c) => c.strong && !c.flaws.some(isFunnyHardFlaw)),
    ...xs.filter((c) => !c.strong && !c.flaws.some(isFunnyHardFlaw)),
    ...xs.filter((c) => c.flaws.some(isFunnyHardFlaw))
  ];
  ranked = order(ranked);
  let finalists = ranked.slice(0, want);
  const bench = ranked.filter((c) => !finalists.includes(c) && !c.flaws.some(isFunnyHardFlaw));
  if (common && finalists.length && !budget.dead && budget.remaining() >= memeCalls + 1) {
    o.onProgress(65, "Checking each joke lands on its own…");
    try {
      const r = await ask({
        ...common,
        req: { stage: "coldread", system: coldReadSystem(Boolean(brief.text), FUNNY_COLDREAD_SYSTEM), user: funnyColdReadUser(finalists, s, sig), maxTokens: (brief.text ? 500 : 300) + (brief.text ? 300 : 220) * finalists.length, temperature: 0.2 },
        parse: (j) => parseColdRead(j, finalists.length, s.length),
        allowRetry: budget.remaining() > memeCalls + 1,
        reserve: memeCalls
      });
      if (brief.text) {
        const breaks = new Set(r.value.filter((v) => v.follows === false).map((v) => v.clip));
        if (breaks.size && breaks.size < finalists.length) {
          trace.push(`cold read: ${breaks.size} of ${finalists.length} do not follow the instructions, dropped`);
          const keep = finalists.map((_, k) => k).filter((k) => !breaks.has(k));
          finalists = keep.map((k) => finalists[k]);
          r.value = r.value.filter((v) => !breaks.has(v.clip)).map((v) => ({ ...v, clip: keep.indexOf(v.clip) }));
          o.log(`Only ${finalists.length} funny moment${finalists.length === 1 ? "" : "s"} in this video match${finalists.length === 1 ? "es" : ""} your instructions.`);
        }
      }
      const flagged = r.value.filter((v) => !v.standsAlone).length;
      const trustFlags = flagged <= Math.floor(finalists.length / 2);
      if (!trustFlags && flagged) trace.push(`cold read: ${flagged} of ${finalists.length} flagged, not trusted`);
      let swaps = Math.max(1, Math.ceil(want / 3));
      const before = finalists;
      finalists = before.map((c, k) => {
        const v = r.value.find((x) => x.clip === k);
        const applied = applyFunnyVerdict(c, v, ctx);
        if (applied.changed && !before.some((x, j) => j !== k && overlapSeconds(x, applied.candidate) > 1)) {
          stats.edgeFixes++;
          trace.push(`cold read ${k + 1}: ${applied.candidate.moves[applied.candidate.moves.length - 1]}`);
          return applied.candidate;
        }
        const kept2 = applied.changed ? { ...c, point: applied.candidate.point } : applied.candidate;
        if (applied.weak && trustFlags && v?.note && swaps > 0) {
          const share = (x) => x.games ? (x.wins ?? 0) / x.games : 0.5;
          const sub = bench.findIndex((b) => !before.some((x) => overlapSeconds(x, b) > 1) && share(b) >= share(c) && (b.strong || !c.strong));
          trace.push(`cold read ${k + 1}: a stranger would not get it (${v.note})${sub >= 0 ? `, replaced by ${sid(bench[sub].first)}-${sid(bench[sub].last)}` : ", kept (nothing better)"}`);
          if (sub >= 0) {
            swaps--;
            stats.replaced++;
            return bench.splice(sub, 1)[0];
          }
        }
        return kept2;
      });
    } catch (err) {
      cancelled();
      budget.skip("coldread", err.message);
    }
  } else if (common) budget.skip("coldread", budget.dead ?? "no requests left");
  cancelled();
  const kept = [];
  for (const c of finalists) if (!kept.some((k) => overlapSeconds(k, c) > 1)) kept.push(c);
  for (const b of bench) {
    if (kept.length >= want) break;
    if (!kept.some((k) => overlapSeconds(k, b) > 1)) kept.push(b);
  }
  finalists = kept.sort((a, b) => a.start - b.start);
  o.onProgress(75, "Picking memes…");
  const clips = finalists.map((c) => toFunnyClip(c, ctx));
  const usedBefore = /* @__PURE__ */ new Map();
  const highlights = [];
  for (let from = 0; from < clips.length; from += 3) {
    cancelled();
    const batch = clips.slice(from, from + 3);
    const offers = batch.map((c) => c.beats.map((b) => candidates(b, o.library, lang, usedBefore)));
    let answers = null;
    if (common && !budget.dead && budget.remaining() > 0) {
      const user = batch.map((c, k) => {
        const fc = finalists[from + k];
        const text = s.slice(fc.first, fc.last + 1).map((u) => u.text).join("\n");
        const beatsText = c.beats.map((b, i) => {
          const opts = offers[k][i].map((m) => `    - ${m.id} (${m.kind}${m.quote ? `, says "${m.quote}"` : ""}): ${m.used_when}`);
          return `Beat ${i + 1}: ${b.type}, lands on "${b.word}". ${b.situation}
${opts.join("\n") || "    (no candidates)"}`;
        }).join("\n");
        return `Clip ${k + 1} (at most ${maxMemes(c)} meme${maxMemes(c) === 1 ? "" : "s"}):
${text}

${beatsText}`;
      }).join("\n\n=====\n\n");
      try {
        const r = await ask({
          ...common,
          req: { stage: "memes", system: memesSystem([...usedBefore.keys()]), user, maxTokens: 800 + 500 * batch.length, temperature: 0.4 },
          parse: (j) => parseMemeAnswer(j, batch.length),
          allowRetry: budget.remaining() > Math.ceil((clips.length - from) / 3)
        });
        answers = r.value;
      } catch (err) {
        cancelled();
        budget.skip("memes", err.message);
      }
    }
    batch.forEach((c, k) => {
      const fc = finalists[from + k];
      highlights.push(finish(c, fc, offers[k], answers?.[k] ?? null, usedBefore, ctx, compared, from + k));
    });
    o.onProgress(75 + (from + batch.length) / Math.max(1, clips.length) * 25, "Picking memes…");
  }
  stats.requests = budget.used;
  stats.byStage = { ...budget.byStage };
  stats.skipped = [...budget.skipped];
  stats.models = [...budget.models];
  stats.wallMs = Date.now() - t0;
  if (common) o.log(`AI requests: ${budget.used} of ${budget.cap} (${Object.entries(budget.byStage).map(([k, v]) => `${k} ${v}`).join(", ")})${budget.skipped.length ? `; skipped ${budget.skipped.join(", ")}` : ""}.`);
  if (budget.dead) o.log(`AI writing stopped early: ${budget.dead}. The laughter filled in.`);
  return {
    highlights: highlights.map((h, i) => ({ ...h, id: `h${i + 1}` })),
    source: budget.ok > 0 ? "ai" : "heuristic",
    ...stats.models.length ? { model: stats.models.join(", ") } : {},
    stats
  };
}
function toFunnyClip(c, ctx) {
  const beats = [...c.beats].sort((a, b) => a.at - b.at).map((b) => ({
    type: b.type,
    situation: b.situation,
    intensity: b.intensity,
    at: r2(b.at),
    word: ctx.words[b.w].text,
    laugh: r2(b.laugh),
    score: r2(b.score)
  }));
  return { start: r2(Math.max(0, c.start - 0.15)), end: r2(c.end), score: r2(c.value / 100), beats };
}
function finish(c, fc, offers, answer, usedBefore, ctx, compared, index) {
  let picks = answer?.picks ?? [];
  if (!answer) {
    const top = c.beats.map((b, i) => ({ i, s: b.score })).sort((x, y) => y.s - x.s).slice(0, 2).map((x) => x.i);
    const used2 = /* @__PURE__ */ new Set();
    picks = c.beats.map((_, i) => {
      const m = top.includes(i) ? offers[i].find((x) => !used2.has(x.id) && x.kind === "sound" && !usedBefore.has(x.id)) : void 0;
      if (m) used2.add(m.id);
      return { beat: i + 1, meme: m?.id ?? "none", why: "closest match" };
    });
  }
  const used = /* @__PURE__ */ new Set();
  let videos = 0;
  const chosen = [];
  for (const p of picks) {
    const bi = Number(p.beat) - 1;
    const m = offers[bi]?.find((x) => x.id === p.meme);
    if (!m || used.has(m.id) || (usedBefore.get(m.id) ?? 0) >= 2 || chosen.length >= maxMemes(c) || m.kind === "video" && videos >= 1) continue;
    used.add(m.id);
    if (m.kind === "video") videos++;
    chosen.push({ beat: bi, m, why: p.why });
  }
  for (const x of chosen) usedBefore.set(x.m.id, (usedBefore.get(x.m.id) ?? 0) + 1);
  const memes = place(c, chosen, ctx.words);
  const text = ctx.s.slice(fc.first, fc.last + 1).map((u) => u.text).join(" ");
  const winShare = compared && fc.games ? (fc.wins ?? 0) / fc.games : null;
  const best = Math.max(...c.beats.map((b) => b.score));
  const score = winShare === null ? Math.min(1, c.score / 1.4) : Math.min(1, 0.65 * best + 0.35 * winShare + 0.1 * Math.min(2, c.beats.length - 1));
  const first = c.beats[0];
  const reason = [
    `${c.beats.length} funny beat${c.beats.length === 1 ? "" : "s"}${first ? `, lands on “${first.word}”` : ""}`,
    fc.point ? `Joke: ${fc.point}` : "",
    winShare !== null && fc.games ? `Won ${fc.wins} of ${fc.games} comparisons` : "",
    memes.length ? `memes: ${memes.map((m) => m.id).join(", ")}` : ""
  ].filter(Boolean).join("; ");
  return {
    id: `h${index + 1}`,
    start: c.start,
    end: c.end,
    title: clean(answer?.title, 60) || shorten(text, 60),
    hook: clean(answer?.hook, 60),
    description: c.beats.map((b) => b.situation).filter(Boolean).join(" "),
    hashtags: (answer?.hashtags ?? []).slice(0, 8),
    reason: `${reason}.`,
    score: Math.round(score * 100),
    beats: c.beats,
    memes
  };
}
function traceFunny(trace, label, cands) {
  trace.push(`${label}: ${cands.map((c) => `${sid(c.first)}-${sid(c.last)} ${Math.round(c.end - c.start)}s v${Math.round(c.value)}${c.strong ? "" : " weak"} ${c.beats.length}b${c.flaws.length ? ` [${c.flaws.join(",")}]` : ""}${c.moves.length ? ` {${c.moves.join("; ")}}` : ""}`).join(" | ")}`);
}
async function loadMemeLibrary(libraryPath, memesDir) {
  const all = JSON.parse(await node_fs.promises.readFile(libraryPath, "utf8"));
  const have = new Set(await node_fs.promises.readdir(memesDir).catch(() => []));
  return all.filter((m) => have.has(hardware.memeFileName(m)));
}
async function funnyHighlights(o) {
  if (o.legacy) return legacyFunnyHighlights(o);
  return runFunnyAgentic({
    transcript: o.transcript,
    options: o.options,
    laughter: o.laughter,
    library: o.library,
    apiKey: o.apiKey,
    model: o.model,
    log: o.log,
    onProgress: o.onProgress,
    signal: o.signal,
    samples: o.samples,
    sampleOffset: o.offset,
    chat: o.chat,
    cap: o.cap,
    rateLimitWaitMs: o.rateLimitWaitMs
  });
}
async function legacyFunnyHighlights(o) {
  const words2 = o.transcript.words;
  const lines = linesOf(words2);
  const ask2 = { apiKey: o.apiKey, model: o.model, log: o.log, signal: o.signal };
  const bt = await findBeats(lines, o.laughter, ask2, (p) => o.onProgress(p * 0.8, "Finding the jokes…"));
  const clips = chooseClips({ words: words2, lines, evs: o.laughter, beats: bt.beats, want: Math.max(1, Math.round(o.options.clipCount)), duration: o.duration, maxSeconds: o.options.maxClipSeconds, log: o.log });
  const lang = (o.transcript.language || o.options.language || "en").slice(0, 2);
  const highlights = await pickMemes({ clips, lines, words: words2, library: o.library, lang, ask: ask2, onProgress: (p) => o.onProgress(80 + p * 0.2, "Picking memes…") });
  return { highlights, source: bt.source === "ai" ? "ai" : "heuristic" };
}
async function funnyAnalysis(o) {
  const { job, transcript } = o;
  if (!job.memeLibraryPath || !job.memesDir) throw new Error("The meme library is not set up. Download it from the first step of a new project.");
  const library = await loadMemeLibrary(job.memeLibraryPath, job.memesDir);
  if (library.length < 20) throw new Error("The meme library is not downloaded yet. Start a new funny project and download it first.");
  const units = clipUnits(transcript.words, 24, 12);
  let evs = [];
  try {
    evs = await laughWindows({
      modelsDir: job.modelsDir,
      samples: o.samples,
      offset: o.offset,
      lineEnds: units.map((l) => l.end),
      onProgress: (p) => o.onProgress(p * 0.35, "Listening for laughter…"),
      signal: o.signal
    });
  } catch (err) {
    if (o.signal.aborted) throw err;
    o.log(`Laughter detection failed (${err.message}); jokes are found from the words alone.`);
  }
  const laughs = laughEvents(evs, 0.55).length;
  o.log(`Heard ${laughs} laugh${laughs === 1 ? "" : "s"} across ${units.length} lines.`);
  const res = await funnyHighlights({
    transcript,
    options: job.options,
    laughter: evs,
    library,
    apiKey: job.openrouterKey,
    model: job.writingModel,
    duration: o.duration,
    log: o.log,
    onProgress: (p, m) => o.onProgress(35 + p * 0.65, m),
    signal: o.signal,
    samples: o.samples,
    offset: o.offset
  });
  const highlights = res.highlights;
  o.onProgress(100, `${highlights.length} funny clip${highlights.length === 1 ? "" : "s"} found`);
  const first = highlights[0];
  const analysis = {
    summary: highlights.map((h) => h.description).filter(Boolean).join(" ") || "Funny moments from the video.",
    chapters: [],
    highlights,
    script: linesOf(transcript.words).map((l) => l.text).join("\n"),
    social: {
      youtubeTitle: first?.title ?? job.options.projectName,
      youtubeDescription: highlights.map((h) => `• ${h.title}`).join("\n"),
      tiktokCaption: first ? `${first.hook || first.title} ${first.hashtags.map((t) => `#${t}`).join(" ")}`.trim() : "",
      linkedinPost: "",
      tweet: first?.title ?? ""
    },
    source: res.source,
    ...res.model ? { model: res.model } : {}
  };
  await node_fs.promises.writeFile(path.join(job.outputDir, "funny.json"), JSON.stringify({ laughs: evs, highlights, stats: res.stats }, null, 1)).catch(() => void 0);
  return analysis;
}
const WHOLE_FRAME = { x: 0, y: 0, w: 1, h: 1 };
const clamp$4 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const even = (v) => Math.max(2, Math.round(v / 2) * 2);
function cleanRect(r) {
  if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite)) return null;
  const x = clamp$4(r.x, 0, 1);
  const y = clamp$4(r.y, 0, 1);
  const w = clamp$4(r.w, 0, 1 - x);
  const h = clamp$4(r.h, 0, 1 - y);
  return w >= 0.02 && h >= 0.02 ? { x, y, w, h } : null;
}
function fitInside(area, aspect) {
  let w = area.w;
  let h = area.h;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(area.w, even(w));
  h = Math.min(area.h, even(h));
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}
function toPixels(r, srcW, srcH) {
  return { x: r.x * srcW, y: r.y * srcH, w: Math.max(2, r.w * srcW), h: Math.max(2, r.h * srcH) };
}
function settle(r, srcW, srcH) {
  const w = Math.min(even(r.w), srcW - srcW % 2);
  const h = Math.min(even(r.h), srcH - srcH % 2);
  const x = clamp$4(Math.round(r.x / 2) * 2, 0, srcW - w);
  const y = clamp$4(Math.round(r.y / 2) * 2, 0, srcH - h);
  return { x, y, w, h };
}
function camBandHeight(camAspect, W, H) {
  const want = W / Math.max(0.1, camAspect);
  return even(clamp$4(want, H / 3, H / 2));
}
function stackPlan(srcW, srcH, W, H, boxes) {
  const gameShare = cleanRect(boxes?.game) ?? WHOLE_FRAME;
  const camShare = cleanRect(boxes?.cam);
  const gameArea2 = toPixels(gameShare, srcW, srcH);
  if (!camShare || W >= H) {
    return { camH: 0, cam: null, game: settle(fitInside(gameArea2, W / H), srcW, srcH), gameH: H, camBelow: false };
  }
  const camPx = toPixels(camShare, srcW, srcH);
  const camH = camBandHeight(camPx.w / camPx.h, W, H);
  const gameH = H - camH;
  const cam = settle(fitInside(camPx, W / camH), srcW, srcH);
  const game = fitInside(gameArea2, W / gameH);
  const maxShiftX = gameArea2.w * 0.25;
  const overlapX = Math.min(game.x + game.w, camPx.x + camPx.w) - Math.max(game.x, camPx.x);
  const overlapY = Math.min(game.y + game.h, camPx.y + camPx.h) - Math.max(game.y, camPx.y);
  if (overlapX > 0 && overlapY > 0) {
    const camMid = camPx.x + camPx.w / 2;
    const gameMid = game.x + game.w / 2;
    if (game.w < gameArea2.w - 1) {
      const shift = Math.min(maxShiftX, overlapX);
      game.x = camMid < gameMid ? Math.min(gameArea2.x + gameArea2.w - game.w, game.x + shift) : Math.max(gameArea2.x, game.x - shift);
    } else if (game.h < gameArea2.h - 1) {
      const camMidY = camPx.y + camPx.h / 2;
      const gameMidY = game.y + game.h / 2;
      const shift = Math.min(gameArea2.h * 0.25, overlapY);
      game.y = camMidY < gameMidY ? Math.min(gameArea2.y + gameArea2.h - game.h, game.y + shift) : Math.max(gameArea2.y, game.y - shift);
    }
  }
  return { camH, cam, game: settle(game, srcW, srcH), gameH, camBelow: Boolean(boxes?.camBelow) };
}
function stackFilter(plan, W) {
  const g = plan.game;
  if (!plan.cam) return `crop=${g.w}:${g.h}:${g.x}:${g.y},scale=${W}:${plan.gameH}`;
  const c = plan.cam;
  const top = plan.camBelow ? "[stgame][stcam]" : "[stcam][stgame]";
  return `split=2[stc][stg];[stc]crop=${c.w}:${c.h}:${c.x}:${c.y},scale=${W}:${plan.camH}[stcam];[stg]crop=${g.w}:${g.h}:${g.x}:${g.y},scale=${W}:${plan.gameH}[stgame];${top}vstack=inputs=2`;
}
function seamShare(plan, H) {
  if (!plan.cam) return 0;
  return (plan.camBelow ? plan.gameH : plan.camH) / H;
}
function seamCaptionPos(seam) {
  return { x: 0.5, y: clamp$4(seam + 0.045, 0.1, 0.95) };
}
function copySystem(o, language) {
  return `You write the social copy for short vertical clips cut from one video. Audience: ${o.audience || "a general audience"}.${o.mode === "gaming" ? "\nThe video is a gaming live stream: say what happens (the play, the win, the fail, the reaction), and use gaming hashtags (the game's name when it is said)." : ""}
For each clip write:
- "title": max 60 characters, specific to what is said, no clickbait lies.
- "hook": max 8 words, shown on screen in the first seconds. Make it a concrete promise, tension, number or reversal taken from the clip — never a generic "this is amazing". It must make someone want to hear the rest.
- "description": 1-2 sentences.
- "hashtags": 5-8 tags without #.
Write in the language the clip is spoken in (transcript language: ${language || "unknown"}); for Urdu or Hindi use the same script as the transcript. Do not invent anything that is not said.
Answer with JSON only: {"clips":[{"clip":1,"title":"...","hook":"...","description":"...","hashtags":["..."]}]}`;
}
function copyUser(clips, s) {
  return clips.map((c, k) => `Clip ${k + 1}${c.point ? ` (about: ${c.point})` : ""}${c.hookLine !== void 0 && c.hookLine >= c.first && c.hookLine <= c.last ? ` (strongest line: "${s[c.hookLine].text}")` : ""}:
${clipText(c, s, 2400)}`).join("\n\n");
}
function parseCopy(json, count) {
  const list = json?.clips;
  if (!Array.isArray(list)) throw new Error("no clips in the answer");
  const out = new Array(count).fill(null);
  list.forEach((item, k) => {
    const r = item;
    const idx = Number(r.clip ?? k + 1) - 1;
    if (!(idx >= 0 && idx < count)) return;
    const title = String(r.title ?? "").trim();
    if (!title) return;
    const tags = Array.isArray(r.hashtags) ? r.hashtags : String(r.hashtags ?? "").split(/[\s,]+/);
    out[idx] = {
      title: title.slice(0, 80),
      hook: String(r.hook ?? "").trim(),
      description: String(r.description ?? "").trim(),
      hashtags: tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 10)
    };
  });
  return out;
}
const SUMMARY_SYSTEM = `You summarise a video from its transcript. Lines look like: S12 [3:41] text (S12 is the id of the paragraph's first sentence).
Write:
- "summary": 2-4 sentences.
- "chapters": YouTube-style chapters, 3-10 of them, each {"first": the id where it starts, "title": a few words}; the first chapter starts at the first id.
- "social": {"youtubeTitle", "youtubeDescription", "tiktokCaption" (with hashtags), "linkedinPost" (80-150 words, written as the speaker), "tweet" (under 260 characters)}.
Write in the transcript's language (same script); do not invent anything that is not said.
Answer with JSON only: {"summary":"...","chapters":[{"first":"S1","title":"..."}],"social":{...}}`;
function summaryUser(s, language, maxChars = 48e3) {
  const paras = [];
  let cur = null;
  s.forEach((x, i) => {
    if (!cur || x.end - cur.start > 20) {
      if (cur) paras.push({ first: cur.first, text: cur.text.join(" ") });
      cur = { first: i, text: [], start: x.start };
    }
    cur.text.push(x.text);
  });
  if (cur) paras.push({ first: cur.first, text: cur.text.join(" ") });
  const total = paras.reduce((a, p) => a + p.text.length, 0);
  const share = total > maxChars ? maxChars / total : 1;
  const lines = paras.map((p) => {
    const text = share < 1 ? `${p.text.slice(0, Math.max(60, Math.floor(p.text.length * share)))}…` : p.text;
    return `${sid(p.first)} [${clock(s[p.first].start)}] ${text}`;
  });
  return `Language: ${language || "unknown"}.

${lines.join("\n")}`;
}
function parseSummary(json, s) {
  const r = json ?? {};
  const summary = String(r.summary ?? "").trim();
  if (!summary) throw new Error("no summary in the answer");
  const chapters = [];
  for (const c of Array.isArray(r.chapters) ? r.chapters : []) {
    const x = c;
    const i = parseId(x.first ?? x.id, s.length);
    const title = String(x.title ?? "").trim();
    if (i === null || !title) continue;
    if (chapters.some((k) => Math.abs(k.start - s[i].start) < 1)) continue;
    chapters.push({ start: Math.round(s[i].start * 1e3) / 1e3, title });
  }
  chapters.sort((a, b) => a.start - b.start);
  const so = r.social ?? {};
  const str = (k) => String(so[k] ?? "").trim();
  return {
    summary,
    chapters,
    social: { youtubeTitle: str("youtubeTitle"), youtubeDescription: str("youtubeDescription"), tiktokCaption: str("tiktokCaption"), linkedinPost: str("linkedinPost"), tweet: str("tweet") }
  };
}
const SCRIPT_SYSTEM = [
  "You turn a raw spoken transcript into a clean, publish-ready script in the speaker's own voice.",
  "Remove filler words (um, uh, like, you know), false starts, repetition and rambling; keep every idea, fact and the original language; do not add anything that isn't in the transcript.",
  "Output plain text only: paragraphs separated by blank lines, no headings, no markdown, no commentary."
].join("\n");
function scriptChunks(s, maxWords = 1200) {
  const out = [];
  let cur = [];
  let words2 = 0;
  for (const x of s) {
    const n = x.to - x.from + 1;
    if (words2 + n > maxWords && cur.length) {
      out.push(cur.join(" "));
      cur = [];
      words2 = 0;
    }
    cur.push(x.text);
    words2 += n;
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}
const REQUEST_CAP = 15;
async function agenticAnalysis(o) {
  return (await runAgentic(o)).analysis;
}
async function agenticAnalysisStaged(o) {
  const { analysis, rest } = await runAgenticStaged(o);
  return { analysis, rest };
}
async function runAgentic(o) {
  const t0 = Date.now();
  const { analysis, stats, rest } = await runAgenticStaged(o);
  const later = await rest;
  stats.wallMs = Date.now() - t0;
  return { analysis: { ...analysis, ...later }, stats };
}
async function runAgenticStaged(o) {
  const t0 = Date.now();
  const { transcript, options } = o;
  const want = Math.max(1, Math.round(options.clipCount));
  const trace = [];
  const cancelled = () => {
    if (o.signal?.aborted) throw new Error("Cancelled");
  };
  const lim = { minSeconds: options.minClipSeconds, maxSeconds: options.maxClipSeconds, lang: transcript.language || options.language };
  const s = clipUnits(transcript.words, 120, Math.max(12, options.maxClipSeconds * 0.75));
  const base = heuristicAnalysis(transcript, { ...options, clipCount: 0 });
  const stats = {
    requests: 0,
    cap: o.cap ?? REQUEST_CAP,
    byStage: {},
    skipped: [],
    models: [],
    proposed: 0,
    checked: 0,
    compareRounds: 0,
    edgeFixes: 0,
    replaced: 0,
    laughter: "none",
    wallMs: 0,
    trace
  };
  if (!s.length) return { analysis: { ...base, highlights: [] }, stats, rest: Promise.resolve({}) };
  o.onProgress(3, "Reading the talk…");
  const laughter = o.laughter;
  if (laughter) stats.laughter = "given";
  let sig = sentenceSignals(s, { samples: o.samples, offset: o.sampleOffset, laughter, ...gamingWords(o) });
  cancelled();
  const rawChat = o.chat ?? (o.apiKey ? openRouterChat({ apiKey: o.apiKey, model: o.model, log: o.log, signal: o.signal }) : null);
  const brief = buildBrief(options);
  if (brief.text) o.log(rawChat ? `Following the creator's instructions (${brief.chars} characters${brief.truncated ? `, the first ${MAX_BRIEF_CHARS} used` : ""}).` : "Instructions were given, but they need an AI service to be followed; the built-in search cannot read them.");
  const chatFn = rawChat ? withBrief(rawChat, brief.text) : null;
  let analysis;
  let rest = Promise.resolve({});
  if (!chatFn) {
    o.onProgress(40, "Finding the moments…");
    let pool0 = checkCandidates(rulesProposals(s, sig, options, want * 3), s, sig, lim, want * 2);
    const heard2 = await listenToEndings(o, s, pool0, stats);
    if (heard2) {
      sig = heard2;
      pool0 = pool0.map((c) => ({ ...c, bonus: signalBonus(sig, c.first, c.last) }));
    }
    pool0 = pool0.sort((a, b) => value(b) - value(a)).slice(0, want);
    stats.proposed = pool0.length;
    stats.checked = pool0.length;
    traceCandidates(trace, "rules", pool0);
    analysis = { ...base, highlights: toHighlights(pool0, s, options, null, false), source: "heuristic" };
  } else {
    ({ analysis, rest } = await withModel(o, chatFn, s, sig, lim, want, base, stats));
  }
  stats.wallMs = Date.now() - t0;
  o.onProgress(100, `${analysis.highlights.length} highlight${analysis.highlights.length === 1 ? "" : "s"} chosen`);
  return { analysis, stats, rest };
}
async function withModel(o, chat2, s, sig0, lim, want, base, stats) {
  const { options, transcript } = o;
  const trace = stats.trace;
  let sig = sig0;
  const budget = new Budget(stats.cap);
  const cancelled = () => {
    if (o.signal?.aborted) throw new Error("Cancelled");
  };
  const common = { budget, chat: chat2, log: o.log, signal: o.signal, rateLimitWaitMs: o.rateLimitWaitMs };
  const RESERVE = 3;
  const chunks = chunkSentences(s);
  const lines = markLines(s, sig);
  const total = Math.max(1, s[s.length - 1].end - s[0].start);
  const allowRetry = budget.cap - chunks.length * 2 >= RESERVE + 2;
  let done = 0;
  o.onProgress(10, `Proposing moments (${chunks.length} part${chunks.length === 1 ? "" : "s"})…`);
  const answers = await pool(
    chunks.map((ch) => async () => {
      const share = (s[ch[1]].end - s[ch[0]].start) / total;
      const k = Math.max(2, Math.ceil(2 * want * share) + 1);
      const r = await ask({
        ...common,
        req: { stage: "propose", system: proposeSystem(options, k), user: lines.slice(ch[0], ch[1] + 1).join("\n"), maxTokens: 500 + 220 * k, temperature: 0.4 },
        parse: (j) => parseProposals(j, s.length, ch),
        allowRetry,
        // With one or two parts, one failed part is half the talk: worth a third try, as long
        // as the stages after it keep their requests.
        attempts: chunks.length <= 2 ? 3 : 2,
        reserve: RESERVE + 2
      });
      o.onProgress(10 + ++done / chunks.length * 25, `Proposing moments (${done}/${chunks.length})…`);
      return r.value;
    }),
    3
  );
  cancelled();
  const proposals = [];
  answers.forEach((a, k) => {
    const ch = chunks[k];
    if (a) {
      proposals.push(...a);
      trace.push(`propose ${sid(ch[0])}-${sid(ch[1])}: ${a.map((p) => `${sid(p.first)}-${sid(p.last)} (${p.score}) ${p.why}`).join(" | ") || "nothing"}`);
    } else {
      const share = (s[ch[1]].end - s[ch[0]].start) / total;
      proposals.push(...rulesProposals(s, sig, options, Math.max(2, Math.ceil(2 * want * share)), ch));
      trace.push(`propose ${sid(ch[0])}-${sid(ch[1])}: failed, rules instead`);
    }
  });
  const modelAnswered = answers.some(Boolean);
  if (!modelAnswered) budget.skip("propose", budget.dead ?? "no answer");
  stats.proposed = proposals.length;
  o.onProgress(38, "Checking the edges…");
  let pool1 = checkCandidates(proposals, s, sig, lim, want * 2);
  if (pool1.length < want) {
    const extra = checkCandidates(rulesProposals(s, sig, options, want * 4), s, sig, lim, want * 4);
    for (const c of extra) {
      if (pool1.length >= Math.max(want, Math.ceil(want * 1.5))) break;
      if (pool1.some((p) => overlapSeconds(p, c) > 1)) continue;
      pool1.push(c);
    }
    trace.push(`check: only ${pool1.length} after rules fill`);
  }
  const heard2 = await listenToEndings(o, s, pool1, stats);
  if (heard2) {
    sig = heard2;
    pool1 = pool1.map((c) => ({ ...c, bonus: signalBonus(sig, c.first, c.last) }));
  }
  stats.checked = pool1.length;
  traceCandidates(trace, "checked", pool1);
  let ranked = [...pool1].sort((a, b) => value(b) - value(a));
  let compared = false;
  if (pool1.length > want && !budget.dead) {
    const maxCalls = Math.min(4, budget.remaining() - RESERVE - 1);
    const perRound = Math.floor(pool1.length / 2);
    const pairsPerCall = Math.max(1, Math.min(6, perRound));
    if (maxCalls >= 1) {
      o.onProgress(45, "Comparing the moments…");
      try {
        const res = await swissRank(
          pool1.length,
          pool1.map(value),
          async (pairs) => {
            const { user, flip } = compareUser(pairs, pool1, s, sig);
            const r = await ask({ ...common, req: { stage: "compare", system: COMPARE_SYSTEM, user, maxTokens: 200 + 90 * pairs.length, temperature: 0.2 }, parse: (j) => parseCompare(j, pairs.length, flip), allowRetry: budget.remaining() > RESERVE + 1, attempts: 3, reserve: RESERVE });
            return r.value;
          },
          { rounds: 3, pairsPerCall, maxCalls, parallel: 2 }
        );
        stats.compareRounds = res.rounds;
        if (res.rounds > 0) {
          compared = true;
          ranked = res.order.map((i) => ({ ...pool1[i], wins: res.wins[i], games: res.games[i] }));
          trace.push(`compare: ${res.rounds} rounds, ${res.calls} calls; order ${ranked.map((c) => `${sid(c.first)}(${c.wins}/${c.games})`).join(" ")}`);
        } else budget.skip("compare", budget.dead ?? "no answer");
      } catch (err) {
        cancelled();
        budget.skip("compare", err.message);
      }
    } else budget.skip("compare", "no requests left");
  }
  cancelled();
  const clean2 = ranked.filter((c) => !c.flaws.some(isHardFlaw));
  const ordered = [...clean2, ...ranked.filter((c) => c.flaws.some(isHardFlaw))];
  const brief = buildBrief(options).text;
  let finalists = ordered.slice(0, brief ? Math.min(ordered.length, want * 2) : want);
  let bench = clean2.filter((c) => !finalists.includes(c));
  let vetted = null;
  if (!budget.dead && budget.remaining() >= 3) {
    o.onProgress(62, "Reading each clip cold…");
    try {
      const r = await ask({
        ...common,
        req: { stage: "coldread", system: coldReadSystem(Boolean(brief)), user: coldReadUser(finalists, s), maxTokens: brief ? 600 + 360 * finalists.length : 300 + 220 * finalists.length, temperature: 0.2 },
        parse: (j) => parseColdRead(j, finalists.length, s.length),
        allowRetry: true,
        attempts: 3,
        reserve: 2
      });
      if (brief) {
        const follows = finalists.filter((c, k) => {
          const said = r.value.find((x) => x.clip === k)?.follows;
          return said === true || said == null && c.origin === "model";
        });
        const kept2 = follows.length ? follows : finalists.filter((c) => c.origin === "model");
        const dropped = finalists.length - kept2.length;
        if (dropped) trace.push(`cold read: ${dropped} of ${finalists.length} do not follow the instructions${follows.length ? "" : " (all turned down; keeping the proposer's own)"}`);
        const verdictFor = new Map(finalists.map((c, k) => [c, r.value.find((x) => x.clip === k)]));
        finalists = kept2.slice(0, want);
        bench = kept2.slice(want);
        vetted = new Set(kept2);
        r.value = finalists.map((c, k) => {
          const v = verdictFor.get(c);
          return v ? { ...v, clip: k } : { clip: k, point: "", standsAlone: true, first: null, last: null, note: "", follows: null };
        });
      }
      const flagged = r.value.filter((v) => !v.standsAlone).length;
      const trustFlags = flagged <= Math.floor(finalists.length / 2);
      let swaps = Math.max(1, Math.ceil(want / 3));
      if (!trustFlags && flagged) trace.push(`cold read: ${flagged} of ${finalists.length} flagged, not trusted`);
      const before = finalists;
      finalists = before.map((c, k) => {
        const v = r.value.find((x) => x.clip === k);
        const applied = applyVerdict(c, v, s, lim);
        if (applied.changed && !before.some((x, j) => j !== k && overlapSeconds(x, applied.candidate) > 1)) {
          stats.edgeFixes++;
          trace.push(`cold read ${k + 1}: ${applied.candidate.moves[applied.candidate.moves.length - 1]}`);
          return applied.candidate;
        }
        const kept2 = applied.changed ? { ...c, point: applied.candidate.point } : applied.candidate;
        if (applied.weak && trustFlags && v?.note && swaps > 0) {
          const share = (x) => x.games ? (x.wins ?? 0) / x.games : 0.5;
          const sub = bench.findIndex((b) => !before.some((x) => overlapSeconds(x, b) > 1) && share(b) >= share(c));
          trace.push(`cold read ${k + 1}: does not stand alone (${v.note})${sub >= 0 ? `, replaced by ${sid(bench[sub].first)}-${sid(bench[sub].last)}` : ", kept (nothing better)"}`);
          if (sub >= 0) {
            swaps--;
            stats.replaced++;
            return bench.splice(sub, 1)[0];
          }
        }
        return kept2;
      });
    } catch (err) {
      cancelled();
      budget.skip("coldread", err.message);
    }
  } else budget.skip("coldread", budget.dead ?? "no requests left");
  cancelled();
  if (brief && !vetted) {
    const own2 = finalists.filter((c) => c.origin === "model");
    if (own2.length) {
      trace.push(`cold read unavailable: keeping the ${own2.length} the proposer picked with the instructions`);
      vetted = /* @__PURE__ */ new Set([...own2, ...bench.filter((c) => c.origin === "model")]);
      bench = bench.filter((c) => vetted.has(c));
      finalists = own2.slice(0, want);
    } else finalists = finalists.slice(0, want);
  }
  const kept = [];
  for (const c of finalists) if (!kept.some((k) => overlapSeconds(k, c) > 1)) kept.push(c);
  for (const b of bench) {
    if (kept.length >= want) break;
    if (vetted && !vetted.has(b)) continue;
    if (!kept.some((k) => overlapSeconds(k, b) > 1)) kept.push(b);
  }
  finalists = kept;
  if (vetted && finalists.length < want) {
    o.log(`Only ${finalists.length} moment${finalists.length === 1 ? "" : "s"} in this video match${finalists.length === 1 ? "es" : ""} your instructions, so SNU Clipper made ${finalists.length} clip${finalists.length === 1 ? "" : "s"} instead of ${want}.`);
  }
  o.onProgress(75, "Writing titles…");
  finalists.sort((a, b) => a.start - b.start);
  const language = transcript.language || options.language;
  const quiet = (p) => p.then((r) => r.value, (err) => {
    if (err.message === "Cancelled") throw err;
    return void 0;
  });
  const copyAsked = quiet(ask({ ...common, req: { stage: "copy", system: copySystem(options, language), user: copyUser(finalists, s), maxTokens: 400 + 260 * finalists.length, temperature: 0.5 }, parse: (j) => parseCopy(j, finalists.length), allowRetry: true, attempts: 3 }));
  const summaryAsked = quiet(ask({ ...common, req: { stage: "summary", system: SUMMARY_SYSTEM, user: summaryUser(s, language), maxTokens: 2500, temperature: 0.4 }, parse: (j) => parseSummary(j, s), allowRetry: true, attempts: 3 }));
  summaryAsked.catch(() => void 0);
  const copyRes = await copyAsked;
  cancelled();
  if (!copyRes) budget.skip("copy", budget.dead ?? "no answer");
  const copy = copyRes ?? null;
  const highlights = toHighlights(finalists, s, options, copy, compared);
  const analysis = {
    ...base,
    highlights,
    source: budget.ok > 0 ? "ai" : "heuristic",
    ...budget.models.size ? { model: [...budget.models].join(", ") } : {}
  };
  const rest = (async () => {
    const summary = await summaryAsked ?? null;
    cancelled();
    if (!summary) budget.skip("summary", budget.dead ?? "no answer");
    let script = base.script;
    if (o.cleanScript !== false && !budget.dead && budget.remaining() > 0) {
      const parts = scriptChunks(s);
      const n = Math.min(parts.length, budget.remaining());
      o.log(`Writing the clean script${n < parts.length ? ` (${n} of ${parts.length} parts)` : ""} while the clips render…`);
      const cleaned = await pool(
        parts.slice(0, n).map((raw) => async () => (await ask({
          ...common,
          req: { stage: "script", system: SCRIPT_SYSTEM, user: raw, maxTokens: Math.min(8e3, Math.max(1200, Math.round(raw.split(/\s+/).length * 2.2))), temperature: 0.3 },
          parse: (t) => {
            const text = String(t).trim();
            if (text.length < raw.length * 0.25) throw new Error("script part came back too short");
            return text;
          },
          text: true,
          allowRetry: false
        })).value),
        2
      );
      if (cleaned.some(Boolean)) script = parts.map((raw, k) => cleaned[k] ?? raw).join("\n\n").trim();
    }
    const models = [...budget.models];
    stats.requests = budget.used;
    stats.byStage = { ...budget.byStage };
    stats.skipped = [...budget.skipped];
    stats.models = models;
    o.log(`AI requests: ${budget.used} of ${budget.cap} (${Object.entries(budget.byStage).map(([k, v]) => `${k} ${v}`).join(", ")})${budget.skipped.length ? `; skipped ${budget.skipped.join(", ")}` : ""}.`);
    if (budget.dead) o.log(`AI writing stopped early: ${budget.dead}. SNU Clipper's own search filled in.`);
    return {
      summary: summary?.summary || base.summary,
      chapters: summary?.chapters.length ? summary.chapters : base.chapters,
      script,
      social: summary ? mergeSocial(summary.social, base.social) : base.social,
      ...models.length ? { model: models.join(", ") } : {}
    };
  })().catch((err) => {
    if (err.message !== "Cancelled") o.log(`The summary and script were not written (${err.message}); SNU Clipper's own stand in.`);
    return {};
  });
  return { analysis, rest };
}
function mergeSocial(a, b) {
  return {
    youtubeTitle: a.youtubeTitle || b.youtubeTitle,
    youtubeDescription: a.youtubeDescription || b.youtubeDescription,
    tiktokCaption: a.tiktokCaption || b.tiktokCaption,
    linkedinPost: a.linkedinPost || b.linkedinPost,
    tweet: a.tweet || b.tweet
  };
}
const MAX_LAUGH_WINDOWS = 24;
async function listenToEndings(o, s, cands, stats) {
  if (o.laughter || !o.samples || !laughterModelPresent(o.modelsDir)) return null;
  const ends = /* @__PURE__ */ new Set();
  for (const c of [...cands].sort((a, b) => value(b) - value(a))) {
    for (const i of [c.last, c.last - 1]) if (i >= c.first && ends.size < MAX_LAUGH_WINDOWS) ends.add(i);
  }
  if (!ends.size) return null;
  const t = Date.now();
  try {
    o.onProgress(40, "Listening for laughter…");
    const heard2 = await laughWindows({
      modelsDir: o.modelsDir,
      samples: o.samples,
      offset: o.sampleOffset ?? 0,
      lineEnds: [...ends].sort((a, b) => a - b).map((i) => s[i].end),
      onProgress: () => {
      },
      signal: o.signal
    });
    stats.laughter = "heard";
    o.log(`Listened for laughter after ${ends.size} candidate endings in ${((Date.now() - t) / 1e3).toFixed(0)}s.`);
    return sentenceSignals(s, { samples: o.samples, offset: o.sampleOffset, laughter: heard2, ...gamingWords(o) });
  } catch (err) {
    if (o.signal?.aborted) throw err;
    o.log(`Laughter detection skipped (${err.message}).`);
    return null;
  }
}
function gamingWords(o) {
  return o.options.mode === "gaming" ? { gamingWords: o.transcript.words } : {};
}
function traceCandidates(trace, label, cands) {
  trace.push(`${label}: ${cands.map((c) => `${sid(c.first)}-${sid(c.last)} ${Math.round(c.end - c.start)}s v${Math.round(value(c))}${c.flaws.length ? ` [${c.flaws.join(",")}]` : ""}${c.moves.length ? ` {${c.moves.join("; ")}}` : ""}`).join(" | ")}`);
}
function bestHookLine(cands, s, fallback) {
  let best = { p: -Infinity, t: fallback };
  for (let i = cands.first; i <= cands.last && i < s.length; i++) {
    const p = hookPower(s[i].text);
    if (p > best.p) best = { p, t: s[i].text };
  }
  return best.t;
}
function toHighlights(cands, s, options, copy, compared) {
  const sorted = [...cands].sort((a, b) => a.start - b.start);
  return sorted.map((c, i) => {
    const k = cands.indexOf(c);
    const text = s.slice(c.first, c.last + 1).map((x) => x.text).join(" ");
    const cp = copy?.[k] ?? null;
    const winShare = compared && c.games ? (c.wins ?? 0) / c.games : null;
    const score = winShare === null ? c.score + c.bonus : 0.6 * c.score + 40 * winShare + c.bonus / 2;
    const reason = [c.why, c.point && c.point !== c.why ? `Point: ${c.point}` : "", winShare !== null && c.games ? `Won ${c.wins} of ${c.games} comparisons.` : ""].filter(Boolean).join(" ");
    return {
      id: `h${i + 1}`,
      start: round$4(c.start),
      end: round$4(c.end),
      title: cp?.title || makeTitle(text) || "Clip",
      hook: cp?.hook || firstSentence(bestHookLine(c, s, text)).split(/\s+/).slice(0, 9).join(" ").replace(/[,.;:!?۔؟।]+$/, ""),
      description: cp?.description || truncate(text, 180),
      hashtags: cp?.hashtags.length ? cp.hashtags : defaultHashtags(options.audience),
      reason: reason || "Chosen for a clean start, a finished thought and what is said.",
      score: Math.max(0, Math.min(100, Math.round(score)))
    };
  });
}
function round$4(n) {
  return Math.round(n * 1e3) / 1e3;
}
const YUNET_SIZE = 640;
let loaded = null;
function loadOrt() {
  const req = require;
  const fromDir = path.dirname(req.resolve("@huggingface/transformers"));
  return req(req.resolve("onnxruntime-node", { paths: [fromDir] }));
}
async function loadYunet(modelPath) {
  if (loaded) return loaded;
  const ort = loadOrt();
  const session = await ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"] });
  loaded = { ort, session };
  return loaded;
}
async function detectFaces(bgr, modelPath, minScore = 0.6) {
  const { ort, session } = await loadYunet(modelPath);
  const n = YUNET_SIZE * YUNET_SIZE;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = bgr[i * 3];
    input[n + i] = bgr[i * 3 + 1];
    input[2 * n + i] = bgr[i * 3 + 2];
  }
  const out = await session.run({ input: new ort.Tensor("float32", input, [1, 3, YUNET_SIZE, YUNET_SIZE]) });
  const faces = [];
  for (const stride of [8, 16, 32]) {
    const cls = out[`cls_${stride}`].data;
    const obj = out[`obj_${stride}`].data;
    const box = out[`bbox_${stride}`].data;
    const kps = out[`kps_${stride}`].data;
    const cols = YUNET_SIZE / stride;
    for (let idx = 0; idx < cls.length; idx++) {
      const score = Math.sqrt(Math.min(1, Math.max(0, cls[idx])) * Math.min(1, Math.max(0, obj[idx])));
      if (score < minScore) continue;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const cx = (c + box[idx * 4]) * stride;
      const cy = (r + box[idx * 4 + 1]) * stride;
      const w = Math.exp(box[idx * 4 + 2]) * stride;
      const h = Math.exp(box[idx * 4 + 3]) * stride;
      const points = [];
      for (let k = 0; k < 5; k++) points.push([(kps[idx * 10 + 2 * k] + c) * stride, (kps[idx * 10 + 2 * k + 1] + r) * stride]);
      faces.push({ x: cx - w / 2, y: cy - h / 2, w, h, score, kps: points });
    }
  }
  return suppress(faces, 0.3);
}
function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}
function suppress(faces, threshold) {
  const kept = [];
  for (const f of faces.sort((a, b) => b.score - a.score)) if (!kept.some((k) => iou(k, f) > threshold)) kept.push(f);
  return kept;
}
const DW = 640;
const DH = 360;
const CW = DW / 2;
const CH = DH / 2;
const DETECT_FPS = 2;
const DETECT_SECONDS = 120;
const WINDOW_SECONDS$1 = 30;
class CamEvidence {
  ex = new Uint16Array(DW * DH);
  ey = new Uint16Array(DW * DH);
  n = 0;
  sD = new Float64Array(CW * CH);
  sDD = new Float64Array(CW * CH);
  sDG = new Float64Array(CW * CH);
  sG = 0;
  sGG = 0;
  steps = 0;
  prev = null;
  small = new Float32Array(CW * CH);
  diff = new Float32Array(CW * CH);
  hist = new Uint32Array(1024);
  faces = [];
  /** The next frame does not follow the last one (a new stretch of the video). */
  breakRun() {
    this.prev = null;
  }
  /** `gray` is 640x360. `faces` is set on the frames faces were looked for (even when none were found). */
  add(gray, faces) {
    if (faces) this.faces.push(faces);
    sobelCount(gray, this.ex, this.ey);
    this.n++;
    const s = this.small;
    for (let y = 0; y < CH; y++) {
      const r0 = 2 * y * DW;
      const r1 = r0 + DW;
      for (let x = 0; x < CW; x++) {
        const c = 2 * x;
        s[y * CW + x] = (gray[r0 + c] + gray[r0 + c + 1] + gray[r1 + c] + gray[r1 + c + 1]) * 0.25;
      }
    }
    if (this.prev) {
      const d = this.diff;
      this.hist.fill(0);
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(s[i] - this.prev[i]);
        d[i] = v;
        this.hist[Math.min(1023, Math.round(v * 4))]++;
      }
      const g = histMedian$1(this.hist, d.length) / 4;
      for (let i = 0; i < d.length; i++) {
        const v = d[i];
        this.sD[i] += v;
        this.sDD[i] += v * v;
        this.sDG[i] += v * g;
      }
      this.sG += g;
      this.sGG += g * g;
      this.steps++;
      this.prev.set(s);
    } else {
      this.prev = new Float32Array(s);
    }
  }
  /** How much each pixel moves with the game, 640x360 (a pixel of the cam is well below the median). */
  correlation() {
    const n = Math.max(1, this.steps);
    const vG = this.sGG - this.sG * this.sG / n;
    const corr = new Float32Array(CW * CH);
    for (let i = 0; i < corr.length; i++) {
      const cov = this.sDG[i] - this.sD[i] * this.sG / n;
      const vD = this.sDD[i] - this.sD[i] * this.sD[i] / n;
      corr[i] = cov / (Math.sqrt(Math.max(0, vD * vG)) + 1e-6);
    }
    return upsample2x(blur3(corr, CW, CH), CW, CH);
  }
  decide() {
    const full = [0, 0, DW, DH];
    const faceFrames = this.faces.length;
    const base = { frames: this.n, faceFrames };
    if (this.n < 8 || this.steps < 4) return { cam: null, reason: "too few frames", game: full, ...base };
    const corr = this.correlation();
    const med = median$1(corr);
    const camlike = new Uint8Array(DW * DH);
    for (let i = 0; i < camlike.length; i++) camlike[i] = corr[i] < 0.5 * med ? 1 : 0;
    const integral = integralOf(camlike);
    const all = this.faces.flat();
    const noCam = (reason) => ({ cam: null, reason, game: gameArea(camlike, null), ...base });
    if (all.length < 0.3 * faceFrames || !all.length) return noCam("no steady face");
    const centres = all.map((f) => [f.x + f.w / 2, f.y + f.h / 2]);
    let best = 0;
    let bestCount = -1;
    for (let i = 0; i < centres.length; i++) {
      let c = 0;
      for (const q of centres) if (Math.hypot(q[0] - centres[i][0], q[1] - centres[i][1]) < 20) c++;
      if (c > bestCount) bestCount = c, best = i;
    }
    if (bestCount < 0.3 * faceFrames) return noCam("face not steady");
    const c0 = centres[best];
    const members2 = all.filter((_, i) => Math.hypot(centres[i][0] - c0[0], centres[i][1] - c0[1]) < 20);
    const face = {
      x: median$1(members2.map((f) => f.x)),
      y: median$1(members2.map((f) => f.y)),
      w: median$1(members2.map((f) => f.w)),
      h: median$1(members2.map((f) => f.h))
    };
    const { x: fx, y: fy, w: fw, h: fh } = face;
    const half = this.n / 2;
    const rowsA = Math.trunc(fy);
    const rowsB = Math.min(DH, Math.trunc(fy + fh));
    const colsA = Math.trunc(fx);
    const colsB = Math.min(DW, Math.trunc(fx + fw));
    const vprof = new Float32Array(DW);
    for (let x = 0; x < DW; x++) {
      let c = 0;
      for (let y = rowsA; y < rowsB; y++) if (this.ex[y * DW + x] > half) c++;
      vprof[x] = c / Math.max(1, rowsB - rowsA);
    }
    const hprof = new Float32Array(DH);
    for (let y = 0; y < DH; y++) {
      let c = 0;
      for (let x = colsA; x < colsB; x++) if (this.ey[y * DW + x] > half) c++;
      hprof[y] = c / Math.max(1, colsB - colsA);
    }
    const R = 5;
    const L = [...peaks(vprof, fx - R * fw, fx - 1), 0];
    const Rr = [...peaks(vprof, fx + fw + 1, fx + fw + R * fw), DW];
    const T = [...peaks(hprof, fy - R * fh, fy - 1), 0];
    const B = [...peaks(hprof, fy + fh + 1, fy + fh + R * fh), DH];
    const ex = this.ex;
    const ey = this.ey;
    const support = (vertical, at, a0, b0) => {
      const a = Math.trunc(Math.max(0, a0));
      const b = Math.trunc(Math.min(vertical ? DH : DW, b0));
      if (b - a < 4) return 0;
      const frameEdge = vertical ? at === 0 || at === DW : at === 0 || at === DH;
      if (frameEdge) {
        const r = vertical ? at === 0 ? [0, a, 4, b] : [DW - 4, a, DW, b] : at === 0 ? [a, 0, b, 4] : [a, DH - 4, b, DH];
        return rectSum(integral, r[0], r[1], r[2], r[3]) / ((r[2] - r[0]) * (r[3] - r[1])) * 0.9;
      }
      let hits = 0;
      for (let k = a; k < b; k++) {
        let m = 0;
        for (let j = Math.max(0, at - 1); j <= Math.min((vertical ? DW : DH) - 1, at + 1); j++) {
          m = Math.max(m, vertical ? ex[k * DW + j] : ey[j * DW + k]);
        }
        if (m > half) hits++;
      }
      return hits / (b - a);
    };
    let found = null;
    for (const l of L) for (const r of Rr) for (const t of T) for (const b of B) {
      const w = r - l;
      const h = b - t;
      if (h < 1.4 * fh || w < 1.4 * fw || !(w / h >= 0.8 && w / h <= 2.4)) continue;
      if (w * h > 0.35 * DW * DH) continue;
      const sup = support(true, l, t, b) + support(true, r, t, b) + support(false, t, l, r) + support(false, b, l, r);
      const inside = rectSum(integral, l, t, r, b) / (w * h);
      const ring = [
        [l, Math.max(0, t - 6), r, t],
        [l, b, r, Math.min(DH, b + 6)],
        [Math.max(0, l - 6), t, l, b],
        [r, t, Math.min(DW, r + 6), b]
      ];
      let ringSum = 0;
      let ringN = 0;
      for (const [x0, y0, x1, y1] of ring) {
        if (x1 <= x0 || y1 <= y0) continue;
        ringSum += rectSum(integral, x0, y0, x1, y1);
        ringN += (x1 - x0) * (y1 - y0);
      }
      const outside = ringN ? ringSum / ringN : 0;
      const score = sup / 3 + (inside - outside);
      if (!found || score > found.score) found = { score, box: [l, t, r, b], sup, inside, outside };
    }
    if (!found) return noCam("no rectangle around the face");
    const cam = {
      box: found.box,
      game: [0, 0, DW, DH],
      score: round2(found.score),
      support: round2(found.sup / 4),
      inside: round2(found.inside),
      ring: round2(found.outside),
      face
    };
    if (cam.score < MIN_SCORE || cam.support < 0.45) return { ...noCam(`no clear box around the face (score ${cam.score})`) };
    const game = gameArea(camlike, cam.box);
    cam.game = game;
    return { cam, game, ...base };
  }
}
const MIN_SCORE = 1.2;
function confidenceOf(score) {
  return round2(Math.max(0, Math.min(1, (score - 1) / 1.2)));
}
function gameArea(camlike, cam) {
  const inCam = (x, y) => cam !== null && x >= cam[0] && x < cam[2] && y >= cam[1] && y < cam[3];
  const colN = new Uint32Array(DW);
  const colG = new Uint32Array(DW);
  const rowN = new Uint32Array(DH);
  const rowG = new Uint32Array(DH);
  for (let y = 0; y < DH; y++) {
    for (let x = 0; x < DW; x++) {
      if (inCam(x, y)) continue;
      const g = camlike[y * DW + x] ? 0 : 1;
      colN[x]++;
      rowN[y]++;
      colG[x] += g;
      rowG[y] += g;
    }
  }
  const run = (g, n, len2) => {
    let bestA = 0;
    let bestB = len2;
    let bestLen = -1;
    let a = -1;
    for (let i = 0; i <= len2; i++) {
      const on = i < len2 && n[i] > 0 && g[i] / n[i] >= 0.4;
      if (on && a < 0) a = i;
      if (!on && a >= 0) {
        if (i - a > bestLen) bestLen = i - a, bestA = a, bestB = i;
        a = -1;
      }
    }
    if (bestLen < 0.6 * len2) return [0, len2];
    return [bestA <= len2 * 0.01 ? 0 : bestA, bestB >= len2 * 0.99 ? len2 : bestB];
  };
  const [x0, x1] = run(colG, colN, DW);
  const [y0, y1] = run(rowG, rowN, DH);
  return [x0, y0, x1, y1];
}
function peaks(profile, lo0, hi0, k = 6, sep = 3) {
  const lo = Math.max(0, Math.trunc(lo0));
  const hi = Math.min(profile.length - 1, Math.trunc(hi0));
  const idx = [];
  for (let i = lo; i <= hi; i++) idx.push(i);
  idx.sort((a, b) => profile[b] - profile[a]);
  const out = [];
  for (const i of idx) {
    if (profile[i] < 0.25 || out.length >= k) break;
    if (out.every((j) => Math.abs(i - j) > sep)) out.push(i);
  }
  return out;
}
function sobelCount(g, ex, ey) {
  const W = DW;
  const H = DH;
  for (let y = 0; y < H; y++) {
    const up = (y === 0 ? 1 : y - 1) * W;
    const mid = y * W;
    const dn = (y === H - 1 ? H - 2 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const l = x === 0 ? 1 : x - 1;
      const r = x === W - 1 ? W - 2 : x + 1;
      const gx = g[up + r] + 2 * g[mid + r] + g[dn + r] - g[up + l] - 2 * g[mid + l] - g[dn + l];
      const gy = g[dn + l] + 2 * g[dn + x] + g[dn + r] - g[up + l] - 2 * g[up + x] - g[up + r];
      if (gx > 30 || gx < -30) ex[mid + x]++;
      if (gy > 30 || gy < -30) ey[mid + x]++;
    }
  }
}
function blur3(src, W, H) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = x === 0 ? 1 : x - 1;
      const r = x === W - 1 ? W - 2 : x + 1;
      tmp[y * W + x] = 0.25 * src[y * W + l] + 0.5 * src[y * W + x] + 0.25 * src[y * W + r];
    }
  }
  for (let y = 0; y < H; y++) {
    const u = y === 0 ? 1 : y - 1;
    const d = y === H - 1 ? H - 2 : y + 1;
    for (let x = 0; x < W; x++) out[y * W + x] = 0.25 * tmp[u * W + x] + 0.5 * tmp[y * W + x] + 0.25 * tmp[d * W + x];
  }
  return out;
}
function upsample2x(src, W, H) {
  const W2 = W * 2;
  const H2 = H * 2;
  const out = new Float32Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    const sy = Math.max(0, Math.min(H - 1, (y + 0.5) / 2 - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(H - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < W2; x++) {
      const sx = Math.max(0, Math.min(W - 1, (x + 0.5) / 2 - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(W - 1, x0 + 1);
      const fx = sx - x0;
      const top = src[y0 * W + x0] * (1 - fx) + src[y0 * W + x1] * fx;
      const bot = src[y1 * W + x0] * (1 - fx) + src[y1 * W + x1] * fx;
      out[y * W2 + x] = top * (1 - fy) + bot * fy;
    }
  }
  return out;
}
function integralOf(m) {
  const I = new Uint32Array((DW + 1) * (DH + 1));
  for (let y = 0; y < DH; y++) {
    let row = 0;
    for (let x = 0; x < DW; x++) {
      row += m[y * DW + x];
      I[(y + 1) * (DW + 1) + x + 1] = I[y * (DW + 1) + x + 1] + row;
    }
  }
  return I;
}
function rectSum(I, x0, y0, x1, y1) {
  const S = DW + 1;
  return I[y1 * S + x1] - I[y0 * S + x1] - I[y1 * S + x0] + I[y0 * S + x0];
}
function histMedian$1(hist, n) {
  const want = (k) => {
    let acc = 0;
    for (let i = 0; i < hist.length; i++) {
      acc += hist[i];
      if (acc > k) return i;
    }
    return hist.length - 1;
  };
  return n % 2 ? want((n - 1) / 2) : (want(n / 2 - 1) + want(n / 2)) / 2;
}
function median$1(xs) {
  if (!xs.length) return 0;
  const s = Float64Array.from(xs).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round2 = (v) => Math.round(v * 100) / 100;
function grayOf(bgr, out = new Uint8Array(DW * DH)) {
  for (let i = 0, p = 0; i < out.length; i++, p += 3) out[i] = bgr[p] * 1868 + bgr[p + 1] * 9617 + bgr[p + 2] * 4899 + 8192 >> 14;
  return out;
}
function detectWindows(duration2, total = DETECT_SECONDS, windowSeconds = WINDOW_SECONDS$1) {
  if (!(duration2 > 0)) return [];
  if (duration2 <= total * 1.25) return [{ start: 0, seconds: duration2 }];
  const n = Math.max(1, Math.round(total / windowSeconds));
  return Array.from({ length: n }, (_, i) => ({
    start: Math.max(0, Math.min(duration2 - windowSeconds, (i + 0.5) * duration2 / n - windowSeconds / 2)),
    seconds: windowSeconds
  }));
}
async function detectFacecam(o) {
  const ev = new CamEvidence();
  const windows = o.windows ?? detectWindows(o.duration);
  const expected = Math.max(1, windows.reduce((a, w) => a + w.seconds * DETECT_FPS, 0));
  const square = new Uint8Array(YUNET_SIZE * YUNET_SIZE * 3);
  const gray = new Uint8Array(DW * DH);
  let done = 0;
  for (const w of windows) {
    ev.breakRun();
    let index = 0;
    await readFrames(o.ffmpeg, o.input, w.start, w.seconds, o.signal, async (bgr) => {
      grayOf(bgr, gray);
      let faces;
      if (index++ % 2 === 0) {
        square.set(bgr, 0);
        faces = (await detectFaces(square, o.modelPath)).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
      }
      ev.add(gray, faces);
      o.onProgress?.(Math.min(99, ++done / expected * 100));
    });
  }
  o.onProgress?.(100);
  return ev.decide();
}
function readFrames(ffmpeg, input, start, seconds2, signal, onFrame, threads) {
  const frameBytes = DW * DH * 3;
  const args = [
    "-hide_banner",
    "-nostdin",
    "-v",
    "error",
    ...threads ? ["-threads", String(threads)] : [],
    "-ss",
    start.toFixed(3),
    "-t",
    seconds2.toFixed(3),
    "-i",
    input,
    "-an",
    "-sn",
    "-vf",
    `fps=${DETECT_FPS},scale=${DW}:${DH}`,
    "-pix_fmt",
    "bgr24",
    "-f",
    "rawvideo",
    "pipe:1"
  ];
  const child = node_child_process.spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const kill = () => child.kill("SIGKILL");
  signal?.addEventListener("abort", kill, { once: true });
  let stderr = "";
  child.stderr.on("data", (d) => stderr = (stderr + d).slice(-2e3));
  let pending = Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    let busy = Promise.resolve();
    let failed = null;
    child.stdout.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= frameBytes) {
        const frame = new Uint8Array(pending.subarray(0, frameBytes));
        pending = pending.subarray(frameBytes);
        child.stdout.pause();
        busy = busy.then(() => failed ? void 0 : onFrame(frame)).catch((err) => {
          failed ??= err;
          kill();
        }).finally(() => child.stdout.resume());
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      signal?.removeEventListener("abort", kill);
      busy.then(() => {
        if (failed) reject(failed);
        else if (signal?.aborted) reject(new Error("Cancelled"));
        else if (code !== 0) reject(new Error(`Could not read frames to find the facecam: ${stderr.trim().split("\n").pop()}`));
        else resolve();
      }, reject);
    });
  });
}
const BORDER_TRIM = 3;
function boxToShare(b) {
  return { x: b[0] / DW, y: b[1] / DH, w: (b[2] - b[0]) / DW, h: (b[3] - b[1]) / DH };
}
function trimBorder(b, trim = BORDER_TRIM) {
  const [l, t, r, bt] = b;
  return [l > 0 ? l + trim : l, t > 0 ? t + trim : t, r < DW ? r - trim : r, bt < DH ? bt - trim : bt];
}
function stackFromDetection(res, noCam = false) {
  const game = boxToShare(res.game);
  const found = res.cam ? boxToShare(trimBorder(res.cam.box)) : null;
  return {
    cam: noCam ? null : found,
    found,
    game,
    ...res.cam ? { confidence: confidenceOf(res.cam.score) } : { confidence: 0 }
  };
}
function boxIou(a, b) {
  const x0 = Math.max(a[0], b[0]);
  const y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[2], b[2]);
  const y1 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  return inter / (area(a) + area(b) - inter || 1);
}
const YUNET_FILE$1 = "face_detection_yunet_2023mar.onnx";
const DETECT_VERSION = 1;
function isGamingJob(o) {
  return o.mode === "gaming" || o.mode === "live" && o.liveKind === "gaming";
}
function gamingOptions(o) {
  if (!isGamingJob(o)) return o;
  return {
    ...o,
    aspect: "9:16",
    layout: "stack",
    // The app's default audience is developers; a stream's is gamers (titles, hashtags).
    audience: !o.audience || o.audience === local.DEFAULT_JOB_DEFAULTS.audience ? "gamers" : o.audience,
    // The line over the clip would sit on the streamer's face; on only when asked for.
    topText: o.topText && Object.keys(o.topText).length ? o.topText : { off: true }
  };
}
function gamingAnalysis(o) {
  return agenticAnalysisStaged({
    transcript: o.transcript,
    options: o.options,
    apiKey: o.apiKey,
    model: o.model,
    log: o.log,
    onProgress: o.onProgress,
    signal: o.signal,
    samples: o.samples,
    sampleOffset: o.offset,
    modelsDir: o.modelsDir
  });
}
const NO_CAM_NOTE = "No facecam was found in this stream, so the clips show the gameplay on its own.";
const NO_CAM_ASKED_NOTE = "You said this stream has no facecam, so the clips show the gameplay on its own.";
async function gamingStack(o) {
  if (o.options.facecam === "none") {
    o.log("No facecam (as asked): the clips show the gameplay only.");
    return { stack: { cam: null, game: WHOLE_FRAME }, note: NO_CAM_ASKED_NOTE };
  }
  const cachePath = path.join(o.outputDir, "gaming.json");
  const stat = await node_fs.promises.stat(o.input).catch(() => null);
  const key2 = { input: o.input, size: stat?.size ?? 0, mtime: Math.round(stat?.mtimeMs ?? 0), v: DETECT_VERSION };
  let res = null;
  try {
    const kept = JSON.parse(await node_fs.promises.readFile(cachePath, "utf8"));
    if (JSON.stringify(kept.key) === JSON.stringify(key2)) res = kept.result;
  } catch {
  }
  if (!res) {
    if (!o.fontsDir) {
      o.log("The face model is not available here, so the facecam was not looked for.");
      return { stack: { cam: null, game: WHOLE_FRAME }, note: NO_CAM_NOTE };
    }
    const t = Date.now();
    try {
      res = await detectFacecam({
        ffmpeg: o.ffmpeg,
        input: o.input,
        duration: o.media.duration,
        modelPath: path.join(path.dirname(o.fontsDir), "models", YUNET_FILE$1),
        signal: o.signal,
        onProgress: o.onProgress
      });
    } catch (err) {
      if (o.signal.aborted) throw err;
      o.log(`Looking for the facecam failed (${err.message}); the clips show the gameplay only.`);
      return { stack: { cam: null, game: WHOLE_FRAME }, note: NO_CAM_NOTE };
    }
    o.log(`Looked for the facecam in ${res.frames} frames in ${((Date.now() - t) / 1e3).toFixed(0)}s.`);
    await node_fs.promises.writeFile(cachePath, JSON.stringify({ key: key2, result: res }, null, 1)).catch(() => void 0);
  }
  const stack = stackFromDetection(res);
  if (!res.cam) {
    o.log(`No facecam found (${res.reason ?? "no box"}): gameplay only.`);
    return { stack, note: NO_CAM_NOTE };
  }
  const c = res.cam;
  o.log(`Facecam at ${c.box.join(",")} of 640x360 (score ${c.score}, sides ${c.support}, game area ${res.game.join(",")}).`);
  return { stack };
}
const SIZE_ORDER = ["tiny", "base", "small", "medium", "large"];
const MEDIUM_IS_ENOUGH = /* @__PURE__ */ new Set([
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "ru",
  "pl",
  "tr",
  "ja",
  "zh",
  "ko",
  "id",
  "vi",
  "uk",
  "sv",
  "ca",
  "cs",
  "ro",
  "da",
  "fi",
  "hu",
  "no",
  "nb",
  "el",
  "ms",
  "he",
  "th"
]);
function goodEnough(lang) {
  const l = (lang ?? "").toLowerCase().slice(0, 2);
  if (l === "en") return "small";
  if (MEDIUM_IS_ENOUGH.has(l)) return "medium";
  return "large";
}
function pickSpeechModel(lang, downloaded) {
  const ramGb = os.totalmem() / 1024 ** 3;
  const cap = ramGb < 8 ? "base" : ramGb < 12 ? "small" : "large";
  const wanted0 = goodEnough(lang);
  const wanted = SIZE_ORDER.indexOf(wanted0) > SIZE_ORDER.indexOf(cap) ? cap : wanted0;
  const have = SIZE_ORDER.filter((m) => downloaded.includes(m) && SIZE_ORDER.indexOf(m) <= SIZE_ORDER.indexOf(cap));
  const atLeast = have.find((m) => SIZE_ORDER.indexOf(m) >= SIZE_ORDER.indexOf(wanted));
  if (atLeast) return { model: atLeast, wanted, good: true };
  return { model: have[have.length - 1] ?? wanted, wanted, good: false };
}
function detectionModel(downloaded) {
  const have = SIZE_ORDER.filter((m) => downloaded.includes(m));
  return have.find((m) => m !== "tiny") ?? have[0];
}
const CLOUD_CHUNKS = { target: 600, search: 30, pad: 2 };
function planChunks(samples, sampleRate, o = CLOUD_CHUNKS) {
  const duration2 = samples.length / sampleRate;
  return planChunksFromLoudness(duration2 > 0 ? local.loudnessFrames(samples, sampleRate) : new Float32Array(0), local.FRAME_MS / 1e3, duration2, o);
}
function planChunksFromLoudness(frames, frameSec, duration2, o = CLOUD_CHUNKS) {
  if (!(duration2 > 0)) return [];
  if (duration2 <= o.target * 1.5) return [{ start: 0, end: duration2, ownStart: 0, ownEnd: duration2 }];
  const win = Math.max(1, Math.round(0.5 / frameSec));
  const sum = new Float64Array(frames.length + 1);
  for (let i = 0; i < frames.length; i++) sum[i + 1] = sum[i] + frames[i];
  const cuts = [];
  let last = 0;
  while (duration2 - last > o.target * 1.5) {
    const aim = last + o.target;
    const lo = Math.max(Math.floor((aim - o.search) / frameSec), Math.floor((last + o.target / 2) / frameSec));
    const hi = Math.min(Math.floor((aim + o.search) / frameSec), frames.length - win);
    let best = -1;
    let bestLoud = Infinity;
    for (let f = lo; f <= hi; f++) {
      const loud = sum[f + win] - sum[f];
      if (loud < bestLoud - 1e-9 || Math.abs(loud - bestLoud) <= 1e-9 && Math.abs(f * frameSec - aim) < Math.abs(best * frameSec - aim)) {
        bestLoud = loud;
        best = f;
      }
    }
    const cut = best >= 0 ? (best + win / 2) * frameSec : aim;
    cuts.push(round$3(cut));
    last = cut;
  }
  const edges = [0, ...cuts, duration2];
  const out = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    out.push({
      start: round$3(Math.max(0, edges[i] - (i === 0 ? 0 : o.pad))),
      end: round$3(Math.min(duration2, edges[i + 1] + (i + 1 === edges.length - 1 ? 0 : o.pad))),
      ownStart: edges[i],
      ownEnd: edges[i + 1]
    });
  }
  return out;
}
function mergeChunkWords(chunks, words2) {
  const out = [];
  chunks.forEach((c, i) => {
    const last = i === chunks.length - 1;
    for (const w of words2[i] ?? []) {
      const start = round$3(w.start + c.start);
      const end = round$3(Math.max(w.end, w.start) + c.start);
      const mid = (start + end) / 2;
      if (mid < c.ownStart || (last ? mid > c.ownEnd + 0.5 : mid >= c.ownEnd)) continue;
      out.push({ ...w, start, end });
    }
  });
  out.sort((a, b) => a.start - b.start);
  return out;
}
function silentSegment(s) {
  return (s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -1;
}
function wordsFromVerbose(json) {
  const segments = json.segments ?? [];
  const raw = (json.words ?? []).map((w) => ({ text: (w.word ?? "").trim(), start: Number(w.start) || 0, end: Math.max(Number(w.end) || 0, (Number(w.start) || 0) + 0.05) })).filter((w) => w.text);
  if (!segments.length) return raw;
  const out = [];
  let k = 0;
  const groups = segments.map(() => []);
  const loose = [];
  for (const w of raw) {
    const mid = (w.start + w.end) / 2;
    while (k < segments.length - 1 && mid >= segments[k].end) k++;
    if (mid >= segments[k].start - 0.5 && mid <= segments[k].end + 0.5) groups[k].push(w);
    else loose.push(w);
  }
  segments.forEach((s, i) => {
    if (silentSegment(s)) return;
    const ws = groups[i];
    const tokens2 = s.text.trim().split(/\s+/).filter(Boolean);
    if (tokens2.length === ws.length) ws.forEach((w, j) => out.push({ ...w, text: tokens2[j] }));
    else out.push(...ws);
  });
  out.push(...loose);
  out.sort((a, b) => a.start - b.start);
  return out;
}
const LANGUAGE_CODES = {
  english: "en",
  urdu: "ur",
  hindi: "hi",
  arabic: "ar",
  spanish: "es",
  french: "fr",
  german: "de",
  portuguese: "pt",
  italian: "it",
  dutch: "nl",
  russian: "ru",
  turkish: "tr",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  punjabi: "pa",
  bengali: "bn",
  persian: "fa",
  indonesian: "id",
  malay: "ms",
  tamil: "ta",
  telugu: "te",
  marathi: "mr",
  gujarati: "gu",
  polish: "pl",
  ukrainian: "uk",
  vietnamese: "vi",
  thai: "th",
  swedish: "sv",
  greek: "el",
  hebrew: "he",
  pashto: "ps",
  sindhi: "sd"
};
function languageCode(name) {
  if (!name) return void 0;
  const n = name.trim().toLowerCase();
  if (!n) return void 0;
  return LANGUAGE_CODES[n] ?? n;
}
function round$3(n) {
  return Math.round(n * 1e3) / 1e3;
}
const GROQ_SPEECH_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];
function cloudService(provider, model, baseUrl) {
  if (provider === "clipie") {
    const base = (baseUrl ?? "").replace(/\/+$/, "");
    return {
      provider,
      url: `${base}/v1/audio/transcriptions`,
      jobsUrl: `${base}/v1/jobs`,
      model: "whisper-large-v3",
      label: "SNU Clipper Cloud",
      // Pieces wait in the server's line (up to eight per account), which takes turns between
      // accounts, so sending more at once does not push anyone else back.
      parallel: 6,
      maxBytes: 25 * 1024 * 1024,
      segments: true
    };
  }
  if (provider === "groq") {
    return {
      provider,
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      model: model && GROQ_SPEECH_MODELS.includes(model) ? model : "whisper-large-v3",
      label: "Groq",
      parallel: 4,
      maxBytes: 25 * 1024 * 1024,
      segments: true
    };
  }
  return {
    provider,
    url: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
    label: "OpenAI",
    parallel: 4,
    maxBytes: 25 * 1024 * 1024,
    segments: true
  };
}
class CloudSpeechError extends Error {
  /** "credits": SNU Clipper Cloud minutes used up. */
  constructor(message, reason) {
    super(message);
    this.reason = reason;
  }
  reason;
}
const SR$1 = 16e3;
const MAX_RATE_WAIT_MS = 9e4;
const WAITING = "No internet connection. Waiting for it to come back; SNU Clipper carries on by itself.";
async function transcribeCloud(opts) {
  let last = 0;
  const o = { ...opts, onProgress: (p, m) => opts.onProgress(p < 0 ? last : last = p, m) };
  const svc = o.service;
  const sleep2 = o.sleep ?? abortableSleep;
  const audio = await local.readPcmF32(o.pcmPath);
  const chunks = planChunks(audio, SR$1, o.chunking ?? CLOUD_CHUNKS);
  if (!chunks.length) throw new CloudSpeechError("The audio is empty.", "service");
  if (svc.jobsUrl) await checkMinutes(o, svc, chunks);
  o.onProgress(2, `Sending the audio to ${svc.label} (${chunks.length} part${chunks.length === 1 ? "" : "s"})…`);
  const t0 = Date.now();
  let done = 0;
  const results = new Array(chunks.length);
  const fatal = new AbortController();
  const signal = o.signal ? AbortSignal.any([o.signal, fatal.signal]) : fatal.signal;
  let failure = null;
  let next = 0;
  let uploaded = 0;
  const worker2 = async () => {
    while (failure === null && next < chunks.length) {
      const i = next++;
      try {
        const body = await encodePiece(o.ffmpeg, o.pcmPath, chunks[i], signal);
        uploaded += body.length;
        results[i] = await transcribePiece(o, svc, body, `part-${i + 1}.ogg`, {}, signal, sleep2);
      } catch (err) {
        if (failure === null) failure = err;
        fatal.abort();
        return;
      }
      done++;
      o.onProgress(5 + done / chunks.length * 85, `${svc.label} transcribed ${done} of ${chunks.length} part${chunks.length === 1 ? "" : "s"}…`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(svc.parallel, chunks.length) }, worker2));
  if (o.signal?.aborted) throw new Error("Cancelled");
  if (failure !== null) throw failure;
  let words2 = mergeChunkWords(chunks, results.map((r) => wordsFromVerbose(r)));
  const language = pickLanguage(chunks, results) ?? (o.language === "auto" ? "auto" : o.language);
  o.log(`${svc.label} (${svc.model}) transcribed ${fmt$1(o.duration)} of audio in ${((Date.now() - t0) / 1e3).toFixed(0)}s: ${chunks.length} part${chunks.length === 1 ? "" : "s"}, ${(uploaded / 1024 / 1024).toFixed(1)} MB sent.`);
  const looped = local.loopedSpans(words2, o.duration);
  for (const at of looped.slice(0, 4)) {
    o.onProgress(92, "Checking a stretch that repeats…");
    const span = { start: Math.max(0, at - 1), end: Math.min(o.duration, at + local.LOOP_SPAN + 1), ownStart: at, ownEnd: at + local.LOOP_SPAN };
    let fresh = null;
    try {
      const body = await encodePiece(o.ffmpeg, o.pcmPath, span, o.signal);
      const again = await transcribePiece(o, svc, body, "again.ogg", { temperature: "0.2" }, o.signal, sleep2);
      const heard2 = mergeChunkWords([span], [wordsFromVerbose(again)]);
      if (!local.looksLooped(heard2.map((w) => w.text).join(" "))) fresh = heard2;
    } catch (err) {
      if (o.signal?.aborted) throw new Error("Cancelled");
    }
    if (fresh) words2 = local.spliceWords(words2, at, at + local.LOOP_SPAN, fresh);
    else words2 = local.spliceWords(words2, at, at + local.LOOP_SPAN, local.collapseRuns(words2.filter((w) => w.start >= at && w.start < at + local.LOOP_SPAN)));
  }
  if (looped.length) o.log(`Repaired ${looped.length} stretch${looped.length === 1 ? "" : "es"} where the speech service repeated itself.`);
  const piles = local.dropPileUps(local.dropAnnotations(words2));
  const aligned = local.alignToAudio(piles.words, audio, SR$1);
  if (aligned.lag > 0.02) o.log(`Captions moved ${Math.round(aligned.lag * 1e3)} ms earlier: that is how late the service's word times were against the audio.`);
  o.onProgress(100, "Transcription complete");
  return {
    language,
    duration: o.duration,
    words: aligned.words,
    segments: local.buildSegments(aligned.words),
    provider: svc.provider,
    model: svc.model
  };
}
function pickLanguage(chunks, results) {
  const by = /* @__PURE__ */ new Map();
  results.forEach((r, i) => {
    const code = languageCode(r?.language);
    if (code) by.set(code, (by.get(code) ?? 0) + (chunks[i].ownEnd - chunks[i].ownStart));
  });
  return [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
async function encodePiece(ffmpeg, pcmPath, c, signal) {
  const input = ["-hide_banner", "-nostdin", "-loglevel", "error", "-f", "f32le", "-ar", String(SR$1), "-ac", "1", "-ss", c.start.toFixed(3), "-t", (c.end - c.start).toFixed(3), "-i", pcmPath];
  try {
    return await capture(ffmpeg, [...input, "-c:a", "libopus", "-b:a", "32k", "-application", "audio", "-f", "ogg", "pipe:1"], signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    return capture(ffmpeg, [...input, "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1"], signal);
  }
}
function capture(bin, args, signal) {
  return new Promise((resolve, reject) => {
    const child = node_child_process.spawn(bin, args, { windowsHide: true });
    const parts = [];
    let err = "";
    const onAbort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (d) => parts.push(d));
    child.stderr.on("data", (d) => err += d.toString());
    child.on("error", reject);
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) return reject(new Error("Cancelled"));
      const out = Buffer.concat(parts);
      if (code !== 0 || !out.length) return reject(new Error(`Could not prepare the audio for upload: ${err.trim().split("\n").slice(-2).join(" ")}`));
      resolve(out);
    });
  });
}
const MAX_QUEUE_WAIT_MS = 20 * 6e4;
async function transcribePiece(o, svc, body, name, extra, signal, sleep2) {
  if (!svc.jobsUrl) return request(o, svc, body, name, extra, signal, sleep2);
  const auth = { Authorization: `Bearer ${o.apiKey}` };
  const started = Date.now();
  let told = "";
  for (let attempt = 0; ; attempt++) {
    const job = await request(o, svc, body, name, extra, signal, sleep2, svc.jobsUrl, crypto.randomUUID());
    let busy = 0;
    let lost = false;
    try {
      while (!lost) {
        if (signal?.aborted) {
          void fetch(`${svc.jobsUrl}/${job.id}`, { method: "DELETE", headers: auth }).catch(() => void 0);
          throw new Error("Cancelled");
        }
        let res;
        try {
          res = await fetch(`${svc.jobsUrl}/${job.id}`, { headers: auth, signal });
        } catch (err) {
          if (signal?.aborted) continue;
          void err;
          await waitForInternet(o, svc, sleep2, signal);
          continue;
        }
        if (res.status === 404) {
          lost = true;
          break;
        }
        if (res.status === 401 || res.status === 403) {
          throw new CloudSpeechError(res.status === 403 ? "Your SNU Clipper Cloud account has been turned off." : "Your SNU Clipper Cloud sign-in has run out. Sign in again on the Cloud page.", "key");
        }
        if (!res.ok) {
          if (++busy > 6) throw new CloudSpeechError(`${svc.label} is not answering properly right now.`, "service");
          await sleep2(3e3 * busy, signal);
          continue;
        }
        busy = 0;
        const now = await res.json().catch(() => null);
        if (!now) throw new CloudSpeechError(`${svc.label} sent back an answer SNU Clipper could not read.`, "service");
        if (now.status === "done" && now.result) return now.result;
        if (now.status === "failed") {
          if (attempt >= 1) throw new CloudSpeechError(`${svc.label} could not transcribe a part of this audio.`, "service");
          lost = true;
          break;
        }
        if (now.status === "cancelled") {
          lost = true;
          break;
        }
        if (now.status === "queued" && Date.now() - started > MAX_QUEUE_WAIT_MS) {
          void fetch(`${svc.jobsUrl}/${job.id}`, { method: "DELETE", headers: auth }).catch(() => void 0);
          throw new CloudSpeechError("SNU Clipper Cloud is busy with other videos right now.", "limit");
        }
        const eta = now.eta_seconds ?? 0;
        if (now.status === "queued" && (now.position ?? 0) > 0) {
          const line = `SNU Clipper Cloud: in line, ${now.position} part${now.position === 1 ? "" : "s"} ahead (${waitWords(eta)})…`;
          if (line !== told) o.onProgress(-1, told = line);
        }
        await sleep2(now.status === "running" || eta < 30 ? 2e3 : 5e3, signal);
      }
    } catch (err) {
      if (signal?.aborted) void fetch(`${svc.jobsUrl}/${job.id}`, { method: "DELETE", headers: auth }).catch(() => void 0);
      throw err;
    }
    if (attempt >= 3) throw new CloudSpeechError(`${svc.label} lost this part of the audio more than once.`, "service");
  }
}
async function checkMinutes(o, svc, chunks) {
  if (!svc.jobsUrl?.endsWith("/jobs")) return;
  const url = svc.jobsUrl.replace(/\/jobs$/, "/account");
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${o.apiKey}` }, signal: AbortSignal.timeout(2e4) });
  } catch {
    return;
  }
  if (res.status === 401 || res.status === 403) {
    throw new CloudSpeechError(res.status === 403 ? "Your SNU Clipper Cloud account has been turned off." : "Your SNU Clipper Cloud sign-in has run out. Sign in again on the Cloud page.", "key");
  }
  if (!res.ok) return;
  const acc = await res.json().catch(() => null);
  if (typeof acc?.balance !== "number") return;
  const perSecond = acc.credits_per_second ?? 1;
  const needed = chunks.reduce((n, c) => n + Math.ceil((c.end - c.start + 1) * perSecond), 0);
  if (acc.balance >= needed) return;
  const min = (credits) => Math.ceil(credits / perSecond / 60);
  const left = acc.balance >= 60 * perSecond ? `${Math.floor(acc.balance / perSecond / 60)} min left` : "less than a minute left";
  throw new CloudSpeechError(`Your SNU Clipper Cloud minutes are not enough for this video (${left}, it needs about ${min(needed)} min). Nothing was used. Add minutes on the Cloud page, or switch SNU Clipper Cloud off to listen on this computer for free.`, "credits");
}
function waitWords(s) {
  return s < 60 ? "under a minute" : `about ${Math.round(s / 60)} min`;
}
async function request(o, svc, body, name, extra, signal, sleep2, url = svc.url, idempotencyKey) {
  if (body.length > svc.maxBytes) throw new CloudSpeechError(`A piece of the audio is larger than ${svc.label} accepts.`, "service");
  let busy = 0;
  let slowDowns = 0;
  for (; ; ) {
    if (signal?.aborted) throw new Error("Cancelled");
    const form = new FormData();
    const type = body.subarray(0, 4).toString("latin1") === "OggS" ? "audio/ogg" : "audio/mpeg";
    form.append("file", new Blob([new Uint8Array(body)], { type }), type === "audio/ogg" ? name : name.replace(/\.ogg$/, ".mp3"));
    form.append("model", svc.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (svc.segments) form.append("timestamp_granularities[]", "segment");
    form.append("temperature", extra.temperature ?? "0");
    if (o.language !== "auto") form.append("language", o.language);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${o.apiKey}`, ...idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {} },
        body: form,
        signal
      });
    } catch (err) {
      if (signal?.aborted) throw new Error("Cancelled");
      const text = `${err.message} ${String(err.cause ?? "")}`;
      if (!hardware.OFFLINE.test(text) && ++busy > 3) throw new CloudSpeechError(`${svc.label} could not be reached.`, "service");
      await waitForInternet(o, svc, sleep2, signal);
      continue;
    }
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (!json) throw new CloudSpeechError(`${svc.label} sent back an answer SNU Clipper could not read.`, "service");
      return json;
    }
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const clipie = svc.provider === "clipie";
    if (res.status === 401 || res.status === 403) {
      if (clipie) throw new CloudSpeechError(res.status === 403 ? "Your SNU Clipper Cloud account has been turned off." : "Your SNU Clipper Cloud sign-in has run out. Sign in again on the Cloud page.", "key");
      throw new CloudSpeechError(`${svc.label} refused the key. Check it in Settings → Speech.`, "key");
    }
    if (res.status === 402 && clipie) throw new CloudSpeechError(minutesMessage(detail), "credits");
    if (res.status === 429) {
      const wait = retryAfterMs(res.headers, detail);
      if (wait > MAX_RATE_WAIT_MS || ++slowDowns > 8) {
        if (clipie) throw new CloudSpeechError("SNU Clipper Cloud is busy with other videos right now.", "limit");
        throw new CloudSpeechError(`${svc.label}'s free allowance for now is used up${wait > MAX_RATE_WAIT_MS ? ` (it frees up in about ${Math.ceil(wait / 6e4)} min)` : ""}.`, "limit");
      }
      o.onProgress(-1, clipie ? `SNU Clipper Cloud is busy; this part starts in ${Math.ceil(wait / 1e3)}s…` : `${svc.label} asked SNU Clipper to slow down; carrying on in ${Math.ceil(wait / 1e3)}s…`);
      await sleep2(wait, signal);
      continue;
    }
    if (res.status === 413) throw new CloudSpeechError(`A piece of the audio is larger than ${svc.label} accepts.`, "service");
    if (res.status >= 500 && ++busy <= 4) {
      await sleep2(2e3 * busy, signal);
      continue;
    }
    throw new CloudSpeechError(`${svc.label} could not transcribe this audio (${res.status}${detail ? `: ${detail.replace(/\s+/g, " ").slice(0, 160)}` : ""}).`, "service");
  }
}
function minutesMessage(body) {
  let err = {};
  try {
    err = JSON.parse(body).error ?? {};
  } catch {
  }
  const min = (s) => Math.max(1, Math.ceil(s / 60));
  const left = typeof err.balance === "number" ? err.balance >= 60 ? `${Math.floor(err.balance / 60)} min left` : "less than a minute left" : "";
  return `Your SNU Clipper Cloud minutes have run out${left ? ` (${left}${typeof err.needed === "number" ? `, this part needs ${min(err.needed)} min` : ""})` : ""}. Add minutes on the Cloud page, or switch SNU Clipper Cloud off to listen on this computer for free.`;
}
function retryAfterMs(headers, body) {
  const h = Number(headers.get("retry-after"));
  if (Number.isFinite(h) && h > 0) return Math.ceil(h * 1e3);
  const m = /try again in\s+(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?/i.exec(body);
  if (m && (m[1] || m[2] || m[3] || m[4])) {
    return Math.ceil((Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 1e3 + Number(m[4] ?? 0));
  }
  return 1e4;
}
async function waitForInternet(o, svc, sleep2, signal) {
  const host = new URL(svc.url).hostname;
  const online = o.online ?? (async () => {
    const { lookup: lookup2 } = await import("node:dns/promises");
    return lookup2(host).then(() => true, () => false);
  });
  const limit = o.offlineWaitMs ?? Infinity;
  const started = Date.now();
  let told = false;
  for (let wait = 2e3; ; wait = Math.min(wait * 2, 1e4)) {
    if (signal?.aborted) throw new Error("Cancelled");
    if (await online()) {
      if (told) o.onProgress(-1, "Back online. Continuing…");
      else await sleep2(2e3, signal);
      return;
    }
    if (Date.now() - started >= limit) throw new CloudSpeechError("There is no internet connection.", "offline");
    if (!told) o.onProgress(-1, WAITING);
    told = true;
    await sleep2(wait, signal);
  }
}
function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Cancelled"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("Cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function fmt$1(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function normToken(s) {
  return s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
}
function nearly(a, b) {
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i >= Math.min(a.length, b.length)) return true;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
const MATCH = 3;
const NEAR = 1;
const MISS = -1;
const GAP = -1;
const MAX_CELLS = 3e6;
function lineUp(a, b, i0, i1, j0, j1, pairs) {
  const n = i1 - i0;
  const m = j1 - j0;
  if (n <= 0 || m <= 0) return;
  let band = m;
  if ((n + 1) * (m + 1) > MAX_CELLS) band = Math.max(60, Math.floor(MAX_CELLS / (n + 1) / 2));
  const slope = m / n;
  const lo = (i2) => band >= m ? 0 : Math.max(0, Math.floor(i2 * slope) - band);
  const hi = (i2) => band >= m ? m : Math.min(m, Math.floor(i2 * slope) + band);
  const width = Math.min(m, 2 * band) + 2;
  const score = new Float64Array((n + 1) * width).fill(-Infinity);
  const move = new Uint8Array((n + 1) * width);
  const at = (i2, j2) => {
    const k = j2 - lo(i2);
    return k >= 0 && k < width && j2 <= hi(i2) ? i2 * width + k : -1;
  };
  for (let j2 = lo(0); j2 <= hi(0); j2++) {
    const c = at(0, j2);
    score[c] = j2 * GAP;
    move[c] = 3;
  }
  for (let i2 = 1; i2 <= n; i2++) {
    const ai = a[i0 + i2 - 1];
    for (let j2 = lo(i2); j2 <= hi(i2); j2++) {
      const c = at(i2, j2);
      let best = -Infinity;
      let how = 0;
      if (j2 > 0) {
        const d = at(i2 - 1, j2 - 1);
        if (d >= 0 && score[d] > -Infinity) {
          const bj = b[j0 + j2 - 1];
          const s = score[d] + (ai && ai === bj ? MATCH : nearly(ai, bj) ? NEAR : MISS);
          if (s > best) {
            best = s;
            how = 1;
          }
        }
        const l = at(i2, j2 - 1);
        if (l >= 0 && score[l] + GAP > best) {
          best = score[l] + GAP;
          how = 3;
        }
      }
      const u = at(i2 - 1, j2);
      if (u >= 0 && score[u] + GAP > best) {
        best = score[u] + GAP;
        how = 2;
      }
      if (j2 === 0 && how === 0) {
        best = i2 * GAP;
        how = 2;
      }
      score[c] = best;
      move[c] = how;
    }
  }
  let i = n;
  let j = m;
  if (at(i, j) < 0) j = hi(n);
  while (i > 0 && j >= 0) {
    const c = at(i, j);
    if (c < 0) break;
    const how = move[c];
    if (how === 1) {
      const ai = a[i0 + i - 1];
      const bj = b[j0 + j - 1];
      if (ai && (ai === bj || nearly(ai, bj))) pairs.set(i0 + i - 1, j0 + j - 1);
      i--;
      j--;
    } else if (how === 2) i--;
    else if (how === 3) j--;
    else break;
  }
}
function anchors(a, b) {
  const grams = (w) => {
    const seen = /* @__PURE__ */ new Map();
    for (let i = 0; i + 2 < w.length; i++) {
      if (!w[i] || !w[i + 1] || !w[i + 2]) continue;
      const k = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
      seen.set(k, seen.has(k) ? -1 : i);
    }
    return seen;
  };
  const ga = grams(a);
  const gb = grams(b);
  const found = [];
  for (const [k, i] of ga) {
    if (i < 0) continue;
    const j = gb.get(k);
    if (j !== void 0 && j >= 0) found.push([i, j]);
  }
  found.sort((x, y) => x[0] - y[0]);
  const tails = [];
  const prev = new Int32Array(found.length).fill(-1);
  for (let k = 0; k < found.length; k++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (found[tails[mid]][1] < found[k][1]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[k] = tails[lo - 1];
    tails[lo] = k;
  }
  const out = [];
  for (let k = tails.length ? tails[tails.length - 1] : -1; k >= 0; k = prev[k]) out.push(found[k]);
  out.reverse();
  const kept = [];
  for (const p of out) {
    const last = kept[kept.length - 1];
    if (!last || p[0] >= last[0] + 3 && p[1] >= last[1] + 3) kept.push(p);
  }
  return kept;
}
function matchWords(text, heard2) {
  const pairs = /* @__PURE__ */ new Map();
  const fixed = anchors(text, heard2);
  let i = 0;
  let j = 0;
  for (const [ai, bj] of fixed) {
    lineUp(text, heard2, i, ai, j, bj, pairs);
    for (let k = 0; k < 3; k++) pairs.set(ai + k, bj + k);
    i = ai + 3;
    j = bj + 3;
  }
  lineUp(text, heard2, i, text.length, j, heard2.length, pairs);
  return pairs;
}
const WORD_SECONDS = 0.38;
function alignTextToHeard(textWords, heard2, duration2) {
  const a = textWords.map(normToken);
  const b = heard2.map((w) => normToken(w.text));
  const pairs = matchWords(a, b);
  const out = textWords.map((t) => ({ text: t, start: NaN, end: NaN }));
  for (const [i2, j] of pairs) {
    out[i2].start = heard2[j].start;
    out[i2].end = heard2[j].end;
  }
  const len2 = (w) => Math.max(1, [...normToken(w)].length) + 1;
  let i = 0;
  while (i < out.length) {
    if (Number.isFinite(out[i].start)) {
      i++;
      continue;
    }
    let k = i;
    while (k < out.length && !Number.isFinite(out[k].start)) k++;
    const run = out.slice(i, k);
    const weights = run.map((w) => len2(w.text));
    const total = weights.reduce((x, y) => x + y, 0);
    let from;
    let to;
    if (i > 0 && k < out.length) {
      from = out[i - 1].end;
      to = out[k].start;
      if (to - from < 0.12 * run.length) {
        const need = 0.12 * run.length;
        from = Math.max(out[i - 1].start + 0.05, from - need / 2);
        to = from + need;
      }
    } else if (k < out.length) {
      to = out[k].start;
      from = Math.max(0, to - WORD_SECONDS * run.length);
    } else if (i > 0) {
      from = out[i - 1].end;
      to = from + WORD_SECONDS * run.length;
      if (duration2) to = Math.min(duration2, to);
      if (to <= from) to = from + 0.05 * run.length;
    } else {
      from = heard2[0]?.start ?? 0;
      to = heard2.length ? heard2[heard2.length - 1].end : duration2 ?? WORD_SECONDS * run.length;
    }
    let at = from;
    run.forEach((w, n) => {
      const d = (to - from) * weights[n] / total;
      w.start = at;
      w.end = at + d;
      at += d;
    });
    i = k;
  }
  return { words: local.tidy(out.filter((w) => w.text)), matched: pairs.size };
}
function voicedCueWords(cues, samples, sampleRate) {
  const runs = local.voiceRuns(local.loudnessFrames(samples, sampleRate), local.FRAME_MS);
  const out = [];
  let r = 0;
  for (const c of [...cues].sort((a, b) => a.start - b.start)) {
    const even2 = hardware.spreadCue(c);
    if (c.words?.length || !runs.length || c.end - c.start < 0.3) {
      out.push(...even2);
      continue;
    }
    while (r > 0 && runs[r - 1].end > c.start) r--;
    while (r < runs.length && runs[r].end <= c.start) r++;
    const voiced = [];
    for (let k = r; k < runs.length && runs[k].start < c.end; k++) voiced.push({ start: Math.max(runs[k].start, c.start), end: Math.min(runs[k].end, c.end) });
    const total = voiced.reduce((a, v) => a + v.end - v.start, 0);
    const span = c.end - c.start;
    if (total < 0.3 * span) {
      out.push(...even2);
      continue;
    }
    const onVoice = (t) => {
      let pos = (t - c.start) / span * total;
      for (const v of voiced) {
        const len2 = v.end - v.start;
        if (pos <= len2 + 1e-9) return v.start + pos;
        pos -= len2;
      }
      return c.end;
    };
    for (const w of even2) out.push({ text: w.text, start: onVoice(w.start), end: Math.max(onVoice(w.end), onVoice(w.start) + 0.02) });
  }
  return local.tidy(out);
}
function buildImportedTranscript(o) {
  let words2;
  const end = o.windowEnd;
  if (o.parsed.format === "plain") {
    const heard2 = (o.heard ?? []).map((w) => ({ ...w, start: w.start + o.offset, end: w.end + o.offset }));
    const timed = alignTextToHeard(o.parsed.plainWords ?? [], heard2, end);
    const share = timed.matched / Math.max(1, o.parsed.plainWords?.length ?? 0);
    o.log(`Timed your text against a quick listen: ${timed.matched} of ${o.parsed.plainWords?.length ?? 0} words lined up with what was heard (${Math.round(share * 100)}%).`);
    if (share < 0.3) o.log("Few of your words matched what was heard, so caption times may be rough. Check the text is for this video, or use a transcript with times (.srt or .vtt).", "warn");
    words2 = timed.words;
  } else if (o.parsed.cues?.length && o.samples?.length) {
    const local2 = o.parsed.cues.map((c) => ({ ...c, start: c.start - o.offset, end: c.end - o.offset, words: c.words?.map((w) => ({ ...w, start: w.start - o.offset, end: w.end - o.offset })) }));
    words2 = voicedCueWords(local2, o.samples, 16e3).map((w) => ({ text: w.text, start: round$2(w.start + o.offset), end: round$2(w.end + o.offset) }));
  } else {
    words2 = o.parsed.words;
  }
  words2 = words2.filter((w) => w.start >= o.offset - 0.05 && w.start < end);
  words2 = local.tidy(local.dropAnnotations(words2));
  return {
    language: o.language,
    duration: o.duration,
    segments: local.buildSegments(words2),
    words: words2,
    provider: o.source,
    model: o.parsed.format === "plain" ? `text+${o.heardModel ?? "listen"}` : o.parsed.format
  };
}
function round$2(n) {
  return Math.round(n * 1e3) / 1e3;
}
const LEAD_IN = 0.12;
const TAIL = 0.3;
function padHighlights(highlights, words2, duration2, maxSeconds) {
  return highlights.map((h) => {
    let prevEnd = 0;
    let nextStart = duration2 + 0.05;
    for (const w of words2) {
      if (w.end <= h.start + 1e-3) prevEnd = Math.max(prevEnd, w.end);
      else if (w.start >= h.end - 1e-3) {
        nextStart = Math.min(nextStart, w.start);
        break;
      }
    }
    const room = Math.max(0, maxSeconds + 0.5 - (h.end - h.start));
    const tail = Math.min(TAIL, Math.max(0, nextStart - 0.05 - h.end), duration2 - h.end, room);
    const lead = Math.min(LEAD_IN, Math.max(0, h.start - (prevEnd + 0.02)), h.start, room - Math.max(0, tail));
    if (!(tail > 0) && !(lead > 0)) return h;
    const r = (n) => Math.round(n * 1e3) / 1e3;
    return { ...h, start: r(h.start - Math.max(0, lead)), end: r(h.end + Math.max(0, tail)) };
  });
}
const f3$1 = (n) => Math.max(0, n).toFixed(3);
function shiftForInserts(t, inserts) {
  return t + inserts.filter((i) => i.at <= t).reduce((s, i) => s + i.len, 0);
}
async function mixMemes(o) {
  const present = [];
  for (const m of o.memes) {
    const ok = await node_fs.promises.access(path.join(o.memesDir, hardware.memeFileName(m))).then(() => true, () => false);
    if (ok) present.push(m);
    else o.log(`Meme ${m.id} is not in the library on this computer; left out.`);
  }
  if (!present.length) return { duration: o.duration, inserts: [] };
  const { width: W, height: H, duration: len2 } = o;
  const inserts = present.filter((m) => m.mode === "insert").map((m) => ({ ...m, rel: Math.min(len2 - 0.05, Math.max(0.05, m.rel)) })).sort((a, b) => a.rel - b.rel);
  const overlays = present.filter((m) => m.mode === "overlay");
  const inputs = ["-i", o.file];
  const add = (m) => {
    inputs.push("-i", path.join(o.memesDir, hardware.memeFileName(m)));
    return inputs.length / 2 - 1;
  };
  const f = [];
  const parts = [];
  let cursor = 0;
  const outTime = (rel) => rel + inserts.filter((i) => i.rel <= rel).reduce((s, i) => s + i.len, 0);
  inserts.forEach((ins, k) => {
    f.push(`[0:v]trim=${f3$1(cursor)}:${f3$1(ins.rel)},setpts=PTS-STARTPTS[v${k}]`, `[0:a]atrim=${f3$1(cursor)}:${f3$1(ins.rel)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a${k}]`);
    parts.push(`[v${k}][a${k}]`);
    const idx = add(ins);
    if (ins.kind === "video") {
      f.push(`[${idx}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[mv${k}]`);
    } else {
      f.push(`[0:v]trim=start=${f3$1(ins.rel - 0.04)}:duration=0.04,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${f3$1(Math.max(0, ins.len - 0.04))}[mv${k}]`);
    }
    f.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[ma${k}]`);
    parts.push(`[mv${k}][ma${k}]`);
    cursor = ins.rel;
  });
  f.push(`[0:v]trim=start=${f3$1(cursor)},setpts=PTS-STARTPTS[vend]`, `[0:a]atrim=start=${f3$1(cursor)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[aend]`);
  parts.push("[vend][aend]");
  f.push(`${parts.join("")}concat=n=${parts.length}:v=1:a=1[vcat][acat]`);
  const total = len2 + inserts.reduce((s, i) => s + i.len, 0);
  f.push(`[acat]apad=whole_dur=${f3$1(total)}[apadded]`);
  let main = "[apadded]";
  const ducks = overlays.filter((m) => m.duck).map((m) => [outTime(m.rel), outTime(m.rel) + m.len]);
  if (ducks.length) {
    f.push(`${main}volume=0.35:enable='${ducks.map(([a, b]) => `between(t,${f3$1(a)},${f3$1(b)})`).join("+")}'[aduck]`);
    main = "[aduck]";
  }
  const mix = [main];
  overlays.forEach((m, k) => {
    const idx = add(m);
    const ms = Math.round(outTime(Math.max(0, m.rel)) * 1e3);
    f.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${m.gain ?? 1},adelay=${ms}|${ms}[o${k}]`);
    mix.push(`[o${k}]`);
  });
  if (mix.length > 1) f.push(`${mix.join("")}amix=inputs=${mix.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad=whole_dur=${f3$1(total)},atrim=0:${f3$1(total)}[aout]`);
  else f.push(`${main}anull[aout]`);
  const tmp = o.file.replace(/\.mp4$/i, ".memes.mp4");
  const res = await local.run(o.bins.ffmpeg, [
    "-y",
    "-hide_banner",
    "-nostdin",
    ...inputs,
    "-filter_complex",
    f.join(";"),
    "-map",
    "[vcat]",
    "-map",
    "[aout]",
    ...o.encoderArgs,
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "48000",
    "-t",
    f3$1(total),
    "-movflags",
    "+faststart",
    tmp
  ], { signal: o.signal });
  if (res.code !== 0) {
    await node_fs.promises.rm(tmp, { force: true }).catch(() => void 0);
    throw new Error(`Adding the memes failed: ${res.stderr.trim().split("\n").slice(-3).join(" ")}`);
  }
  await node_fs.promises.rename(tmp, o.file);
  o.log(`Memes: ${present.map((m) => `${m.id} (${m.mode === "insert" ? m.kind === "video" ? "cut in" : "freeze" : "sound"} at ${outTime(m.rel).toFixed(2)} s)`).join(", ")}`);
  return { duration: total, inserts: inserts.map((i) => ({ at: i.rel, len: i.len })) };
}
const f3 = (n) => Math.max(0, n).toFixed(3);
function musicFilter(music, duration2, hasSound, monoSound = false) {
  const plan = hardware.planMusic(music, duration2);
  if (!plan) return null;
  const ms = Math.round(plan.start * 1e3);
  const song = [
    "[1:a]aformat=sample_rates=48000:channel_layouts=stereo",
    // Clocks counted from the samples: a looped input's timestamps jump where it repeats, and trimming
    // by them left the music running two seconds past its window (measured on a 3 s song from 1 s).
    "asetpts=N/SR/TB",
    `atrim=0:${f3(plan.seconds)}`,
    `volume=${plan.volume.toFixed(3)}`,
    `afade=t=in:st=0:d=${f3(plan.fadeIn)}`,
    `afade=t=out:st=${f3(plan.seconds - plan.fadeOut)}:d=${f3(plan.fadeOut)}`,
    ...ms > 0 ? [`adelay=${ms}|${ms}`] : [],
    `apad=whole_dur=${f3(duration2)}[song]`
  ].join(",");
  const end = `alimiter=limit=0.95:level=disabled,atrim=0:${f3(duration2)}[aout]`;
  if (!hasSound) return `${song};[song]${end}`;
  const own2 = monoSound ? "pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000" : "aformat=sample_rates=48000:channel_layouts=stereo";
  return `[0:a]${own2},apad=whole_dur=${f3(duration2)}[own];${song};[own][song]amix=inputs=2:duration=longest:normalize=0,${end}`;
}
async function mixMusic(o) {
  const channels = o.hasSound ? await local.run(o.bins.ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "csv=p=0", o.file], { signal: o.signal }).then((r) => r.stdout.trim()).catch(() => "") : "";
  const filter = musicFilter(o.music, o.duration, o.hasSound, channels === "1");
  if (!filter) {
    o.log(`The music's time on the clip falls outside this ${o.duration.toFixed(1)} s clip, so it has none.`);
    return false;
  }
  const plan = hardware.planMusic(o.music, o.duration);
  const tmp = o.file.replace(/\.mp4$/i, ".music.mp4");
  const res = await local.run(o.bins.ffmpeg, [
    "-y",
    "-hide_banner",
    "-nostdin",
    "-i",
    o.file,
    // Repeats when the song is shorter than its time on the clip: on from where it was set to start,
    // then from the song's beginning.
    "-stream_loop",
    "-1",
    "-ss",
    f3(plan.songStart),
    "-i",
    o.music.path,
    "-filter_complex",
    filter,
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "48000",
    "-t",
    f3(o.duration),
    "-movflags",
    "+faststart",
    tmp
  ], { signal: o.signal, stallMs: 12e4 });
  if (res.code !== 0) {
    await node_fs.promises.rm(tmp, { force: true }).catch(() => void 0);
    throw new Error(local.lastLines(res.stderr));
  }
  await node_fs.promises.rename(tmp, o.file);
  o.log(`Music: ${o.music.name} from ${plan.start.toFixed(1)} s for ${plan.seconds.toFixed(1)} s at ${Math.round(plan.volume * 100)}%.`);
  return true;
}
const LOGO_WIDTH_RANGE = { min: 0.05, max: 0.6 };
const LOGO_DEFAULT = { pos: { x: 0.84, y: 0.1 }, width: 0.2 };
const clamp$3 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function resolveLogo(l) {
  if (!l?.path || !(l.w > 0) || !(l.h > 0)) return null;
  return {
    ...l,
    width: clamp$3(Number(l.width) || LOGO_DEFAULT.width, LOGO_WIDTH_RANGE.min, LOGO_WIDTH_RANGE.max),
    opacity: clamp$3(Number.isFinite(l.opacity) ? l.opacity : 1, 0.1, 1),
    pos: { x: clamp$3(l.pos?.x ?? LOGO_DEFAULT.pos.x, 0, 1), y: clamp$3(l.pos?.y ?? LOGO_DEFAULT.pos.y, 0, 1) }
  };
}
function logoBox(l, frameW, frameH) {
  const w = Math.max(2, Math.round(l.width * frameW / 2) * 2);
  const h = Math.max(2, Math.round(w * l.h / l.w / 2) * 2);
  const x = Math.round(clamp$3(l.pos.x * frameW - w / 2, 0, Math.max(0, frameW - w)));
  const y = Math.round(clamp$3(l.pos.y * frameH - h / 2, 0, Math.max(0, frameH - h)));
  return { x, y, w, h };
}
function clamp$2(value2, low, high) {
  if (!Number.isFinite(value2)) return low;
  return Math.min(high, Math.max(low, value2));
}
function cropRect(box, srcAspect, dstAspect) {
  if (!Number.isFinite(srcAspect) || srcAspect <= 0 || !Number.isFinite(dstAspect) || dstAspect <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const { zoom, x, y } = box ?? local.CENTRED_CROP;
  const coverW = srcAspect > dstAspect ? dstAspect / srcAspect : 1;
  const coverH = srcAspect > dstAspect ? 1 : srcAspect / dstAspect;
  const z = clamp$2(zoom, 1, local.MAX_CROP_ZOOM);
  const w = clamp$2(coverW / z, 0.02, 1);
  const h = clamp$2(coverH / z, 0.02, 1);
  const cx = clamp$2(x, w / 2, 1 - w / 2);
  const cy = clamp$2(y, h / 2, 1 - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function settleCrop(box, srcAspect, dstAspect) {
  const rect = cropRect(box, srcAspect, dstAspect);
  return { zoom: clamp$2(box.zoom, 1, local.MAX_CROP_ZOOM), x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}
function isCentred(box) {
  if (!box) return true;
  return Math.abs(box.zoom - 1) < 2e-3 && Math.abs(box.x - 0.5) < 2e-3 && Math.abs(box.y - 0.5) < 2e-3;
}
function cropStyle(box, srcAspect, dstAspect) {
  const rect = cropRect(box, srcAspect, dstAspect);
  return {
    width: `${100 / rect.w}%`,
    height: `${100 / rect.h}%`,
    left: `${-rect.x * 100 / rect.w}%`,
    top: `${-rect.y * 100 / rect.h}%`
  };
}
function resolutionShortSide(r) {
  if (r === "720") return 720;
  if (r === "480") return 480;
  return 1080;
}
const TEXT_MAX_CHARS = 120;
const TEXT_DEFAULT_POS = { x: 0.5, y: 0.62 };
const TEXT_MAX_ITEMS = 8;
const TEXT_SIZE_RANGE = { min: 0.5, max: 2.5 };
const TEXT_CARD_REFERENCE_WIDTH = 2160;
const TEXT_ANIM_SECONDS = 0.25;
const TEXT_LOOK_COLOR = {
  box: "#000000",
  light: "#FFFFFF",
  color: "#FF6B3D",
  marker: "#FFE14D",
  outline: "#FFFFFF",
  shadow: "#FF3D6E",
  neon: "#3DF2FF",
  sticker: "#FFD23D"
};
const textColor = (t) => t.color || TEXT_LOOK_COLOR[t.look] || "#FFFFFF";
let counter = 0;
function newTextOverlay(partial2 = {}) {
  counter++;
  return {
    id: `t${Date.now().toString(36)}${counter}`,
    text: "",
    start: 0,
    pos: { ...TEXT_DEFAULT_POS },
    size: 1,
    look: "box",
    entrance: "pop",
    ...partial2
  };
}
const clamp$1 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function resolveTextOverlays(list, clipSeconds) {
  const out = [];
  for (const t of (list ?? []).slice(0, TEXT_MAX_ITEMS)) {
    const text = t.text.trim().slice(0, TEXT_MAX_CHARS);
    if (!text) continue;
    const start = clamp$1(Number.isFinite(t.start) ? t.start : 0, 0, clipSeconds);
    const end = clamp$1(t.end === void 0 || !Number.isFinite(t.end) ? clipSeconds : t.end, 0, clipSeconds);
    if (end - start < 0.2) continue;
    out.push({
      ...t,
      text,
      start,
      end,
      size: clamp$1(t.size || 1, TEXT_SIZE_RANGE.min, TEXT_SIZE_RANGE.max),
      pos: { x: clamp$1(t.pos?.x ?? TEXT_DEFAULT_POS.x, 0, 1), y: clamp$1(t.pos?.y ?? TEXT_DEFAULT_POS.y, 0, 1) }
    });
  }
  return out;
}
function textCardKey(t, font) {
  return JSON.stringify([t.text.trim(), Math.round(t.size * 100), t.look, t.color ?? "", font]);
}
const TOP_TEXT_DEFAULT_SECONDS = 2.6;
const TOP_TEXT_DEFAULT_POS = { x: 0.5, y: 0.12 };
const TOP_TEXT_SIZE_RANGE = { min: 0.5, max: 2 };
const TOP_TEXT_MAX_CHARS = 120;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function shortenHook(text) {
  const words2 = text.trim().replace(/\s+/g, " ").split(" ");
  let out = words2.slice(0, 9).join(" ");
  if (out.length > 70) out = out.slice(0, 69).replace(/\s+\S*$/, "");
  if (out.length < text.trim().length) out = out.replace(/[,.;:!?]+$/, "") + "…";
  return out;
}
function resolveTopText(written, o, clipSeconds) {
  if (o?.off) return null;
  const own2 = typeof o?.text === "string";
  const raw = own2 ? o.text : shortenHook(written ?? "");
  const text = (own2 ? raw.slice(0, TOP_TEXT_MAX_CHARS) : raw).trim();
  if (!text) return null;
  const duration2 = Math.max(0, clipSeconds);
  const asked = typeof o?.seconds === "number" && Number.isFinite(o.seconds) ? o.seconds : TOP_TEXT_DEFAULT_SECONDS;
  const seconds2 = asked === 0 ? duration2 : clamp(asked, 0.3, duration2 || asked);
  return {
    text,
    seconds: seconds2,
    sizeScale: typeof o?.sizeScale === "number" && Number.isFinite(o.sizeScale) ? clamp(o.sizeScale, TOP_TEXT_SIZE_RANGE.min, TOP_TEXT_SIZE_RANGE.max) : 1,
    pos: o?.pos && Number.isFinite(o.pos.x) && Number.isFinite(o.pos.y) ? { x: clamp(o.pos.x, 0, 1), y: clamp(o.pos.y, 0, 1) } : { ...TOP_TEXT_DEFAULT_POS },
    look: o?.look && TEXT_LOOK_COLOR[o.look] ? o.look : "box",
    color: textColor({ look: o?.look && TEXT_LOOK_COLOR[o.look] ? o.look : "box", color: o?.color })
  };
}
function topTextTouched(o) {
  return Boolean(o && (o.off || typeof o.text === "string" || o.sizeScale !== void 0 || o.pos || o.seconds !== void 0 || o.look || o.color));
}
const LEAD = 0.08;
function groupWords(words2, maxWords = 4, maxSeconds = 2.4) {
  const limit = Math.max(1, Math.floor(maxWords));
  const lines = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    lines.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (let i = 0; i < words2.length; i++) {
    const w = words2[i];
    if (cur.length && w.start - cur[cur.length - 1].end > 0.9) flush();
    cur.push(w);
    const dur = w.end - cur[0].start;
    const endsSentence = /[.!?]$/.test(w.text);
    if (cur.length >= limit || dur >= maxSeconds || endsSentence && cur.length >= 2 && limit > 1) flush();
  }
  flush();
  for (let i = 0; i < lines.length; i++) {
    const floor = i === 0 ? 0 : lines[i - 1].end;
    lines[i].start = Math.max(floor, lines[i].start - LEAD);
  }
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1];
    const extended = lines[i].end + 0.5;
    lines[i].end = next ? Math.max(lines[i].end, Math.min(extended, next.start - 0.02)) : extended;
  }
  return lines;
}
function assColor(hex, alpha = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const [r, g, b] = m ? [m[1].slice(0, 2), m[1].slice(2, 4), m[1].slice(4, 6)] : ["ff", "ff", "ff"];
  const a = Math.round((1 - Math.max(0, Math.min(1, alpha))) * 255).toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}
function tag(hex, alpha = 1) {
  return `${assColor(hex, alpha)}&`;
}
function alphaTag(alpha) {
  return `\\alpha&H${Math.round((1 - Math.max(0, Math.min(1, alpha))) * 255).toString(16).padStart(2, "0").toUpperCase()}&`;
}
function blurIn(unit) {
  return (radius) => unit === 1 ? radius : Math.max(0.5, Math.round(radius * unit * 10) / 10);
}
function enterTags(enter, ms, frame) {
  const { cx, cy, fontSize, playResX, tracking } = frame;
  const bl = blurIn(frame.unit);
  const lift = Math.round(fontSize * 1.15);
  const side = Math.round(playResX * 0.38);
  const fadeIn = Math.max(60, Math.round(ms * 0.7));
  switch (enter) {
    case "fade":
      return `\\fad(${ms},80)`;
    case "rise":
      return `\\move(${cx},${cy + lift},${cx},${cy},0,${ms})\\fad(${fadeIn},60)`;
    case "drop":
      return `\\move(${cx},${cy - lift},${cx},${cy},0,${ms})\\fad(${fadeIn},60)`;
    case "slide-left":
      return `\\move(${cx - side},${cy},${cx},${cy},0,${ms})\\fad(${fadeIn},60)`;
    case "slide-right":
      return `\\move(${cx + side},${cy},${cx},${cy},0,${ms})\\fad(${fadeIn},60)`;
    case "zoom":
      return `\\fscx145\\fscy145\\t(0,${ms},\\fscx100\\fscy100)`;
    case "shrink":
      return `\\fscx52\\fscy52\\t(0,${ms},\\fscx100\\fscy100)`;
    case "blur":
      return `\\blur${bl(16)}\\t(0,${ms},\\blur0)`;
    case "spread":
      return `\\fsp${tracking + Math.round(fontSize * 0.34)}\\t(0,${ms},\\fsp${tracking})`;
    case "flip":
      return `\\fry88\\t(0,${ms},\\fry0)`;
    case "spin":
      return `\\frz-185\\fscx35\\fscy35\\t(0,${ms},\\frz0\\fscx100\\fscy100)`;
    case "wipe": {
      const top = Math.max(0, cy - Math.round(fontSize * 2.8));
      const bottom = Math.min(frame.playResY, cy + Math.round(fontSize * 0.9));
      return `\\clip(0,${top},0,${bottom})\\t(0,${ms},\\clip(0,${top},${playResX},${bottom}))`;
    }
    case "lean":
      return `\\fax0.34\\t(0,${ms},\\fax0)`;
    case "pop-up": {
      const over = Math.round(ms * 0.6);
      return `\\fscx18\\fscy18\\t(0,${over},\\fscx118\\fscy118)\\t(${over},${ms},\\fscx100\\fscy100)`;
    }
    case "elastic": {
      const a = Math.round(ms * 0.42);
      const b = Math.round(ms * 0.7);
      return `\\fscx42\\fscy42\\t(0,${a},\\fscx122\\fscy122)\\t(${a},${b},\\fscx91\\fscy91)\\t(${b},${ms},\\fscx100\\fscy100)`;
    }
    case "bounce-in": {
      const land = Math.round(ms * 0.55);
      const squash = Math.round(ms * 0.78);
      return `\\move(${cx},${cy - Math.round(lift * 1.6)},${cx},${cy},0,${land})\\t(${land},${squash},\\fscx114\\fscy84)\\t(${squash},${ms},\\fscx100\\fscy100)`;
    }
    case "roll":
      return `\\move(${cx - side},${cy},${cx},${cy},0,${ms})\\frz-360\\t(0,${ms},\\frz0)`;
    case "swing": {
      const a = Math.round(ms * 0.5);
      const b = Math.round(ms * 0.78);
      return `\\frz-32\\t(0,${a},\\frz11)\\t(${a},${b},\\frz-5)\\t(${b},${ms},\\frz0)`;
    }
    case "tumble":
      return `\\frx-92\\t(0,${ms},\\frx0)`;
    case "stretch":
      return `\\fscx24\\t(0,${ms},\\fscx100)`;
    case "squeeze":
      return `\\fscy16\\t(0,${ms},\\fscy100)`;
    case "glitch": {
      const q = Math.max(1, Math.round(ms / 4));
      return `\\fax0.5\\blur${bl(7)}\\t(0,${q},\\fax-0.42\\blur${bl(2)})\\t(${q},${q * 2},\\fax0.26\\blur${bl(6)})\\t(${q * 2},${q * 3},\\fax-0.13\\blur${bl(1)})\\t(${q * 3},${ms},\\fax0\\blur0)`;
    }
    case "shake-in": {
      const q = Math.max(1, Math.round(ms / 4));
      return `\\fscx108\\fscy108\\frz7\\t(0,${q},\\frz-7)\\t(${q},${q * 2},\\frz5)\\t(${q * 2},${q * 3},\\frz-3)\\t(${q * 3},${ms},\\frz0\\fscx100\\fscy100)`;
    }
    case "mask-up": {
      const top = Math.max(0, cy - Math.round(fontSize * 2.8));
      const bottom = Math.min(frame.playResY, cy + Math.round(fontSize * 0.9));
      return `\\clip(0,${bottom},${playResX},${bottom})\\t(0,${ms},\\clip(0,${top},${playResX},${bottom}))`;
    }
    case "sweep": {
      const top = Math.max(0, cy - Math.round(fontSize * 2.8));
      const bottom = Math.min(frame.playResY, cy + Math.round(fontSize * 0.9));
      const fast = Math.max(40, Math.round(ms * 0.7));
      return `\\clip(0,${top},0,${bottom})\\t(0,${fast},\\clip(0,${top},${playResX},${bottom}))\\blur${bl(5)}\\t(0,${ms},\\blur0)`;
    }
    case "unfold":
      return `\\fry-92\\fscx26\\t(0,${ms},\\fry0\\fscx100)`;
    case "zoom-blur":
      return `\\fscx178\\fscy178\\blur${bl(15)}\\t(0,${ms},\\fscx100\\fscy100\\blur0)`;
    case "drift":
      return `\\move(${cx + Math.round(side * 0.3)},${cy + Math.round(lift * 0.5)},${cx},${cy},0,${ms})\\fad(${Math.max(120, ms)},120)`;
    case "flicker": {
      const s1 = Math.round(ms * 0.14);
      const s2 = Math.round(ms * 0.26);
      const s3 = Math.round(ms * 0.4);
      const s4 = Math.round(ms * 0.56);
      return `\\alpha&HFF&\\t(0,${s1},\\alpha&H15&)\\t(${s1},${s2},\\alpha&HD0&)\\t(${s2},${s3},\\alpha&H10&)\\t(${s3},${s4},\\alpha&H90&)\\t(${s4},${ms},\\alpha&H00&)`;
    }
    case "slam": {
      const hit = Math.round(ms * 0.45);
      return `\\move(${cx},${cy - lift * 2},${cx},${cy},0,${hit})\\fscx155\\fscy155\\blur${bl(9)}\\t(0,${hit},\\blur0)\\t(${hit},${ms},\\fscx100\\fscy100)`;
    }
    case "kick":
      return `\\move(${cx - Math.round(side * 0.5)},${cy},${cx},${cy},0,${ms})\\fax0.45\\t(0,${ms},\\fax0)`;
    default:
      return "";
  }
}
function accentTags(accent, ms, opts) {
  const bl = blurIn(opts.unit);
  const none = { pre: "", post: "" };
  const scaleBack = "\\fscx100\\fscy100";
  const bord = opts.activeOutline ?? opts.outline;
  switch (accent) {
    case "pop":
      return { pre: `\\fscx114\\fscy114\\t(0,${ms},${scaleBack})`, post: scaleBack };
    case "punch":
      return { pre: `\\fscx138\\fscy138\\t(0,${ms},${scaleBack})`, post: scaleBack };
    case "bounce": {
      const half = Math.round(ms * 0.45);
      return { pre: `\\fscx58\\fscy58\\t(0,${half},\\fscx117\\fscy117)\\t(${half},${ms},${scaleBack})`, post: scaleBack };
    }
    case "swell": {
      const half = Math.round(ms * 0.5);
      return { pre: `\\t(0,${half},\\fscx111\\fscy111)\\t(${half},${ms},${scaleBack})`, post: scaleBack };
    }
    case "squash":
      return { pre: `\\fscx132\\fscy72\\t(0,${ms},${scaleBack})`, post: scaleBack };
    case "wiggle": {
      const a = Math.round(ms * 0.33);
      const b = Math.round(ms * 0.66);
      return { pre: `\\frz-8\\t(0,${a},\\frz8)\\t(${a},${b},\\frz-4)\\t(${b},${ms},\\frz0)`, post: "\\frz0" };
    }
    case "shake": {
      const q = Math.round(ms * 0.25);
      return {
        pre: `\\frz4\\t(0,${q},\\frz-4)\\t(${q},${q * 2},\\frz3)\\t(${q * 2},${q * 3},\\frz-2)\\t(${q * 3},${ms},\\frz0)`,
        post: "\\frz0"
      };
    }
    case "tilt":
      return { pre: `\\frz-11\\t(0,${ms},\\frz0)`, post: "\\frz0" };
    case "flip":
      return { pre: `\\fry78\\t(0,${ms},\\fry0)`, post: "\\fry0" };
    case "lean":
      return { pre: `\\fax0.3\\t(0,${ms},\\fax0)`, post: "\\fax0" };
    case "glow":
      return { pre: `\\blur${bl(9)}\\t(0,${ms},\\blur0)`, post: "\\blur0" };
    case "flash":
      return { pre: `\\bord${Math.max(1, Math.round(bord * 2.2))}\\t(0,${ms},\\bord${bord})`, post: `\\bord${bord}` };
    case "spread": {
      const wide = opts.tracking + Math.round(opts.fontSize * 0.16);
      return { pre: `\\fsp${wide}\\t(0,${ms},\\fsp${opts.tracking})`, post: `\\fsp${opts.tracking}` };
    }
    case "heartbeat": {
      const a = Math.round(ms * 0.22);
      const b = Math.round(ms * 0.46);
      const c = Math.round(ms * 0.68);
      return { pre: `\\t(0,${a},\\fscx120\\fscy120)\\t(${a},${b},${scaleBack})\\t(${b},${c},\\fscx110\\fscy110)\\t(${c},${ms},${scaleBack})`, post: scaleBack };
    }
    case "jitter": {
      const q = Math.max(1, Math.round(ms / 4));
      return {
        pre: `\\fax0.3\\blur${bl(3)}\\t(0,${q},\\fax-0.3\\blur0)\\t(${q},${q * 2},\\fax0.18\\blur${bl(2)})\\t(${q * 2},${q * 3},\\fax-0.09)\\t(${q * 3},${ms},\\fax0\\blur0)`,
        post: "\\fax0\\blur0"
      };
    }
    case "spin":
      return { pre: `\\frz0\\t(0,${ms},\\frz360)`, post: "\\frz0" };
    case "flip-x":
      return { pre: `\\frx0\\t(0,${ms},\\frx360)`, post: "\\frx0" };
    case "wave": {
      const half = Math.round(ms * 0.5);
      return { pre: `\\fry-32\\t(0,${half},\\fry32)\\t(${half},${ms},\\fry0)`, post: "\\fry0" };
    }
    case "rock": {
      const half = Math.round(ms * 0.5);
      return { pre: `\\fax0.28\\t(0,${half},\\fax-0.28)\\t(${half},${ms},\\fax0)`, post: "\\fax0" };
    }
    case "grow":
      return { pre: `\\fscx76\\fscy76\\t(0,${ms},${scaleBack})`, post: scaleBack };
    case "bulge":
      return { pre: `\\fscx134\\t(0,${ms},\\fscx100)`, post: "\\fscx100" };
    case "tall":
      return { pre: `\\fscy140\\t(0,${ms},\\fscy100)`, post: "\\fscy100" };
    case "blink": {
      const a = Math.round(ms * 0.2);
      const b = Math.round(ms * 0.4);
      return { pre: `\\alpha&HFF&\\t(0,${a},\\alpha&H00&)\\t(${a},${b},\\alpha&HB0&)\\t(${b},${ms},\\alpha&H00&)`, post: "\\alpha&H00&" };
    }
    case "fill":
      return { pre: `\\c${tag(opts.text)}\\t(0,${ms},\\c${tag(opts.active)})`, post: "" };
    case "rainbow": {
      const a = Math.round(ms * 0.33);
      const b = Math.round(ms * 0.66);
      return {
        pre: `\\c${tag("#FF3B6B")}\\t(0,${a},\\c${tag("#FFD23F")})\\t(${a},${b},\\c${tag("#3DDC97")})\\t(${b},${ms},\\c${tag(opts.active)})`,
        post: ""
      };
    }
    case "neon": {
      const up = Math.round(ms * 0.4);
      return { pre: `\\blur0\\t(0,${up},\\blur${bl(8)})\\t(${up},${ms},\\blur${bl(1)})`, post: "\\blur0" };
    }
    case "thicken": {
      const bord2 = Math.max(1, bord);
      return { pre: `\\bord0\\t(0,${ms},\\bord${bord2})`, post: `\\bord${opts.outline}` };
    }
    case "shadow": {
      const kick = Math.max(2, Math.round((opts.shadow || opts.outline || 2) * 4));
      const half = Math.round(ms * 0.45);
      return { pre: `\\shad${kick}\\t(0,${half},\\shad${Math.round(kick / 2)})\\t(${half},${ms},\\shad${opts.shadow})`, post: `\\shad${opts.shadow}` };
    }
    default:
      return none;
  }
}
function assHex(hex) {
  const h = hex.replace("#", "").padEnd(6, "0").slice(0, 6).toUpperCase();
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`;
}
function readableOn(hex) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const lum = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
  return lum > 160 ? "#111111" : "#FFFFFF";
}
function lightenHex(hex, amount) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0");
  return `#${mix(n >> 16 & 255)}${mix(n >> 8 & 255)}${mix(n & 255)}`;
}
function topLook(look, color, fontSize, pad) {
  const r = (k) => Math.max(1, Math.round(fontSize * k));
  switch (look) {
    case "light":
      return { style: "Top", tags: `\\1c&H111111&\\3c&HFFFFFF&` };
    case "color":
      return { style: "Top", tags: `\\1c${assHex(readableOn(color))}\\3c${assHex(color)}` };
    case "marker":
      return { style: "Top", tags: `\\1c${assHex(readableOn(color))}\\3c${assHex(color)}\\bord${Math.max(2, Math.round(pad * 0.55))}` };
    case "outline":
      return { style: "TopPlain", tags: `\\1c${assHex(color)}\\3c&H000000&\\bord${r(0.12)}` };
    case "shadow":
      return { style: "TopPlain", tags: `\\1c&HFFFFFF&\\3c&H000000&\\bord${r(0.035)}\\4c${assHex(color)}\\4a&H00&\\shad${r(0.09)}` };
    case "neon":
      return {
        style: "TopPlain",
        under: `\\1c${assHex(color)}\\3c${assHex(color)}\\bord${r(0.16)}\\blur${r(0.3)}`,
        tags: `\\1c${assHex(lightenHex(color, 0.72))}\\3c${assHex(color)}\\bord${r(0.04)}\\blur${r(0.05)}`
      };
    case "sticker":
      return { style: "TopPlain", tags: `\\1c${assHex(color)}\\3c&HFFFFFF&\\bord${r(0.2)}\\4c&H000000&\\4a&H90&\\shad${r(0.06)}` };
    default:
      return { style: "Top", tags: "" };
  }
}
function buildAss(lines, styleId, playResX, playResY, top, overrides) {
  const preset = local.resolveCaptionPreset(styleId, overrides);
  if (!preset) return "";
  const px = (share) => Math.max(0, Math.round(share * playResX));
  const unit = Math.min(playResX, playResY) / 1080;
  const fixed = (pixels) => Math.round(pixels * unit);
  const side = fixed(60);
  const fontSize = Math.max(fixed(12), px(preset.size));
  const portrait = playResY > playResX;
  const marginV = Math.round(preset.bottom * (portrait ? 1 : 0.6) * playResY);
  const moved = preset.anchor ?? null;
  const restX = moved ? Math.round(moved.x * playResX) : Math.round(playResX / 2);
  const restY = moved ? Math.round(moved.y * playResY) : playResY - marginV;
  const outline = preset.box ? px(preset.box.pad) : px(preset.outline);
  const shadow = preset.box ? 0 : px(preset.shadow ?? 0);
  const outlineColour = preset.box ? assColor(preset.box.color, preset.box.alpha) : assColor(preset.outlineColor);
  const back = assColor(preset.shadowColor ?? "#000000");
  const borderStyle = preset.box ? 3 : 1;
  const tracking = px(preset.tracking ?? 0);
  const frame = { playResX, playResY, cx: restX, cy: restY, fontSize, tracking, unit };
  const designedSize = Math.max(fixed(12), px((local.findPreset(styleId) ?? preset).size));
  const topFontSize = Math.max(fixed(12), Math.round(designedSize * 0.85 * (top?.sizeScale ?? 1)));
  const topPad = Math.max(fixed(4), Math.round(playResX * 0.012 * (top?.sizeScale ?? 1)));
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,${preset.fontFamily},${fontSize},${assColor(preset.text)},${assColor(preset.active)},${outlineColour},${back},${preset.bold ? -1 : 0},${preset.italic ? -1 : 0},0,0,100,100,${tracking},0,${borderStyle},${outline},${shadow},2,${side},${side},${marginV},1`,
    `Style: Top,${preset.fontFamily},${topFontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HB0000000,${preset.bold ? -1 : 0},0,0,0,100,100,0,0,3,${topPad},0,8,${side},${side},${Math.round(playResY * TOP_TEXT_DEFAULT_POS.y)},1`,
    // The looks without a box (outline, 3D shadow, neon, sticker) draw letters and their edges only.
    `Style: TopPlain,${preset.fontFamily},${topFontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,${preset.bold ? -1 : 0},0,0,0,100,100,0,0,1,0,0,8,${side},${side},${Math.round(playResY * TOP_TEXT_DEFAULT_POS.y)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ];
  const events = [];
  if (top) {
    const tx = Math.round(top.pos.x * playResX);
    const ty = Math.round(top.pos.y * playResY);
    const look = topLook(top.look, top.color, topFontSize, topPad);
    const at = `\\pos(${tx},${ty})\\fad(150,250)`;
    if (look.under) events.push(`Dialogue: 19,${ts(0)},${ts(top.seconds)},${look.style},,0,0,0,,{${at}${look.under}}${esc(top.text)}`);
    events.push(`Dialogue: 20,${ts(0)},${ts(top.seconds)},${look.style},,0,0,0,,{${at}${look.tags}}${esc(top.text)}`);
  }
  const enterMs = Math.max(60, Math.round(preset.motion.enterMs ?? 220));
  const accentMs = Math.max(60, Math.round(preset.motion.accentMs ?? 150));
  const enter = enterTags(preset.motion.enter, enterMs, frame);
  const activeOutline = preset.activeOutline ? Math.max(1, Math.round(outline * (preset.activeOutlineScale ?? 2))) : null;
  const accent = accentTags(preset.motion.accent, accentMs, {
    outline,
    activeOutline,
    tracking,
    fontSize,
    shadow,
    text: preset.text,
    active: preset.active,
    unit
  });
  const activeOutlineTags = preset.activeOutline ? `\\3c${tag(preset.activeOutline)}\\bord${activeOutline}` : "";
  const restoreOutline = preset.activeOutline ? `\\3c${tag(preset.outlineColor)}\\bord${outline}` : "";
  const fx = preset.fx;
  const under = fx?.under ?? [];
  const mainLayer = under.length;
  const own2 = (n) => fx?.cycle?.length ? fx.cycle[n % fx.cycle.length] : null;
  const grow = fx?.emphasis ? Math.round(fx.emphasis.scale * 100) : 100;
  let wordBase = 0;
  for (const line of lines) {
    const emph = fx?.emphasis ? emphasisIndex(line.words) : -1;
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i];
      const start = i === 0 ? line.start : w.start;
      const end = i === line.words.length - 1 ? line.end : line.words[i + 1].start;
      if (end <= start) continue;
      const isFirst = i === 0;
      const shown = preset.reveal === "word" ? [i] : preset.reveal === "accumulate" ? range(0, i) : range(0, line.words.length - 1);
      const parts = shown.map((j) => {
        const text = esc(local.applyCase(line.words[j].text, preset.textCase));
        const mine = own2(wordBase + j);
        const big = j === emph ? `\\fscx${grow}\\fscy${grow}` : "";
        const unbig = j === emph ? "{\\fscx100\\fscy100}" : "";
        if (j !== i) {
          const spoken = j < i;
          let color = spoken ? mine ?? preset.spoken ?? preset.text : preset.upcoming ?? preset.text;
          if (j === emph) color = fx.emphasis.color;
          const alpha = !spoken && preset.upcomingAlpha !== void 0 ? alphaTag(preset.upcomingAlpha) : "";
          return `{\\c${tag(color)}${alpha}${big}}${text}${unbig}`;
        }
        const motion = isFirst ? { pre: "", post: "" } : accent;
        return `{\\c${tag(mine ?? preset.active)}${alphaTag(1)}${activeOutlineTags}${big}${motion.pre}}${text}{\\c${tag(preset.text)}${restoreOutline}${motion.post}}${unbig}`;
      });
      const pin = moved && !(isFirst && enter.includes("\\move")) ? `\\pos(${restX},${restY})` : "";
      const head = isFirst ? `{${pin}${enter}}`.replace("{}", "") : pin ? `{${pin}}` : "";
      const body = `${head}${parts.join(" ")}`;
      under.forEach((u, k) => events.push(`Dialogue: ${k},${ts(start)},${ts(end)},Cap,,0,0,0,,${underlay(body, u, px, restX, restY)}`));
      events.push(`Dialogue: ${mainLayer},${ts(start)},${ts(end)},Cap,,0,0,0,,${body}`);
    }
    wordBase += line.words.length;
  }
  return header.concat(events).join("\n") + "\n";
}
function emphasisIndex(words2) {
  let best = -1;
  let score = 0;
  words2.forEach((w, i) => {
    const t = w.text.replace(/[^\p{L}\p{N}]/gu, "");
    const s = new RegExp("\\p{N}", "u").test(t) ? 100 + t.length : t.length >= 5 ? t.length : 0;
    if (s > score) score = s, best = i;
  });
  return best;
}
const LOOK_TAGS = /\\(?:[1-4]?c|[1-4]a|alpha|x?bord|y?bord|x?shad|y?shad|blur|be)(?:&H[0-9A-Fa-f]+&?|-?\d+(?:\.\d+)?)/g;
function underlay(body, u, px, x, y) {
  let t = body.replace(LOOK_TAGS, "").replace(/\\t\([\d.,\s-]*\)/g, "");
  const dx = px(u.dx ?? 0);
  const dy = px(u.dy ?? 0);
  if (dx || dy) {
    if (/\\(?:pos|move)\(/.test(t)) {
      t = t.replace(/\\pos\((-?[\d.]+),(-?[\d.]+)\)/g, (_m, a, b) => `\\pos(${Number(a) + dx},${Number(b) + dy})`).replace(/\\move\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/g, (_m, a, b, c, d) => `\\move(${Number(a) + dx},${Number(b) + dy},${Number(c) + dx},${Number(d) + dy}`);
    } else {
      t = `{\\pos(${x + dx},${y + dy})}${t}`;
    }
  }
  const color = tag(u.color);
  const blur = u.blur ? `\\blur${Math.max(1, px(u.blur))}` : "";
  return `{\\1c${color}\\3c${color}${alphaTag(u.alpha ?? 1)}\\bord${Math.max(1, px(u.outline))}\\shad0${blur}}${t}`;
}
function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}
function buildSrt(lines) {
  return lines.map((l, i) => `${i + 1}
${srtTs(l.start)} --> ${srtTs(l.end)}
${l.words.map((w) => w.text).join(" ")}
`).join("\n");
}
function ts(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${ss.toFixed(2).padStart(5, "0")}`;
}
function srtTs(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1e3);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
function esc(t) {
  return t.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\n/g, " ");
}
const HINGLISH_WORDS = `
# Everyday Hindi, as Hinglish writes it
तो toh
नहीं nahi
नही nahi
नहि nahi
हम hum
हमने humne
हमें humein
हमको humko
हमसे humse
हमलोग humlog
यह yeh
वह woh
वहीं wahin
क्यों kyun
क्यूं kyun
क्योंकि kyunki
क्यूंकि kyunki
यूं yun
ज्यादा zyada
जरूरत zaroorat
जरूरी zaroori
जरूर zaroor
जिंदगी zindagi
जिन्दगी zindagi
चीज cheez
चीजें cheezein
चीजों cheezon
मां maa
इज्जत izzat
आवाज awaaz
मजा maza
मजे maze
मजाक mazaak
नजर nazar
नजरिया nazariya
सब्जी sabzi
हजार hazaar
हजारों hazaaron
इजाजत ijazat
जरा zara
खत्म khatam
मम्मी mummy
पापा papa
बारे baare
सारे saare
सारी saari
सारा saara
सामने saamne
बाकी baaki
काफी kaafi
इंसान insaan
कमाल kamaal
अरे arey
अबे abey
यानी yaani
बहन behen
बहनें behnein
वक्त waqt
वजह wajah
कुरान Quran
अल्लाह Allah
जिहाद jihad
भारत Bharat
हिंदुस्तान Hindustan
पाकिस्तान Pakistan
दिल्ली Delhi
मुंबई Mumbai
चाय chai
गलती galti
तलाक talaq
जगह jagah
ताकि taaki
आईने aaine
आई aayi
आए aaye
गई gayi
गए gaye
नई nayi
कई kai
भाई bhai
भाइयों bhaiyon
भैया bhaiya
दोस्तों doston
दोस्तो doston
ब्रह्मांड brahmand
रुपए rupaye
रुपये rupaye
बात baat
बातें baatein
जाता jaata
जाती jaati
जाते jaate
आता aata
करो karo
# English words written in Devanagari
एंड and
यू you
टू to
इज is
बट but
द the
दैट that
दैट्स that's
ऑफ of
इट it
इट्स it's
हैव have
वेरी very
दिस this
माय my
योर your
यौर your
देन then
आर are
फॉर for
फ्रॉम from
विद with
विथ with
एम am
बी be
वाज was
वेयर where
व्हेयर where
व्हाट what
व्हाट्स what's
व्हेन when
व्हाई why
व्हिच which
हू who
हाउ how
आल्सो also
ऑलसो also
ओनली only
जस्ट just
सो so
इफ if
ऑर or
नॉट not
डोंट don't
कांट can't
कैन can
विल will
वुड would
शुड should
कुड could
मस्ट must
नीड need
वांट want
वाना wanna
गोना gonna
वी we
देम them
देयर there
हियर here
शी she
मी me
अस us
यस yes
नो no
ओके okay
हाय hi
हेलो hello
हैलो hello
बाय bye
थैंक thank
थैंक्स thanks
थैंक्यू thank you
सॉरी sorry
प्लीज please
वेलकम welcome
ऑल all
मोर more
लेस less
मच much
मेनी many
वन one
थ्री three
फर्स्ट first
सेकंड second
थर्ड third
नेक्स्ट next
लास्ट last
एवर ever
नेवर never
ऑलवेज always
अगेन again
स्टिल still
ऑलरेडी already
नाउ now
टुडे today
टुमारो tomorrow
डे day
नाइट night
वीक week
मंथ month
ईयर year
इयर year
ईयर्स years
इयर्स years
मिनट minute
मिनट्स minutes
आवर hour
टाइम time
टाइम्स times
मोमेंट moment
एक्चुअली actually
बेसिकली basically
रियली really
सीरियसली seriously
ऑब्वियसली obviously
एग्जैक्टली exactly
डेफिनेटली definitely
प्रॉपर proper
प्रॉपरली properly
सिंपल simple
नॉर्मल normal
नॉर्मली normally
स्पेशल special
इंपोर्टेंट important
परफेक्ट perfect
बेस्ट best
गुड good
बैड bad
हैप्पी happy
सैड sad
फनी funny
कूल cool
ऑसम awesome
अमेजिंग amazing
सीरियस serious
डीप deep
फ्री free
ट्रू true
लेट late
अर्ली early
ओपन open
ओपनली openly
रिसेंटली recently
लाइक like
लाइक्स likes
लव love
हेट hate
फील feel
फीलिंग feeling
फीलिंग्स feelings
थिंक think
मीन mean
लुक look
सेड said
टेल tell
टॉक talk
ट्राई try
यूज use
मेक make
टेक take
गेट get
गॉट got
गिव give
गो go
डू do
डन done
वर्क work
प्ले play
स्टार्ट start
स्टॉप stop
वेट wait
चेक check
चेंज change
मिस miss
केयर care
ट्रस्ट trust
होप hope
हेल्प help
सपोर्ट support
एंजॉय enjoy
इमेजिन imagine
रिलाइज realise
रिएक्ट react
रिएक्शन reaction
परफॉर्म perform
मेंटेन maintain
कंप्लीट complete
इंगेज engage
कन्वर्ट convert
कट cut
सेट set
शेयर share
सब्सक्राइब subscribe
कमेंट comment
कमेंट्स comments
चैनल channel
वीडियो video
वीडियोज videos
लाइव live
स्ट्रीम stream
रील reel
रील्स reels
शॉर्ट्स shorts
कंटेंट content
क्रिएटर creator
व्यूज views
फॉलो follow
फॉलोअर्स followers
ट्रेंड trend
ट्रेंडिंग trending
वायरल viral
लिंक link
बेल bell
आइकन icon
यूट्यूब YouTube
यूट्यूबर YouTuber
इंस्टाग्राम Instagram
इंस्टा insta
फेसबुक Facebook
व्हाट्सएप WhatsApp
गूगल Google
पॉडकास्ट podcast
पडकास्ट podcast
एपिसोड episode
शो show
इंटरव्यू interview
गेस्ट guest
होस्ट host
इंट्रो intro
टॉपिक topic
टैग tag
मोबाइल mobile
फोन phone
लैपटॉप laptop
कंप्यूटर computer
इंटरनेट internet
ऑनलाइन online
ऑफलाइन offline
ऐप app
गेम game
गेम्स games
गेमिंग gaming
प्लेयर player
टीम team
मैच match
क्रिकेट cricket
स्कोर score
विन win
कप cup
वर्ल्ड world
हीरो hero
चैलेंज challenge
कॉमेडी comedy
कॉमेडियन comedian
जोक joke
रोस्ट roast
ड्रामा drama
मूवी movie
फिल्म film
सीन scene
सॉन्ग song
म्यूजिक music
आर्टिस्ट artist
एक्टर actor
एक्टिंग acting
बॉलीवुड Bollywood
सेलिब्रिटी celebrity
फैन fan
फैंस fans
लाइफ life
स्टोरी story
फैमिली family
फ्रेंड friend
फ्रेंड्स friends
ब्रदर brother
सिस्टर sister
मॉम mom
डैड dad
फादर father
मदर mother
पेरेंट्स parents
बेबी baby
बॉय boy
बॉयज boys
गर्ल girl
गर्ल्स girls
गाइज guys
गाइस guys
ब्रो bro
मैन man
पीपल people
पर्सन person
गर्लफ्रेंड girlfriend
बॉयफ्रेंड boyfriend
हस्बैंड husband
वाइफ wife
मैरिज marriage
रिलेशनशिप relationship
रिलेशन relation
ब्रेकअप breakup
क्रश crush
डेट date
डेटिंग dating
सिंगल single
डिवोर्स divorce
स्कूल school
कॉलेज college
क्लास class
स्टूडेंट student
टीचर teacher
एजुकेशन education
एग्जाम exam
स्टडी study
जॉब job
सैलरी salary
बॉस boss
ऑफिस office
मीटिंग meeting
प्रोजेक्ट project
बिजनेस business
कंपनी company
मार्केट market
प्रोडक्ट product
ऑफर offer
डील deal
बैंक bank
लोन loan
मनी money
इनकम income
प्रॉफिट profit
लॉस loss
इन्वेस्ट invest
इन्वेस्टमेंट investment
सक्सेस success
सक्सेसफुल successful
फेल fail
मोटिवेशन motivation
ड्रीम dream
गोल goal
प्लान plan
आइडिया idea
आईडिया idea
आईडी ID
माइंडसेट mindset
कॉन्फिडेंस confidence
स्ट्रेस stress
टेंशन tension
डिप्रेशन depression
इमोशनल emotional
मेंटल mental
हेल्थ health
जिम gym
वर्कआउट workout
फिट fit
फिटनेस fitness
डाइट diet
डॉक्टर doctor
हॉस्पिटल hospital
पुलिस police
गवर्नमेंट government
पॉलिटिक्स politics
पार्टी party
वोट vote
न्यूज news
मीडिया media
पब्लिक public
सोशल social
सिस्टम system
प्रॉब्लम problem
सिचुएशन situation
क्वेश्चन question
आंसर answer
रीजन reason
फैक्ट fact
रिजल्ट result
पॉइंट point
लेवल level
स्टेप step
टाइप type
साइड side
साइज size
लाइन line
लिमिट limit
डिटेल detail
कांसेप्ट concept
एग्जांपल example
एरिया area
सिटी city
रोड road
कार car
बाइक bike
ट्रेन train
फ्लाइट flight
होटल hotel
रूम room
हाउस house
होम home
किचन kitchen
ट्रिप trip
ट्रैवल travel
फूड food
पिज्जा pizza
बर्गर burger
कॉफी coffee
केक cake
क्रीम cream
फ्रिज fridge
कलर color
डिजाइन design
चॉइस choice
पर्सनल personal
पर्सनालिटी personality
कैरेक्टर character
बॉडी body
हार्ट heart
हेयर hair
मॉडर्न modern
पॉजिटिव positive
नेगेटिव negative
सिक्योर secure
सिक्योरिटी security
इनसिक्योरिटी insecurity
कम्युनिटी community
कनेक्शन connection
कन्वर्सेशन conversation
जजमेंट judgement
रिस्पेक्ट respect
प्रेशर pressure
चैप्टर chapter
पेपर paper
नंबर number
कार्ड card
ग्रुप group
सर्कल circle
स्पेस space
टॉप top
प्लेनेट planet
प्रेसिडेंट president
कोर्ट court
चेयर chair
हॉल hall
हॉस्टल hostel
मैम ma'am
गॉड god
पीरियड period
पीरियड्स periods
स्पीच speech
नोटिस notice
क्रेडिट credit
हैंडल handle
थिंग thing
थिंग्स things
समथिंग something
एवरीथिंग everything
एनीथिंग anything
नथिंग nothing
एवरीवन everyone
समवन someone
एव्री every
इवन even
ओवर over
आउट out
अप up
डाउन down
ऑन on
इन in
बैक back
अबाउट about
थ्रू through
बिकॉज because
लोनली lonely
फोर four
फाइव five
सिक्स six
सेवन seven
एट eight
नाइन nine
टेन ten
हंड्रेड hundred
थाउजेंड thousand
मिलियन million
पार्टनर partner
रूटीन routine
स्किन skin
सनस्क्रीन sunscreen
सीरम serum
टोनर toner
टेक्सचर texture
प्रोडक्ट्स products
ब्रांड brand
रिव्यू review
विटामिन vitamin
मेकअप makeup
क्लियर clear
पाउडर powder
अकॉर्डिंग according
रेसिपी recipe
कॉन्ट्रैक्ट contract
कांट्रैक्ट contract
लैंड land
पार्ट part
प्राइसलेस priceless
इंडिया India
इंडियन Indian
इंग्लिश English
हिंदी Hindi
उर्दू Urdu
`;
const DEVANAGARI = /[ऀ-ॿ]/;
function hasDevanagari(text) {
  return DEVANAGARI.test(text);
}
const CONSONANTS = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  ङ: "n",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ञ: "n",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  ऩ: "n",
  प: "p",
  फ: "f",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ऱ: "r",
  ल: "l",
  ळ: "l",
  ऴ: "l",
  व: "w",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h"
};
const NUKTA = { क: "q", ख: "kh", ग: "gh", ज: "z", ड: "d", ढ: "dh", फ: "f", य: "y" };
const VOWELS = {
  अ: "a",
  आ: "aa",
  इ: "i",
  ई: "ee",
  उ: "u",
  ऊ: "oo",
  ऋ: "ri",
  ॠ: "ri",
  ऌ: "li",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
  ऑ: "o",
  ऍ: "e",
  ऎ: "e",
  ऒ: "o"
};
const SIGNS = {
  "ा": "aa",
  "ि": "i",
  "ी": "ee",
  "ु": "u",
  "ू": "oo",
  "ृ": "ri",
  "ॄ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ॉ": "o",
  "ॅ": "e",
  "ॆ": "e",
  "ॊ": "o",
  "ॢ": "li"
};
const VIRAMA = "्";
const NUKTA_SIGN = "़";
const NASALS = /* @__PURE__ */ new Set(["ं", "ँ"]);
const VISARGA = "ः";
const DIGITS = "०१२३४५६७८९";
function parse(word) {
  const units = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const last = units[units.length - 1];
    if (CONSONANTS[ch] !== void 0) {
      let c = CONSONANTS[ch];
      if (chars[i + 1] === NUKTA_SIGN && NUKTA[ch]) {
        c = NUKTA[ch];
        i++;
      }
      units.push({ c, dev: ch, v: "a", schwa: true, nasal: false, visarga: false });
    } else if (VOWELS[ch] !== void 0) {
      units.push({ c: "", dev: ch, v: VOWELS[ch], schwa: false, nasal: false, visarga: false });
    } else if (SIGNS[ch] !== void 0) {
      if (last && last.schwa) {
        last.v = SIGNS[ch];
        last.schwa = false;
      } else {
        units.push({ c: "", dev: ch, v: SIGNS[ch], schwa: false, nasal: false, visarga: false });
      }
    } else if (ch === VIRAMA) {
      if (last) {
        last.v = null;
        last.schwa = false;
      }
    } else if (NASALS.has(ch)) {
      if (last) last.nasal = true;
    } else if (ch === VISARGA) {
      if (last) last.visarga = true;
    } else if (ch === NUKTA_SIGN || ch === "‍" || ch === "‌") ;
    else {
      return null;
    }
  }
  return units;
}
const LABIALS = /* @__PURE__ */ new Set(["p", "ph", "b", "bh", "m"]);
const CLUSTER_KEEPS_A = /* @__PURE__ */ new Set(["र", "य", "व"]);
function byRules(word) {
  const u = parse(word);
  if (!u || u.length === 0) return null;
  const n = u.length;
  const hasVowel = (x) => x.v !== null;
  const lastU = u[n - 1];
  if (n > 1 && lastU.schwa && !lastU.nasal && !lastU.visarga) {
    const afterCluster = n >= 2 && u[n - 2].v === null && u[n - 2].c !== "";
    if (!(afterCluster && CLUSTER_KEEPS_A.has(lastU.dev))) lastU.v = null;
  }
  for (let i = n - 2; i >= 1; i--) {
    const x = u[i];
    if (!x.schwa || x.v === null || x.nasal || x.visarga) continue;
    const left = u[i - 1];
    const right = u[i + 1];
    if (!hasVowel(left)) continue;
    if (right.c === "" || !hasVowel(right)) continue;
    x.v = null;
  }
  const syllables = u.filter(hasVowel).length;
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = u[i];
    const next = u[i + 1];
    let c = x.c;
    const prevV = i > 0 ? u[i - 1].v : null;
    if (x.dev === "व" && (x.v === "i" || x.v === "ee" || prevV === "e" || prevV === "ee" || prevV === "i")) c = "v";
    if (x.dev === "च" && x.v === null && next && (next.dev === "छ" || next.dev === "च")) c = "c";
    if (x.dev === "छ" && i > 0 && u[i - 1].dev === "च" && u[i - 1].v === null) c = "ch";
    out += c;
    let v = x.v ?? "";
    const isLast = i === n - 1;
    const prev = u[i - 1];
    const afterVowel = Boolean(prev && prev.v !== null && !prev.nasal);
    if (x.c === "") {
      if (x.dev === "ए" && afterVowel && prev.v !== "u" && prev.v !== "oo") v = "ye";
      else if (x.dev === "आ" && afterVowel && isLast) v = "a";
    } else if (v === "aa") {
      const closed = i === n - 2 && next && next.v === null && next.dev !== "ह";
      v = syllables === 1 && (closed || x.nasal) ? "aa" : "a";
    }
    if (v === "ee" && isLast) v = "i";
    if (v === "oo" && isLast && x.c !== "" && !x.nasal) v = "u";
    if (v === "e" && isLast && x.nasal) v = "ei";
    if (x.v === "a" && next && next.dev === "ह" && next.v === null && i + 2 < n) v = "e";
    if (x.dev === "छ" && isLast && x.v === null) out = out.slice(0, -3) + "ch";
    out += v;
    if (x.nasal) {
      const following = next ? next.c : "";
      if (following === "n" || following === "m") ;
      else out += LABIALS.has(following) ? "m" : "n";
    }
    if (x.visarga) out += "h";
  }
  return out;
}
let words = null;
function wordList() {
  if (words) return words;
  words = /* @__PURE__ */ new Map();
  for (const line of HINGLISH_WORDS.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const at = t.indexOf(" ");
    if (at < 0) continue;
    words.set(t.slice(0, at).normalize("NFC"), t.slice(at + 1).trim());
  }
  return words;
}
function lookup(core) {
  const list = wordList();
  return list.get(core) ?? list.get(core.replace(/ँ/g, "ं")) ?? list.get(core.replace(/़/g, ""));
}
function hinglishWord(text) {
  if (!hasDevanagari(text)) return text;
  text = text.normalize("NFC");
  let out = "";
  const re = /[ऀ-ॣॱ-ॿ‌‍]+|[।॥]|[०-९]|[^ऀ-ॿ]+/g;
  for (const m of text.matchAll(re)) {
    const part = m[0];
    if (part === "।" || part === "॥") out += ".";
    else if (/^[०-९]$/.test(part)) out += String(DIGITS.indexOf(part));
    else if (hasDevanagari(part)) out += lookup(part) ?? byRules(part) ?? part;
    else out += part;
  }
  return out;
}
function hinglish(text) {
  if (!hasDevanagari(text)) return text;
  return text.split(/(\s+)/).map((w) => /\s/.test(w) ? w : hinglishWord(w)).join("");
}
const hinglishByRules = (word) => byRules(word.normalize("NFC")) ?? word;
const FACE_FPS = 10;
const BIN = 0.5;
const SWITCH_AFTER = 2;
const MIN_SHOT = 1.5;
function patch(bgr, cx, cy, w, h, gw = 16, gh = 8) {
  const out = new Float32Array(gw * gh);
  let sum = 0;
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const x = Math.min(YUNET_SIZE - 1, Math.max(0, Math.round(cx - w / 2 + (i + 0.5) * w / gw)));
      const y = Math.min(YUNET_SIZE - 1, Math.max(0, Math.round(cy - h / 2 + (j + 0.5) * h / gh)));
      const p = (y * YUNET_SIZE + x) * 3;
      const v = 0.114 * bgr[p] + 0.587 * bgr[p + 1] + 0.299 * bgr[p + 2];
      out[j * gw + i] = v;
      sum += v;
    }
  }
  const mean = sum / out.length;
  let sq = 0;
  for (const v of out) sq += (v - mean) ** 2;
  const sd = Math.sqrt(sq / out.length) || 1;
  for (let k = 0; k < out.length; k++) out[k] = (out[k] - mean) / sd;
  return out;
}
const change = (a, b) => {
  let d = 0;
  for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]);
  return d / a.length;
};
async function sampleFaces(o) {
  const scale = Math.min(YUNET_SIZE / o.srcW, YUNET_SIZE / o.srcH);
  const picW = o.srcW * scale;
  const picH = o.srcH * scale;
  const frameBytes = YUNET_SIZE * YUNET_SIZE * 3;
  const args = [
    "-hide_banner",
    "-nostdin",
    "-v",
    "error",
    "-ss",
    o.start.toFixed(3),
    "-t",
    o.seconds.toFixed(3),
    "-i",
    o.input,
    "-vf",
    `fps=${FACE_FPS},scale=${YUNET_SIZE}:${YUNET_SIZE}:force_original_aspect_ratio=decrease,pad=${YUNET_SIZE}:${YUNET_SIZE}:0:0`,
    "-pix_fmt",
    "bgr24",
    "-f",
    "rawvideo",
    "pipe:1"
  ];
  const child = node_child_process.spawn(o.ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
  const kill = () => child.kill("SIGKILL");
  o.signal?.addEventListener("abort", kill, { once: true });
  let stderr = "";
  child.stderr.on("data", (d) => stderr = (stderr + d).slice(-2e3));
  const samples = [];
  const tracks = [];
  let nextId = 0;
  let index = 0;
  let pending = Buffer.alloc(0);
  const onFrame = async (bgr) => {
    const t = index++ / FACE_FPS;
    const faces = await detectFaces(bgr, o.modelPath);
    const free = new Set(tracks.filter((tr) => index - tr.seen <= FACE_FPS));
    for (const f of faces.sort((a, b) => b.w * b.h - a.w * a.h)) {
      let best = null;
      let bestIou = 0.25;
      for (const tr of free) {
        const v = iou(tr.box, f);
        if (v > bestIou) best = tr, bestIou = v;
      }
      const track = best ?? { id: nextId++, box: f, seen: index };
      if (best) free.delete(best);
      else tracks.push(track);
      const [re, le, , rm, lm] = f.kps;
      const mouthW = Math.max(6, Math.hypot(lm[0] - rm[0], lm[1] - rm[1]) * 1.6);
      const eyeW = Math.max(6, Math.hypot(le[0] - re[0], le[1] - re[1]) * 1.4);
      const mouth = patch(bgr, (rm[0] + lm[0]) / 2, (rm[1] + lm[1]) / 2 + mouthW * 0.05, mouthW, mouthW * 0.55);
      const eyes = patch(bgr, (re[0] + le[0]) / 2, (re[1] + le[1]) / 2, eyeW, eyeW * 0.45);
      const fresh = track.mouth && index - track.seen === 1;
      const lip = fresh ? Math.max(0, change(mouth, track.mouth) - 0.8 * change(eyes, track.eyes)) : 0;
      Object.assign(track, { box: f, seen: index, mouth, eyes });
      samples.push({ t, track: track.id, cx: (f.x + f.w / 2) / picW, cy: (f.y + f.h / 2) / picH, h: f.h / picH, lip });
    }
  };
  await new Promise((resolve, reject) => {
    let busy = Promise.resolve();
    let failed = null;
    child.stdout.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= frameBytes) {
        const frame = new Uint8Array(pending.subarray(0, frameBytes));
        pending = pending.subarray(frameBytes);
        child.stdout.pause();
        busy = busy.then(() => failed ? void 0 : onFrame(frame)).catch((err) => {
          failed ??= err;
          kill();
        }).finally(() => child.stdout.resume());
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      o.signal?.removeEventListener("abort", kill);
      busy.then(() => {
        if (failed) reject(failed);
        else if (o.signal?.aborted) reject(new Error("Cancelled"));
        else if (code !== 0) reject(new Error(`Could not read frames for speaker tracking: ${stderr.trim().split("\n").pop()}`));
        else resolve();
      }, reject);
    });
  });
  return samples;
}
function planShots(samples, seconds2, speaking) {
  if (!samples.length) return [];
  const count = /* @__PURE__ */ new Map();
  for (const s of samples) count.set(s.track, (count.get(s.track) ?? 0) + 1);
  const real = onlyPeople(mergePeople(samples.filter((s) => (count.get(s.track) ?? 0) >= FACE_FPS)));
  if (!real.length) return [];
  const bins = Math.max(1, Math.ceil(seconds2 / BIN));
  const byBin = Array.from({ length: bins }, () => /* @__PURE__ */ new Map());
  for (const s of real) {
    const b = Math.min(bins - 1, Math.floor(s.t / BIN));
    const list = byBin[b].get(s.track) ?? [];
    list.push(s);
    byBin[b].set(s.track, list);
  }
  const present = (b, track) => (byBin[b].get(track)?.length ?? 0) >= BIN * FACE_FPS / 2;
  const biggest = (b) => {
    let id = -1;
    let size = 0;
    for (const [track, list] of byBin[b]) {
      const h = list.reduce((a, s) => a + s.h, 0) / list.length;
      if (present(b, track) && h > size) size = h, id = track;
    }
    return id;
  };
  const winner = (b) => {
    const tracks = [...byBin[b].keys()].filter((tr) => present(b, tr));
    if (tracks.length === 1) return tracks[0];
    if (!tracks.length || !speaking(b * BIN, (b + 1) * BIN)) return -1;
    const lip = tracks.map((tr) => ({ tr, v: byBin[b].get(tr).reduce((a, s) => a + s.lip, 0) / byBin[b].get(tr).length })).sort((a, b2) => b2.v - a.v);
    return lip[0].v > 0.05 && lip[0].v >= lip[1].v * 1.3 ? lip[0].tr : -1;
  };
  const plan = [];
  let current = -1;
  let streak = { track: -1, from: 0, n: 0 };
  for (let b = 0; b < bins; b++) {
    const w = winner(b);
    const gone = current >= 0 && !present(b, current) && !present(Math.max(0, b - 1), current);
    if (current < 0 || gone) {
      const pick2 = w >= 0 ? w : biggest(b);
      if (pick2 >= 0 && pick2 !== current) {
        current = pick2;
        plan.push({ start: b * BIN, track: pick2 });
      }
      streak = { track: -1, from: 0, n: 0 };
      continue;
    }
    if (w < 0 || w === current) {
      streak = { track: -1, from: 0, n: 0 };
      continue;
    }
    streak = streak.track === w ? { ...streak, n: streak.n + 1 } : { track: w, from: b, n: 1 };
    const last = plan[plan.length - 1];
    if (streak.n >= SWITCH_AFTER && streak.from * BIN - last.start >= MIN_SHOT) {
      current = w;
      plan.push({ start: streak.from * BIN, track: w });
      streak = { track: -1, from: 0, n: 0 };
    }
  }
  if (!plan.length) return [];
  plan[0].start = 0;
  const median2 = (v) => {
    const s = [...v].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0.5;
  };
  return plan.map((p, i) => {
    const end = i + 1 < plan.length ? plan[i + 1].start : seconds2;
    const own2 = real.filter((s) => s.track === p.track && s.t >= p.start && s.t < end);
    const all = own2.length ? own2 : real.filter((s) => s.track === p.track);
    return { start: p.start, end, cx: median2(all.map((s) => s.cx)), cy: median2(all.map((s) => s.cy)), track: p.track };
  });
}
function mergePeople(samples) {
  const info = /* @__PURE__ */ new Map();
  for (const s of samples) {
    const i = info.get(s.track) ?? { from: s.t, cx: 0, cy: 0, n: 0 };
    i.from = Math.min(i.from, s.t);
    i.cx += s.cx;
    i.cy += s.cy;
    i.n++;
    info.set(s.track, i);
  }
  const ids = [...info.keys()].sort((a, b) => info.get(a).from - info.get(b).from);
  const person = /* @__PURE__ */ new Map();
  const people = [];
  for (const id of ids) {
    const me = info.get(id);
    const near = people.find(
      (p) => p.tracks.every((t) => {
        const o = info.get(t);
        return Math.abs(o.cx / o.n - me.cx / me.n) < 0.08 && Math.abs(o.cy / o.n - me.cy / me.n) < 0.12;
      })
    );
    if (near) near.tracks.push(id);
    else people.push({ id, tracks: [id] });
    person.set(id, near ? near.id : id);
  }
  return samples.map((s) => ({ ...s, track: person.get(s.track) ?? s.track }));
}
function onlyPeople(samples) {
  const byPerson = /* @__PURE__ */ new Map();
  for (const s of samples) byPerson.set(s.track, [...byPerson.get(s.track) ?? [], s]);
  const stats = [...byPerson].map(([id, list]) => {
    const hs = list.map((s) => s.h).sort((a, b) => a - b);
    return { id, h: hs[Math.floor(hs.length / 2)], lip: list.reduce((a, s) => a + s.lip, 0) / list.length };
  });
  const tallest = Math.max(...stats.map((p) => p.h));
  const keep = new Set(stats.filter((p) => p.h >= tallest * 0.6 && (p.lip >= 0.02 || stats.length === 1)).map((p) => p.id));
  return samples.filter((s) => keep.has(s.track));
}
function speakingFrom(words2) {
  return (t0, t1) => words2.some((w) => w.start < t1 && w.end > t0);
}
function safeName(s, max) {
  const clean2 = s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  if (clean2.length <= max) return clean2 || "Clip";
  const cut = clean2.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim() || "Clip";
}
function projectClipsDir(clipsDir, projectName) {
  return path.join(clipsDir, safeName(projectName, 80));
}
function clipFileName(index, title) {
  return `${String(index + 1).padStart(2, "0")} - ${safeName(title, 70)}`;
}
async function newClipTarget(clipsDir, projectName, index, title) {
  const saveDir = projectClipsDir(clipsDir, projectName);
  const base = clipFileName(index, title);
  let saveName = base;
  for (let n = 2; await node_fs.promises.access(path.join(saveDir, `${saveName}.mp4`)).then(() => true, () => false); n++) saveName = `${base} (${n})`;
  return { saveDir, saveName };
}
const YUNET_FILE = "face_detection_yunet_2023mar.onnx";
function targetSize(aspect, resolution) {
  const short = resolutionShortSide(resolution);
  const long = Math.round(short * 16 / 9 / 2) * 2;
  if (aspect === "9:16") return { w: short, h: long };
  if (aspect === "1:1") return { w: short, h: short };
  return { w: long, h: short };
}
function computeKeepIntervals(start, end, words2, tighten, maxGap = 1, padding = 0.25) {
  if (!tighten) return [{ start, end }];
  const inRange = words2.filter((w) => w.end > start && w.start < end);
  if (inRange.length < 2) return [{ start, end }];
  const keep = [];
  let curStart = Math.max(start, inRange[0].start - padding);
  if (curStart - start < maxGap) curStart = start;
  let curEnd = inRange[0].end;
  for (let i = 1; i < inRange.length; i++) {
    const w = inRange[i];
    const gap = w.start - curEnd;
    if (gap > maxGap) {
      keep.push({ start: curStart, end: Math.min(end, curEnd + padding) });
      curStart = Math.max(start, w.start - padding);
    }
    curEnd = Math.max(curEnd, w.end);
  }
  const tailEnd = end - curEnd < maxGap ? end : Math.min(end, curEnd + padding);
  keep.push({ start: curStart, end: tailEnd });
  const merged = [];
  for (const k of keep) {
    const last = merged[merged.length - 1];
    if (last && k.start - last.end < 0.12) last.end = Math.max(last.end, k.end);
    else if (k.end - k.start > 0.05) merged.push({ ...k });
  }
  return merged.length ? merged : [{ start, end }];
}
const SEEK_LEAD = 2;
const RENDER_STALL_MS = 18e4;
// Weak PCs (<=4 cores or <8 GB RAM) get a lighter pipeline by default.
// SNU_FAST=1 forces it on any machine; SNU_FAST=0 restores full quality.
const SNU_WEAK = process.env.SNU_FAST === "1" || (process.env.SNU_FAST !== "0" && ((os.cpus()?.length ?? 4) <= 4 || os.totalmem() < 8 * 1024 ** 3));
function seekPoint(keep) {
  return Math.max(0, Math.floor(((keep[0]?.start ?? 0) - SEEK_LEAD) * 1e3));
}
function readSeconds(keep, seekMs) {
  const end = keep.length ? keep[keep.length - 1].end : 0;
  return Math.max(1, end - seekMs / 1e3 + 1);
}
const FPS = 30;
function snapToFrames(keep, seekMs) {
  const origin = seekMs / 1e3;
  const snap = (t) => origin + Math.round((t - origin) * FPS) / FPS;
  const out = [];
  for (const k of keep) {
    const start = snap(k.start);
    const end = snap(k.end);
    if (end <= start) continue;
    const last = out[out.length - 1];
    if (last && start <= last.end + 1e-6) last.end = Math.max(last.end, end);
    else out.push({ start, end });
  }
  return out.length ? out : keep;
}
function cutFilters(keep, seekMs, hasAudio) {
  const rel = (s) => s - seekMs / 1e3;
  const half = 0.5 / FPS;
  const ranges = keep.map((k) => `between(t,${(rel(k.start) - half).toFixed(4)},${(rel(k.end) - half).toFixed(4)})`).join("+");
  const parts = [`[0:v]fps=${FPS}:start_time=0,select='${ranges}',setpts=N/${FPS}/TB[vc]`];
  if (!hasAudio) return parts;
  const ins = [];
  keep.forEach((k, i) => {
    const dur = k.end - k.start;
    const fade = Math.min(0.015, dur / 3).toFixed(4);
    const fades = [
      i > 0 ? `,afade=t=in:d=${fade}` : "",
      i < keep.length - 1 ? `,afade=t=out:st=${(dur - Number(fade)).toFixed(4)}:d=${fade}` : ""
    ].join("");
    parts.push(`[0:a]aresample=async=1:first_pts=0,atrim=start=${rel(k.start).toFixed(4)}:end=${rel(k.end).toFixed(4)},asetpts=PTS-STARTPTS${fades}[a${i}]`);
    ins.push(`[a${i}]`);
  });
  parts.push(keep.length > 1 ? `${ins.join("")}concat=n=${keep.length}:v=0:a=1[ac]` : `${ins[0]}anull[ac]`);
  return parts;
}
function remapTime(t, keep) {
  let acc = 0;
  for (const k of keep) {
    if (t <= k.start) return acc;
    if (t <= k.end) return acc + (t - k.start);
    acc += k.end - k.start;
  }
  return acc;
}
function buildVideoFilter(aspect, layout, assPath, srcW, srcH, fontsDir, crop, follow, resolution, stack) {
  const { w, h } = targetSize(aspect, resolution);
  const unit = Math.min(w, h) / 1080;
  const blurR = (r) => Math.max(1, Math.round(r * unit));
  const srcAspect = srcW / srcH;
  const dstAspect = w / h;
  let chain;
  const nearlySame = Math.abs(srcAspect - dstAspect) < 0.02;
  if (layout === "stack" && srcW > 0 && srcH > 0) {
    chain = stackFilter(stackPlan(srcW, srcH, w, h, stack), w);
  } else if (layout === "follow" && follow?.length && srcW > 0 && srcH > 0 && !nearlySame) {
    const even2 = (value2) => Math.max(2, Math.round(value2 / 2) * 2);
    const cw = srcAspect > dstAspect ? Math.min(srcW, even2(srcH * dstAspect)) : srcW;
    const ch = srcAspect > dstAspect ? srcH : Math.min(srcH, even2(srcW / dstAspect));
    const at = (share, size, total) => Math.max(0, Math.min(total - size, Math.round(share * total - size / 2)));
    const piecewise = (values) => {
      let expr = String(values[values.length - 1]);
      for (let i = values.length - 2; i >= 0; i--) expr = `if(lt(t,${follow[i + 1].start.toFixed(3)}),${values[i]},${expr})`;
      return expr;
    };
    const xs = follow.map((s) => at(s.cx, cw, srcW));
    const ys = follow.map((s) => at(s.cy, ch, srcH));
    chain = `crop=${cw}:${ch}:x='${piecewise(xs)}':y='${piecewise(ys)}',scale=${w}:${h}`;
  } else if (layout === "manual" && srcW > 0 && srcH > 0) {
    const rect = cropRect(crop, srcAspect, dstAspect);
    const even2 = (value2, limit) => Math.max(2, Math.min(limit, Math.round(value2 / 2) * 2));
    const cw = even2(srcW * rect.w, srcW);
    const ch = even2(srcH * rect.h, srcH);
    const cx = Math.max(0, Math.min(srcW - cw, Math.round(srcW * rect.x)));
    const cy = Math.max(0, Math.min(srcH - ch, Math.round(srcH * rect.y)));
    chain = `crop=${cw}:${ch}:${cx}:${cy},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  } else if (layout === "original" || nearlySame) {
    chain = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`;
  } else if (layout === "crop" || layout === "follow") {
    chain = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  } else {
    chain = `split=2[bg][fg];[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=luma_radius=${blurR(SNU_WEAK ? 12 : 30)}:luma_power=${SNU_WEAK ? 1 : 2}:chroma_radius=${blurR(SNU_WEAK ? 6 : 15)}:chroma_power=${SNU_WEAK ? 1 : 2},eq=brightness=-0.08[bgb];[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2`;
  }
  chain += `,setsar=1,format=yuv420p`;
  if (assPath) chain += `,${assFilter(assPath, fontsDir)}`;
  return { filter: chain, w, h };
}
function assFilter(assPath, fontsDir) {
  return `ass='${local.escapeFilterPath(assPath)}'${fontsDir ? `:fontsdir='${local.escapeFilterPath(fontsDir)}'` : ""}`;
}
function logoFilters(logo, from, to, input, W, H) {
  const box = logoBox(logo, W, H);
  const alpha = logo.opacity < 1 ? `,colorchannelmixer=aa=${logo.opacity.toFixed(2)}` : "";
  return [
    `[${input}:v]format=rgba,scale=${box.w}:${box.h}:flags=lanczos${alpha}[logo]`,
    `${from}[logo]overlay=x=${box.x}:y=${box.y},format=yuv420p${to}`
  ];
}
function textOverlayFilters(texts, from, to, firstInput, W, H) {
  const out = [];
  const k = W / TEXT_CARD_REFERENCE_WIDTH;
  const a = TEXT_ANIM_SECONDS;
  let prev = from;
  texts.forEach((t, i) => {
    const s = t.start.toFixed(3);
    const e = t.end.toFixed(3);
    const fadeOut = Math.max(t.start, t.end - a).toFixed(3);
    const cw = Math.max(2, Math.round(t.card.w * k));
    const ch = Math.max(2, Math.round(t.card.h * k));
    const cx = Math.round(Math.min(W - cw / 2, Math.max(cw / 2, t.pos.x * W)));
    const cy = Math.round(Math.min(H - ch / 2, Math.max(ch / 2, t.pos.y * H)));
    const fades = [
      t.entrance === "none" ? "" : `fade=t=in:st=${s}:d=${a}:alpha=1`,
      `fade=t=out:st=${fadeOut}:d=${a}:alpha=1`
    ].filter(Boolean).join(",");
    let size = `scale=${cw}:${ch}`;
    let y = `${cy}-h/2`;
    if (t.entrance === "pop") {
      const grow = `(0.7+0.3*min(1,max(0,(t-${s})/${a})))`;
      size = `scale=w='trunc(${cw}*${grow}/2)*2':h='trunc(${ch}*${grow}/2)*2':eval=frame`;
    } else if (t.entrance === "slide") {
      y = `${cy}-h/2+${Math.round(0.04 * H)}*max(0,1-(t-${s})/${a})`;
    }
    out.push(`[${firstInput + i}:v]format=rgba,${size},${fades}[txt${i}]`);
    const next = i === texts.length - 1 ? to : `[vt${i}]`;
    out.push(`${prev}[txt${i}]overlay=x='${cx}-w/2':y='${y}':eval=frame:enable='between(t,${s},${e})'${next === to ? ",format=yuv420p" : ""}${next}`);
    prev = next;
  });
  return out;
}
async function followShots(o, keep, cachePath) {
  const h = o.highlight;
  if (!o.fontsDir) return [];
  const modelPath = path.join(path.dirname(o.fontsDir), "models", YUNET_FILE);
  const key2 = { input: o.input, start: h.start, end: h.end, fps: FACE_FPS, v: 1 };
  let samples = null;
  try {
    const cached2 = JSON.parse(await node_fs.promises.readFile(cachePath, "utf8"));
    if (JSON.stringify(cached2.key) === JSON.stringify(key2)) samples = cached2.samples;
  } catch {
  }
  if (!samples) {
    try {
      samples = await sampleFaces({
        ffmpeg: o.bins.ffmpeg,
        input: o.input,
        start: h.start,
        seconds: h.end - h.start,
        srcW: o.sourceWidth,
        srcH: o.sourceHeight,
        modelPath,
        signal: o.signal
      });
      await node_fs.promises.writeFile(cachePath, JSON.stringify({ key: key2, samples }), "utf8");
    } catch (err) {
      if (o.signal?.aborted) throw err;
      o.log(`Could not look for faces (${err.message}); using a centre crop.`);
      return [];
    }
  }
  const words2 = o.words.filter((w) => w.end > h.start && w.start < h.end).map((w) => ({ ...w, start: w.start - h.start, end: w.end - h.start }));
  const shots = planShots(samples, h.end - h.start, speakingFrom(words2));
  if (!shots.length) {
    o.log("No face found in this clip; using a centre crop.");
    return [];
  }
  o.log(`Following the speaker: ${shots.length} shot${shots.length > 1 ? "s" : ""} between ${new Set(shots.map((s) => s.track)).size} ${new Set(shots.map((s) => s.track)).size > 1 ? "people" : "person"}.`);
  const cuts = [];
  let acc = 0;
  for (const k of keep.slice(0, -1)) cuts.push(acc += k.end - k.start);
  const onCut = (t) => {
    const near = cuts.reduce((best, c) => Math.abs(c - t) < Math.abs(best - t) ? c : best, Infinity);
    return Math.abs(near - t) <= 0.5 ? near : t;
  };
  return shots.map((s, i) => ({ start: i === 0 ? 0 : onCut(remapTime(h.start + s.start, keep)), cx: s.cx, cy: s.cy }));
}
async function renderClip(o) {
  const { highlight: h, settings } = o;
  const rough = computeKeepIntervals(h.start, h.end, o.words, settings.tightenSilences);
  const seekMs = seekPoint(rough);
  const keep = snapToFrames(rough, seekMs);
  const editedDuration = keep.reduce((a, k) => a + (k.end - k.start), 0);
  const removed = h.end - h.start - editedDuration;
  const base = `clip-${String(o.index + 1).padStart(2, "0")}`;
  const saveDir = o.saveDir ?? o.outDir;
  const saveName = o.saveDir ? o.saveName ?? base : base;
  if (o.saveDir) await node_fs.promises.mkdir(saveDir, { recursive: true });
  const outPath = path.join(saveDir, `${saveName}.mp4`);
  const assPath = path.join(o.outDir, `${base}.ass`);
  const srtPath = path.join(saveDir, `${saveName}.srt`);
  const thumbPath = path.join(o.outDir, `${base}.jpg`);
  const { w, h: hh } = targetSize(settings.aspect, settings.resolution);
  const clipWords = [];
  for (const wd of o.words) {
    if (wd.end <= h.start || wd.start >= h.end) continue;
    const inKeep = keep.find((k) => wd.start < k.end && wd.end > k.start);
    if (!inKeep) continue;
    const s = remapTime(Math.max(wd.start, inKeep.start), keep);
    const e = remapTime(Math.min(wd.end, inKeep.end), keep);
    if (e > s) clipWords.push({ text: hinglishWord(wd.text), start: s, end: e });
  }
  const preset = local.findPreset(settings.captionStyle);
  const lines = groupWords(clipWords, preset?.maxWords ?? 4);
  const useCaptions = Boolean(preset) && lines.length > 0;
  const top = resolveTopText(h.hook ?? "", settings.topText, editedDuration) ?? void 0;
  const useAss = useCaptions || Boolean(top);
  if (useAss) {
    const overrides = {
      color: settings.captionColor,
      textColor: settings.captionTextColor,
      font: settings.captionFont,
      sizeScale: settings.captionSize,
      pos: settings.captionPos
    };
    const styleId = preset ? settings.captionStyle : local.DEFAULT_CAPTION_PRESET;
    await node_fs.promises.writeFile(assPath, buildAss(useCaptions ? lines : [], styleId, w, hh, top, overrides), "utf8");
  }
  await node_fs.promises.writeFile(srtPath, buildSrt(groupWords(clipWords, 4)), "utf8");
  const parts = cutFilters(keep, seekMs, o.hasAudio);
  const follow = settings.layout === "follow" ? await followShots(o, keep, path.join(o.outDir, `${base}.faces.json`)) : void 0;
  const texts = resolveTextOverlays(settings.texts, editedDuration).filter((t) => t.card);
  const missing = (settings.texts?.length ?? 0) - texts.length;
  if (missing > 0) o.log(`${missing} added text(s) had no drawn card or no time on screen in this clip, so they are left out.`);
  const logo = resolveLogo(settings.logo);
  const layered = texts.length > 0 || Boolean(logo);
  const vf = buildVideoFilter(settings.aspect, settings.layout, useAss && !layered ? assPath : null, o.sourceWidth, o.sourceHeight, o.fontsDir, settings.crop, follow, settings.resolution, settings.stack);
  if (layered) {
    parts.push(`[vc]${vf.filter}[vbase]`);
    let cur = "[vbase]";
    if (texts.length) {
      parts.push(...textOverlayFilters(texts, cur, "[vtext]", 1, vf.w, vf.h));
      cur = "[vtext]";
    }
    if (logo) parts.push(...logoFilters(logo, cur, "[vlogo]", 1 + texts.length, vf.w, vf.h)), cur = "[vlogo]";
    parts.push(`${cur}${useAss ? assFilter(assPath, o.fontsDir) : "null"}[vout]`);
  } else {
    parts.push(`[vc]${vf.filter}[vout]`);
  }
  if (o.hasAudio) parts.push(SNU_WEAK ? `[ac]aresample=48000[aout]` : `[ac]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);
  const filterComplex = parts.join(";");
  let filterArgs = ["-filter_complex", filterComplex];
  if (filterComplex.length > 8e3) {
    const scriptPath = path.join(o.outDir, `${base}.filter.txt`);
    await node_fs.promises.writeFile(scriptPath, filterComplex, "utf8");
    filterArgs = ["-filter_complex_script", scriptPath];
  }
  const argsFor = (encoderArgs2) => [
    "-y",
    "-hide_banner",
    "-nostdin",
    // Only on the source: the cards and the logo are stills that start at 0.
    ...seekMs > 0 ? ["-ss", (seekMs / 1e3).toFixed(3)] : [],
    // ...and only as far as the clip goes. The output's -t alone did not stop the reading: when
    // the kept frames come to a hair under it, ffmpeg went on decoding (and `select` dropping)
    // the whole rest of the source, so a clip near the start of a one-hour video decoded most
    // of the hour (measured: 16+ minutes for a one-minute clip).
    "-t",
    readSeconds(keep, seekMs).toFixed(3),
    "-i",
    o.input,
    // Each added text is a still PNG, looped so it has a frame for every frame of the clip.
    ...texts.flatMap((t) => ["-loop", "1", "-i", t.card.path]),
    ...logo ? ["-loop", "1", "-i", logo.path] : [],
    ...filterArgs,
    "-map",
    "[vout]",
    ...o.hasAudio ? ["-map", "[aout]"] : [],
    ...encoderArgs2,
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    ...o.hasAudio ? ["-c:a", "aac", "-b:a", "160k", "-ar", "48000"] : [],
    "-movflags",
    "+faststart",
    "-t",
    (editedDuration + 0.05).toFixed(3),
    "-progress",
    "pipe:2",
    outPath
  ];
  const encode2 = (encoderArgs2) => local.run(o.bins.ffmpeg, argsFor(local.sizedEncoderArgs(encoderArgs2, vf.w, vf.h, settings.aspect)), {
    signal: o.signal,
    stallMs: RENDER_STALL_MS,
    hardMs: 9e5,
    onStderr: (line) => {
      const p = local.parseProgress(line, editedDuration);
      if (p >= 0) o.onProgress(p);
    }
  });
  o.log(`Rendering ${base}: ${h.start.toFixed(1)}s → ${h.end.toFixed(1)}s (${keep.length} segment${keep.length > 1 ? "s" : ""}, ${removed.toFixed(1)}s silence removed)`);
  let encoderArgs = o.encoderArgs;
  let res = await encode2(encoderArgs);
  if (res.stalled) throw new Error(hardware.withDetails(`Making clip ${o.index + 1} stopped moving for three minutes, so it was stopped. Close other apps and try again, or choose a smaller video size in More options.`, local.lastLines(res.stderr)));
  if (res.code !== 0 && !local.isCpuEncoder(encoderArgs)) {
    for (const next of await local.fallbackEncoders(o.bins, encoderArgs)) {
      o.log(`The video encoder failed (${local.lastLines(res.stderr, 1)}); trying ${next.name}.`);
      encoderArgs = next.videoArgs;
      res = await encode2(encoderArgs);
      if (res.code === 0) {
        o.onEncoderFallback?.(next);
        break;
      }
    }
  }
  if (res.code !== 0) throw new Error(`Render failed for ${base}: ${local.lastLines(res.stderr)}`);
  let finalDuration = editedDuration;
  if (h.memes?.length && o.memesDir && settings.memes !== false && o.hasAudio) {
    const mixed = await mixMemes({
      bins: o.bins,
      file: outPath,
      width: vf.w,
      height: vf.h,
      duration: editedDuration,
      memesDir: o.memesDir,
      memes: h.memes.map((m) => ({ ...m, rel: remapTime(m.at, keep) })),
      encoderArgs: local.sizedEncoderArgs(encoderArgs, vf.w, vf.h, settings.aspect),
      log: o.log,
      signal: o.signal
    });
    finalDuration = mixed.duration;
    if (mixed.inserts.length) {
      const shifted = clipWords.map((w2) => ({ ...w2, start: shiftForInserts(w2.start, mixed.inserts), end: shiftForInserts(w2.end, mixed.inserts) }));
      await node_fs.promises.writeFile(srtPath, buildSrt(groupWords(shifted, 4)), "utf8");
    }
  }
  let musicNote;
  if (settings.music) {
    try {
      await node_fs.promises.access(settings.music.path);
      const mixed = await mixMusic({ bins: o.bins, file: outPath, music: settings.music, duration: finalDuration, hasSound: o.hasAudio, log: o.log, signal: o.signal });
      if (!mixed && settings.music.volume > 0) musicNote = "This clip ends before the music starts, so it has none. Move the music earlier and press Apply.";
    } catch (err) {
      if (o.signal?.aborted) throw err;
      o.log(`Could not add the music (${err.message}); the clip is made without it.`);
      musicNote = "The music could not be added, so this clip has none. Choose the song again and press Apply.";
    }
  }
  await local.thumbnail(o.bins, outPath, Math.min(1, editedDuration / 3), thumbPath, 540);
  return {
    highlightId: h.id,
    index: o.index,
    filePath: outPath,
    thumbnailPath: thumbPath,
    srtPath,
    duration: Math.round(finalDuration * 100) / 100,
    width: vf.w,
    height: vf.h,
    removedSilenceSeconds: Math.round(removed * 100) / 100,
    settings: { ...settings },
    ...musicNote ? { musicNote } : {},
    renderedAt: Date.now()
  };
}
const KEY_VERSION = 1;
function transcriptKey(job, source, range2, imported) {
  if (imported) {
    return {
      v: KEY_VERSION,
      app: job.appVersion ?? "",
      source: { path: job.options.inputPath, size: source.size, mtimeMs: Math.round(source.mtimeMs) },
      range: range2 ? { start: round$1(range2.start), end: round$1(range2.end) } : null,
      provider: String(imported.source ?? "imported"),
      imported,
      language: job.options.language
    };
  }
  const openai = job.transcription === "openai" && Boolean(job.openaiKey);
  if (job.transcription === "groq" && job.groqKey) {
    return {
      v: KEY_VERSION,
      app: job.appVersion ?? "",
      source: { path: job.options.inputPath, size: source.size, mtimeMs: Math.round(source.mtimeMs) },
      range: range2 ? { start: round$1(range2.start), end: round$1(range2.end) } : null,
      provider: "groq",
      model: job.groqSpeechModel ?? "whisper-large-v3",
      dtype: "",
      language: job.options.language
    };
  }
  if (job.transcription === "clipie" && job.clipieToken && job.clipieUrl) {
    return {
      v: KEY_VERSION,
      app: job.appVersion ?? "",
      source: { path: job.options.inputPath, size: source.size, mtimeMs: Math.round(source.mtimeMs) },
      range: range2 ? { start: round$1(range2.start), end: round$1(range2.end) } : null,
      provider: "clipie",
      model: "whisper-large-v3",
      dtype: "",
      language: job.options.language
    };
  }
  const models = openai ? [] : job.whisperAuto?.length ? [...job.whisperAuto].sort() : [job.whisperModel];
  const dtype = (m) => `${process.env.CLIPIE_WHISPER_ENCODER || local.WHISPER_DTYPES[m]?.encoder}/${process.env.CLIPIE_WHISPER_DECODER || local.WHISPER_DTYPES[m]?.decoder}`;
  return {
    v: KEY_VERSION,
    app: job.appVersion ?? "",
    source: { path: job.options.inputPath, size: source.size, mtimeMs: Math.round(source.mtimeMs) },
    range: range2 ? { start: round$1(range2.start), end: round$1(range2.end) } : null,
    provider: openai ? "openai" : "local",
    model: openai ? "openai" : `${job.whisperAuto?.length ? "auto:" : ""}${models.join(",")}`,
    dtype: models.map(dtype).join(","),
    language: job.options.language
  };
}
function analysisKey(transcript, job, memeLibrary) {
  return {
    transcript,
    options: job.options,
    writingModel: job.writingModel,
    llm: job.llm ? { provider: job.llm.provider, baseUrl: job.llm.baseUrl } : null,
    withKey: Boolean(job.openrouterKey),
    memes: memeLibrary ? { size: memeLibrary.size, mtimeMs: Math.round(memeLibrary.mtimeMs) } : null
  };
}
function sameKey(a, b) {
  return stable(a) === stable(b);
}
function analysisWorthKeeping(analysis, hadKey) {
  return analysis.source === "ai" || !hadKey;
}
async function readStage(dir, name, key2) {
  try {
    const saved = JSON.parse(await node_fs.promises.readFile(path.join(dir, `${name}.key.json`), "utf8"));
    if (!sameKey(saved, key2)) return null;
    return JSON.parse(await node_fs.promises.readFile(path.join(dir, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}
async function dropStageKey(dir, name) {
  await node_fs.promises.rm(path.join(dir, `${name}.key.json`), { force: true }).catch(() => void 0);
}
async function writeStageKey(dir, name, key2) {
  await node_fs.promises.writeFile(path.join(dir, `${name}.key.json`), JSON.stringify(key2, null, 2)).catch(() => void 0);
}
function usableTranscript(t) {
  return Boolean(t && Array.isArray(t.words) && t.words.length >= 5 && Array.isArray(t.segments));
}
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).filter((k) => v[k] !== void 0).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}
function round$1(n) {
  return Math.round(n * 1e3) / 1e3;
}
function reelHighlight(transcript, analysis, options) {
  const first = transcript.words[0];
  const last = transcript.words[transcript.words.length - 1];
  const best = analysis.highlights[0];
  const whole = {
    start: Math.max(0, (first?.start ?? 0) - 0.3),
    end: Math.min(transcript.duration, (last?.end ?? transcript.duration) + 0.4)
  };
  const copy = {
    title: best?.title || analysis.social.youtubeTitle || "My reel",
    hook: best?.hook ?? "",
    description: best?.description || analysis.social.tiktokCaption || analysis.summary,
    hashtags: best?.hashtags ?? [],
    score: best?.score ?? 0
  };
  const max = options?.reelMaxSeconds;
  if (!max || !(max > 0) || whole.end - whole.start <= max + 0.5) {
    return { id: "h1", ...whole, ...copy, reason: "The whole recording, edited into one reel." };
  }
  const fits = (h) => h.end - h.start <= max + 0.5 && h.end - h.start >= Math.min(5, max);
  const aiPick = [...analysis.highlights].filter(fits).sort((a, b) => b.score - a.score)[0];
  const ownPick = aiPick ? void 0 : heuristicAnalysis(transcript, { ...options, clipCount: 3, minClipSeconds: Math.max(5, Math.round(max * 0.6)), maxClipSeconds: max }).highlights.filter(fits).sort((a, b) => b.score - a.score)[0];
  const pick2 = aiPick ?? ownPick;
  let range2 = pick2 ? { start: pick2.start, end: pick2.end } : { start: whole.start, end: whole.start + max };
  if (!pick2) {
    range2 = snapToSentences(range2.start, range2.end, buildSentences(transcript.words), { minSeconds: Math.min(5, max), maxSeconds: max, limit: whole });
  }
  return {
    id: "h1",
    start: range2.start,
    end: Math.min(range2.end, range2.start + max + 0.5),
    ...copy,
    ...pick2 ? { title: pick2.title || copy.title, hook: pick2.hook || copy.hook, description: pick2.description || copy.description, hashtags: pick2.hashtags?.length ? pick2.hashtags : copy.hashtags, score: pick2.score } : {},
    reason: pick2 ? `The best ${Math.round(range2.end - range2.start)} s of the recording (you asked for up to ${max} s). ${pick2.reason ?? ""}`.trim() : `The first ${max} s of the recording, cut on a sentence edge.`
  };
}
const ORDER = ["probe", "audio", "transcribe", "analyze", "render", "finalize"];
function clipSettingsFrom(options) {
  return {
    aspect: options.aspect,
    layout: options.layout,
    captionStyle: options.captionStyle,
    tightenSilences: options.tightenSilences,
    ...options.layout === "manual" && options.crop ? { crop: options.crop } : {},
    // Only carry the caption overrides the user actually set, so a project file stays readable.
    ...options.captionColor ? { captionColor: options.captionColor } : {},
    ...options.captionTextColor ? { captionTextColor: options.captionTextColor } : {},
    ...options.captionFont ? { captionFont: options.captionFont } : {},
    ...options.captionSize && options.captionSize !== 1 ? { captionSize: options.captionSize } : {},
    ...options.captionPos ? { captionPos: options.captionPos } : {},
    ...options.topText && Object.keys(options.topText).length ? { topText: options.topText } : {},
    ...options.texts?.length ? { texts: options.texts } : {},
    ...options.logo ? { logo: options.logo } : {},
    ...options.music ? { music: options.music } : {},
    ...options.resolution && options.resolution !== "auto" ? { resolution: options.resolution } : {},
    ...options.stack ? { stack: options.stack } : {}
  };
}
function resolveRange(options, duration2) {
  const start = Math.max(0, Math.min(options.rangeStart ?? 0, duration2));
  const end = Math.min(duration2, options.rangeEnd ?? duration2);
  if (!(end > start)) return null;
  if (end - start < 5) return null;
  if (start <= 0.01 && end >= duration2 - 0.01) return null;
  return { start, end };
}
function shiftTranscript(transcript, window) {
  const by = window.start;
  return {
    ...transcript,
    duration: window.end,
    words: transcript.words.map((w) => ({ ...w, start: round(w.start + by), end: round(w.end + by) })),
    segments: transcript.segments.map((seg) => ({
      ...seg,
      start: round(seg.start + by),
      end: round(seg.end + by),
      words: seg.words?.map((w) => ({ ...w, start: round(w.start + by), end: round(w.end + by) })) ?? seg.words
    }))
  };
}
function topUpHighlights(analysis, transcript, options) {
  const want = Math.max(1, Math.round(options.clipCount));
  const have = analysis.highlights;
  if (have.length >= want) return analysis;
  const spare = heuristicAnalysis(transcript, { ...options, clipCount: want * 4 }).highlights;
  const out = [...have];
  for (const candidate of spare) {
    if (out.length >= want) break;
    const clashes = out.some((h) => Math.min(h.end, candidate.end) - Math.max(h.start, candidate.start) > 1);
    if (clashes) continue;
    out.push({ ...candidate, reason: `${candidate.reason} Added to reach the ${want} clips you asked for.` });
  }
  out.sort((a, b) => a.start - b.start);
  out.forEach((h, i) => h.id = `h${i + 1}`);
  return { ...analysis, highlights: out };
}
function round(n) {
  return Math.round(n * 1e3) / 1e3;
}
function untilAborted(p, signal) {
  if (signal.aborted) return Promise.reject(new Error("Cancelled"));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error("Cancelled"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
function paceEta(elapsedSeconds, share, minSeconds = 15, minShare = 0.1) {
  if (!(share >= minShare) || elapsedSeconds < minSeconds || share >= 1) return share >= 1 ? 0 : void 0;
  return Math.max(0, Math.round(elapsedSeconds / share * (1 - share)));
}
function transcribeEtaTracker(audioSeconds, rate, now = Date.now) {
  let started = null;
  return (percent) => {
    if (percent < 10) return void 0;
    const t = now();
    if (started === null) started = t;
    const share = Math.min(1, (percent - 10) / 88);
    const elapsed = (t - started) / 1e3;
    const own2 = paceEta(elapsed, share);
    if (own2 !== void 0) return own2;
    if (!rate || !(rate > 0)) return void 0;
    const left = rate * audioSeconds - elapsed;
    return left > 0 ? Math.round(left) : void 0;
  };
}
function samePickForEveryLanguage(downloaded) {
  if (!downloaded?.length) return false;
  return new Set(["en", "es", "ur"].map((l) => pickSpeechModel(l, downloaded).model)).size === 1;
}
function probeAudioOnly(ffprobe, input) {
  return new Promise((resolve, reject) => {
    node_child_process.execFile(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", input], { maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      try {
        const json = JSON.parse(stdout);
        const audio = json.streams?.find((x) => x.codec_type === "audio");
        resolve({ duration: Number(json.format?.duration ?? audio?.duration ?? 0), width: 0, height: 0, fps: 0, hasAudio: Boolean(audio), codec: audio?.codec_name ?? "unknown" });
      } catch (e) {
        reject(e);
      }
    });
  });
}
async function runPipeline(job, emit, signal, hooks = {}) {
  if (job.options.mode === "gaming") job = { ...job, options: gamingOptions(job.options) };
  const bins = { ffmpeg: job.ffmpegPath, ffprobe: job.ffprobePath };
  const projectId = job.projectId;
  const log = (message, level2 = "info") => emit({ type: "log", projectId, level: level2, message });
  const progress = (stage, percent2, message, eta) => {
    const idx = ORDER.indexOf(stage);
    const before = ORDER.slice(0, idx).reduce((a, s) => a + local.STAGE_WEIGHTS[s], 0);
    const total = ORDER.reduce((a, s) => a + local.STAGE_WEIGHTS[s], 0);
    const overall = (before + local.STAGE_WEIGHTS[stage] * Math.max(0, Math.min(100, percent2)) / 100) / total * 100;
    emit({ type: "progress", projectId, stage, percent: percent2, overall: Math.round(overall * 10) / 10, message, ...eta !== void 0 ? { eta } : {} });
  };
  const project = {
    id: projectId,
    name: job.options.projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "processing",
    options: job.options,
    outputDir: job.outputDir,
    clips: []
  };
  await node_fs.promises.mkdir(job.outputDir, { recursive: true });
  const workDir = path.join(job.outputDir, ".work");
  await node_fs.promises.mkdir(workDir, { recursive: true });
  const checkCancel = () => {
    if (signal.aborted) throw new Error("Cancelled");
  };
  progress("probe", 0, "Reading video…");
  let media = job.videoPending ? await probeAudioOnly(bins.ffprobe, job.options.inputPath) : await local.probe(bins, job.options.inputPath);
  if (!job.videoPending) project.media = media;
  log(job.videoPending ? `Source sound: ${fmtDur(media.duration)}, codec ${media.codec} (the video is still downloading)` : `Source: ${media.width}x${media.height} @ ${media.fps}fps, ${fmtDur(media.duration)}, codec ${media.codec}${media.hasAudio ? "" : ", NO AUDIO"}`);
  if (!media.hasAudio) throw new Error("This video has no audio track, so there is no speech to caption or clip.");
  if (media.duration < 5) throw new Error("Video is too short (under 5 seconds).");
  progress("probe", 100, "Video read");
  checkCancel();
  const window = resolveRange(job.options, media.duration);
  const windowLength = window ? window.end - window.start : media.duration;
  if (window) {
    log(`Using ${fmtDur(window.start)} → ${fmtDur(window.end)} of the video (${fmtDur(windowLength)} of ${fmtDur(media.duration)}).`);
  }
  const source = await node_fs.promises.stat(job.options.inputPath);
  const imported = await readImported(job, media.duration, window, log);
  const importKey = imported ? { ...imported.key, quick: imported.parsed.format === "plain" ? quickModel(job) : null } : null;
  let tKey = transcriptKey(job, source, window, importKey);
  const kept = job.videoPending ? null : await readStage(job.outputDir, "transcript", tKey);
  const keptTranscript = usableTranscript(kept) ? kept : null;
  if (!keptTranscript) await dropStageKey(job.outputDir, "transcript");
  const memeLibrary = job.options.mode === "funny" && job.memeLibraryPath ? await node_fs.promises.stat(job.memeLibraryPath).catch(() => null) : null;
  let aKey = analysisKey(tKey, job, memeLibrary);
  const keptAnalysis = keptTranscript ? await readStage(job.outputDir, "analysis", aKey) : null;
  const reuseAnalysis = Boolean(keptAnalysis?.highlights?.length) && analysisWorthKeeping(keptAnalysis, Boolean(job.openrouterKey));
  if (!reuseAnalysis) await dropStageKey(job.outputDir, "analysis");
  let audio;
  if (!reuseAnalysis) {
    progress("audio", 0, "Extracting audio…");
    audio = await local.extractAudio(
      bins,
      job.options.inputPath,
      workDir,
      (p) => {
        if (p >= 0) progress("audio", p, "Extracting audio…");
      },
      windowLength,
      signal,
      window ?? void 0
    );
  }
  progress("audio", 100, "Audio ready");
  checkCancel();
  let transcript;
  let importedTranscript = null;
  const tStart = Date.now();
  if (keptTranscript) {
    transcript = keptTranscript;
    log(`Using the transcript from the last try (${transcript.words.length} words, ${transcript.provider}/${transcript.model}): same video, part, speech model and language.`);
    progress("transcribe", 100, "Transcript kept from the last try");
  } else if (imported && (importedTranscript = await importTranscript(job, imported.parsed, audio?.pcmPath, window, media.duration, progress, log, signal, emit))) {
    transcript = importedTranscript;
    log(`Used ${imported.source === "youtube" ? "YouTube's captions" : "your transcript"} (${hardware.TRANSCRIPT_FORMAT_LABEL[imported.parsed.format]}): ${transcript.words.length} words in ${((Date.now() - tStart) / 1e3).toFixed(0)}s${imported.parsed.format === "plain" ? " (timed with a quick listen)" : ", without listening to the video"}.`);
    if (transcript.words.length < 5) throw new Error("The transcript has almost no words for this video. Check it is the right one, or make the project without it.");
    await node_fs.promises.writeFile(path.join(job.outputDir, "transcript.json"), JSON.stringify(transcript, null, 2));
    await node_fs.promises.writeFile(path.join(job.outputDir, "transcript.txt"), transcript.segments.map((s) => `[${fmtDur(s.start)}] ${s.text}`).join("\n"));
    if (!job.videoPending) await writeStageKey(job.outputDir, "transcript", tKey);
  } else {
    const cloudKey = job.transcription === "groq" ? job.groqKey : job.transcription === "clipie" ? job.clipieUrl ? job.clipieToken : void 0 : job.transcription === "openai" ? job.openaiKey : void 0;
    let cloud = null;
    if (job.transcription !== "local" && cloudKey) {
      try {
        cloud = await transcribeCloud({
          service: cloudService(job.transcription, job.groqSpeechModel, job.clipieUrl),
          apiKey: cloudKey,
          ffmpeg: bins.ffmpeg,
          pcmPath: audio.pcmPath,
          language: job.options.language,
          duration: windowLength,
          onProgress: (p, m) => progress("transcribe", p, m),
          log,
          signal,
          // With a model here, a minute without internet hands over to it; without one, wait.
          offlineWaitMs: job.localSpeechReady ? 6e4 : void 0
        });
      } catch (err) {
        if (signal.aborted) throw new Error("Cancelled");
        const why = err instanceof CloudSpeechError ? err.message : "Something went wrong on the way.";
        log(`Cloud transcription did not finish: ${why} Transcribing on this computer instead.`, "warn");
        if (!(err instanceof CloudSpeechError)) log(`Cloud transcription error: ${err.message}`);
        progress("transcribe", 0, "Transcribing on this computer…");
        tKey = transcriptKey({ ...job, transcription: "local" }, source, window, importKey);
        aKey = analysisKey(tKey, job, memeLibrary);
      }
    } else if (job.transcription !== "local") {
      log(
        job.transcription === "clipie" ? job.clipieUrl ? "Not signed in to SNU Clipper Cloud; transcribing on this computer." : "SNU Clipper Cloud is coming soon; transcribing on this computer." : `No ${job.transcription === "groq" ? "Groq" : "OpenAI"} key saved; transcribing on this computer.`,
        "warn"
      );
      tKey = transcriptKey({ ...job, transcription: "local" }, source, window, importKey);
      aKey = analysisKey(tKey, job, memeLibrary);
    }
    if (cloud) {
      transcript = cloud;
    } else {
      let model = job.whisperModel;
      let language = job.options.language;
      let checkPickAfter = false;
      const speech = new worker.SpeechWorker(log, signal);
      try {
        if (job.whisperAuto?.length) {
          const judge = detectionModel(job.whisperAuto);
          const sameForAll = language === "auto" && samePickForEveryLanguage(job.whisperAuto);
          if (sameForAll) checkPickAfter = true;
          if (language === "auto" && judge && !sameForAll) {
            progress("transcribe", 1, "Detecting the language…");
            const heard2 = await speech.detect({ modelsDir: job.modelsDir, model: judge, accelerator: job.accelerator, pcmPath: audio.pcmPath }).catch(() => null);
            if (heard2) {
              language = heard2;
              log(`Detected language: ${heard2}`);
            }
          }
          const pick2 = pickSpeechModel(language, job.whisperAuto);
          model = pick2.model;
          log(`Speech model: ${local.WHISPER_MODEL_INFO[model].label}, chosen automatically for ${language === "auto" ? "this video" : language}.`);
          if (!pick2.good && !checkPickAfter) {
            log(`For ${language}, the ${local.WHISPER_MODEL_INFO[pick2.wanted].label} model gives accurate captions and it is not downloaded; using ${local.WHISPER_MODEL_INFO[model].label}. Download ${local.WHISPER_MODEL_INFO[pick2.wanted].label} in Settings → Speech for better results.`, "warn");
          }
        }
        const rateKey = `${model}|${job.accelerator ?? "cpu"}`;
        const eta = transcribeEtaTracker(windowLength, job.speechRates?.[rateKey]);
        let heardFrom = 0;
        transcript = await speech.transcribe({
          pcmPath: audio.pcmPath,
          modelsDir: job.modelsDir,
          model,
          accelerator: job.accelerator,
          language,
          duration: windowLength,
          onProgress: (p, m) => {
            if (p >= 10 && !heardFrom) heardFrom = Date.now();
            progress("transcribe", p, m, eta(p));
          }
        });
        speech.close();
        if (checkPickAfter && transcript.language && transcript.language !== "auto") {
          const pick2 = pickSpeechModel(transcript.language, job.whisperAuto);
          if (!pick2.good) log(`For ${transcript.language}, the ${local.WHISPER_MODEL_INFO[pick2.wanted].label} model gives accurate captions and it is not downloaded; using ${local.WHISPER_MODEL_INFO[model].label}. Download ${local.WHISPER_MODEL_INFO[pick2.wanted].label} in Settings → Speech for better results.`, "warn");
        }
        if (heardFrom && windowLength >= 30) {
          emit({ type: "speech-rate", projectId, key: rateKey, rate: Math.round((Date.now() - heardFrom) / 1e3 / windowLength * 1e3) / 1e3 });
        }
      } finally {
        speech.close();
      }
    }
    if (window) transcript = shiftTranscript(transcript, window);
    log(`Transcribed ${transcript.words.length} words in ${((Date.now() - tStart) / 1e3).toFixed(0)}s (${transcript.provider}/${transcript.model})`);
    if (transcript.words.length < 5) throw new Error("Almost no speech was detected. SNU Clipper needs spoken content to work with.");
    await node_fs.promises.writeFile(path.join(job.outputDir, "transcript.json"), JSON.stringify(transcript, null, 2));
    await node_fs.promises.writeFile(path.join(job.outputDir, "transcript.txt"), transcript.segments.map((s) => `[${fmtDur(s.start)}] ${s.text}`).join("\n"));
    if (!job.videoPending) await writeStageKey(job.outputDir, "transcript", tKey);
  }
  project.transcript = transcript;
  checkCancel();
  const focus = job.options.mode === "reel" ? [] : briefWindows(buildBrief(job.options).text, media.duration, job.options.maxClipSeconds);
  const pickFrom = focus.length ? transcriptInWindows(transcript, focus) : transcript;
  if (focus.length) {
    if (pickFrom.words.length < 5) {
      throw new Error(`Your instructions point at ${describeWindows(focus)} of the video, but there is almost no speech there. Check the times, or take them out of the instructions.`);
    }
    log(`Your instructions name ${describeWindows(focus)}: clips are chosen from there only.`);
  }
  let analysis;
  let writing = null;
  if (reuseAnalysis) {
    analysis = keptAnalysis;
    log(`Using the ${analysis.highlights.length} clip${analysis.highlights.length === 1 ? "" : "s"} chosen on the last try: same transcript and settings.`);
  } else {
    progress("analyze", 0, job.options.mode === "funny" ? "Listening for laughter…" : job.options.mode === "reel" ? "Analyzing transcript…" : job.options.mode === "gaming" ? "Looking for the plays and reactions…" : "Reading the talk…");
    if (job.options.mode === "gaming") {
      if (!job.openrouterKey) log("No AI key set: clips are chosen from the yells, game sounds and laughter alone (add a free key in Settings → AI writing for far better clips and titles).", "warn");
      const pcm = await local.readPcmF32(audio.pcmPath).catch(() => void 0);
      try {
        const staged = await gamingAnalysis({
          transcript: pickFrom,
          options: job.options,
          apiKey: job.openrouterKey,
          model: job.writingModel,
          log,
          onProgress: (p, m) => progress("analyze", p, m),
          signal,
          samples: pcm,
          offset: window?.start ?? 0,
          modelsDir: job.modelsDir
        });
        analysis = staged.analysis;
        writing = staged.rest;
      } catch (err) {
        if (signal.aborted) throw err;
        log(`Clip selection failed: ${err.message}. Falling back to built-in highlight detection.`, "warn");
        analysis = heuristicAnalysis(pickFrom, job.options);
      }
    } else if (job.options.mode === "funny") {
      analysis = await funnyAnalysis({
        job,
        transcript: pickFrom,
        samples: await local.readPcmF32(audio.pcmPath),
        offset: window?.start ?? 0,
        duration: media.duration,
        log,
        onProgress: (p, m) => progress("analyze", p, m),
        signal
      });
    } else if (job.options.mode !== "reel") {
      if (!job.openrouterKey) log("No OpenRouter API key set: using built-in highlight detection (add a free key in Settings → AI writing for far better clips, titles and scripts).", "warn");
      const pcm = await local.readPcmF32(audio.pcmPath).catch(() => void 0);
      try {
        const staged = await agenticAnalysisStaged({
          transcript: pickFrom,
          options: job.options,
          apiKey: job.openrouterKey,
          model: job.writingModel,
          log,
          onProgress: (p, m) => progress("analyze", p, m),
          signal,
          samples: pcm,
          sampleOffset: window?.start ?? 0,
          modelsDir: job.modelsDir
        });
        analysis = staged.analysis;
        writing = staged.rest;
      } catch (err) {
        if (signal.aborted) throw err;
        log(`Clip selection failed: ${err.message}. Falling back to built-in highlight detection.`, "warn");
        analysis = heuristicAnalysis(pickFrom, job.options);
      }
    } else if (job.openrouterKey) {
      try {
        analysis = await openrouterAnalysis({
          transcript: pickFrom,
          options: job.options,
          apiKey: job.openrouterKey,
          model: job.writingModel,
          log,
          onProgress: (p, m) => progress("analyze", p, m),
          signal
        });
      } catch (err) {
        if (signal.aborted) throw err;
        log(`AI writing failed: ${err.message}. Falling back to built-in highlight detection.`, "warn");
        analysis = heuristicAnalysis(pickFrom, job.options);
      }
    } else {
      log("No OpenRouter API key set: using built-in highlight detection (add a free key in Settings → AI writing for far better clips, titles and scripts).", "warn");
      analysis = heuristicAnalysis(pickFrom, job.options);
    }
    if (job.options.mode === "funny") {
      if (analysis.highlights.length < job.options.clipCount && analysis.highlights.length) {
        log(`Found ${analysis.highlights.length} funny moment${analysis.highlights.length === 1 ? "" : "s"} worth a clip (you asked for up to ${job.options.clipCount}).`);
      }
    } else if (job.options.mode === "reel") {
      const reelMax = job.options.reelMaxSeconds && job.options.reelMaxSeconds > 0 ? job.options.reelMaxSeconds : Infinity;
      const padded = { ...analysis, highlights: padHighlights(analysis.highlights, transcript.words, transcript.duration, reelMax) };
      analysis = { ...analysis, highlights: [reelHighlight(transcript, padded, job.options)] };
      log("Reel mode: the whole recording becomes one clip.");
    } else {
      const asked = Math.max(1, Math.round(job.options.clipCount));
      const found = analysis.highlights.length;
      const instructed = Boolean(buildBrief(job.options).text) && analysis.source === "ai";
      if (instructed && found === 0) {
        throw new Error("No moment in this video matches your instructions. Loosen them, or clear them for SNU Clipper's usual picks, and try again.");
      }
      if (found < asked && !instructed) {
        analysis = topUpHighlights(analysis, pickFrom, job.options);
        const filled = analysis.highlights.length;
        if (filled > found) log(`The clip picker offered ${found} clip${found === 1 ? "" : "s"}; ${filled - found} more came from SNU Clipper's own search to reach the ${asked} you asked for.`);
        if (filled < asked) log(`You asked for ${asked} clips and this video could only give ${filled}: there is not enough speech in it for more at that length.`, "warn");
      }
      analysis = { ...analysis, highlights: padHighlights(analysis.highlights, transcript.words, transcript.duration, job.options.maxClipSeconds) };
    }
  }
  if (focus.length && !reuseAnalysis && job.options.mode !== "reel") {
    const inFocus = analysis.highlights.filter((h) => focus.some((w) => (h.start + h.end) / 2 >= w.start && (h.start + h.end) / 2 <= w.end));
    if (inFocus.length < analysis.highlights.length) {
      log(`Left out ${analysis.highlights.length - inFocus.length} clip${analysis.highlights.length - inFocus.length === 1 ? "" : "s"} outside ${describeWindows(focus)}.`);
      analysis = { ...analysis, highlights: inFocus };
    }
  }
  project.analysis = analysis;
  if (!reuseAnalysis) {
    await node_fs.promises.writeFile(path.join(job.outputDir, "analysis.json"), JSON.stringify(analysis, null, 2));
    if (!writing && !job.videoPending) await writeStageKey(job.outputDir, "analysis", aKey);
  }
  await node_fs.promises.writeFile(path.join(job.outputDir, "script.md"), buildScriptMarkdown(project));
  const writingDone = writing ? writing.then(async (rest) => {
    if (signal.aborted) return;
    analysis = { ...analysis, ...rest };
    project.analysis = analysis;
    await node_fs.promises.writeFile(path.join(job.outputDir, "analysis.json"), JSON.stringify(analysis, null, 2));
    await node_fs.promises.writeFile(path.join(job.outputDir, "script.md"), buildScriptMarkdown(project));
    if (!job.videoPending) await writeStageKey(job.outputDir, "analysis", aKey);
  }).catch((err) => log(`The summary and script could not be saved (${err.message}); the clips are not affected.`, "warn")) : Promise.resolve();
  progress("analyze", 100, `${analysis.highlights.length} highlight${analysis.highlights.length === 1 ? "" : "s"} found`);
  log(`Highlights: ${analysis.highlights.map((h) => `${fmtDur(h.start)}-${fmtDur(h.end)}`).join(", ") || "none"}`);
  if (analysis.highlights.length === 0) {
    throw new Error(job.options.mode === "funny" ? "No funny moments were found in this video. Funny clips work best on podcasts, shows and vlogs where people joke and laugh." : job.options.mode === "gaming" ? "No clip-worthy moments were found in this stream. Gaming clips are chosen from what the streamer says and how they react, so a stream with commentary works best." : "No highlight-worthy moments were found in this video.");
  }
  checkCancel();
  let input = job.options.inputPath;
  if (job.videoPending) {
    if (!hooks.videoReady) throw new Error("The video for this project never arrived.");
    progress("render", 0, "Waiting for the video to finish downloading…");
    log("Clips chosen; waiting for the video to finish downloading before rendering.");
    input = await untilAborted(hooks.videoReady, signal);
    media = await local.probe(bins, input);
    project.media = media;
    project.options = { ...project.options, inputPath: input };
    log(`Source: ${media.width}x${media.height} @ ${media.fps}fps, ${fmtDur(media.duration)}, codec ${media.codec}`);
    const video = await node_fs.promises.stat(input);
    const videoJob = { ...job, options: { ...job.options, inputPath: input } };
    tKey = transcriptKey(videoJob, video, window, importKey);
    aKey = analysisKey(tKey, videoJob, memeLibrary);
    await writeStageKey(job.outputDir, "transcript", tKey);
    if (!reuseAnalysis && !writing) await writeStageKey(job.outputDir, "analysis", aKey);
    if (writing) void writingDone.then(() => writeStageKey(job.outputDir, "analysis", aKey)).catch(() => void 0);
  }
  let look = clipSettingsFrom(job.options);
  if (job.options.mode === "gaming") {
    progress("render", 0, "Finding the facecam…");
    const found = await gamingStack({
      ffmpeg: bins.ffmpeg,
      input,
      media,
      options: job.options,
      outputDir: job.outputDir,
      fontsDir: job.fontsDir,
      log,
      onProgress: (p) => progress("render", 0, `Finding the facecam… ${Math.round(p)}%`),
      signal
    });
    project.options = { ...project.options, stack: found.stack };
    if (found.note) project.notes = [found.note];
    look = clipSettingsFrom(project.options);
    if (!look.captionPos) {
      const { w, h } = targetSize(look.aspect, look.resolution);
      const seam = seamShare(stackPlan(media.width, media.height, w, h, found.stack), h);
      if (seam > 0) look = { ...look, captionPos: seamCaptionPos(seam) };
    }
    checkCancel();
  }
  let enc = job.encoder ?? await local.detectEncoder(bins);
  log(`Video encoder: ${enc.name}`);
  const n = analysis.highlights.length;
  const targets = [];
  for (let i = 0; i < n; i++) {
    targets.push(job.clipsDir ? await newClipTarget(job.clipsDir, job.options.projectName, i, analysis.highlights[i].title) : {});
  }
  const slots = renderSlots(enc.name, n);
  if (slots > 1) log(`Rendering ${slots} clips at a time (hardware encoder, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 1024 ** 3)} GB).`);
  const rendered = new Array(n);
  const percent = new Array(n).fill(0);
  const active = /* @__PURE__ */ new Set();
  const renderStarted = Date.now();
  const report = () => {
    const overall = percent.reduce((a, p) => a + p, 0) / n;
    const now = [...active].sort((a, b) => a - b).map((i) => i + 1);
    const which = now.length > 1 ? `clips ${now.slice(0, -1).join(", ")} and ${now[now.length - 1]}` : `clip ${now[0] ?? n}`;
    progress("render", overall, `Rendering ${which} of ${n}… ${Math.round(overall)}%`, paceEta((Date.now() - renderStarted) / 1e3, overall / 100, 10));
  };
  const stopOthers = new AbortController();
  const renderSignal = AbortSignal.any([signal, stopOthers.signal]);
  let failure = null;
  let next = 0;
  const worker$1 = async () => {
    while (failure === null && next < n) {
      checkCancel();
      const i = next++;
      const h = analysis.highlights[i];
      active.add(i);
      report();
      try {
        rendered[i] = await renderClip({
          bins,
          input,
          highlight: h,
          index: i,
          words: transcript.words,
          settings: look,
          outDir: job.outputDir,
          encoderArgs: enc.videoArgs,
          onEncoderFallback: (encoder) => {
            enc = encoder;
            emit({ type: "encoder", projectId, encoder });
          },
          sourceWidth: media.width,
          sourceHeight: media.height,
          hasAudio: media.hasAudio,
          fontsDir: job.fontsDir,
          memesDir: job.memesDir,
          ...targets[i],
          onProgress: (p) => {
            percent[i] = p;
            report();
          },
          log,
          signal: renderSignal
        });
      } catch (err) {
        if (failure === null) failure = err;
        stopOthers.abort();
        return;
      } finally {
        active.delete(i);
      }
      percent[i] = 100;
      project.clips = rendered.filter((c) => Boolean(c));
      emit({ type: "clip-ready", projectId, clip: rendered[i], analysis });
    }
  };
  await Promise.all(Array.from({ length: slots }, worker$1));
  if (failure !== null) throw signal.aborted ? new Error("Cancelled") : failure;
  checkCancel();
  const clips = rendered;
  project.clips = [...clips];
  progress("render", 100, "All clips rendered");
  progress("finalize", 0, writing ? "Finishing the summary and script…" : "Saving project…");
  await writingDone;
  project.analysis = analysis;
  project.status = "done";
  project.updatedAt = Date.now();
  await node_fs.promises.writeFile(path.join(job.outputDir, "project.json"), JSON.stringify(project, null, 2));
  await node_fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => void 0);
  progress("finalize", 100, "Done");
  return project;
}
async function readImported(job, duration2, window, log) {
  const t = job.options.transcript;
  if (!t?.file) return null;
  const who = t.source === "youtube" ? "YouTube's captions" : "your transcript";
  try {
    const st = await node_fs.promises.stat(t.file);
    if (st.size > hardware.MAX_TRANSCRIPT_BYTES) throw new Error("too big");
    const parsed = hardware.parseTranscript(await node_fs.promises.readFile(t.file, "utf8"), t.name ?? t.file, duration2);
    if (!parsed.ok) {
      log(`Could not use ${who}: ${parsed.error} Listening to the video instead.`, "warn");
      return null;
    }
    const warning = hardware.coverageWarning(parsed.transcript, duration2, window);
    if (warning) log(warning, "warn");
    if (parsed.transcript.words.length && !parsed.transcript.words.some((w) => w.start < (window?.end ?? duration2) && w.end > (window?.start ?? 0))) {
      log(`${who[0].toUpperCase()}${who.slice(1)} has no words in this part of the video; listening to it instead.`, "warn");
      return null;
    }
    return { source: t.source, parsed: parsed.transcript, key: { source: t.source, name: t.name ?? "", size: st.size, mtimeMs: Math.round(st.mtimeMs), format: parsed.transcript.format } };
  } catch {
    log(`Could not open ${who}; listening to the video instead.`, "warn");
    return null;
  }
}
function quickModel(job) {
  const have = job.downloadedModels?.length ? job.downloadedModels : job.whisperAuto?.length ? job.whisperAuto : [job.whisperModel];
  return [...have].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))[0] ?? job.whisperModel;
}
async function importTranscript(job, parsed, pcmPath, window, duration2, progress, log, signal, emit) {
  const offset = window?.start ?? 0;
  const length = window ? window.end - window.start : duration2;
  let heard2 = null;
  let language = job.options.transcript?.youtube?.lang.replace(/-orig$/, "") ?? job.options.language;
  if (parsed.format === "plain") {
    if (!pcmPath) throw new Error("The audio is needed to time your text, and it could not be read.");
    const model = quickModel(job);
    if (!hardware.quickListenFits(parsed.plainWords ?? [], model)) {
      log("Text without times can only be timed quickly when it is written in Latin letters. Listening to the video instead; next time, use a transcript with times (.srt or .vtt) to skip this.", "warn");
      return null;
    }
    log(`Your text has no times; timing it with a quick listen (${local.WHISPER_MODEL_INFO[model].label} model).`);
    const rateKey = `${model}|${job.accelerator ?? "cpu"}`;
    const eta = transcribeEtaTracker(length, job.speechRates?.[rateKey]);
    const speech = new worker.SpeechWorker(log, signal);
    let heardFrom = 0;
    try {
      heard2 = await speech.transcribe({
        pcmPath,
        modelsDir: job.modelsDir,
        model,
        accelerator: job.accelerator,
        language,
        duration: length,
        onProgress: (p, m) => {
          if (p >= 10 && !heardFrom) heardFrom = Date.now();
          progress("transcribe", p * 0.95, m.replace(/^Transcribing/, "Timing your text"), eta(p));
        }
      });
    } finally {
      speech.close();
    }
    if (heardFrom && length >= 30) emit({ type: "speech-rate", projectId: job.projectId, key: rateKey, rate: Math.round((Date.now() - heardFrom) / 1e3 / length * 1e3) / 1e3 });
    if (language === "auto" && heard2.language) language = heard2.language;
    const share = matchWords((parsed.plainWords ?? []).map(normToken), heard2.words.map((w) => normToken(w.text))).size / Math.max(1, parsed.plainWords?.length ?? 0);
    if (share < 0.3) {
      log(`Only ${Math.round(share * 100)}% of your text lined up with what the quick listen heard, so its times would be guesses. Listening to the video properly instead. Check the text is for this video.`, "warn");
      return null;
    }
  } else {
    progress("transcribe", 50, "Reading your transcript…");
  }
  const samples = pcmPath ? await local.readPcmF32(pcmPath) : void 0;
  const transcript = buildImportedTranscript({
    parsed,
    source: job.options.transcript?.source ?? "imported",
    language,
    // As a listened transcript has it: the end of the part listened to.
    duration: window ? window.end : duration2,
    offset,
    windowEnd: offset + length,
    samples,
    heard: heard2?.words,
    heardModel: heard2?.model,
    log
  });
  progress("transcribe", 100, "Transcript ready");
  return transcript;
}
function renderSlots(encoder, clips, machine = { cores: os.cpus().length, memBytes: os.totalmem() }) {
  if (clips < 2 || encoder === "libx264") return 1;
  return machine.cores >= 4 && machine.memBytes >= 7.5 * 1024 ** 3 ? 2 : 1;
}
function buildScriptMarkdown(p) {
  const a = p.analysis;
  if (!a) return "";
  const lines = [`# ${p.name}`, "", "## Summary", "", a.summary, ""];
  if (a.chapters.length) {
    lines.push("## Chapters", "");
    for (const c of a.chapters) lines.push(`- ${fmtDur(c.start)} — ${c.title}`);
    lines.push("");
  }
  lines.push("## Highlights", "");
  a.highlights.forEach((h, i) => {
    lines.push(`### ${i + 1}. ${h.title}  (${fmtDur(h.start)} → ${fmtDur(h.end)}, score ${h.score})`, "", `**Hook:** ${h.hook}`, "", h.description, "", `Tags: ${h.hashtags.map((t) => `#${t}`).join(" ")}`, "", `_Why:_ ${h.reason}`, "");
  });
  lines.push("## Social posts", "", `**YouTube title:** ${a.social.youtubeTitle}`, "", `**YouTube description:**`, "", a.social.youtubeDescription, "", `**TikTok / Reels caption:**`, "", a.social.tiktokCaption, "", `**LinkedIn:**`, "", a.social.linkedinPost, "", `**X / Twitter:**`, "", a.social.tweet, "");
  lines.push("## Clean script", "", a.script, "");
  return lines.join("\n");
}
function fmtDur(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
async function runClipRender(job, emit, signal) {
  const bins = { ffmpeg: job.ffmpegPath, ffprobe: job.ffprobePath };
  const { project, highlightId } = job;
  const highlight = project.analysis?.highlights.find((h) => h.id === highlightId);
  const words2 = project.transcript?.words;
  if (!highlight || !words2) throw new Error("This project has no stored transcript, so its clips cannot be re-rendered.");
  const existing = project.clips.find((c) => c.highlightId === highlightId);
  const index = existing?.index ?? project.analysis.highlights.findIndex((h) => h.id === highlightId);
  const media = project.media ?? await local.probe(bins, project.options.inputPath);
  const enc = job.encoder ?? await local.detectEncoder(bins);
  const saved = existing && path.dirname(existing.filePath) !== project.outputDir ? { saveDir: path.dirname(existing.filePath), saveName: path.basename(existing.filePath, ".mp4") } : !existing && job.clipsDir ? await newClipTarget(job.clipsDir, project.name, Math.max(0, index), highlight.title) : {};
  emit({ type: "clip-progress", projectId: project.id, highlightId, percent: 1, message: "Preparing…" });
  const clip = await renderClip({
    bins,
    input: project.options.inputPath,
    highlight,
    index: Math.max(0, index),
    words: words2,
    settings: job.settings,
    outDir: project.outputDir,
    encoderArgs: enc.videoArgs,
    onEncoderFallback: (encoder) => emit({ type: "encoder", projectId: project.id, encoder }),
    sourceWidth: media.width,
    sourceHeight: media.height,
    hasAudio: media.hasAudio,
    fontsDir: job.fontsDir,
    memesDir: job.memesDir,
    ...saved,
    onProgress: (p) => emit({ type: "clip-progress", projectId: project.id, highlightId, percent: p, message: `Rendering… ${Math.round(p)}%` }),
    log: (message) => emit({ type: "log", projectId: project.id, level: "info", message }),
    signal
  });
  const clips = project.clips.some((c) => c.highlightId === highlightId) ? project.clips.map((c) => c.highlightId === highlightId ? clip : c) : [...project.clips, clip].sort((a, b) => a.index - b.index);
  return { ...project, clips, updatedAt: Date.now() };
}
const VIDEO_DIR = "video";
const AUDIO_DIR = "audio";
function videoExtension(container) {
  return container === "matroska" ? "mkv" : "ts";
}
const TS_VIDEO = /* @__PURE__ */ new Set(["h264", "hevc", "mpeg2video", "mpeg1video"]);
function containerFor(videoCodec) {
  return !videoCodec || TS_VIDEO.has(videoCodec) ? "mpegts" : "matroska";
}
async function startRecorder(o) {
  const videoDir = path.join(o.dir, VIDEO_DIR);
  const audioDir = path.join(o.dir, AUDIO_DIR);
  await node_fs.promises.mkdir(videoDir, { recursive: true });
  await node_fs.promises.mkdir(audioDir, { recursive: true });
  const seg = String(Math.max(4, Math.round(o.segmentSeconds)));
  const args = ["-hide_banner", "-nostdin", "-loglevel", "warning"];
  if (!o.simulate) args.push("-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10");
  for (const input of o.inputs) {
    if (o.simulate) args.push("-re");
    args.push("-i", input);
  }
  const audioFrom = o.inputs.length > 1 ? "1:a:0" : "0:a:0";
  args.push(
    "-map",
    "0:v:0",
    "-map",
    audioFrom,
    "-c",
    "copy",
    "-f",
    "segment",
    "-segment_time",
    seg,
    "-segment_format",
    o.container ?? "mpegts",
    "-reset_timestamps",
    "1",
    path.join(videoDir, `seg_%05d.${videoExtension(o.container)}`),
    "-map",
    audioFrom,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    "-f",
    "segment",
    "-segment_time",
    seg,
    "-segment_format",
    "wav",
    "-reset_timestamps",
    "1",
    path.join(audioDir, "aud_%05d.wav")
  );
  const child = node_child_process.spawn(o.ffmpeg, args, { windowsHide: true });
  let stderr = "";
  child.stderr?.on("data", (d) => {
    const text = String(d);
    stderr = (stderr + text).slice(-4e3);
    for (const line of text.split(/\r?\n/)) if (line.trim()) o.onLog(line.trim());
  });
  const seen = { video: /* @__PURE__ */ new Set(), audio: /* @__PURE__ */ new Set() };
  const sweep = async (dir, key2, emit, finalPass) => {
    const files = (await node_fs.promises.readdir(dir).catch(() => [])).filter((f) => !f.startsWith(".")).sort();
    const complete = finalPass ? files : files.slice(0, -1);
    for (const f of complete) {
      if (seen[key2].has(f)) continue;
      seen[key2].add(f);
      emit(path.join(dir, f));
    }
  };
  const tick = async (finalPass = false) => {
    await sweep(videoDir, "video", o.onVideoSegment, finalPass);
    await sweep(audioDir, "audio", o.onAudioSegment, finalPass);
  };
  const timer = setInterval(() => void tick(), 1e3);
  const stop = () => {
    try {
      child.stdin?.write("q");
      child.stdin?.end();
    } catch {
    }
    setTimeout(() => child.kill("SIGKILL"), 4e3);
  };
  o.signal.addEventListener("abort", stop, { once: true });
  const done = new Promise((resolve) => {
    child.on("error", (err) => {
      clearInterval(timer);
      resolve({ code: -1, stderr: `${stderr}
${err.message}` });
    });
    child.on("close", async (code) => {
      clearInterval(timer);
      await tick(true);
      resolve({ code: code ?? -1, stderr });
    });
  });
  return { done, stop };
}
async function readWavMono16(file) {
  const buf = await node_fs.promises.readFile(file);
  let offset = 12;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") {
      dataStart = offset + 8;
      dataLength = size === 4294967295 || size === 0 || dataStart + size > buf.length ? buf.length - dataStart : size;
      break;
    }
    offset += 8 + size + size % 2;
  }
  if (dataStart < 0) return new Float32Array();
  const count = Math.floor(dataLength / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = buf.readInt16LE(dataStart + i * 2) / 32768;
  return out;
}
const HOOK_OPENERS = [
  "how",
  "why",
  "what",
  "here's",
  "heres",
  "the secret",
  "the trick",
  "the problem",
  "the truth",
  "let me",
  "listen",
  "look",
  "imagine",
  "nobody",
  "everyone",
  "most people",
  "i want to show",
  "the mistake",
  "stop",
  "never",
  "always",
  "the best",
  "the worst",
  "my biggest"
];
const STRONG = [
  "secret",
  "mistake",
  "biggest",
  "never",
  "always",
  "best",
  "worst",
  "hack",
  "trick",
  "tip",
  "wrong",
  "right",
  "fix",
  "fixed",
  "problem",
  "solution",
  "learned",
  "lesson",
  "surprising",
  "crazy",
  "insane",
  "actually",
  "honestly",
  "truth",
  "proof",
  "result",
  "results",
  "free",
  "fast",
  "faster",
  "easy",
  "simple",
  "hard",
  "expensive",
  "cheap",
  "million",
  "thousand",
  "percent",
  "money",
  "revenue",
  "profit",
  "growth",
  "failed",
  "failure",
  "won",
  "beat"
];
const FILLER = ["um", "uh", "erm", "hmm", "sort of", "kind of", "basically", "anyway"];
function normalize(word) {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}
function isBoundary(words2, index, pause = 0.45) {
  const w = words2[index];
  if (!w) return false;
  if (/[.!?]$/.test(w.text)) return true;
  const next = words2[index + 1];
  return Boolean(next && next.start - w.end >= pause);
}
function scoreWindow(words2, options) {
  const start = words2[0]?.start ?? 0;
  const end = words2[words2.length - 1]?.end ?? start;
  const duration2 = Math.max(0.1, end - start);
  const text = words2.map((w) => w.text).join(" ");
  const lower = text.toLowerCase();
  const plain = words2.map((w) => normalize(w.text));
  const reasons = [];
  let score = 26;
  const opener = lower.slice(0, 46);
  if (HOOK_OPENERS.some((h) => opener.startsWith(h) || opener.includes(` ${h}`))) {
    score += 16;
    reasons.push("opens with a hook");
  }
  if (/\?/.test(text)) {
    score += 7;
    reasons.push("asks a question");
  }
  const strong = plain.filter((w) => STRONG.includes(w)).length;
  if (strong > 0) {
    score += Math.min(18, strong * 6);
    reasons.push(`${strong} strong word${strong === 1 ? "" : "s"}`);
  }
  const numbers = words2.filter((w) => /\d/.test(w.text) || /^(one|two|three|five|ten|hundred|thousand|million)$/i.test(w.text)).length;
  if (numbers > 0) {
    score += Math.min(10, numbers * 4);
    reasons.push("concrete numbers");
  }
  const rate = words2.length / duration2;
  const baseline = options.baselineRate ?? 2.6;
  if (rate >= baseline * 0.85) {
    score += 8;
    reasons.push("tight pacing");
  } else if (rate < baseline * 0.55) {
    score -= 10;
    reasons.push("slow stretch");
  }
  const fillers = FILLER.filter((f) => lower.includes(f)).length;
  if (fillers >= 2) {
    score -= Math.min(12, fillers * 4);
    reasons.push("filler words");
  }
  if (/[.!?]$/.test(words2[words2.length - 1]?.text ?? "")) {
    score += 7;
    reasons.push("ends on a finished sentence");
  } else {
    score -= 8;
  }
  const ideal = (options.minSeconds + options.maxSeconds) / 2;
  const fit = 1 - Math.min(1, Math.abs(duration2 - ideal) / Math.max(ideal, 1));
  score += Math.round(fit * 10);
  if (words2.length < 12) {
    score -= 12;
    reasons.push("very short");
  }
  return {
    start,
    end,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reason: reasons.slice(0, 3).join(", ") || "steady talking",
    text
  };
}
function bestWindow(words2, options) {
  if (words2.length < 8) return null;
  const starts = [0];
  for (let i = 0; i < words2.length - 1; i++) if (isBoundary(words2, i)) starts.push(i + 1);
  let best = null;
  for (const from of starts) {
    for (let to = from + 7; to < words2.length; to++) {
      const duration2 = words2[to].end - words2[from].start;
      if (duration2 > options.maxSeconds) break;
      if (duration2 < options.minSeconds) continue;
      if (!isBoundary(words2, to)) continue;
      let scored = scoreWindow(words2.slice(from, to + 1), options);
      if (options.bonus) {
        const extra = options.bonus(scored.start, scored.end);
        if (extra.points > 0) {
          const reason = [...extra.reasons, ...scored.reason.split(", ")].filter((r) => r && r !== "steady talking").slice(0, 3).join(", ");
          scored = { ...scored, score: Math.min(100, scored.score + extra.points), reason: reason || scored.reason };
        }
      }
      if (!best || scored.score > best.score) best = scored;
    }
  }
  return best;
}
const FIRST_SECONDS = 120;
const RECHECK_SECONDS = 120;
const RECHECK_GAP = 60;
const RECHECK_STRIDE = 2;
const NO_FACE_SECONDS = 60;
const MIN_DECIDE_SECONDS = 30;
const SAME_BOX_IOU = 0.5;
const SWITCH_SCORE = 1.5;
const DROP_AFTER = 2;
const MAX_BACKLOG = 2;
const LONG_MAX_FACE_FRAMES = 1800;
const DECODE_THREADS = 2;
class CamTracker {
  current = null;
  missing = 0;
  offer(next) {
    const cur = this.current;
    if (!cur) {
      this.current = next;
      return { changed: true, foundChanged: true, why: next.cam ? "first look found a cam" : "first look found no cam" };
    }
    if (next.cam && cur.cam) {
      this.missing = 0;
      const overlap2 = boxIou(next.cam.box, cur.cam.box);
      if (overlap2 >= SAME_BOX_IOU) return { changed: false, foundChanged: false, why: `same cam (IoU ${overlap2.toFixed(2)})` };
      if (next.cam.score >= SWITCH_SCORE) {
        this.current = next;
        return { changed: true, foundChanged: false, why: `the cam moved (IoU ${overlap2.toFixed(2)}, score ${next.cam.score})` };
      }
      return { changed: false, foundChanged: false, why: `a box elsewhere, not sure enough (score ${next.cam.score})` };
    }
    if (next.cam && !cur.cam) {
      if (next.cam.score >= SWITCH_SCORE) {
        this.current = next;
        return { changed: true, foundChanged: true, why: `a cam appeared (score ${next.cam.score})` };
      }
      return { changed: false, foundChanged: false, why: `maybe a cam, not sure enough (score ${next.cam.score})` };
    }
    if (!next.cam && cur.cam) {
      this.missing++;
      if (this.missing >= DROP_AFTER) {
        this.missing = 0;
        this.current = next;
        return { changed: true, foundChanged: true, why: `no cam in ${DROP_AFTER} looks in a row (${next.reason ?? "no box"})` };
      }
      return { changed: false, foundChanged: false, why: `no cam this look (${next.reason ?? "no box"}); keeping the one found` };
    }
    this.current = next;
    return { changed: false, foundChanged: false, why: `still no cam (${next.reason ?? "no box"})` };
  }
  /**
   * A verdict over every frame since the current cam appeared. It is the same cam measured on more
   * frames, so it replaces the box only when it overlaps it and the detector is surer of it.
   */
  refine(all) {
    const cur = this.current;
    if (!cur?.cam || !all.cam || boxIou(all.cam.box, cur.cam.box) < SAME_BOX_IOU || all.cam.score <= cur.cam.score) {
      return { changed: false, foundChanged: false, why: `same cam${all.cam ? ` (all frames: score ${all.cam.score})` : ""}` };
    }
    this.missing = 0;
    const was = cur.cam.score;
    this.current = all;
    return { changed: true, foundChanged: false, why: `same cam, measured better on all the frames since it appeared (score ${was} -> ${all.cam.score})` };
  }
}
class LiveFacecam {
  constructor(o) {
    this.o = o;
  }
  o;
  tracker = new CamTracker();
  ev = new CamEvidence();
  /** Every frame since the current scene began (see the top of this file). */
  long = null;
  collected = 0;
  target = FIRST_SECONDS;
  stride = 1;
  seen = 0;
  /** Stream time before which no segment is read (the gap after a verdict). */
  idleUntil = 0;
  lastEnd = -1;
  work = Promise.resolve();
  /** Segments waiting to be read. */
  backlog = 0;
  closed = false;
  frameIndex = 0;
  looks = 0;
  square = new Uint8Array(YUNET_SIZE * YUNET_SIZE * 3);
  gray = new Uint8Array(DW * DH);
  /** The first verdict is in. */
  get ready() {
    return this.tracker.current !== null;
  }
  /**
   * The box is good enough to cut clips with: a sure verdict, or a second look. A first look that
   * is not sure is often a strip of the game off (see the top of this file), and the moments that
   * wait for it only wait for the next look, about two minutes.
   */
  get settled() {
    const cur = this.tracker.current;
    return cur !== null && (!cur.cam || cur.cam.score >= SWITCH_SCORE || this.looks >= 2);
  }
  /** A finished video segment covering [start, start + duration) of the session. */
  offer(file, start, duration2) {
    if (this.closed || start < this.idleUntil) return;
    if (!this.ev) {
      this.ev = new CamEvidence();
      this.collected = 0;
      this.seen = 0;
      this.lastEnd = -1;
    }
    if (this.seen++ % this.stride !== 0) return;
    if (this.backlog >= MAX_BACKLOG) return;
    this.backlog++;
    this.work = this.work.then(() => this.read(file, start, duration2)).finally(() => this.backlog--);
  }
  /** Decide now on whatever has been collected (the stream ended, or clips have waited long enough). */
  async finish() {
    await this.work;
    if (!this.settled && this.ev && this.collected >= MIN_DECIDE_SECONDS) this.decide();
    if (!this.ready) {
      this.o.log("Not enough of the stream to look for the facecam; these clips show the whole picture.");
      this.tracker.offer({ cam: null, reason: "too little of the stream", game: [0, 0, DW, DH], frames: 0, faceFrames: 0 });
      this.o.onVerdict(this.tracker.current, { changed: true, foundChanged: true, why: "too little of the stream" });
    }
  }
  /** Stop taking segments; anything being read finishes. */
  async close() {
    this.closed = true;
    await this.work.catch(() => void 0);
  }
  async read(file, start, duration2) {
    const ev = this.ev;
    if (this.closed || !ev || this.o.signal.aborted) return;
    const long = this.long;
    if (Math.abs(start - this.lastEnd) > 0.5) {
      ev.breakRun();
      long?.breakRun();
    }
    try {
      await readFrames(this.o.ffmpeg, file, 0, duration2 + 1, this.o.signal, async (bgr) => {
        grayOf(bgr, this.gray);
        let faces;
        if (this.frameIndex++ % 2 === 0) {
          this.square.set(bgr, 0);
          faces = (await detectFaces(this.square, this.o.modelPath)).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
        }
        ev.add(this.gray, faces);
        if (long && long !== ev && long.faces.length < LONG_MAX_FACE_FRAMES) long.add(this.gray, faces);
      }, DECODE_THREADS);
    } catch (err) {
      if (this.o.signal.aborted || this.closed) return;
      this.o.log(`Skipped a segment while looking for the facecam (${err.message.split("\n")[0].slice(0, 120)}).`);
      ev.breakRun();
      long?.breakRun();
      return;
    }
    this.lastEnd = start + duration2;
    this.collected += duration2;
    const noFaceYet = !this.ready && this.collected >= NO_FACE_SECONDS && ev.faces.every((f) => f.length === 0);
    if (this.collected >= this.target || noFaceYet) {
      const sure = this.decide();
      this.idleUntil = start + duration2 + (sure ? RECHECK_GAP : 0);
    }
  }
  /** Decide on the look; true when the verdict is sure enough to wait a while for the next one. */
  decide() {
    const ev = this.ev;
    if (!ev) return true;
    const res = ev.decide();
    this.looks++;
    this.ev = null;
    const cur = this.tracker.current;
    let change2;
    if (cur?.cam && res.cam && this.long && this.long !== ev && boxIou(res.cam.box, cur.cam.box) >= SAME_BOX_IOU) {
      change2 = this.tracker.refine(this.long.decide());
    } else {
      change2 = this.tracker.offer(res);
      if (change2.changed || !this.long) this.long = ev;
    }
    this.o.onVerdict(this.tracker.current, change2);
    const now = this.tracker.current;
    const sure = !now.cam || now.cam.score >= SWITCH_SCORE;
    this.target = RECHECK_SECONDS;
    this.stride = sure ? RECHECK_STRIDE : 1;
    return sure;
  }
}
const SR = 16e3;
const PER = Math.round(SR * FRAME_S);
const PITCH_SPAN = 2 * (320 + Math.ceil(SR / 2 / 75));
const PITCH_FLOOR_DB = -45;
const USUAL_LINES = 300;
const MIN_LINES = 5;
const USUAL_SPIKES_PER_MIN = 2;
const RECENT_SECONDS = 60;
const AUDIO_BASE = 44;
const REACTION_TAIL = 4;
const CHAT_LAG = 5;
const MAX_LIVE_BONUS = 30;
class LiveGamingAudio {
  /** dB and pitch (Hz, 0 unvoiced) per 20 ms frame; frame 0 of the arrays is session frame `origin`. */
  db = new Float32Array(0);
  pitch = new Float32Array(0);
  origin = 0;
  pending = new Float32Array(0);
  /** Every frame's dB since the session began, 1 dB bins from -90: the stream's median frame. */
  dbHist = new Uint32Array(100);
  /** Voiced pitch inside words, 5 Hz bins from 75 Hz: the streamer's usual voice. */
  pitchHist = new Uint32Array(100);
  lineLevels = [];
  linesTo = 0;
  // lines ending before this have been counted into the usual
  scannedTo = 0;
  // frames scanned for spikes
  spikes = [];
  /** Spikes found all session (never pruned), for the stream's own rate. */
  spikeCount = 0;
  recent = new Float32Array(0);
  recentStart = 0;
  /** Seconds of sound taken in so far. */
  get heard() {
    return (this.origin + this.db.length) * FRAME_S;
  }
  /** The next stretch of the session's 16 kHz mono sound (it follows the last one). */
  push(samples) {
    const buf = new Float32Array(this.pending.length + samples.length);
    buf.set(this.pending, 0);
    buf.set(samples, this.pending.length);
    const count = buf.length >= PITCH_SPAN ? Math.floor((buf.length - PITCH_SPAN) / PER) + 1 : 0;
    const db = new Float32Array(count);
    const pitch = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      let sum = 0;
      for (let j = k * PER; j < (k + 1) * PER; j++) sum += buf[j] * buf[j];
      db[k] = 10 * Math.log10(Math.max(1e-9, sum / PER));
      this.dbHist[Math.max(0, Math.min(99, Math.round(db[k] + 90)))]++;
      if (db[k] >= PITCH_FLOOR_DB) pitch[k] = pitchAt(buf, k * PER);
    }
    this.db = join(this.db, db);
    this.pitch = join(this.pitch, pitch);
    this.pending = buf.slice(count * PER);
    const keep = RECENT_SECONDS * SR;
    const all = join(this.recent, samples);
    this.recentStart += Math.max(0, all.length - keep) / SR;
    this.recent = all.length > keep ? all.slice(all.length - keep) : all;
  }
  /** The last minute of sound, for the laughter model: samples and the session second they start at. */
  recentSound() {
    return { samples: this.recent, offset: this.recentStart };
  }
  /** Forget everything before `t` (seconds), except the 2 s a spike looks back over. */
  prune(t) {
    const drop = Math.floor((t - 2.5) / FRAME_S) - this.origin;
    if (drop <= 0) return;
    this.db = this.db.slice(Math.min(drop, this.db.length));
    this.pitch = this.pitch.slice(Math.min(drop, this.pitch.length));
    this.origin += drop;
    while (this.spikes.length && this.spikes[0].t < t - 2.5) this.spikes.shift();
  }
  /**
   * 0-1: what one game sound is worth on this stream (see USUAL_SPIKES_PER_MIN). The rate starts
   * from a prior of the usual rate over one minute, so the first spikes of a session are not
   * judged on a few seconds.
   */
  spikeWeight() {
    const minutes = this.scannedTo * FRAME_S / 60;
    const rate = (this.spikeCount + USUAL_SPIKES_PER_MIN) / (minutes + 1);
    return Math.min(1, USUAL_SPIKES_PER_MIN / rate);
  }
  /** The stream's median frame, in dB. */
  overall() {
    return histMedian(this.dbHist) - 90;
  }
  usualPitch() {
    const n = this.pitchHist.reduce((a, b) => a + b, 0);
    return n < 20 ? 0 : 75 + histMedian(this.pitchHist) * 5;
  }
  /** Loudness of a line: mean power of its louder half of frames, in dB (NaN if not heard). */
  lineLevel(s) {
    const a = Math.floor(s.start / FRAME_S) - this.origin;
    const b = Math.max(a + 1, Math.floor(s.end / FRAME_S) - this.origin);
    if (a < 0 || b > this.db.length) return { level: NaN, loudest: [] };
    const idx = Array.from({ length: b - a }, (_, k) => a + k).sort((x, y) => this.db[y] - this.db[x]);
    const top = idx.slice(0, Math.max(1, Math.floor(idx.length / 2)));
    const power = top.reduce((acc, i) => acc + 10 ** (this.db[i] / 10), 0) / top.length;
    return { level: 10 * Math.log10(Math.max(1e-9, power)), loudest: idx.slice(0, 5) };
  }
  /**
   * Bring the running usual and the spike list up to `to` (the settled transcript's end), then the
   * yell/spike marks of `sentences`. `words` say where someone talks: spikes are only looked for
   * where nobody does, as in the offline marks.
   */
  marks(sentences, words2, to) {
    for (const s of sentences) {
      if (s.end <= this.linesTo || s.end > to) continue;
      const { level: level2 } = this.lineLevel(s);
      if (Number.isFinite(level2)) {
        this.lineLevels.push(level2);
        if (this.lineLevels.length > USUAL_LINES) this.lineLevels.shift();
      }
      for (let i = s.from; i <= s.to; i++) {
        const w = words2[i];
        if (!w) continue;
        for (let f = Math.floor(w.start / FRAME_S) - this.origin; f < Math.floor(w.end / FRAME_S) - this.origin; f++) {
          const p = this.pitch[f];
          if (p > 0) this.pitchHist[Math.max(0, Math.min(99, Math.round((p - 75) / 5)))]++;
        }
      }
    }
    this.linesTo = Math.max(this.linesTo, ...sentences.filter((s) => s.end <= to).map((s) => s.end), this.linesTo);
    const end = Math.min(this.db.length, Math.floor(to / FRAME_S) - this.origin);
    const from = Math.max(0, this.scannedTo - this.origin);
    if (end > from) {
      const speech = new Uint8Array(this.db.length);
      const at = (t) => Math.max(0, Math.min(this.db.length - 1, Math.floor(t / FRAME_S) - this.origin));
      for (const w of words2) {
        if (w.end < (this.origin + from) * FRAME_S - 1 || w.start > to + 1) continue;
        for (let f = at(w.start - 0.15); f <= at(w.end + 0.15); f++) speech[f] = 1;
      }
      for (const sp of scanSpikes(this.db, speech, this.overall(), from, end)) {
        const t = (this.origin + sp.frame) * FRAME_S;
        const last = this.spikes[this.spikes.length - 1];
        if (last && t - last.t < 2) last.jump = Math.max(last.jump, sp.jump);
        else {
          this.spikes.push({ t, jump: sp.jump });
          this.spikeCount++;
        }
      }
      this.scannedTo = this.origin + end;
    }
    const usual = this.lineLevels.length >= MIN_LINES ? median(this.lineLevels) : NaN;
    const voice = this.usualPitch();
    const out = sentences.map(() => ({ yell: 0, spike: 0 }));
    sentences.forEach((s, i) => {
      if (!Number.isFinite(usual)) return;
      const { level: level2, loudest } = this.lineLevel(s);
      const over = level2 - usual;
      if (!(over >= YELL_DB)) return;
      const f0s = loudest.map((f) => this.pitch[f]).filter((p2) => p2 > 0);
      const p = f0s.length >= 2 ? median(f0s) : 0;
      const higher = voice > 0 && p > 0 ? p / voice : 0;
      if (isYell(over, higher)) out[i].yell = Math.round(over * 10) / 10;
    });
    const weight = this.spikeWeight();
    for (const sp of this.spikes) {
      const k = spikeLine(sentences, sp.t);
      if (k >= 0) out[k].spike = Math.max(out[k].spike, Math.round(spikeStrength(sp.jump) * weight * 100) / 100);
    }
    return out;
  }
  /** The anchors for sound-alone windows between `from` and `to`: spikes and yells (chat is added by the session). */
  events(sentences, marks, from, to) {
    const out = [];
    const weight = this.spikeWeight();
    for (const sp of this.spikes) if (sp.t >= from && sp.t <= to) out.push({ t: sp.t, kind: "spike", strength: spikeStrength(sp.jump) * weight });
    sentences.forEach((s, i) => {
      if (marks[i]?.yell > 0 && s.end >= from && s.end <= to) out.push({ t: s.end, kind: "yell", strength: 1 });
    });
    return out.sort((a, b) => a.t - b.t);
  }
}
function liveGamingBonus(marks, sentences, start, end, extras = {}) {
  let first = sentences.findIndex((s) => s.start >= start - 0.05);
  let last = -1;
  for (let i = sentences.length - 1; i >= 0; i--) if (sentences[i].end <= end + 0.05) {
    last = i;
    break;
  }
  const reasons = [];
  let points = 0;
  if (first >= 0 && last >= first) {
    const g = gamingBonus(marks, first, last);
    if (g > 0) {
      points += g;
      const yells = marks.slice(first, last + 1).filter((m) => m.yell > 0).length;
      const spikes = marks.slice(first, last + 1).filter((m) => m.spike > 0).length;
      if (yells) reasons.push(yells === 1 ? "a yell" : `${yells} yells`);
      if (spikes) reasons.push(spikes === 1 ? "a game sound" : `${spikes} game sounds`);
    }
  } else first = -1;
  if ((extras.laugh ?? 0) > 0.2) {
    points += Math.round((extras.laugh ?? 0) * 8);
    reasons.push("laughter after it");
  }
  if ((extras.chat ?? 0) > 0) {
    points += Math.round((extras.chat ?? 0) * 15);
    reasons.push("chat went off");
  }
  return { points: Math.min(MAX_LIVE_BONUS, points), reasons };
}
function scoreAudioWindow(events, start, end, extras = {}) {
  let spikes = 0;
  let yells = 0;
  let late = 0;
  let weight = 0;
  let chat2 = extras.chat ?? 0;
  const lateFrom = start + (end - start) * 0.6;
  for (const e of events) {
    if (e.t < start || e.t > end - 1) continue;
    weight += e.strength;
    if (e.kind === "spike") spikes += e.strength;
    else if (e.kind === "yell") yells++;
    else chat2 = Math.max(chat2, e.strength);
    if (e.t >= lateFrom && e.kind !== "chat") late = 1;
  }
  const reasons = [];
  if (spikes > 0) reasons.push(spikes >= 1.5 ? "big game sounds" : "a game sound");
  if (yells > 0) reasons.push(yells === 1 ? "a yell" : `${yells} yells`);
  if (chat2 > 0) reasons.push("chat went off");
  if ((extras.laugh ?? 0) > 0.2) reasons.push("laughter");
  const score = AUDIO_BASE + Math.min(2.5, spikes) * 10 + Math.min(2, yells) * 7 + late * 4 + (extras.laugh ?? 0) * 8 + chat2 * 15;
  return { score: Math.max(0, Math.min(100, Math.round(score))), reason: reasons.slice(0, 3).join(", ") || "game sounds", weight };
}
function bestAudioWindow(o) {
  const length = Math.max(o.minSeconds, Math.min(o.maxSeconds, (o.minSeconds + o.maxSeconds) / 2 * 0.6));
  if (o.to - o.from < o.minSeconds) return null;
  let best = null;
  let bestWeight = 0;
  for (const e of o.events) {
    let end = Math.min(o.to, e.t + REACTION_TAIL);
    let start = end - length;
    if (start < o.from) {
      start = o.from;
      end = Math.min(o.to, start + length);
    }
    if (end - start < o.minSeconds) continue;
    const snapped = snapToSentences(start, end, o.sentences, { minSeconds: o.minSeconds, maxSeconds: o.maxSeconds, limit: { start: o.from, end: o.to } });
    if (snapped.end - snapped.start >= o.minSeconds && snapped.end - snapped.start <= o.maxSeconds && e.t >= snapped.start && e.t <= snapped.end) {
      start = snapped.start;
      end = snapped.end;
    }
    const { score, reason, weight } = scoreAudioWindow(o.events, start, end, o.extras?.(start, end));
    if (!best || score > best.score || score === best.score && weight > bestWeight) {
      bestWeight = weight;
      const text = o.words.filter((w) => w.start >= start && w.end <= end).map((w) => w.text).join(" ");
      best = { start, end, score, reason, text };
    }
  }
  return best;
}
function join(a, b) {
  if (!a.length) return b;
  if (!b.length) return a;
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
function histMedian(h) {
  const n = h.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < h.length; i++) {
    acc += h[i];
    if (acc > n / 2) return i;
  }
  return 0;
}
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
const CHAT_BIN = 5;
const BURST_RATIO = 2.5;
const BURST_MIN = 4;
const KEEP_BINS = 120;
const USUAL_WEIGHT = 1 / 60;
const HYPE = [
  "clip",
  "clipit",
  "clip it",
  "w",
  "ww",
  "www",
  "lol",
  "lmao",
  "lmfao",
  "kekw",
  "kek",
  "lul",
  "lulw",
  "omegalul",
  "omg",
  "wtf",
  "pog",
  "poggers",
  "pogchamp",
  "pogu",
  "no way",
  "noway",
  "insane",
  "holy",
  "goated",
  "gg",
  "sheesh",
  "bro",
  "nah",
  "😂",
  "🤣",
  "💀",
  "🔥",
  "😱",
  "😭"
];
const HYPE_RE = new RegExp(`(^|[^\\p{L}\\p{N}])(${HYPE.map((h) => h.replace(/ /g, "\\s+")).join("|")})(?=$|[^\\p{L}\\p{N}])`, "iu");
function isHype(text) {
  return HYPE_RE.test(text) || /(.)\1{4,}/u.test(text);
}
class ChatBursts {
  bins = /* @__PURE__ */ new Map();
  usual = 0;
  settledTo = -1;
  // bins up to here have gone into the usual
  settledCount = 0;
  seen = 0;
  /** A message posted at `t` seconds of session time. */
  add(t, text) {
    if (!(t >= 0)) return;
    const b = Math.floor(t / CHAT_BIN);
    if (this.settledTo < 0) this.settledTo = b - 1;
    const bin = this.bins.get(b) ?? { n: 0, hype: 0 };
    bin.n++;
    if (isHype(text)) bin.hype++;
    this.bins.set(b, bin);
    this.seen++;
    for (let k = this.settledTo + 1; k < b - 1; k++) this.settle(k);
  }
  settle(k) {
    const n = this.bins.get(k)?.n ?? 0;
    this.settledCount++;
    if (this.settledCount <= 12) {
      this.usual += (n - this.usual) / this.settledCount;
    } else {
      this.usual += (Math.min(n, Math.max(1, this.usual) * BURST_RATIO) - this.usual) * USUAL_WEIGHT;
    }
    this.settledTo = k;
    this.bins.delete(k - KEEP_BINS);
  }
  /** Messages per bin, usually. */
  get usualRate() {
    return this.usual;
  }
  /** Any messages at all so far (a chat that never said anything is not counted as a signal). */
  get active() {
    return this.seen > 0;
  }
  /** 0-1: how hard one bin went off. More messages than usual, and how many of them cheer. */
  binStrength(b) {
    const bin = this.bins.get(b);
    if (!bin) return 0;
    const usual = Math.max(1, this.usual);
    const ratio = bin.n / usual;
    const hypeShare = bin.hype / Math.max(1, bin.n);
    if (bin.n < BURST_MIN || ratio < BURST_RATIO && !(ratio >= 1.5 && hypeShare >= 0.5)) return 0;
    const fromRate = Math.min(1, (ratio - 1.5) / 4);
    return Math.round(Math.min(1, fromRate * 0.7 + hypeShare * 0.5) * 100) / 100;
  }
  /**
   * 0-1: chat's reaction to a moment that ends at `end`: the strongest bin in the `lag` seconds after
   * it (chat lags the play by about 3-8 s), and the last couple of seconds of the moment itself.
   */
  reactionTo(end, lag = 10) {
    let best = 0;
    for (let b = Math.floor((end - 2) / CHAT_BIN); b <= Math.floor((end + lag) / CHAT_BIN); b++) best = Math.max(best, this.binStrength(b));
    return best;
  }
  /** The bursts between `from` and `to` (session seconds of the chat): when and how strong. */
  bursts(from, to) {
    const out = [];
    for (let b = Math.floor(from / CHAT_BIN); b <= Math.floor(to / CHAT_BIN); b++) {
      const s = this.binStrength(b);
      if (s > 0) out.push({ t: b * CHAT_BIN, strength: s });
    }
    return out;
  }
}
function chatPlatform(url) {
  if (!url) return null;
  let u;
  try {
    u = new URL(url.includes("://") ? url : `https://${url}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (host === "twitch.tv") {
    const channel = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return channel && /^[a-z0-9_]{2,25}$/.test(channel) && !["videos", "directory", "settings"].includes(channel) ? { kind: "twitch", channel } : null;
  }
  if (host === "youtube.com" || host === "youtu.be") return { kind: "youtube", url: u.toString() };
  return null;
}
function startChat(pageUrl, onMessage, log) {
  const platform = chatPlatform(pageUrl);
  if (!platform) return null;
  try {
    return platform.kind === "twitch" ? twitchChat(platform.channel, onMessage, log) : youtubeChat(platform.url, onMessage, log);
  } catch {
    return null;
  }
}
function twitchChat(channel, onMessage, log) {
  let stopped = false;
  let ws = null;
  let tries = 0;
  let said = false;
  const connect = () => {
    if (stopped || tries++ > 5 || typeof WebSocket === "undefined") return;
    try {
      ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    } catch {
      return;
    }
    ws.onopen = () => {
      ws?.send("PASS SCHMOOPIIE");
      ws?.send(`NICK justinfan${1e4 + Math.floor(Math.random() * 8e4)}`);
      ws?.send(`JOIN #${channel}`);
    };
    ws.onmessage = (ev) => {
      for (const line of String(ev.data).split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) {
          ws?.send(line.replace("PING", "PONG"));
          continue;
        }
        const m = / PRIVMSG #[^ ]+ :(.*)$/.exec(line);
        if (!m) continue;
        if (!said) {
          said = true;
          tries = 0;
          log("Reading the stream's Twitch chat.");
        }
        onMessage(Date.now(), m[1]);
      }
    };
    ws.onerror = () => void 0;
    ws.onclose = () => {
      if (!stopped) setTimeout(connect, 5e3 * tries);
    };
  };
  connect();
  return {
    stop: () => {
      stopped = true;
      try {
        ws?.close();
      } catch {
      }
    }
  };
}
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
function youtubeChat(pageUrl, onMessage, log) {
  const abort = new AbortController();
  const get = (url) => fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, signal: abort.signal }).then((r) => r.text());
  void (async () => {
    let id = /[?&]v=([\w-]{11})/.exec(pageUrl)?.[1] ?? /youtu\.be\/([\w-]{11})/.exec(pageUrl)?.[1] ?? /\/live\/([\w-]{11})/.exec(pageUrl)?.[1];
    if (!id) {
      const page = await get(pageUrl);
      id = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/.exec(page)?.[1] ?? /"videoId":"([\w-]{11})"/.exec(page)?.[1];
    }
    if (!id) return;
    const html = await get(`https://www.youtube.com/live_chat?is_popout=1&v=${id}`);
    const key2 = /"INNERTUBE_API_KEY":"([^"]+)"/.exec(html)?.[1];
    const version2 = /"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1] ?? /"clientVersion":"([^"]+)"/.exec(html)?.[1];
    let continuation = /"continuation":"([^"]+)"/.exec(html)?.[1];
    if (!key2 || !version2 || !continuation) return;
    log("Reading the stream's YouTube live chat.");
    let misses = 0;
    while (!abort.signal.aborted && continuation && misses < 5) {
      let wait = 5e3;
      try {
        const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${key2}&prettyPrint=false`, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": UA },
          body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: version2 } }, continuation }),
          signal: abort.signal
        });
        const data = await res.json();
        const live = data.continuationContents?.liveChatContinuation;
        if (!live) {
          misses++;
        } else {
          misses = 0;
          for (const a of live.actions ?? []) {
            const r = a.addChatItemAction?.item?.liveChatTextMessageRenderer;
            if (!r) continue;
            const text = (r.message?.runs ?? []).map((x) => x.text ?? x.emoji?.shortcuts?.[0] ?? "").join("");
            const at = r.timestampUsec ? Number(r.timestampUsec) / 1e3 : Date.now();
            onMessage(at, text);
          }
          const next = live.continuations?.[0];
          const c = next?.invalidationContinuationData ?? next?.timedContinuationData ?? next?.reloadContinuationData;
          continuation = c?.continuation;
          wait = Math.max(1e3, Math.min(1e4, Number(c?.timeoutMs) || 5e3));
        }
      } catch {
        if (abort.signal.aborted) return;
        misses++;
      }
      await new Promise((r) => setTimeout(r, wait));
    }
  })().catch(() => void 0);
  return { stop: () => abort.abort() };
}
const SAMPLE_RATE = 16e3;
const SEGMENT_SECONDS = 12;
const WINDOW_SECONDS = 30;
const STEP_SECONDS = 25;
const EDGE_GUARD = 2.5;
const CLIP_PAD = 0.35;
function searchWindowSeconds(maxClipSeconds) {
  return Math.max(150, maxClipSeconds * 3);
}
async function runLiveSession(job, emit, signal) {
  const bins = { ffmpeg: job.ffmpegPath, ffprobe: job.ffprobePath };
  const projectId = job.projectId;
  const gaming = isGamingJob(job.project.options);
  const options = gamingOptions(job.project.options);
  const log = (message, level2 = "info") => emit({ type: "log", projectId, level: level2, message });
  const recDir = path.join(job.outputDir, ".live");
  const workDir = path.join(job.outputDir, ".work");
  await node_fs.promises.mkdir(recDir, { recursive: true });
  await node_fs.promises.mkdir(workDir, { recursive: true });
  const project = { ...job.project, options, status: "processing", clips: [...job.project.clips], liveStopped: void 0 };
  const words2 = [];
  const highlights = [...job.project.analysis?.highlights ?? []];
  const videoSegments = [];
  const pendingAudio = [];
  let buffer = new Float32Array(0);
  let bufferStart = 0;
  let videoEnd = 0;
  let transcribedTo = 0;
  let cutFrom = 0;
  let stopping = false;
  let ended = false;
  let endedByItself = false;
  let recordingGone = false;
  let lastCandidateKey = "";
  const status = (state, extra = {}) => emitStatus(state, extra);
  function emitStatus(state, extra = {}) {
    emit({
      type: "live-status",
      projectId,
      state,
      watched: Math.round(Math.max(videoEnd, transcribedTo)),
      clipsFound: project.clips.length + waiting.length,
      ...extra
    });
  }
  const waiting = [];
  const gamingAudio = gaming ? new LiveGamingAudio() : null;
  let stack = { cam: null, game: WHOLE_FRAME };
  let facecam = null;
  if (gaming && options.facecam === "none") {
    log("No facecam (as asked): the clips show the gameplay only.");
    project.notes = [NO_CAM_ASKED_NOTE];
  } else if (gaming && !job.fontsDir) {
    log("The face model is not available here, so the facecam was not looked for.");
    project.notes = [NO_CAM_NOTE];
  } else if (gaming) {
    facecam = new LiveFacecam({
      ffmpeg: bins.ffmpeg,
      modelPath: path.join(path.dirname(job.fontsDir), "models", YUNET_FILE$1),
      signal,
      log: (m) => log(m),
      onVerdict: (res, change2) => {
        if (change2.changed) stack = stackFromDetection(res);
        project.options = { ...project.options, stack };
        project.notes = stack.cam ? void 0 : [NO_CAM_NOTE];
        const where = res.cam ? `at ${res.cam.box.join(",")} of 640x360 (score ${res.cam.score})` : `none (${res.reason ?? "no box"})`;
        log(`Facecam check: ${where}; ${change2.why}.`);
        if (change2.foundChanged) status("watching", { facecam: { found: Boolean(stack.cam) } });
      }
    });
  }
  const facecamReady = () => !facecam || facecam.settled;
  let wallStart = null;
  const chat2 = gaming && !job.simulate ? new ChatBursts() : null;
  const chatSource = chat2 ? startChat(job.project.sourceUrl ?? options.sourceUrl, (atMs, text) => {
    if (wallStart !== null) chat2.add((atMs - wallStart) / 1e3, text);
  }, (m) => log(m)) : null;
  const canHearLaughs = gaming && laughterModelPresent(job.modelsDir);
  const laughHeard = /* @__PURE__ */ new Map();
  const downloaded = job.whisperAuto ?? [];
  const auto = downloaded.length > 0;
  const onCpu = !job.accelerator || job.accelerator === "cpu";
  const liveSizes = downloaded.filter((m) => !onCpu || SIZE_ORDER.indexOf(m) <= SIZE_ORDER.indexOf("small"));
  const pickLive = (lang) => pickSpeechModel(lang, liveSizes.length ? liveSizes : downloaded);
  let model = auto ? pickLive(options.language === "auto" ? void 0 : options.language).model : job.whisperModel;
  let languageSettled = !auto || options.language !== "auto";
  let heardLanguage = options.language;
  let slowSteps = 0;
  let failures = 0;
  let warned = "";
  const notice = (text) => {
    if (warned === text) return;
    warned = text;
    log(text, "warn");
    status("watching", { notice: text });
  };
  if (auto) log(`Speech model: ${local.WHISPER_MODEL_INFO[model].label} (Auto, for a live stream${onCpu ? " on the processor" : ""}).`);
  status("connecting", { message: "Connecting to the stream…" });
  const inputs = job.streamUrl.split("\n").filter(Boolean);
  const probeLimit = AbortSignal.any([signal, AbortSignal.timeout(2e4)]);
  const videoCodec = await local.run(bins.ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", inputs[0]], { signal: probeLimit }).then((r) => r.stdout.trim().split(/\s+/)[0] || void 0, () => void 0);
  const container = containerFor(videoCodec);
  if (container !== "mpegts") log(`The stream's video is ${videoCodec}; recording it in Matroska segments.`);
  const recorder = await startRecorder({
    ffmpeg: bins.ffmpeg,
    inputs,
    simulate: job.simulate,
    container,
    dir: recDir,
    segmentSeconds: SEGMENT_SECONDS,
    signal,
    onLog: (line) => {
      if (/error|failed|unable/i.test(line)) log(line, "warn");
    },
    onVideoSegment: (file) => void onVideoSegment(file),
    onAudioSegment: (file) => pendingAudio.push(file)
  });
  async function onVideoSegment(file) {
    if (recordingGone) return;
    try {
      const info = await local.probe(bins, file);
      videoSegments.push({ file, start: videoEnd, duration: info.duration });
      facecam?.offer(file, videoEnd, info.duration);
      videoEnd += info.duration;
    } catch (err) {
      if (recordingGone) return;
      log(`Skipped an unreadable segment: ${err.message}`, "warn");
    }
  }
  let encoder = job.encoder ?? await local.detectEncoder(bins);
  log(`Video encoder: ${encoder.name}`);
  const maxSeconds = job.project.options.liveMaxMinutes * 60;
  const retentionSeconds = Math.max(300, job.project.options.liveRetentionMinutes * 60);
  const threshold = job.project.options.liveThreshold;
  const recorderResult = { value: null };
  void recorder.done.then((r) => {
    recorderResult.value = r;
    if (!stopping && !signal.aborted && (!job.simulate || process.env.CLIPIE_LIVE_DROP_TEST === "1")) endedByItself = true;
    ended = true;
  });
  status("watching", { message: "Watching the stream…" });
  while (!ended || pendingAudio.length > 0 || buffer.length > 0) {
    if (signal.aborted) stopping = true;
    if (stopping && !ended) recorder.stop();
    while (pendingAudio.length > 0) {
      const file = pendingAudio.shift();
      try {
        const samples = await readWavMono16(file);
        if (samples.length) buffer = concat(buffer, samples);
        if (gamingAudio && samples.length) {
          gamingAudio.push(samples);
          wallStart ??= Date.now() - gamingAudio.heard * 1e3;
        }
        await node_fs.promises.rm(file, { force: true });
      } catch (err) {
        log(`Could not read an audio segment: ${err.message}`, "warn");
      }
    }
    const bufferSeconds = buffer.length / SAMPLE_RATE;
    const flush = ended && pendingAudio.length === 0;
    if (bufferSeconds >= WINDOW_SECONDS || flush && bufferSeconds > 2) {
      const take = Math.min(buffer.length, WINDOW_SECONDS * SAMPLE_RATE);
      const slice = new Float32Array(buffer.subarray(0, take));
      const windowEnd = bufferStart + take / SAMPLE_RATE;
      const isLast = flush && take === buffer.length;
      const heardAt = Date.now();
      try {
        const transcript = await local.transcribeLocal({
          samples: slice,
          pcmPath: "",
          modelsDir: job.modelsDir,
          model,
          accelerator: job.accelerator,
          language: heardLanguage,
          duration: take / SAMPLE_RATE,
          onProgress: () => void 0,
          log: () => void 0,
          signal
        });
        const guard = isLast ? 0 : EDGE_GUARD;
        const lastEnd = words2.length ? words2[words2.length - 1].end : 0;
        for (const w of transcript.words) {
          const start = bufferStart + w.start;
          const end = bufferStart + w.end;
          if (end > windowEnd - guard) break;
          if (start < lastEnd - 0.05) continue;
          words2.push({ text: w.text, start, end });
        }
        transcribedTo = Math.max(transcribedTo, windowEnd - guard);
        failures = 0;
        if (!languageSettled && transcript.language && transcript.language !== "auto") {
          languageSettled = true;
          heardLanguage = transcript.language;
          const pick2 = pickLive(transcript.language);
          if (pick2.model !== model) {
            log(`Heard ${local.LANGUAGES.find((l) => l.id === transcript.language)?.label ?? transcript.language}; switching the speech model to ${local.WHISPER_MODEL_INFO[pick2.model].label}.`);
            model = pick2.model;
          }
          const best = pickSpeechModel(transcript.language, downloaded);
          if (!pick2.good || best.model !== pick2.model) {
            const name = local.LANGUAGES.find((l) => l.id === transcript.language)?.label ?? transcript.language;
            notice(`For ${name}, ${local.WHISPER_MODEL_INFO[pick2.wanted].label} would write better captions, but ${best.model !== pick2.model ? "it is slower than a live stream on this computer" : "it is not downloaded"}. Using ${local.WHISPER_MODEL_INFO[model].label}. For the best captions, record the stream and make clips from the recording.`);
          }
        }
        const took = (Date.now() - heardAt) / 1e3;
        slowSteps = took > STEP_SECONDS * 0.95 ? slowSteps + 1 : 0;
        if (slowSteps >= 2) {
          const smaller = auto ? [...SIZE_ORDER].reverse().find((m) => downloaded.includes(m) && SIZE_ORDER.indexOf(m) < SIZE_ORDER.indexOf(model)) : void 0;
          if (smaller) {
            notice(`${local.WHISPER_MODEL_INFO[model].label} took ${Math.round(took)} s for each ${STEP_SECONDS} s of the stream, so it was falling behind. Switched to ${local.WHISPER_MODEL_INFO[smaller].label} to keep up.`);
            model = smaller;
          } else {
            notice(`The ${local.WHISPER_MODEL_INFO[model].label} speech model is slower than the stream on this computer (${Math.round(took)} s for each ${STEP_SECONDS} s), so clips will come later and later. Choose a smaller model${auto ? "" : ", or Auto,"} in Settings → Speech for live streams.`);
          }
          slowSteps = 0;
        }
      } catch (err) {
        if (signal.aborted) break;
        failures++;
        log(`Transcription hiccup: ${err.message}`, "warn");
        if (failures >= 2) {
          notice(`The ${local.WHISPER_MODEL_INFO[model].label} speech model keeps failing on this stream (${err.message.split("\n")[0].slice(0, 120)}). Choose another model in Settings → Speech.`);
        }
      }
      const drop = Math.min(buffer.length, (isLast ? WINDOW_SECONDS : STEP_SECONDS) * SAMPLE_RATE);
      buffer = new Float32Array(buffer.slice(drop));
      bufferStart += drop / SAMPLE_RATE;
      cutFrom = Math.max(cutFrom, transcribedTo - searchWindowSeconds(options.maxClipSeconds));
      const settled = words2.filter((w) => w.start >= cutFrom && w.end <= transcribedTo);
      const ticker = settled.slice(-14).map((w) => w.text).join(" ");
      const room = project.clips.length + waiting.length < options.clipCount;
      const lengths = { minSeconds: options.minClipSeconds, maxSeconds: options.maxClipSeconds };
      const candidate = !room ? null : gaming ? await gamingCandidate(settled) : bestWindow(settled, lengths);
      if (candidate) {
        const passes = candidate.score >= threshold;
        const recorded = candidate.end + CLIP_PAD <= videoEnd;
        if (passes && !recorded) {
          status("watching", { currentScore: candidate.score, transcript: ticker, message: "Waiting for the recording to catch up…" });
        } else {
          const key2 = `${candidate.start.toFixed(1)}-${candidate.end.toFixed(1)}-${candidate.score}`;
          if (key2 !== lastCandidateKey) {
            lastCandidateKey = key2;
            emit({
              type: "live-candidate",
              projectId,
              candidate: { start: candidate.start, end: candidate.end, score: candidate.score, reason: candidate.reason, text: candidate.text },
              accepted: passes
            });
          }
          status(passes ? "clipping" : "watching", { currentScore: candidate.score, transcript: ticker });
          if (passes && !facecamReady()) {
            waiting.push(candidate);
            log(`Kept the moment at ${fmt(candidate.start)}–${fmt(candidate.end)} (score ${candidate.score}); it is cut once the facecam has been found.`);
            cutFrom = candidate.end + 0.5;
          } else if (passes) {
            try {
              await cutClip(candidate.start, candidate.end, candidate.score, candidate.reason, candidate.text);
            } catch (err) {
              if (signal.aborted) break;
              log(`Could not cut that clip: ${err.message}`, "warn");
            }
            cutFrom = candidate.end + 0.5;
          }
        }
      } else {
        status("watching", { transcript: ticker });
      }
    }
    if (waiting.length && facecamReady() && !signal.aborted) await cutWaiting();
    if (project.clips.length + waiting.length >= options.clipCount) {
      const n = project.clips.length + waiting.length;
      log(`Found ${n} clip${n === 1 ? "" : "s"}; stopping.`);
      stopping = true;
      break;
    }
    if (!stopping && videoEnd >= maxSeconds) {
      log(`Reached the ${options.liveMaxMinutes} minute limit; stopping.`);
      stopping = true;
    }
    if (stopping && ended && pendingAudio.length === 0 && buffer.length / SAMPLE_RATE < 2) break;
    await pruneOldSegments();
    if (!ended) await sleep(700, signal);
    else if (pendingAudio.length === 0 && buffer.length / SAMPLE_RATE < 2) break;
  }
  status("stopping", { message: "Finishing up…" });
  recorder.stop();
  await recorder.done;
  chatSource?.stop();
  if (waiting.length && !signal.aborted) {
    if (facecam && !facecam.settled) {
      status("stopping", { message: "Finding the facecam…" });
      await facecam.finish();
    }
    await cutWaiting();
  }
  await facecam?.close();
  const exit = recorderResult.value;
  if (!signal.aborted && project.clips.length === 0 && exit && exit.code !== 0 && videoEnd < 5) {
    throw new Error(`The stream could not be read: ${local.lastLines(exit.stderr, 3) || `ffmpeg exited with code ${exit.code}`}`);
  }
  if (endedByItself && !signal.aborted) {
    const why = exit && exit.code !== 0 ? "the connection to the stream dropped" : "the stream ended or went offline";
    const after = videoEnd < 60 ? `${Math.round(videoEnd)} s` : `${Math.round(videoEnd / 60)} min`;
    log(`The recording stopped by itself after ${after} (${why}).`, "warn");
    if (project.clips.length === 0) {
      throw new Error(`SNU Clipper stopped watching after ${after}: ${why} before any moment scored ${threshold} or higher. Try again while the stream is live.`);
    }
    project.liveStopped = { reason: `${why[0].toUpperCase()}${why.slice(1)}.`, watched: Math.round(videoEnd) };
  }
  project.status = signal.aborted && project.clips.length === 0 ? "cancelled" : "done";
  project.updatedAt = Date.now();
  project.media = project.media ?? { duration: videoEnd, width: 0, height: 0, fps: 0, hasAudio: true, codec: "live", sizeBytes: 0 };
  project.transcript = {
    language: options.language,
    duration: videoEnd,
    segments: [],
    words: words2,
    provider: job.transcription,
    model
  };
  project.analysis = {
    summary: `Watched ${(videoEnd / 60).toFixed(1)} minutes of the live stream and kept ${project.clips.length} moment${project.clips.length === 1 ? "" : "s"} that scored ${threshold} or higher.`,
    chapters: [],
    highlights,
    script: "",
    social: { youtubeTitle: highlights[0]?.title ?? "", youtubeDescription: "", tiktokCaption: highlights[0]?.description ?? "", linkedinPost: "", tweet: "" },
    source: job.openrouterKey ? "ai" : "heuristic",
    model: job.openrouterKey ? job.writingModel : void 0
  };
  await node_fs.promises.writeFile(path.join(job.outputDir, "project.json"), JSON.stringify(project, null, 2));
  recordingGone = true;
  await node_fs.promises.rm(recDir, { recursive: true, force: true });
  await node_fs.promises.rm(workDir, { recursive: true, force: true });
  status("ended", { message: `Done. ${project.clips.length} clip${project.clips.length === 1 ? "" : "s"}.` });
  return project;
  async function cutWaiting() {
    while (waiting.length && !signal.aborted) {
      const w = waiting.shift();
      try {
        await cutClip(w.start, w.end, w.score, w.reason, w.text);
      } catch (err) {
        if (signal.aborted) return;
        log(`Could not cut that clip: ${err.message}`, "warn");
      }
    }
  }
  async function gamingCandidate(settled) {
    const sentences = buildSentences(settled);
    const marks = gamingAudio.marks(sentences, settled, transcribedTo);
    const chatAfter = (end) => chat2?.reactionTo(end) ?? 0;
    const lengths = { minSeconds: options.minClipSeconds, maxSeconds: options.maxClipSeconds };
    const fromWords = bestWindow(settled, {
      ...lengths,
      bonus: (start, end) => liveGamingBonus(marks, sentences, start, end, { chat: chatAfter(end) })
    });
    const events = gamingAudio.events(sentences, marks, cutFrom, transcribedTo);
    for (const b of chat2?.bursts(cutFrom + CHAT_LAG, transcribedTo + CHAT_LAG) ?? []) events.push({ t: b.t - CHAT_LAG, kind: "chat", strength: b.strength });
    const fromSound = bestAudioWindow({
      events,
      words: settled,
      sentences,
      from: cutFrom,
      to: transcribedTo,
      ...lengths,
      extras: (_start, end) => ({ chat: chatAfter(end) })
    });
    let best = !fromSound || fromWords && fromWords.score >= fromSound.score ? fromWords : fromSound;
    if (best && canHearLaughs && best.score < threshold && best.score >= threshold - 8) {
      const key2 = best.end.toFixed(1);
      if (!laughHeard.has(key2)) laughHeard.set(key2, await laughAfter2(best.end));
      const laugh = laughHeard.get(key2);
      if (laugh > 0.2) best = { ...best, score: Math.min(100, best.score + Math.round(laugh * 8)), reason: `${best.reason}, laughter after it` };
    }
    return best;
  }
  async function laughAfter2(t) {
    const { samples, offset } = gamingAudio.recentSound();
    if (t - 0.4 < offset || t + 2.6 > offset + samples.length / SAMPLE_RATE) return 0;
    try {
      const evs = await laughWindows({ modelsDir: job.modelsDir, samples, offset, lineEnds: [t], onProgress: () => void 0, signal });
      return Math.max(0, ...evs.map((e) => Math.max(level(e.laugh), level(e.crowd) * 0.9)));
    } catch {
      return 0;
    }
  }
  async function cutClip(start, end, score, reason, text) {
    const from = Math.max(0, start - CLIP_PAD);
    const to = end + CLIP_PAD;
    const needed = videoSegments.filter((s) => s.start < to && s.start + s.duration > from);
    if (needed.length === 0) throw new Error("the recording for that moment is already gone");
    const index = project.clips.length;
    const listFile = path.join(workDir, `win-${index}.txt`);
    const windowFile = path.join(workDir, `win-${index}.${videoExtension(container)}`);
    await node_fs.promises.writeFile(listFile, needed.map((s) => `file '${s.file.replace(/'/g, "'\\''")}'`).join("\n"));
    const concat2 = await local.run(bins.ffmpeg, ["-y", "-hide_banner", "-nostdin", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", windowFile], { signal });
    if (concat2.code !== 0) throw new Error(`concat failed: ${local.lastLines(concat2.stderr, 2)}`);
    const base = needed[0].start;
    const localWords = words2.filter((w) => w.end > from && w.start < to).map((w) => ({ text: w.text, start: w.start - base, end: w.end - base }));
    const copy = job.openrouterKey && text.trim().split(/\s+/).length >= 4 ? await writeClipCopy({
      apiKey: job.openrouterKey,
      model: job.writingModel,
      text,
      audience: options.audience,
      instructions: buildBrief(options).text,
      log: (m) => log(m, "warn"),
      signal
    }) : null;
    const fallbackTitle = titleFromText(text, index);
    const highlight = {
      id: `h${index + 1}`,
      start: from - base,
      end: to - base,
      title: copy?.title || fallbackTitle,
      hook: copy?.hook || text.split(/\s+/).slice(0, 7).join(" "),
      description: copy?.description || text.slice(0, 220),
      hashtags: copy?.hashtags ?? [],
      reason,
      score
    };
    const windowInfo = await local.probe(bins, windowFile);
    let settings = clipSettingsFrom(options);
    if (gaming) {
      settings = { ...settings, layout: "stack", stack };
      if (!settings.captionPos) {
        const { w, h } = targetSize(settings.aspect, settings.resolution);
        const seam = seamShare(stackPlan(windowInfo.width, windowInfo.height, w, h, stack), h);
        if (seam > 0) settings = { ...settings, captionPos: seamCaptionPos(seam) };
      }
    }
    const clip = await renderClip({
      bins,
      input: windowFile,
      highlight,
      index,
      words: localWords,
      settings,
      outDir: job.outputDir,
      encoderArgs: encoder.videoArgs,
      onEncoderFallback: (next) => {
        encoder = next;
        emit({ type: "encoder", projectId, encoder: next });
      },
      sourceWidth: windowInfo.width,
      sourceHeight: windowInfo.height,
      hasAudio: windowInfo.hasAudio,
      fontsDir: job.fontsDir,
      ...job.clipsDir ? await newClipTarget(job.clipsDir, job.project.name, index, highlight.title) : {},
      onProgress: (p) => emit({ type: "clip-progress", projectId, highlightId: highlight.id, percent: p, message: `Rendering clip ${index + 1}… ${Math.round(p)}%` }),
      log: (m) => log(m),
      signal
    });
    highlights.push({ ...highlight, start, end });
    project.clips = [...project.clips, clip];
    project.updatedAt = Date.now();
    project.analysis = {
      summary: "",
      chapters: [],
      highlights,
      script: "",
      social: { youtubeTitle: "", youtubeDescription: "", tiktokCaption: "", linkedinPost: "", tweet: "" },
      source: job.openrouterKey ? "ai" : "heuristic"
    };
    await node_fs.promises.writeFile(path.join(job.outputDir, "project.json"), JSON.stringify(project, null, 2));
    await node_fs.promises.rm(listFile, { force: true });
    await node_fs.promises.rm(windowFile, { force: true });
    log(`Clip ${index + 1}: ${fmt(start)}–${fmt(end)} scored ${score} (${reason})`);
    emit({ type: "clip-rendered", projectId, highlightId: highlight.id, project: { ...project } });
  }
  async function pruneOldSegments() {
    const waitingFrom = waiting.length ? Math.min(...waiting.map((w) => w.start)) : Infinity;
    const keepFrom = Math.min(videoEnd - retentionSeconds, cutFrom - CLIP_PAD - 1, waitingFrom - CLIP_PAD - 1);
    gamingAudio?.prune(Math.min(cutFrom, waitingFrom));
    if (keepFrom <= 0) return;
    while (videoSegments.length > 1 && videoSegments[0].start + videoSegments[0].duration < keepFrom) {
      const gone = videoSegments.shift();
      await node_fs.promises.rm(gone.file, { force: true }).catch(() => void 0);
    }
  }
}
function concat(a, b) {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
function sleep(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
function fmt(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function titleFromText(text, index) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    const cleaned = sentence.replace(/^[^A-Za-z]+/, "").replace(/\s+/g, " ").trim();
    if (cleaned.split(" ").length < 4) continue;
    const short = cleaned.length > 60 ? cleaned.slice(0, 59).replace(/\s+\S*$/, "") + "…" : cleaned;
    return short.charAt(0).toUpperCase() + short.slice(1);
  }
  return `Live clip ${index + 1}`;
}
worker.setSpeechWorkerEntry(path.join(__dirname, "speech.js"));
function getPort() {
  const p = process.parentPort;
  return p ?? null;
}
const port = getPort();
if (port) {
  const controller = new AbortController();
  let videoArrived;
  let videoFailed;
  const videoReady = new Promise((resolve, reject) => {
    videoArrived = resolve;
    videoFailed = reject;
  });
  videoReady.catch(() => void 0);
  port.on("message", (e) => {
    const msg = e.data;
    if (msg.type === "cancel") {
      controller.abort();
      return;
    }
    if (msg.type === "video-ready") return void videoArrived(msg.inputPath);
    if (msg.type === "video-failed") return void videoFailed(new Error(msg.error));
    if (msg.type === "run" || msg.type === "live") {
      setLlmEndpoint(msg.llm, msg.llmFallbacks);
      onLlmSwitch((message) => port.postMessage({ type: "log", projectId: msg.projectId, level: "warn", message }));
    }
    if (msg.type === "download-laughter") {
      const m = msg;
      downloadLaughterModel(m.modelsDir, (percent) => port.postMessage({ type: "laughter-progress", percent })).then(() => port.postMessage({ type: "laughter-done" })).catch((err) => port.postMessage({ type: "laughter-failed", error: err.message || String(err) })).finally(() => setTimeout(() => process.exit(0), 50));
      return;
    }
    if (msg.type === "download-model") {
      const emit = (ev) => port.postMessage(ev);
      local.downloadWhisperModel({
        modelsDir: msg.modelsDir,
        model: msg.model,
        log: (message) => emit({ type: "model-log", model: msg.model, message }),
        onProgress: (percent, message) => emit({ type: "model-progress", model: msg.model, percent, message })
      }).then(() => emit({ type: "model-done", model: msg.model })).catch((err) => emit({ type: "model-failed", model: msg.model, error: err.message || String(err) })).finally(() => setTimeout(() => process.exit(0), 50));
      return;
    }
    if (msg.type === "speed-test") {
      const emit = (ev) => port.postMessage(ev);
      local.probeAcceleration({
        modelsDir: msg.modelsDir,
        model: msg.model,
        log: (message) => emit({ type: "speed-progress", message }),
        onProgress: (percent, message) => emit({ type: "speed-progress", percent, message })
      }).then((result) => emit({ type: "speed-done", result })).catch((err) => emit({ type: "speed-failed", error: err.message || String(err) })).finally(() => setTimeout(() => process.exit(0), 50));
      return;
    }
    if (msg.type === "live") {
      const emit = (ev) => port.postMessage(ev);
      runLiveSession(msg, emit, controller.signal).then((project) => emit({ type: "done", projectId: msg.projectId, project })).catch((err) => emit({
        type: "failed",
        projectId: msg.projectId,
        error: controller.signal.aborted ? "Cancelled" : err.message || String(err)
      })).finally(() => setTimeout(() => process.exit(0), 50));
      return;
    }
    if (msg.type === "render-clip") {
      const emit = (ev) => port.postMessage(ev);
      runClipRender(msg, emit, controller.signal).then((project) => emit({ type: "clip-rendered", projectId: msg.projectId, highlightId: msg.highlightId, project })).catch((err) => emit({
        type: "clip-failed",
        projectId: msg.projectId,
        highlightId: msg.highlightId,
        error: controller.signal.aborted ? "Cancelled" : err.message || String(err)
      })).finally(() => setTimeout(() => process.exit(0), 50));
      return;
    }
    if (msg.type === "run") {
      const emit = (ev) => port.postMessage(ev);
      runPipeline(msg, emit, controller.signal, msg.videoPending ? { videoReady } : {}).then((project) => emit({ type: "done", projectId: msg.projectId, project })).catch((err) => {
        emit({ type: "failed", projectId: msg.projectId, error: controller.signal.aborted ? "Cancelled" : err.message || String(err) });
      }).finally(() => setTimeout(() => process.exit(0), 50));
    }
  });
  port.start?.();
}
exports.CAPTION_FONT_FILES = local.CAPTION_FONT_FILES;
exports.CAPTION_GROUPS = local.CAPTION_GROUPS;
exports.CAPTION_PRESETS = local.CAPTION_PRESETS;
exports.WHISPER_DTYPES = local.WHISPER_DTYPES;
exports.WHISPER_MODEL_IDS = local.WHISPER_MODEL_IDS;
exports.WHISPER_MODEL_INFO = local.WHISPER_MODEL_INFO;
exports.WHISPER_MODEL_SIZES = local.WHISPER_MODEL_SIZES;
exports.alignToAudio = local.alignToAudio;
exports.alignWords = local.alignWords;
exports.applyCase = local.applyCase;
exports.buildSegments = local.buildSegments;
exports.collapseRuns = local.collapseRuns;
exports.downloadWhisperModel = local.downloadWhisperModel;
exports.dropAnnotations = local.dropAnnotations;
exports.dropPileUps = local.dropPileUps;
exports.escapeFilterPath = local.escapeFilterPath;
exports.extractAudio = local.extractAudio;
exports.findPreset = local.findPreset;
exports.isAnnotation = local.isAnnotation;
exports.looksLooped = local.looksLooped;
exports.loopedSpans = local.loopedSpans;
exports.loudnessFrames = local.loudnessFrames;
exports.measureLag = local.measureLag;
exports.parseProgress = local.parseProgress;
exports.platformAccelerator = local.platformAccelerator;
exports.probeAcceleration = local.probeAcceleration;
exports.readPcmF32 = local.readPcmF32;
exports.sizedEncoderArgs = local.sizedEncoderArgs;
exports.spliceWords = local.spliceWords;
exports.tidy = local.tidy;
exports.transcribeLocal = local.transcribeLocal;
exports.voiceRuns = local.voiceRuns;
exports.whisperWeightFiles = local.whisperWeightFiles;
exports.ERROR_MESSAGES = hardware.MESSAGES;
exports.IMPORT_MESSAGES = hardware.IMPORT_MESSAGES;
exports.LLM_PROVIDERS = hardware.LLM_PROVIDERS;
exports.MAC_SWAP_SCRIPT = hardware.MAC_SWAP_SCRIPT;
exports.OFFLINE = hardware.OFFLINE;
exports.PAYMENTS = hardware.PAYMENTS;
exports.ROBOT_MESSAGE = hardware.ROBOT_MESSAGE;
exports.ROBOT_TAIL = hardware.ROBOT_TAIL;
exports.UPDATE_MESSAGES = hardware.UPDATE_MESSAGES;
exports.attemptArgs = hardware.attemptArgs;
exports.attemptChain = hardware.attemptChain;
exports.availableMethods = hardware.availableMethods;
exports.captionTracksFrom = hardware.captionTracksFrom;
exports.chooseCaptions = hardware.chooseCaptions;
exports.classifyYtDlp = hardware.classifyYtDlp;
exports.cleanFolderName = hardware.cleanFolderName;
exports.cookieTrouble = hardware.cookieTrouble;
exports.coverageWarning = hardware.coverageWarning;
exports.createFolder = hardware.createFolder;
exports.cuesToWords = hardware.cuesToWords;
exports.deleteFolder = hardware.deleteFolder;
exports.describeDownload = hardware.describeDownload;
exports.detectFormat = hardware.detectFormat;
exports.eventThrottle = hardware.eventThrottle;
exports.folderCounts = hardware.folderCounts;
exports.folderOf = hardware.folderOf;
exports.forgetProjects = hardware.forgetProjects;
exports.friendlyError = hardware.friendlyError;
exports.inFolder = hardware.inFolder;
exports.isFreeTextModel = hardware.isFreeTextModel;
exports.isNetworkTrouble = hardware.isNetworkTrouble;
exports.isNewerVersion = hardware.isNewerVersion;
exports.latestDownloadUrl = hardware.latestDownloadUrl;
exports.looksLikeUrl = hardware.looksLikeUrl;
exports.macZipFor = hardware.macZipFor;
exports.manualDownloadName = hardware.manualDownloadName;
exports.moveToFolder = hardware.moveToFolder;
exports.normalizeBaseUrl = hardware.normalizeBaseUrl;
exports.normalizeFolders = hardware.normalizeFolders;
exports.packPrice = hardware.packPrice;
exports.parseClock = hardware.parseClock;
exports.parseDownloadLine = hardware.parseDownloadLine;
exports.parseJson3 = hardware.parseJson3;
exports.parseSrt = hardware.parseSrt;
exports.parseSrv3 = hardware.parseSrv3;
exports.parseTimedText = hardware.parseTimedText;
exports.parseTranscript = hardware.parseTranscript;
exports.parseVtt = hardware.parseVtt;
exports.parseYouTubeId = hardware.parseYouTubeId;
exports.plainCoverageWarning = hardware.plainCoverageWarning;
exports.planMusic = hardware.planMusic;
exports.quickListenFits = hardware.quickListenFits;
exports.rankFreeModels = hardware.rankFreeModels;
exports.recommendModel = hardware.recommendModel;
exports.renameFolder = hardware.renameFolder;
exports.robotCheck = hardware.robotCheck;
exports.spreadCue = hardware.spreadCue;
exports.updateErrorMessage = hardware.updateErrorMessage;
exports.wantsFreshYtDlp = hardware.wantsFreshYtDlp;
exports.AUDIO_BASE = AUDIO_BASE;
exports.Budget = Budget;
exports.CAM_MIN_SCORE = MIN_SCORE;
exports.CamEvidence = CamEvidence;
exports.CamTracker = CamTracker;
exports.ChatBursts = ChatBursts;
exports.CloudSpeechError = CloudSpeechError;
exports.DROP_AFTER = DROP_AFTER;
exports.FUNNY_REQUEST_CAP = FUNNY_REQUEST_CAP;
exports.LiveGamingAudio = LiveGamingAudio;
exports.MAX_BRIEF_CHARS = MAX_BRIEF_CHARS;
exports.NO_CAM_NOTE = NO_CAM_NOTE;
exports.OpenRouterError = OpenRouterError;
exports.REQUEST_CAP = REQUEST_CAP;
exports.SAME_BOX_IOU = SAME_BOX_IOU;
exports.SWITCH_SCORE = SWITCH_SCORE;
exports.agenticAnalysis = agenticAnalysis;
exports.agenticAnalysisStaged = agenticAnalysisStaged;
exports.alignTextToHeard = alignTextToHeard;
exports.analysisKey = analysisKey;
exports.analysisWorthKeeping = analysisWorthKeeping;
exports.applyFunnyVerdict = applyFunnyVerdict;
exports.applyVerdict = applyVerdict;
exports.ask = ask;
exports.askPool = pool;
exports.bestAudioWindow = bestAudioWindow;
exports.bestWindow = bestWindow;
exports.boxIou = boxIou;
exports.boxToShare = boxToShare;
exports.briefFor = briefFor;
exports.briefWindows = briefWindows;
exports.buildAss = buildAss;
exports.buildBrief = buildBrief;
exports.buildImportedTranscript = buildImportedTranscript;
exports.buildSentences = buildSentences;
exports.buildSrt = buildSrt;
exports.buildVideoFilter = buildVideoFilter;
exports.camBandHeight = camBandHeight;
exports.camPeaks = peaks;
exports.candidateModels = candidateModels;
exports.candidates = candidates;
exports.chat = chat;
exports.chatBody = chatBody;
exports.chatPlatform = chatPlatform;
exports.checkCandidates = checkCandidates;
exports.chooseClips = chooseClips;
exports.chunkSentences = chunkSentences;
exports.clipFileName = clipFileName;
exports.clipSettingsFrom = clipSettingsFrom;
exports.clipUnits = clipUnits;
exports.clock = clock;
exports.cloudService = cloudService;
exports.compareUser = compareUser;
exports.computeKeepIntervals = computeKeepIntervals;
exports.cropRect = cropRect;
exports.cropStyle = cropStyle;
exports.cutFilters = cutFilters;
exports.detectFacecam = detectFacecam;
exports.detectFaces = detectFaces;
exports.detectWindows = detectWindows;
exports.detectionModel = detectionModel;
exports.encodePiece = encodePiece;
exports.endFlaw = endFlaw;
exports.extractJson = extractJson;
exports.fitFunny = fitFunny;
exports.fixEdges = fixEdges;
exports.frameDb = frameDb;
exports.funnyCandidates = funnyCandidates;
exports.funnyColdReadUser = funnyColdReadUser;
exports.funnyCompareUser = funnyCompareUser;
exports.funnyHighlights = funnyHighlights;
exports.gameArea = gameArea;
exports.gamingBonus = gamingBonus;
exports.gamingMarks = gamingMarks;
exports.gamingOptions = gamingOptions;
exports.gamingProposeSystem = gamingProposeSystem;
exports.gamingStack = gamingStack;
exports.goodEnough = goodEnough;
exports.grayOf = grayOf;
exports.groupBeats = groupBeats;
exports.groupWords = groupWords;
exports.hasDevanagari = hasDevanagari;
exports.heuristicAnalysis = heuristicAnalysis;
exports.hinglish = hinglish;
exports.hinglishByRules = hinglishByRules;
exports.hinglishWord = hinglishWord;
exports.idsToTimes = idsToTimes;
exports.isBoundary = isBoundary;
exports.isCentred = isCentred;
exports.isFunnyHardFlaw = isFunnyHardFlaw;
exports.isGamingJob = isGamingJob;
exports.isHype = isHype;
exports.keyRanOut = keyRanOut;
exports.landsOnSentences = landsOnSentences;
exports.languageCode = languageCode;
exports.laughEvents = laughEvents;
exports.laughLevel = level;
exports.laughingAt = laughingAt;
exports.laughterBeats = laughterBeats;
exports.linesOf = linesOf;
exports.liveGamingBonus = liveGamingBonus;
exports.loadMemeLibrary = loadMemeLibrary;
exports.logoBox = logoBox;
exports.logoFilters = logoFilters;
exports.markLines = markLines;
exports.marksFor = marksFor;
exports.matchWords = matchWords;
exports.mergeChunkWords = mergeChunkWords;
exports.mixMemes = mixMemes;
exports.mixMusic = mixMusic;
exports.musicFilter = musicFilter;
exports.newClipTarget = newClipTarget;
exports.newTextOverlay = newTextOverlay;
exports.normToken = normToken;
exports.normWord = normWord;
exports.normalizeHighlights = normalizeHighlights;
exports.onLlmSwitch = onLlmSwitch;
exports.openRouterChat = openRouterChat;
exports.openerFlaw = openerFlaw;
exports.openrouterAnalysis = openrouterAnalysis;
exports.paceEta = paceEta;
exports.padHighlights = padHighlights;
exports.parseBeats = parseBeats;
exports.parseColdRead = parseColdRead;
exports.parseCompare = parseCompare;
exports.parseId = parseId;
exports.parseMemeAnswer = parseMemeAnswer;
exports.parseProposals = parseProposals;
exports.parseSummary = parseSummary;
exports.pickSpeechModel = pickSpeechModel;
exports.pitchAt = pitchAt;
exports.place = place;
exports.placeBeat = placeBeat;
exports.planChunks = planChunks;
exports.planChunksFromLoudness = planChunksFromLoudness;
exports.planShots = planShots;
exports.projectClipsDir = projectClipsDir;
exports.quickModel = quickModel;
exports.reactionAt = reactionAt;
exports.readSeconds = readSeconds;
exports.readStage = readStage;
exports.readWavMono16 = readWavMono16;
exports.reelHighlight = reelHighlight;
exports.remapTime = remapTime;
exports.renderClip = renderClip;
exports.renderSlots = renderSlots;
exports.requoteSingles = requoteSingles;
exports.resolveLogo = resolveLogo;
exports.resolveRange = resolveRange;
exports.resolveTextOverlays = resolveTextOverlays;
exports.resolveTopText = resolveTopText;
exports.retryAfterMs = retryAfterMs;
exports.rulesProposals = rulesProposals;
exports.runAgentic = runAgentic;
exports.runClipRender = runClipRender;
exports.runFunnyAgentic = runFunnyAgentic;
exports.runLiveSession = runLiveSession;
exports.runPipeline = runPipeline;
exports.sameKey = sameKey;
exports.samePickForEveryLanguage = samePickForEveryLanguage;
exports.sampleFaces = sampleFaces;
exports.scoreAudioWindow = scoreAudioWindow;
exports.scoreSpan = scoreSpan;
exports.scoreWindow = scoreWindow;
exports.seamCaptionPos = seamCaptionPos;
exports.seamShare = seamShare;
exports.seekPoint = seekPoint;
exports.sentenceSignals = sentenceSignals;
exports.setLlmEndpoint = setLlmEndpoint;
exports.settleCrop = settleCrop;
exports.shiftTranscript = shiftTranscript;
exports.shortenHook = shortenHook;
exports.sid = sid;
exports.signalBonus = signalBonus;
exports.snapToFrames = snapToFrames;
exports.snapToSentences = snapToSentences;
exports.speakingFrom = speakingFrom;
exports.stackFilter = stackFilter;
exports.stackFromDetection = stackFromDetection;
exports.stackPlan = stackPlan;
exports.startChat = startChat;
exports.swissPairs = swissPairs;
exports.swissRank = swissRank;
exports.targetSize = targetSize;
exports.textCardKey = textCardKey;
exports.textOverlayFilters = textOverlayFilters;
exports.titleFromText = titleFromText;
exports.toHighlights = toHighlights;
exports.topTextTouched = topTextTouched;
exports.topUpHighlights = topUpHighlights;
exports.transcribeCloud = transcribeCloud;
exports.transcribeEtaTracker = transcribeEtaTracker;
exports.transcriptInWindows = transcriptInWindows;
exports.transcriptKey = transcriptKey;
exports.trimBorder = trimBorder;
exports.voicedCueWords = voicedCueWords;
exports.withBrief = withBrief;
exports.wordsFromVerbose = wordsFromVerbose;
exports.wordsWithin = wordsWithin;
exports.writeClipCopy = writeClipCopy;
exports.writeStageKey = writeStageKey;
