"use strict";
const path = require("node:path");
const os = require("node:os");
const node_fs = require("node:fs");
const node_child_process = require("node:child_process");
const SANS = '"Helvetica Neue", Arial, sans-serif';
const f = (name) => `"${name}", ${SANS}`;
const CAPTION_PRESETS = [
  /* ---------------- Big effects ---------------- */
  {
    id: "pro-beast",
    name: "Beast Mode",
    group: "Big effects",
    blurb: "Every word lights up in its own colour and stays that way, on a chunky 3D base",
    fontFamily: "Luckiest Guy",
    cssStack: f("Luckiest Guy"),
    bold: false,
    size: 0.085,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "pop-up", enterMs: 220, accent: "punch", accentMs: 170 },
    text: "#FFFFFF",
    active: "#22E55B",
    outline: 6e-3,
    outlineColor: "#000000",
    bottom: 0.23,
    fx: {
      cycle: ["#22E55B", "#FFE500", "#FF3B6B", "#26C6FF"],
      under: [
        { outline: 6e-3, color: "#000000", dx: 6e-3, dy: 8e-3 },
        { outline: 6e-3, color: "#000000", dx: 3e-3, dy: 4e-3 }
      ]
    }
  },
  {
    id: "pro-sticker",
    name: "Sticker",
    group: "Big effects",
    blurb: "Die-cut sticker: a fat white border around bold black-edged words",
    fontFamily: "Titan One",
    cssStack: f("Titan One"),
    bold: false,
    size: 0.078,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "bounce-in", enterMs: 360, accent: "pop", accentMs: 150 },
    text: "#FFFFFF",
    active: "#FFD60A",
    outline: 45e-4,
    outlineColor: "#111111",
    bottom: 0.22,
    fx: { under: [{ outline: 0.016, color: "#000000", dx: 2e-3, dy: 4e-3, alpha: 0.35 }, { outline: 0.014, color: "#FFFFFF" }] }
  },
  {
    id: "pro-neon",
    name: "Neon Night",
    group: "Big effects",
    blurb: "Real glow: the words burn in hot pink over a soft light that bleeds into the frame",
    fontFamily: "Righteous",
    cssStack: f("Righteous"),
    bold: false,
    size: 0.074,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "fade", enterMs: 260, accent: "neon", accentMs: 260 },
    text: "#FFFFFF",
    active: "#FF3DDB",
    outline: 3e-3,
    outlineColor: "#FF3DDB",
    bottom: 0.22,
    fx: { under: [{ outline: 0.012, color: "#FF3DDB", blur: 0.02, alpha: 0.75 }, { outline: 6e-3, color: "#7A2CFF", blur: 8e-3 }] }
  },
  {
    id: "pro-gold",
    name: "Gold Luxe",
    group: "Big effects",
    blurb: "Solid gold slab letters with a deep engraved edge and a warm glow",
    fontFamily: "Alfa Slab One",
    cssStack: f("Alfa Slab One"),
    bold: false,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "rise", enterMs: 320, accent: "swell", accentMs: 220 },
    text: "#F6D27A",
    active: "#FFFFFF",
    outline: 4e-3,
    outlineColor: "#3B2400",
    bottom: 0.22,
    fx: {
      under: [
        { outline: 0.012, color: "#FFB300", blur: 0.018, alpha: 0.45 },
        { outline: 4e-3, color: "#2A1800", dx: 4e-3, dy: 6e-3 },
        { outline: 4e-3, color: "#5A3A00", dx: 2e-3, dy: 3e-3 }
      ]
    }
  },
  {
    id: "pro-hype",
    name: "Hype Keywords",
    group: "Big effects",
    blurb: "Clean and fast, but the word that matters in every line jumps out big and yellow",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "zoom", enterMs: 180, accent: "pop", accentMs: 140 },
    text: "#FFFFFF",
    active: "#39FF88",
    outline: 5e-3,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22,
    fx: { emphasis: { color: "#FFE500", scale: 1.35 } }
  },
  {
    id: "pro-candy",
    name: "Candy Pop",
    group: "Big effects",
    blurb: "Rounded, bouncy, and every word a different sweet: pure feel-good",
    fontFamily: "Fredoka SemiBold",
    cssStack: f("Fredoka SemiBold"),
    bold: true,
    size: 0.078,
    textCase: "lower",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "elastic", enterMs: 420, accent: "heartbeat", accentMs: 260 },
    text: "#FFFFFF",
    active: "#FF7AB6",
    outline: 45e-4,
    outlineColor: "#5B1A7A",
    bottom: 0.22,
    fx: {
      cycle: ["#FF7AB6", "#7AD7FF", "#FFD36E", "#9DFF8A", "#C79BFF"],
      under: [{ outline: 0.012, color: "#FFFFFF" }]
    }
  },
  {
    id: "pro-fire",
    name: "On Fire",
    group: "Big effects",
    blurb: "Burning orange letters shaking with heat, a red glow licking up behind them",
    fontFamily: "Anton",
    cssStack: f("Anton"),
    bold: false,
    size: 0.084,
    textCase: "upper",
    tracking: 2e-3,
    maxWords: 3,
    reveal: "line",
    motion: { enter: "slam", enterMs: 260, accent: "shake", accentMs: 220 },
    text: "#FFE08A",
    active: "#FF7A00",
    outline: 4e-3,
    outlineColor: "#3A0000",
    bottom: 0.22,
    fx: { under: [{ outline: 0.014, color: "#FF2A00", blur: 0.024, alpha: 0.8 }, { outline: 7e-3, color: "#FF8A00", blur: 0.01, alpha: 0.9 }] }
  },
  {
    id: "pro-ice",
    name: "Ice 3D",
    group: "Big effects",
    blurb: "Frosty block letters extruded deep into the screen",
    fontFamily: "Archivo Black",
    cssStack: f("Archivo Black"),
    bold: false,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "drop", enterMs: 300, accent: "pop", accentMs: 150 },
    text: "#E8F7FF",
    active: "#6FE3FF",
    outline: 35e-4,
    outlineColor: "#0B2A4A",
    bottom: 0.22,
    fx: {
      under: [
        { outline: 35e-4, color: "#06182C", dx: 75e-4, dy: 75e-4 },
        { outline: 35e-4, color: "#0B2A4A", dx: 5e-3, dy: 5e-3 },
        { outline: 35e-4, color: "#12406B", dx: 25e-4, dy: 25e-4 }
      ]
    }
  },
  {
    id: "pro-comic",
    name: "Comic Boom",
    group: "Big effects",
    blurb: "Comic-book lettering with a double red and black outline that rocks on every word",
    fontFamily: "Bangers",
    cssStack: f("Bangers"),
    bold: false,
    size: 0.09,
    textCase: "upper",
    tracking: 2e-3,
    maxWords: 3,
    reveal: "line",
    motion: { enter: "slam", enterMs: 280, accent: "rock", accentMs: 220 },
    text: "#FFE500",
    active: "#FFFFFF",
    outline: 5e-3,
    outlineColor: "#000000",
    bottom: 0.22,
    fx: { under: [{ outline: 0.014, color: "#000000", dx: 4e-3, dy: 5e-3 }, { outline: 0.011, color: "#E4002B" }], emphasis: { color: "#FFFFFF", scale: 1.25 } }
  },
  {
    id: "pro-soft-glow",
    name: "Soft Glow",
    group: "Big effects",
    blurb: "Calm, lowercase and expensive: a quiet white halo, the live word in warm cream",
    fontFamily: "Plus Jakarta Sans ExtraBold",
    cssStack: f("Plus Jakarta Sans ExtraBold"),
    bold: true,
    size: 0.062,
    textCase: "lower",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "fade", enterMs: 320, accent: "grow", accentMs: 240 },
    text: "#FFFFFF",
    active: "#FFE7B8",
    outline: 15e-4,
    outlineColor: "#000000",
    bottom: 0.2,
    fx: { under: [{ outline: 6e-3, color: "#FFFFFF", blur: 0.016, alpha: 0.45 }] }
  },
  /* ---------------- Punch & pop ---------------- */
  {
    id: "hormozi-yellow",
    name: "Hormozi Yellow",
    group: "Punch & pop",
    blurb: "The one everyone copies. Each word snaps up as it is said",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.075,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "pop", accentMs: 140 },
    text: "#FFFFFF",
    active: "#F7C204",
    outline: 55e-4,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "hormozi-green",
    name: "Hormozi Punch",
    group: "Punch & pop",
    blurb: "Harder hit: the word lands oversized and slams back to size",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.075,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "punch", accentMs: 170 },
    text: "#FFFFFF",
    active: "#02FB23",
    outline: 55e-4,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "hormozi-red",
    name: "Red Alert",
    group: "Punch & pop",
    blurb: "Whole line zooms in, then every word flashes its outline",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.075,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "zoom", enterMs: 200, accent: "flash", accentMs: 130 },
    text: "#FFFFFF",
    active: "#FF2D2D",
    outline: 55e-4,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "anton-punch",
    name: "Anton Squash",
    group: "Punch & pop",
    blurb: "Tall condensed caps that squash wide, then spring back",
    fontFamily: "Anton",
    cssStack: f("Anton"),
    bold: false,
    size: 0.082,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "squash", accentMs: 160 },
    text: "#FFFFFF",
    active: "#FFE500",
    outline: 5e-3,
    outlineColor: "#000000",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  {
    id: "kanit-power",
    name: "Kanit Power",
    group: "Punch & pop",
    blurb: "Line grows in from small, each word gives a firm pop",
    fontFamily: "Kanit ExtraBold",
    cssStack: f("Kanit ExtraBold"),
    bold: true,
    size: 0.074,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "shrink", enterMs: 200, accent: "pop", accentMs: 140 },
    text: "#FFFFFF",
    active: "#FF8A00",
    outline: 5e-3,
    outlineColor: "#140A05",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "meme-classic",
    name: "Meme Classic",
    group: "Punch & pop",
    blurb: "Heavy white caps with a thick rim and a plain scale hit",
    fontFamily: "Archivo Black",
    cssStack: f("Archivo Black"),
    bold: false,
    size: 0.07,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "none", accent: "pop", accentMs: 120 },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 65e-4,
    outlineColor: "#000000",
    shadow: 25e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  /* ---------------- Bounce & spring ---------------- */
  {
    id: "bounce-classic",
    name: "Bounce",
    group: "Bounce & spring",
    blurb: "Words spring up past their size and settle, the classic bounce",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "bounce", accentMs: 260 },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 5e-3,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "jelly",
    name: "Jelly",
    group: "Bounce & spring",
    blurb: "Rounded letters that wobble wide and snap back like jelly",
    fontFamily: "Baloo 2 ExtraBold",
    cssStack: f("Baloo 2 ExtraBold"),
    bold: true,
    size: 0.076,
    textCase: "keep",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "shrink", enterMs: 220, accent: "squash", accentMs: 220 },
    text: "#FFFFFF",
    active: "#FF5FA2",
    outline: 55e-4,
    outlineColor: "#3B1152",
    shadow: 2e-3,
    shadowColor: "#20062E",
    bottom: 0.22
  },
  {
    id: "spring-up",
    name: "Spring Up",
    group: "Bounce & spring",
    blurb: "The line springs up from below and every word bounces",
    fontFamily: "Figtree Black",
    cssStack: f("Figtree Black"),
    bold: true,
    size: 0.068,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "rise", enterMs: 260, accent: "bounce", accentMs: 240 },
    text: "#FFFFFF",
    active: "#00E5A0",
    outline: 4e-3,
    outlineColor: "#06231C",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  {
    id: "beast-mode",
    name: "Beast Mode",
    group: "Bounce & spring",
    blurb: "Chunky cartoon caps with a big springy bounce on every word",
    fontFamily: "Luckiest Guy",
    cssStack: f("Luckiest Guy"),
    bold: false,
    size: 0.078,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "bounce", accentMs: 280 },
    text: "#FFFFFF",
    active: "#FFE500",
    outline: 65e-4,
    outlineColor: "#000000",
    shadow: 3e-3,
    shadowColor: "#000000",
    bottom: 0.23
  },
  {
    id: "bubble-pop",
    name: "Bubble Pop",
    group: "Bounce & spring",
    blurb: "Friendly rounded text that zooms in and swells word by word",
    fontFamily: "Fredoka SemiBold",
    cssStack: f("Fredoka SemiBold"),
    bold: true,
    size: 0.072,
    textCase: "keep",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "zoom", enterMs: 220, accent: "swell", accentMs: 260 },
    text: "#FFFFFF",
    active: "#A66BFF",
    outline: 55e-4,
    outlineColor: "#2A0E45",
    shadow: 2e-3,
    shadowColor: "#1A0630",
    bottom: 0.22
  },
  /* ---------------- Slide & rise ---------------- */
  {
    id: "rise-clean",
    name: "Rise",
    group: "Slide & rise",
    blurb: "Each line lifts into place from below, calm and modern",
    fontFamily: "Inter ExtraBold",
    cssStack: f("Inter"),
    bold: true,
    size: 0.064,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "rise", enterMs: 240, accent: "pop", accentMs: 130 },
    text: "#FFFFFF",
    active: "#6CB8FF",
    outline: 3e-3,
    outlineColor: "#101010",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "drop-in",
    name: "Drop In",
    group: "Slide & rise",
    blurb: "Lines fall in from above and land with a small pop",
    fontFamily: "Outfit ExtraBold",
    cssStack: f("Outfit ExtraBold"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "drop", enterMs: 240, accent: "pop", accentMs: 140 },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 45e-4,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "slide-in",
    name: "Slide In",
    group: "Slide & rise",
    blurb: "Lines glide in from the left, no bouncing at all",
    fontFamily: "Plus Jakarta Sans ExtraBold",
    cssStack: f("Plus Jakarta Sans ExtraBold"),
    bold: true,
    size: 0.066,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "slide-left", enterMs: 260, accent: "none" },
    text: "#FFFFFF",
    active: "#FFB020",
    outline: 35e-4,
    outlineColor: "#12100A",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "slide-back",
    name: "Slide Back",
    group: "Slide & rise",
    blurb: "Mirror of Slide In: lines arrive from the right, techy and flat",
    fontFamily: "Sora",
    cssStack: f("Sora"),
    bold: true,
    size: 0.06,
    tracking: 1e-3,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "slide-right", enterMs: 260, accent: "glow", accentMs: 180 },
    text: "#FFFFFF",
    active: "#4CE0FF",
    outline: 3e-3,
    outlineColor: "#04121A",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "wipe-reveal",
    name: "Wipe",
    group: "Slide & rise",
    blurb: "The line is wiped on left to right, like a lower third",
    fontFamily: "Staatliches",
    cssStack: f("Staatliches"),
    bold: false,
    size: 0.078,
    tracking: 2e-3,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "wipe", enterMs: 320, accent: "none" },
    text: "#FFFFFF",
    active: "#FF4D6D",
    outline: 4e-3,
    outlineColor: "#000000",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "bebas-tall",
    name: "Bebas Spread",
    group: "Slide & rise",
    blurb: "Narrow caps that arrive spaced out and pull together",
    fontFamily: "Bebas Neue",
    cssStack: f("Bebas Neue"),
    bold: false,
    size: 0.088,
    tracking: 4e-3,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "spread", enterMs: 280, accent: "spread", accentMs: 180 },
    text: "#FFFFFF",
    active: "#FF4D6D",
    outline: 4e-3,
    outlineColor: "#000000",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  /* ---------------- Spin & flip ---------------- */
  {
    id: "flip-3d",
    name: "3D Flip",
    group: "Spin & flip",
    blurb: "Words turn in on their own axis like cards",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "flip", enterMs: 260, accent: "flip", accentMs: 200 },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 5e-3,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "spin-in",
    name: "Spin In",
    group: "Spin & flip",
    blurb: "The line spins into place, then words wiggle as they land",
    fontFamily: "Titan One",
    cssStack: f("Titan One"),
    bold: false,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "spin", enterMs: 320, accent: "wiggle", accentMs: 220 },
    text: "#FFFFFF",
    active: "#FF8A3D",
    outline: 6e-3,
    outlineColor: "#2A1000",
    shadow: 25e-4,
    shadowColor: "#1A0A00",
    bottom: 0.22
  },
  {
    id: "comic-boom",
    name: "Comic Boom",
    group: "Spin & flip",
    blurb: "Comic lettering that shakes on every word, like a sound effect",
    fontFamily: "Bangers",
    cssStack: f("Bangers"),
    bold: false,
    size: 0.085,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "shake", accentMs: 240 },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 6e-3,
    outlineColor: "#000000",
    shadow: 25e-4,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "wiggle-fun",
    name: "Wiggle",
    group: "Spin & flip",
    blurb: "Playful chunky caps where the spoken word rocks side to side",
    fontFamily: "Lilita One",
    cssStack: f("Lilita One"),
    bold: false,
    size: 0.08,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "wiggle", accentMs: 240 },
    text: "#FFFFFF",
    active: "#FF5FA2",
    outline: 55e-4,
    outlineColor: "#2B0A1C",
    shadow: 2e-3,
    shadowColor: "#1A0512",
    bottom: 0.22
  },
  {
    id: "tilt-slant",
    name: "Slant",
    group: "Spin & flip",
    blurb: "Everything leans in italic, the spoken word leans hardest",
    fontFamily: "Kanit ExtraBold",
    cssStack: f("Kanit ExtraBold"),
    bold: true,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "lean", enterMs: 240, accent: "lean", accentMs: 200 },
    text: "#FFFFFF",
    active: "#4CE0FF",
    outline: 5e-3,
    outlineColor: "#031218",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "retro-warm",
    name: "Retro Tilt",
    group: "Spin & flip",
    blurb: "Cream and burnt orange, with a small tilt as each word hits",
    fontFamily: "Oswald",
    cssStack: f("Oswald"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "none", accent: "tilt", accentMs: 180 },
    text: "#FFF3D6",
    active: "#FF8A3D",
    outline: 5e-3,
    outlineColor: "#2A1A0F",
    shadow: 2e-3,
    shadowColor: "#140A05",
    bottom: 0.21
  },
  /* ---------------- Soft & glow ---------------- */
  {
    id: "blur-in",
    name: "Focus",
    group: "Soft & glow",
    blurb: "Lines resolve out of a blur, words glow as they are spoken",
    fontFamily: "Inter ExtraBold",
    cssStack: f("Inter"),
    bold: true,
    size: 0.064,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "blur", enterMs: 300, accent: "glow", accentMs: 200 },
    text: "#FFFFFF",
    active: "#9BC7FF",
    outline: 25e-4,
    outlineColor: "#101010",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "neon-night",
    name: "Neon Night",
    group: "Soft & glow",
    blurb: "Cyan glow on a magenta accent, made for night footage",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "fade", enterMs: 200, accent: "glow", accentMs: 220 },
    text: "#FFFFFF",
    active: "#FF3CAC",
    outline: 5e-3,
    outlineColor: "#1B0033",
    shadow: 4e-3,
    shadowColor: "#00E5FF",
    bottom: 0.22
  },
  {
    id: "podcast-soft",
    name: "Podcast Soft",
    group: "Soft & glow",
    blurb: "Rounded heavy text that breathes gently on each word",
    fontFamily: "Nunito Black",
    cssStack: f("Nunito Black"),
    bold: true,
    size: 0.064,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "fade", enterMs: 220, accent: "swell", accentMs: 280 },
    text: "#FFFFFF",
    active: "#FFD166",
    outline: 4e-3,
    outlineColor: "#1A1A1A",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "mono-tech",
    name: "Tech Mono",
    group: "Soft & glow",
    blurb: "Wide-tracked caps with a mint accent, for product and code",
    fontFamily: "Space Grotesk",
    cssStack: f("Space Grotesk"),
    bold: true,
    size: 0.056,
    tracking: 3e-3,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "fade", enterMs: 180, accent: "spread", accentMs: 200 },
    text: "#FFFFFF",
    active: "#00E5A0",
    outline: 3e-3,
    outlineColor: "#04120E",
    shadow: 1e-3,
    shadowColor: "#000000",
    bottom: 0.2
  },
  /* ---------------- Karaoke & fill ---------------- */
  {
    id: "karaoke-fill",
    name: "Karaoke Fill",
    group: "Karaoke & fill",
    blurb: "Upcoming words sit faded and light up exactly on the beat",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.064,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "fade", enterMs: 160, accent: "none" },
    text: "#FFFFFF",
    active: "#6CB8FF",
    upcoming: "#FFFFFF",
    upcomingAlpha: 0.42,
    outline: 3e-3,
    outlineColor: "#101010",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "karaoke-gold",
    name: "Karaoke Gold",
    group: "Karaoke & fill",
    blurb: "Same fill in caps and gold, with a small lift on the word",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.068,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "none", accent: "pop", accentMs: 120 },
    text: "#FFFFFF",
    active: "#FFC300",
    upcoming: "#FFFFFF",
    upcomingAlpha: 0.38,
    outline: 45e-4,
    outlineColor: "#000000",
    bottom: 0.21
  },
  {
    id: "sticker-yellow",
    name: "Sticker Yellow",
    group: "Karaoke & fill",
    blurb: "The spoken word wears a fat yellow rim that snaps on",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "flash", accentMs: 140 },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 4e-3,
    outlineColor: "#000000",
    activeOutline: "#F7C204",
    activeOutlineScale: 2.6,
    bottom: 0.22
  },
  {
    id: "sticker-mint",
    name: "Sticker Mint",
    group: "Karaoke & fill",
    blurb: "Same sticker idea in mint, with a soft tilt as it lands",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "none", accent: "tilt", accentMs: 170 },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 35e-4,
    outlineColor: "#06231C",
    activeOutline: "#00E5A0",
    activeOutlineScale: 2.6,
    bottom: 0.22
  },
  /* ---------------- One word at a time ---------------- */
  {
    id: "word-punch",
    name: "Word Punch",
    group: "One word at a time",
    blurb: "One huge word at a time, thrown at the screen",
    fontFamily: "Anton",
    cssStack: f("Anton"),
    bold: false,
    size: 0.115,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "zoom", enterMs: 160, accent: "none" },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 6e-3,
    outlineColor: "#000000",
    shadow: 3e-3,
    shadowColor: "#000000",
    bottom: 0.3
  },
  {
    id: "word-drop",
    name: "Word Drop",
    group: "One word at a time",
    blurb: "Each word falls in from the top and stops dead",
    fontFamily: "Passion One",
    cssStack: f("Passion One"),
    bold: true,
    size: 0.11,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "drop", enterMs: 180, accent: "none" },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 55e-4,
    outlineColor: "#000000",
    shadow: 25e-4,
    shadowColor: "#000000",
    bottom: 0.3
  },
  {
    id: "word-rise",
    name: "Word Rise",
    group: "One word at a time",
    blurb: "Words push up from the bottom, one per beat",
    fontFamily: "Figtree Black",
    cssStack: f("Figtree Black"),
    bold: true,
    size: 0.095,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "rise", enterMs: 190, accent: "none" },
    text: "#FFFFFF",
    active: "#00E5A0",
    outline: 5e-3,
    outlineColor: "#06231C",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.28
  },
  {
    id: "word-spin",
    name: "Word Spin",
    group: "One word at a time",
    blurb: "Every word spins into frame, loud and playful",
    fontFamily: "Titan One",
    cssStack: f("Titan One"),
    bold: false,
    size: 0.092,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "spin", enterMs: 240, accent: "none" },
    text: "#FFFFFF",
    active: "#FF8A3D",
    outline: 6e-3,
    outlineColor: "#2A1000",
    shadow: 25e-4,
    shadowColor: "#1A0A00",
    bottom: 0.29
  },
  {
    id: "word-flip",
    name: "Word Flip",
    group: "One word at a time",
    blurb: "Words turn in like a flipboard, retro and clean",
    fontFamily: "Righteous",
    cssStack: f("Righteous"),
    bold: false,
    size: 0.088,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "flip", enterMs: 220, accent: "none" },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 45e-4,
    outlineColor: "#16120A",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.29
  },
  {
    id: "word-slab",
    name: "Slab Slide",
    group: "One word at a time",
    blurb: "Fat slab letters that slide in from the side",
    fontFamily: "Alfa Slab One",
    cssStack: f("Alfa Slab One"),
    bold: false,
    size: 0.082,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "slide-left", enterMs: 200, accent: "none" },
    text: "#FFF3D6",
    active: "#FFF3D6",
    outline: 55e-4,
    outlineColor: "#2A1A0F",
    shadow: 25e-4,
    shadowColor: "#140A05",
    bottom: 0.29
  },
  {
    id: "pill-yellow",
    name: "Yellow Pill",
    group: "One word at a time",
    blurb: "One word inside a solid yellow chip that pops in",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.078,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "zoom", enterMs: 170, accent: "none" },
    text: "#101010",
    active: "#101010",
    outline: 0,
    outlineColor: "#101010",
    box: { color: "#F7C204", alpha: 1, pad: 0.02 },
    bottom: 0.24
  },
  {
    id: "pill-dark",
    name: "Dark Pill",
    group: "One word at a time",
    blurb: "One word in a soft dark chip that lifts into place",
    fontFamily: "Inter ExtraBold",
    cssStack: f("Inter"),
    bold: true,
    size: 0.07,
    textCase: "keep",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "rise", enterMs: 180, accent: "none" },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#0E0E0E", alpha: 0.82, pad: 0.018 },
    bottom: 0.23
  },
  /* ---------------- Clean & minimal ---------------- */
  {
    id: "clean-white",
    name: "Clean White",
    group: "Clean & minimal",
    blurb: "Soft white text with a blue accent. Safe for any brand",
    fontFamily: "Inter",
    cssStack: f("Inter"),
    bold: true,
    size: 0.061,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "fade", enterMs: 180, accent: "none" },
    text: "#FFFFFF",
    active: "#6CB8FF",
    outline: 25e-4,
    outlineColor: "#202020",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "quiet-lower",
    name: "Quiet Lowercase",
    group: "Clean & minimal",
    blurb: "Small lowercase line that just fades. The understated look",
    fontFamily: "Inter",
    cssStack: f("Inter"),
    bold: true,
    size: 0.042,
    textCase: "lower",
    maxWords: 6,
    reveal: "line",
    motion: { enter: "fade", enterMs: 220, accent: "none" },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 18e-4,
    outlineColor: "#000000",
    shadow: 1e-3,
    shadowColor: "#000000",
    bottom: 0.14
  },
  {
    id: "boxed-dark",
    name: "Dark Box",
    group: "Clean & minimal",
    blurb: "Dark bar behind the line so text survives busy footage",
    fontFamily: "Inter",
    cssStack: f("Inter"),
    bold: true,
    size: 0.058,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "fade", enterMs: 160, accent: "none" },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#000000", alpha: 0.62, pad: 0.015 },
    bottom: 0.19
  },
  {
    id: "news-lower-third",
    name: "News Lower Third",
    group: "Clean & minimal",
    blurb: "Documentary bar that slides in low in the frame",
    fontFamily: "Roboto",
    cssStack: f("Roboto"),
    bold: true,
    size: 0.05,
    textCase: "keep",
    maxWords: 6,
    reveal: "line",
    motion: { enter: "slide-left", enterMs: 260, accent: "none" },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#101418", alpha: 0.85, pad: 0.016 },
    bottom: 0.1
  },
  {
    id: "typewriter",
    name: "Typewriter",
    group: "Clean & minimal",
    blurb: "Words appear one by one and stay, good for storytelling",
    fontFamily: "Sora",
    cssStack: f("Sora"),
    bold: true,
    size: 0.052,
    textCase: "keep",
    maxWords: 6,
    reveal: "accumulate",
    motion: { enter: "none", accent: "none" },
    text: "#FFFFFF",
    active: "#FFFFFF",
    outline: 22e-4,
    outlineColor: "#000000",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.18
  },
  /* ---------------- Viral bold ---------------- */
  {
    id: "slam-impact",
    name: "Slam Impact",
    group: "Viral bold",
    blurb: "Drops from off-screen oversized, lands hard, then every word double-beats",
    fontFamily: "Anton",
    cssStack: f("Anton"),
    bold: false,
    size: 0.084,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "slam", enterMs: 320, accent: "heartbeat", accentMs: 260 },
    text: "#FFFFFF",
    active: "#FFE500",
    outline: 6e-3,
    outlineColor: "#000000",
    shadow: 25e-4,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "elastic-hype",
    name: "Elastic Hype",
    group: "Viral bold",
    blurb: "Springs in past its size and settles; the spoken word stretches sideways",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.074,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "elastic", enterMs: 420, accent: "bulge", accentMs: 170 },
    text: "#FFFFFF",
    active: "#00E5FF",
    outline: 55e-4,
    outlineColor: "#04121A",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "drop-kick",
    name: "Drop Kick",
    group: "Viral bold",
    blurb: "Falls in, squashes on landing, and each word shoots up tall",
    fontFamily: "Archivo Black",
    cssStack: f("Archivo Black"),
    bold: false,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "bounce-in", enterMs: 460, accent: "tall", accentMs: 180 },
    text: "#FFFFFF",
    active: "#FF2E63",
    outline: 55e-4,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "gold-sweep",
    name: "Gold Sweep",
    group: "Viral bold",
    blurb: "A light sweep reveals the line, then gold floods each word as it is said",
    fontFamily: "Montserrat Black",
    cssStack: f("Montserrat Black"),
    bold: true,
    size: 0.073,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "sweep", enterMs: 300, accent: "fill", accentMs: 200 },
    text: "#FFFFFF",
    active: "#FFC300",
    outline: 5e-3,
    outlineColor: "#120C00",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "wide-load",
    name: "Wide Load",
    group: "Viral bold",
    blurb: "Unfolds from a sliver to full width; the spoken word throws a hard shadow",
    fontFamily: "Kanit ExtraBold",
    cssStack: f("Kanit ExtraBold"),
    bold: true,
    size: 0.076,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "stretch", enterMs: 300, accent: "shadow", accentMs: 200 },
    text: "#FFFFFF",
    active: "#A0FF1C",
    outline: 5e-3,
    outlineColor: "#0A1400",
    shadow: 28e-4,
    shadowColor: "#000000",
    bottom: 0.22
  },
  /* ---------------- Karaoke fill ---------------- */
  {
    id: "karaoke-green",
    name: "Karaoke Green",
    group: "Karaoke & fill",
    blurb: "Plain white line; colour floods word by word exactly on the beat",
    fontFamily: "Poppins ExtraBold",
    cssStack: f("Poppins ExtraBold"),
    bold: true,
    size: 0.066,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "fade", enterMs: 200, accent: "fill", accentMs: 190 },
    text: "#FFFFFF",
    active: "#21E065",
    spoken: "#21E065",
    outline: 45e-4,
    outlineColor: "#03150A",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  {
    id: "fill-pill",
    name: "Fill Pill",
    group: "Karaoke & fill",
    blurb: "A dark pill wipes up into frame and warms up as each word lands",
    fontFamily: "Fredoka SemiBold",
    cssStack: f("Fredoka SemiBold"),
    bold: true,
    size: 0.062,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "mask-up", enterMs: 280, accent: "fill", accentMs: 200 },
    text: "#FFFFFF",
    active: "#FF8A3D",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#101318", alpha: 0.86, pad: 0.012 },
    bottom: 0.2
  },
  {
    id: "dim-fill",
    name: "Dim & Fill",
    group: "Karaoke & fill",
    blurb: "Words ahead sit faded; the one being said lights up to full white",
    fontFamily: "Inter ExtraBold",
    cssStack: f("Inter ExtraBold"),
    bold: true,
    size: 0.062,
    textCase: "keep",
    maxWords: 5,
    reveal: "line",
    motion: { enter: "drift", enterMs: 420, accent: "fill", accentMs: 210 },
    text: "#9FB2C6",
    active: "#FFFFFF",
    spoken: "#E6EEF7",
    upcoming: "#7D8FA3",
    upcomingAlpha: 0.55,
    outline: 35e-4,
    outlineColor: "#050A12",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.2
  },
  {
    id: "rainbow-pop",
    name: "Rainbow Pop",
    group: "Karaoke & fill",
    blurb: "Pops up from nothing and each word cycles through colour before settling",
    fontFamily: "Luckiest Guy",
    cssStack: f("Luckiest Guy"),
    bold: false,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "pop-up", enterMs: 340, accent: "rainbow", accentMs: 300 },
    text: "#FFFFFF",
    active: "#FFD23F",
    outline: 6e-3,
    outlineColor: "#1A0C2E",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "build-up",
    name: "Build Up",
    group: "Karaoke & fill",
    blurb: "The line builds one word at a time, each unfolding from a flat line",
    fontFamily: "Figtree Black",
    cssStack: f("Figtree Black"),
    bold: true,
    size: 0.065,
    textCase: "keep",
    maxWords: 4,
    reveal: "accumulate",
    motion: { enter: "squeeze", enterMs: 260, accent: "grow", accentMs: 170 },
    text: "#FFFFFF",
    active: "#7C5CFF",
    outline: 45e-4,
    outlineColor: "#0B0722",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  /* ---------------- 3D & flip ---------------- */
  {
    id: "tumble-3d",
    name: "Tumble",
    group: "3D & flip",
    blurb: "Falls forward on its face, then every word rolls a full barrel turn",
    fontFamily: "Outfit ExtraBold",
    cssStack: f("Outfit ExtraBold"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "tumble", enterMs: 340, accent: "flip-x", accentMs: 320 },
    text: "#FFFFFF",
    active: "#FFD166",
    outline: 5e-3,
    outlineColor: "#100B00",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "unfold-card",
    name: "Unfold",
    group: "3D & flip",
    blurb: "Opens like a card from the side; each word waves as it is spoken",
    fontFamily: "Plus Jakarta Sans ExtraBold",
    cssStack: f("Plus Jakarta Sans ExtraBold"),
    bold: true,
    size: 0.066,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "unfold", enterMs: 380, accent: "wave", accentMs: 260 },
    text: "#FFFFFF",
    active: "#5AC8FA",
    outline: 45e-4,
    outlineColor: "#04121A",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  {
    id: "barrel-roll",
    name: "Barrel Roll",
    group: "3D & flip",
    blurb: "Rolls in from the left like a wheel, then words spin in place",
    fontFamily: "Titan One",
    cssStack: f("Titan One"),
    bold: false,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "roll", enterMs: 480, accent: "spin", accentMs: 340 },
    text: "#FFFFFF",
    active: "#FF6B35",
    outline: 55e-4,
    outlineColor: "#1B0A00",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "swing-sign",
    name: "Swing Sign",
    group: "3D & flip",
    blurb: "Swings in like a hanging sign and rocks on the word being said",
    fontFamily: "Lilita One",
    cssStack: f("Lilita One"),
    bold: false,
    size: 0.072,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "swing", enterMs: 420, accent: "rock", accentMs: 240 },
    text: "#FFFFFF",
    active: "#FFE066",
    outline: 55e-4,
    outlineColor: "#1A1200",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "pivot-word",
    name: "Pivot",
    group: "3D & flip",
    blurb: "One word at a time, kicked in on a slant with a quick jitter",
    fontFamily: "Sora",
    cssStack: f("Sora"),
    bold: true,
    size: 0.082,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "kick", enterMs: 240, accent: "jitter", accentMs: 200 },
    text: "#FFFFFF",
    active: "#B388FF",
    outline: 5e-3,
    outlineColor: "#0C0618",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.24
  },
  /* ---------------- Glitch & tech ---------------- */
  {
    id: "glitch-cyan",
    name: "Glitch",
    group: "Glitch & tech",
    blurb: "Tears in sideways out of focus; the spoken word blinks like a bad signal",
    fontFamily: "Space Grotesk",
    cssStack: f("Space Grotesk"),
    bold: true,
    size: 0.068,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "glitch", enterMs: 300, accent: "blink", accentMs: 200 },
    text: "#FFFFFF",
    active: "#00F0FF",
    outline: 45e-4,
    outlineColor: "#04121A",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "terminal-green",
    name: "Terminal",
    group: "Glitch & tech",
    blurb: "Flickers on like an old CRT; outlines thicken as the word is read out",
    fontFamily: "Space Grotesk",
    cssStack: f("Space Grotesk"),
    bold: true,
    size: 0.058,
    textCase: "lower",
    maxWords: 5,
    reveal: "line",
    motion: { enter: "flicker", enterMs: 420, accent: "thicken", accentMs: 200 },
    text: "#8BFFA3",
    active: "#FFFFFF",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#04120A", alpha: 0.9, pad: 0.011 },
    bottom: 0.2
  },
  {
    id: "data-shake",
    name: "Data Shake",
    group: "Glitch & tech",
    blurb: "Rattles onto the screen, then each word pulses with a neon bloom",
    fontFamily: "Roboto",
    cssStack: f("Roboto"),
    bold: true,
    size: 0.064,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "shake-in", enterMs: 320, accent: "neon", accentMs: 260 },
    text: "#FFFFFF",
    active: "#FF3B6B",
    outline: 45e-4,
    outlineColor: "#12030A",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  {
    id: "hologram",
    name: "Hologram",
    group: "Glitch & tech",
    blurb: "Materialises out of a blur and hums with a soft glow on every word",
    fontFamily: "Sora",
    cssStack: f("Sora"),
    bold: true,
    size: 0.064,
    textCase: "upper",
    tracking: 4e-3,
    maxWords: 4,
    reveal: "line",
    motion: { enter: "zoom-blur", enterMs: 360, accent: "glow", accentMs: 220 },
    text: "#D6F6FF",
    active: "#00E5FF",
    outline: 35e-4,
    outlineColor: "#02141C",
    shadow: 2e-3,
    shadowColor: "#00131B",
    bottom: 0.21
  },
  {
    id: "scanline",
    name: "Scanline",
    group: "Glitch & tech",
    blurb: "Wipes upward from the baseline, then the live word grows an outline",
    fontFamily: "Oswald",
    cssStack: f("Oswald"),
    bold: true,
    size: 0.07,
    textCase: "upper",
    tracking: 3e-3,
    maxWords: 4,
    reveal: "line",
    motion: { enter: "mask-up", enterMs: 300, accent: "thicken", accentMs: 190 },
    text: "#FFFFFF",
    active: "#39FF14",
    outline: 45e-4,
    outlineColor: "#020F02",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.21
  },
  /* ---------------- Neon & glow ---------------- */
  {
    id: "neon-pink",
    name: "Neon Sign",
    group: "Neon & glow",
    blurb: "Buzzes on like a tube sign and pulses brighter on the spoken word",
    fontFamily: "Righteous",
    cssStack: f("Righteous"),
    bold: false,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "flicker", enterMs: 500, accent: "neon", accentMs: 280 },
    text: "#FFFFFF",
    active: "#FF4FD8",
    outline: 4e-3,
    outlineColor: "#2A0322",
    shadow: 3e-3,
    shadowColor: "#48053B",
    bottom: 0.22
  },
  {
    id: "neon-word",
    name: "Neon Word",
    group: "Neon & glow",
    blurb: "One word at a time, arriving out of a soft blur right at you",
    fontFamily: "Righteous",
    cssStack: f("Righteous"),
    bold: false,
    size: 0.086,
    textCase: "upper",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "zoom-blur", enterMs: 280, accent: "neon", accentMs: 240 },
    text: "#FFFFFF",
    active: "#3DA9FF",
    outline: 45e-4,
    outlineColor: "#04101E",
    shadow: 3e-3,
    shadowColor: "#051A33",
    bottom: 0.25
  },
  {
    id: "ember",
    name: "Ember",
    group: "Neon & glow",
    blurb: "Drifts in warm and slow, each word flaring like a coal",
    fontFamily: "Alfa Slab One",
    cssStack: f("Alfa Slab One"),
    bold: false,
    size: 0.068,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "drift", enterMs: 520, accent: "neon", accentMs: 300 },
    text: "#FFE9C7",
    active: "#FF7A1A",
    outline: 45e-4,
    outlineColor: "#1C0800",
    shadow: 25e-4,
    shadowColor: "#2A0C00",
    bottom: 0.21
  },
  {
    id: "ice",
    name: "Ice",
    group: "Neon & glow",
    blurb: "Unfolds from a thin line of frost; words blink cold as they land",
    fontFamily: "Sora",
    cssStack: f("Sora"),
    bold: true,
    size: 0.064,
    textCase: "upper",
    tracking: 5e-3,
    maxWords: 4,
    reveal: "line",
    motion: { enter: "squeeze", enterMs: 300, accent: "blink", accentMs: 220 },
    text: "#EAF8FF",
    active: "#8ED8FF",
    outline: 35e-4,
    outlineColor: "#05121C",
    shadow: 2e-3,
    shadowColor: "#04222E",
    bottom: 0.21
  },
  {
    id: "laser",
    name: "Laser",
    group: "Neon & glow",
    blurb: "A beam sweeps the line into view and the live word burns a thicker edge",
    fontFamily: "Bebas Neue",
    cssStack: f("Bebas Neue"),
    bold: false,
    size: 0.086,
    textCase: "upper",
    tracking: 4e-3,
    maxWords: 4,
    reveal: "line",
    motion: { enter: "sweep", enterMs: 280, accent: "thicken", accentMs: 180 },
    text: "#FFFFFF",
    active: "#FF0055",
    outline: 5e-3,
    outlineColor: "#1A0009",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  /* ---------------- Playful & cute ---------------- */
  {
    id: "bubble-bounce",
    name: "Bubble Bounce",
    group: "Playful & cute",
    blurb: "Pops up round and soft, then every word beats like a little heart",
    fontFamily: "Baloo 2 ExtraBold",
    cssStack: f("Baloo 2 ExtraBold"),
    bold: true,
    size: 0.072,
    textCase: "keep",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "pop-up", enterMs: 320, accent: "heartbeat", accentMs: 280 },
    text: "#FFFFFF",
    active: "#FF7AA2",
    outline: 55e-4,
    outlineColor: "#2B0A16",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.21
  },
  {
    id: "candy-pill",
    name: "Candy Pill",
    group: "Playful & cute",
    blurb: "A white pill springs in and each word grows into place",
    fontFamily: "Fredoka SemiBold",
    cssStack: f("Fredoka SemiBold"),
    bold: true,
    size: 0.06,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "elastic", enterMs: 420, accent: "grow", accentMs: 180 },
    text: "#2A2040",
    active: "#FF5DA2",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#FFFFFF", alpha: 0.94, pad: 0.013 },
    bottom: 0.2
  },
  {
    id: "jelly-word",
    name: "Jelly Word",
    group: "Playful & cute",
    blurb: "One fat word at a time, dropping in and squashing on impact",
    fontFamily: "Nunito Black",
    cssStack: f("Nunito Black"),
    bold: true,
    size: 0.09,
    textCase: "keep",
    maxWords: 1,
    reveal: "word",
    motion: { enter: "bounce-in", enterMs: 380, accent: "squash", accentMs: 200 },
    text: "#FFFFFF",
    active: "#FFC93C",
    outline: 6e-3,
    outlineColor: "#2A1B00",
    shadow: 25e-4,
    shadowColor: "#000000",
    bottom: 0.25
  },
  {
    id: "sticker-blue",
    name: "Blue Sticker",
    group: "Playful & cute",
    blurb: "Swings in like a badge; the live word wears a fat blue rim and stretches",
    fontFamily: "Luckiest Guy",
    cssStack: f("Luckiest Guy"),
    bold: false,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "swing", enterMs: 400, accent: "tall", accentMs: 190 },
    text: "#FFFFFF",
    active: "#0B1220",
    activeOutline: "#2D9BFF",
    activeOutlineScale: 2.4,
    outline: 55e-4,
    outlineColor: "#0B1220",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "wobble",
    name: "Wobble",
    group: "Playful & cute",
    blurb: "Stretches out wide, then each word waves side to side",
    fontFamily: "Baloo 2 ExtraBold",
    cssStack: f("Baloo 2 ExtraBold"),
    bold: true,
    size: 0.07,
    textCase: "keep",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "stretch", enterMs: 320, accent: "wave", accentMs: 260 },
    text: "#FFFFFF",
    active: "#5AD8A6",
    outline: 5e-3,
    outlineColor: "#05231A",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.21
  },
  /* ---------------- Cinematic ---------------- */
  {
    id: "cine-drift",
    name: "Cinematic",
    group: "Cinematic",
    blurb: "Barely moves: a slow drift in, words easing up to size",
    fontFamily: "Plus Jakarta Sans ExtraBold",
    cssStack: f("Plus Jakarta Sans ExtraBold"),
    bold: true,
    size: 0.056,
    textCase: "keep",
    maxWords: 6,
    reveal: "line",
    motion: { enter: "drift", enterMs: 560, accent: "grow", accentMs: 220 },
    text: "#FFFFFF",
    active: "#FFD9A0",
    outline: 3e-3,
    outlineColor: "#000000",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.17
  },
  {
    id: "letterbox",
    name: "Letterbox",
    group: "Cinematic",
    blurb: "A dark bar wipes up from the edge; the spoken word throws a shadow",
    fontFamily: "Inter",
    cssStack: f("Inter"),
    bold: true,
    size: 0.05,
    textCase: "keep",
    maxWords: 7,
    reveal: "line",
    motion: { enter: "mask-up", enterMs: 320, accent: "shadow", accentMs: 200 },
    text: "#F2F5F8",
    active: "#FFFFFF",
    outline: 0,
    outlineColor: "#000000",
    box: { color: "#000000", alpha: 0.72, pad: 0.01 },
    bottom: 0.14
  },
  {
    id: "narrator",
    name: "Narrator",
    group: "Cinematic",
    blurb: "Quiet fade, and a soft shadow kick under the word being read",
    fontFamily: "Roboto",
    cssStack: f("Roboto"),
    bold: true,
    size: 0.052,
    textCase: "keep",
    maxWords: 7,
    reveal: "line",
    motion: { enter: "fade", enterMs: 300, accent: "shadow", accentMs: 230 },
    text: "#FFFFFF",
    active: "#FFE9A8",
    outline: 3e-3,
    outlineColor: "#000000",
    shadow: 22e-4,
    shadowColor: "#000000",
    bottom: 0.16
  },
  {
    id: "whisper",
    name: "Whisper",
    group: "Cinematic",
    blurb: "Unhurried mask reveal with the words ahead held back at a whisper",
    fontFamily: "Sora",
    cssStack: f("Sora"),
    bold: false,
    size: 0.05,
    textCase: "lower",
    tracking: 2e-3,
    maxWords: 6,
    reveal: "line",
    motion: { enter: "mask-up", enterMs: 420, accent: "grow", accentMs: 240 },
    text: "#E9EEF5",
    active: "#FFFFFF",
    upcoming: "#9AA7B8",
    upcomingAlpha: 0.35,
    outline: 25e-4,
    outlineColor: "#05080D",
    shadow: 15e-4,
    shadowColor: "#000000",
    bottom: 0.17
  },
  {
    id: "slate",
    name: "Slate",
    group: "Cinematic",
    blurb: "Wide tracked caps that unfold sideways, outline swelling on each word",
    fontFamily: "Staatliches",
    cssStack: f("Staatliches"),
    bold: false,
    size: 0.066,
    textCase: "upper",
    tracking: 8e-3,
    maxWords: 5,
    reveal: "line",
    motion: { enter: "stretch", enterMs: 360, accent: "thicken", accentMs: 200 },
    text: "#FFFFFF",
    active: "#C8D6E5",
    outline: 35e-4,
    outlineColor: "#05080D",
    shadow: 18e-4,
    shadowColor: "#000000",
    bottom: 0.19
  },
  /* ---------------- Retro & comic ---------------- */
  {
    id: "comic-slam",
    name: "Comic Slam",
    group: "Retro & comic",
    blurb: "Rattles in like a sound effect, every word punching out of the panel",
    fontFamily: "Bangers",
    cssStack: f("Bangers"),
    bold: false,
    size: 0.084,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "shake-in", enterMs: 300, accent: "punch", accentMs: 170 },
    text: "#FFFFFF",
    active: "#1B1B1B",
    activeOutline: "#FF2E63",
    activeOutlineScale: 2.6,
    outline: 6e-3,
    outlineColor: "#1B1B1B",
    shadow: 25e-4,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "retro-70s",
    name: "Retro 70s",
    group: "Retro & comic",
    blurb: "Swings in warm and thick, each word rolling like a vinyl label",
    fontFamily: "Alfa Slab One",
    cssStack: f("Alfa Slab One"),
    bold: false,
    size: 0.07,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "swing", enterMs: 440, accent: "wave", accentMs: 280 },
    text: "#FFEFD5",
    active: "#E2571E",
    outline: 5e-3,
    outlineColor: "#2A1000",
    shadow: 25e-4,
    shadowColor: "#3A1800",
    bottom: 0.22
  },
  {
    id: "vhs",
    name: "VHS",
    group: "Retro & comic",
    blurb: "Tracking error on arrival, then the word smears through colour",
    fontFamily: "Space Grotesk",
    cssStack: f("Space Grotesk"),
    bold: true,
    size: 0.066,
    textCase: "upper",
    maxWords: 4,
    reveal: "line",
    motion: { enter: "glitch", enterMs: 340, accent: "rainbow", accentMs: 320 },
    text: "#FFFFFF",
    active: "#FF00E5",
    outline: 45e-4,
    outlineColor: "#0B0016",
    shadow: 22e-4,
    shadowColor: "#12001F",
    bottom: 0.21
  },
  {
    id: "arcade",
    name: "Arcade",
    group: "Retro & comic",
    blurb: "Coin-op pop up with a hard blink on the word being called",
    fontFamily: "Passion One",
    cssStack: f("Passion One"),
    bold: true,
    size: 0.08,
    textCase: "upper",
    maxWords: 3,
    reveal: "line",
    motion: { enter: "pop-up", enterMs: 260, accent: "blink", accentMs: 200 },
    text: "#FFFFFF",
    active: "#FFD400",
    outline: 55e-4,
    outlineColor: "#12000E",
    shadow: 2e-3,
    shadowColor: "#000000",
    bottom: 0.22
  },
  {
    id: "stamp",
    name: "Stamp",
    group: "Retro & comic",
    blurb: "Slams down like a rubber stamp; the live word grows a heavy border",
    fontFamily: "Staatliches",
    cssStack: f("Staatliches"),
    bold: false,
    size: 0.078,
    textCase: "upper",
    tracking: 4e-3,
    maxWords: 3,
    reveal: "line",
    motion: { enter: "slam", enterMs: 300, accent: "thicken", accentMs: 180 },
    text: "#FFFFFF",
    active: "#FF4A1C",
    outline: 5e-3,
    outlineColor: "#1A0500",
    shadow: 22e-4,
    shadowColor: "#000000",
    bottom: 0.22
  }
];
const CAPTION_GROUPS = [...new Set(CAPTION_PRESETS.map((p) => p.group))];
const BY_ID = new Map(CAPTION_PRESETS.map((p) => [p.id, p]));
const LEGACY = { pop: "hormozi-yellow", clean: "clean-white", boxed: "boxed-dark" };
const DEFAULT_CAPTION_PRESET = "hormozi-yellow";
function findPreset(id) {
  if (!id || id === "none") return null;
  return BY_ID.get(id) ?? BY_ID.get(LEGACY[id] ?? "") ?? BY_ID.get(DEFAULT_CAPTION_PRESET) ?? null;
}
function applyCase(word, textCase) {
  if (textCase === "upper") return word.toUpperCase();
  if (textCase === "lower") return word.toLowerCase();
  return word;
}
const CAPTION_FONT_FILES = {
  "Alfa Slab One": "AlfaSlabOne-Regular.ttf",
  Anton: "Anton-Regular.ttf",
  "Archivo Black": "ArchivoBlack-Regular.ttf",
  "Baloo 2 ExtraBold": "Baloo2-ExtraBold.ttf",
  Bangers: "Bangers-Regular.ttf",
  "Bebas Neue": "BebasNeue-Regular.ttf",
  "Figtree Black": "Figtree-Black.ttf",
  "Fredoka SemiBold": "Fredoka-SemiBold.ttf",
  Inter: "Inter-Bold.ttf",
  "Inter ExtraBold": "Inter-ExtraBold.ttf",
  "Kanit ExtraBold": "Kanit-ExtraBold.ttf",
  "Lilita One": "LilitaOne-Regular.ttf",
  "Luckiest Guy": "LuckiestGuy-Regular.ttf",
  "Montserrat Black": "Montserrat-Black.ttf",
  "Nunito Black": "Nunito-Black.ttf",
  Oswald: "Oswald-Bold.ttf",
  "Outfit ExtraBold": "Outfit-ExtraBold.ttf",
  "Passion One": "PassionOne-Bold.ttf",
  "Plus Jakarta Sans ExtraBold": "PlusJakartaSans-ExtraBold.ttf",
  "Poppins ExtraBold": "Poppins-ExtraBold.ttf",
  Righteous: "Righteous-Regular.ttf",
  Roboto: "Roboto-Bold.ttf",
  Sora: "Sora-Bold.ttf",
  "Space Grotesk": "SpaceGrotesk-Bold.ttf",
  Staatliches: "Staatliches-Regular.ttf",
  "Titan One": "TitanOne-Regular.ttf"
};
const CAPTION_SIZE_RANGE = { min: 0.5, max: 2 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HEX = /^#[0-9a-f]{6}$/i;
function applyCaptionOverrides(preset, overrides) {
  if (!overrides) return preset;
  const color = overrides.color && HEX.test(overrides.color) ? overrides.color.toUpperCase() : void 0;
  const textColor = overrides.textColor && HEX.test(overrides.textColor) ? overrides.textColor.toUpperCase() : void 0;
  const font = overrides.font && CAPTION_FONT_FILES[overrides.font] ? overrides.font : void 0;
  const scale = typeof overrides.sizeScale === "number" && Number.isFinite(overrides.sizeScale) && overrides.sizeScale !== 1 ? clamp(overrides.sizeScale, CAPTION_SIZE_RANGE.min, CAPTION_SIZE_RANGE.max) : void 0;
  const pos = overrides.pos && Number.isFinite(overrides.pos.x) && Number.isFinite(overrides.pos.y) ? { x: clamp(overrides.pos.x, 0, 1), y: clamp(overrides.pos.y, 0, 1) } : void 0;
  if (!color && !textColor && !font && !scale && !pos) return preset;
  const next = { ...preset };
  if (scale) {
    next.size = preset.size * scale;
    next.outline = preset.outline * scale;
    if (preset.tracking) next.tracking = preset.tracking * scale;
    if (preset.shadow) next.shadow = preset.shadow * scale;
    if (preset.box) next.box = { ...preset.box, pad: preset.box.pad * scale };
    if (preset.fx?.under) {
      next.fx = {
        ...preset.fx,
        under: preset.fx.under.map((u) => ({
          ...u,
          outline: u.outline * scale,
          ...u.blur ? { blur: u.blur * scale } : {},
          ...u.dx ? { dx: u.dx * scale } : {},
          ...u.dy ? { dy: u.dy * scale } : {}
        }))
      };
    }
  }
  if (pos) next.anchor = pos;
  if (font) {
    next.fontFamily = font;
    next.cssStack = f(font);
  }
  if (color) {
    const wearsOutline = Boolean(preset.activeOutline);
    const oldAccent = wearsOutline ? preset.activeOutline : preset.active;
    if (wearsOutline) next.activeOutline = color;
    else next.active = color;
    if (preset.spoken && sameColor(preset.spoken, oldAccent)) next.spoken = color;
    if (next.box && sameColor(next.box.color, oldAccent)) next.box = { ...next.box, color };
    if (next.fx?.cycle) next.fx = { ...next.fx, cycle: void 0 };
  }
  if (textColor) {
    const oldText = preset.text;
    next.text = textColor;
    if (preset.spoken && sameColor(preset.spoken, oldText)) next.spoken = textColor;
    if (preset.upcoming && sameColor(preset.upcoming, oldText)) next.upcoming = textColor;
    if (!color && sameColor(preset.active, oldText)) next.active = textColor;
  }
  return next;
}
function sameColor(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
function resolveCaptionPreset(id, overrides) {
  const preset = findPreset(id);
  return preset ? applyCaptionOverrides(preset, overrides) : null;
}
const CENTRED_CROP = { zoom: 1, x: 0.5, y: 0.5 };
const MAX_CROP_ZOOM = 4;
const WHISPER_MODEL_SIZES = ["tiny", "base", "small", "medium", "large"];
const WHISPER_MODEL_IDS = {
  tiny: "onnx-community/whisper-tiny_timestamped",
  base: "onnx-community/whisper-base_timestamped",
  small: "onnx-community/whisper-small_timestamped",
  medium: "onnx-community/whisper-medium_timestamped",
  large: "onnx-community/whisper-large-v3-turbo_timestamped"
};
const WHISPER_DTYPES = {
  tiny: { encoder: "fp32", decoder: "q8" },
  base: { encoder: "fp32", decoder: "q8" },
  small: { encoder: "fp32", decoder: "q8" },
  medium: { encoder: "q8", decoder: "q8" },
  large: { encoder: "fp32", decoder: "fp32" }
};
const DTYPE_SUFFIX = {
  fp32: "",
  fp16: "_fp16",
  q8: "_quantized",
  int8: "_int8",
  uint8: "_uint8",
  q4: "_q4",
  q4f16: "_q4f16",
  bnb4: "_bnb4"
};
function whisperWeightFiles(model) {
  const d = WHISPER_DTYPES[model];
  return {
    encoder: `encoder_model${DTYPE_SUFFIX[d.encoder] ?? `_${d.encoder}`}.onnx`,
    decoder: `decoder_model_merged${DTYPE_SUFFIX[d.decoder] ?? `_${d.decoder}`}.onnx`
  };
}
const WHISPER_MODEL_INFO = {
  tiny: {
    label: "Tiny",
    blurb: "Quick drafts of clear, single-speaker English.",
    tag: "Fastest",
    approxSize: "66 MB",
    downloadBytes: 664e5,
    minRamGb: 0,
    ramGb: 0.9,
    ramMeasured: true,
    speed: 3,
    accuracy: 1
  },
  base: {
    label: "Base",
    blurb: "Good for most English videos.",
    approxSize: "139 MB",
    downloadBytes: 139e6,
    minRamGb: 4,
    ramGb: 1.3,
    ramMeasured: true,
    speed: 3,
    accuracy: 2
  },
  small: {
    label: "Small",
    blurb: "Handles accents, names and noisy audio.",
    tag: "Best for English",
    approxSize: "512 MB",
    downloadBytes: 515e6,
    minRamGb: 8,
    ramGb: 2.6,
    ramMeasured: true,
    speed: 2,
    accuracy: 2
  },
  medium: {
    label: "Medium",
    blurb: "Accurate, but about an hour per minute on a laptop processor.",
    approxSize: "990 MB",
    downloadBytes: 99e7,
    minRamGb: 16,
    // Not measured: a run here takes about an hour per minute. Weights (1 GB) plus the 2-2.5 GB of
    // working memory small and large needed on the same audio.
    ramGb: 3.5,
    ramMeasured: false,
    speed: 1,
    accuracy: 3
  },
  large: {
    label: "Large Turbo",
    blurb: "Most accurate. Slower than the video on a laptop processor.",
    tag: "Best for Urdu & Hindi",
    approxSize: "3.2 GB",
    downloadBytes: 324e7,
    minRamGb: 16,
    ramGb: 5.2,
    ramMeasured: true,
    speed: 1,
    accuracy: 3
  }
};
const STAGE_WEIGHTS = {
  download: 0,
  // handled by the main process before the engine starts
  probe: 2,
  audio: 3,
  transcribe: 40,
  analyze: 15,
  render: 38,
  finalize: 2
};
const DEFAULT_JOB_DEFAULTS = {
  mode: "highlights",
  aspect: "9:16",
  layout: "fit-blur",
  captionStyle: DEFAULT_CAPTION_PRESET,
  clipCount: 5,
  minClipSeconds: 15,
  maxClipSeconds: 60,
  tightenSilences: true,
  language: "auto",
  audience: "software developers and tech creators",
  liveThreshold: 70,
  liveMaxMinutes: 120,
  liveRetentionMinutes: 12
};
const WRITING_MODEL_AUTO = "auto";
const LANGUAGES = [
  { id: "auto", label: "Auto detect" },
  { id: "en", label: "English" },
  { id: "ur", label: "Urdu" },
  { id: "hi", label: "Hindi" },
  { id: "ar", label: "Arabic" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "pt", label: "Portuguese" },
  { id: "tr", label: "Turkish" },
  { id: "id", label: "Indonesian" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "zh", label: "Chinese" }
];
const STDERR_KEEP = 256 * 1024;
function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = node_child_process.spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let stderrBuf = "";
    let stalled = false;
    let watchdog;
    const arm = () => {
      if (!opts.stallMs) return;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        child.kill("SIGKILL");
      }, opts.stallMs);
    };
    arm();
    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => {
      arm();
      const s = d.toString();
      stderr += s;
      if (stderr.length > STDERR_KEEP * 2) stderr = stderr.slice(-STDERR_KEEP);
      if (opts.onStderr) {
        stderrBuf += s;
        const parts = stderrBuf.split(/\r|\n/);
        stderrBuf = parts.pop() ?? "";
        for (const p of parts) if (p.trim()) opts.onStderr(p);
      }
    });
    const onAbort = () => {
      child.kill("SIGKILL");
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    if (opts.signal?.aborted) onAbort();
    child.on("error", (err) => {
      clearTimeout(watchdog);
      opts.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(watchdog);
      opts.signal?.removeEventListener("abort", onAbort);
      if (opts.signal?.aborted) return reject(new Error("Cancelled"));
      resolve({ code: code ?? -1, stdout, stderr, ...stalled ? { stalled } : {} });
    });
  });
}
async function probe(bins, input) {
  const res = await run(bins.ffprobe, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    input
  ]);
  if (res.code !== 0) throw new Error(`ffprobe failed: ${res.stderr.trim() || res.code}`);
  const json = JSON.parse(res.stdout);
  const video = json.streams?.find((s) => s.codec_type === "video");
  const audio = json.streams?.find((s) => s.codec_type === "audio");
  if (!video) throw new Error("No video stream found in the file.");
  const fpsStr = video.avg_frame_rate && video.avg_frame_rate !== "0/0" ? video.avg_frame_rate : video.r_frame_rate ?? "30/1";
  const [n, d] = fpsStr.split("/").map(Number);
  const fps = d ? n / d : n || 30;
  let width = video.width ?? 0;
  let height = video.height ?? 0;
  const rotation = Math.abs(Number(video.tags?.rotate ?? video.side_data_list?.[0]?.rotation ?? 0));
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];
  const duration = Number(json.format?.duration ?? video.duration ?? 0);
  return {
    duration,
    width,
    height,
    fps: Math.round(fps * 100) / 100,
    hasAudio: Boolean(audio),
    codec: video.codec_name ?? "unknown",
    sizeBytes: Number(json.format?.size ?? 0)
  };
}
async function extractAudio(bins, input, outDir, onProgress, duration, signal, range) {
  await node_fs.promises.mkdir(outDir, { recursive: true });
  const pcmPath = path.join(outDir, "audio-16k.f32le");
  const window = range && range.end > range.start ? ["-ss", range.start.toFixed(3), "-t", (range.end - range.start).toFixed(3)] : [];
  const res = await run(
    bins.ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-nostdin",
      ...window,
      "-i",
      input,
      "-vn",
      "-map",
      "0:a:0",
      // On the file's clock, not the sound's own: when the sound starts later than the file (a
      // phone or screen recording, an MKV, a stream recording), sample 0 used to be that late
      // start, and every word time came out early by it (measured: 1.48 s on a file whose sound
      // starts 1.48 s in), so the clips were cut where the words were not. The missing start
      // becomes silence, and a gap in the sound is filled the same way.
      "-af",
      "aresample=async=1:first_pts=0",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      pcmPath,
      "-progress",
      "pipe:2"
    ],
    { signal, onStderr: (line) => onProgress(parseProgress(line, duration)) }
  );
  if (res.code !== 0) throw new Error(`Audio extraction failed: ${lastLines(res.stderr)}`);
  return { pcmPath };
}
function parseProgress(line, totalSeconds) {
  const m = /out_time_us=(\d+)/.exec(line) ?? /out_time_ms=(\d+)/.exec(line);
  if (m && totalSeconds > 0) {
    const secs = Number(m[1]) / 1e6;
    return Math.max(0, Math.min(100, secs / totalSeconds * 100));
  }
  const t = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  if (t && totalSeconds > 0) {
    const secs = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
    return Math.max(0, Math.min(100, secs / totalSeconds * 100));
  }
  return -1;
}
function lastLines(s, n = 6) {
  const lines = s.trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-n).join("\n");
}
async function readPcmF32(pcmPath) {
  const buf = await node_fs.promises.readFile(pcmPath);
  const aligned = buf.byteOffset % 4 === 0 ? buf : Buffer.from(buf);
  return new Float32Array(aligned.buffer, aligned.byteOffset, Math.floor(aligned.byteLength / 4));
}
function escapeFilterPath(p) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "'\\\\\\''");
}
async function thumbnail(bins, input, at, out, width) {
  const res = await run(bins.ffmpeg, [
    "-y",
    "-hide_banner",
    "-nostdin",
    "-ss",
    at.toFixed(3),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:-2`,
    "-q:v",
    "4",
    out
  ]);
  if (res.code !== 0) throw new Error(`Thumbnail failed: ${lastLines(res.stderr)}`);
}
const LIBX264 = { name: "libx264", videoArgs: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"] };
function sizedEncoderArgs(args, w, h, aspect) {
  const i = args.indexOf("-b:v");
  if (i < 0 || i + 1 >= args.length) return args;
  const m = /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(args[i + 1]);
  if (!m) return args;
  const bits = Number(m[1]) * (m[2].toLowerCase() === "m" ? 1e6 : m[2].toLowerCase() === "k" ? 1e3 : 1);
  const full = aspect === "1:1" ? 1080 * 1080 : 1080 * 1920;
  const share = w * h / full;
  if (!(bits > 0) || !(share > 0) || share >= 1) return args;
  const out = [...args];
  out[i + 1] = `${Math.max(500, Math.round(bits * share / 1e3))}k`;
  return out;
}
function isCpuEncoder(args) {
  return args.includes("libx264");
}
async function detectEncoder(bins) {
  const res = await run(bins.ffmpeg, ["-hide_banner", "-encoders"]);
  const list = res.stdout;
  const has = (n) => new RegExp(`\\s${n}\\s`).test(list);
  const candidates = [
    { name: "h264_videotoolbox", args: ["-c:v", "h264_videotoolbox", "-b:v", "8M", "-profile:v", "high", "-allow_sw", "1"] },
    { name: "h264_nvenc", args: ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "21", "-b:v", "0"] },
    { name: "h264_qsv", args: ["-c:v", "h264_qsv", "-global_quality", "22"] },
    { name: "h264_amf", args: ["-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", "22", "-qp_p", "22"] }
  ];
  for (const c of candidates) {
    if (!has(c.name)) continue;
    const test = await run(bins.ffmpeg, [
      "-hide_banner",
      "-nostdin",
      "-v",
      "error",
      // Not smaller: NVENC and AMF reject frames below their minimum size, which would make a
      // working graphics card look broken and silently fall back to the CPU encoder.
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:r=10:d=0.2",
      ...c.args,
      "-pix_fmt",
      "yuv420p",
      "-f",
      "null",
      "-"
    ]);
    if (test.code === 0) return { name: c.name, videoArgs: [...c.args] };
  }
  return { name: LIBX264.name, videoArgs: [...LIBX264.videoArgs] };
}
async function fallbackEncoders(bins, failed) {
  const fresh = await detectEncoder(bins).catch(() => null);
  const out = [];
  if (fresh && !isCpuEncoder(fresh.videoArgs) && fresh.videoArgs.join(" ") !== failed.join(" ")) out.push(fresh);
  out.push({ name: LIBX264.name, videoArgs: [...LIBX264.videoArgs] });
  return out;
}
const FRAME_MS = 20;
function loudnessFrames(samples, sampleRate, frameMs = FRAME_MS) {
  const per = Math.max(1, Math.round(sampleRate * frameMs / 1e3));
  const count = Math.max(1, Math.ceil(samples.length / per));
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const from = i * per;
    const to = Math.min(samples.length, from + per);
    let sum = 0;
    for (let j = from; j < to; j++) sum += samples[j] * samples[j];
    out[i] = Math.sqrt(sum / Math.max(1, to - from));
  }
  return out;
}
function voiceRuns(frames, frameMs = FRAME_MS, { minRunMs = 120, joinGapMs = 160 } = {}) {
  if (!frames.length) return [];
  const db = new Float32Array(frames.length);
  for (let i = 0; i < frames.length; i++) db[i] = 20 * Math.log10(Math.max(frames[i], 1e-6));
  const sorted = Float32Array.from(db).sort();
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const peak = sorted[Math.floor(sorted.length * 0.95)];
  if (!Number.isFinite(floor) || !Number.isFinite(peak) || peak - floor < 6) return [];
  const threshold = floor + (peak - floor) * 0.25;
  const runs = [];
  let from = -1;
  for (let i = 0; i < db.length; i++) {
    const voiced = db[i] >= threshold;
    if (voiced && from < 0) from = i;
    if (!voiced && from >= 0) {
      runs.push({ start: from * frameMs / 1e3, end: i * frameMs / 1e3 });
      from = -1;
    }
  }
  if (from >= 0) runs.push({ start: from * frameMs / 1e3, end: db.length * frameMs / 1e3 });
  const joined = [];
  for (const run2 of runs) {
    const last = joined[joined.length - 1];
    if (last && run2.start - last.end <= joinGapMs / 1e3) last.end = run2.end;
    else joined.push({ ...run2 });
  }
  return joined.filter((r) => r.end - r.start >= minRunMs / 1e3);
}
function measureLag(words, runs, maxLag = 0.6) {
  if (words.length < 4 || runs.length < 2) return 0;
  const offsets = [];
  for (const run2 of runs) {
    const first = words.find((w) => w.start >= run2.start - 0.05 && w.start < run2.end);
    if (!first) continue;
    const offset = first.start - run2.start;
    if (offset >= 0 && offset <= maxLag) offsets.push(offset);
  }
  offsets.sort((a, b) => a - b);
  if (offsets.length >= 3) return Math.max(0, Math.min(maxLag, offsets[Math.floor(offsets.length / 2)]));
  if (offsets.length === 2 && offsets[1] - offsets[0] <= 0.08) return Math.max(0, Math.min(maxLag, offsets[0]));
  return 0;
}
function alignWords(words, runs, lag, snap = 0.3) {
  if (!words.length) return words;
  const shifted = words.map((w) => ({
    text: w.text,
    start: Math.max(0, w.start - lag),
    end: Math.max(0.05, w.end - lag)
  }));
  let r = 0;
  for (let i = 0; i < shifted.length; i++) {
    const w = shifted[i];
    while (r < runs.length - 1 && runs[r].end < w.start - snap) r++;
    const run2 = runs[r];
    if (!run2) break;
    const opensRun = i === 0 || shifted[i - 1].end <= run2.start + 0.02;
    if (!opensRun) continue;
    if (Math.abs(w.start - run2.start) > snap) continue;
    const floor = i === 0 ? 0 : shifted[i - 1].end;
    const moved = Math.max(floor, run2.start);
    if (moved < w.end - 0.05) w.start = moved;
  }
  return tidy(shifted);
}
function tidy(words) {
  const out = words.map((w) => ({ ...w }));
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const w = out[i];
    if (w.start < prev.start) w.start = prev.start;
    if (prev.end > w.start) prev.end = Math.max(prev.start + 0.04, w.start);
    if (w.end <= w.start) w.end = w.start + 0.12;
  }
  return out.map((w) => ({ text: w.text, start: round$1(w.start), end: round$1(w.end) }));
}
function alignToAudio(words, samples, sampleRate) {
  if (!words.length || !samples.length) return { words: tidy(words), lag: 0, runs: 0 };
  const runs = voiceRuns(loudnessFrames(samples, sampleRate), FRAME_MS);
  if (runs.length < 2) return { words: tidy(words), lag: 0, runs: runs.length };
  const lag = measureLag(words, runs);
  return { words: alignWords(words, runs, lag), lag, runs: runs.length };
}
function round$1(n) {
  return Math.round(n * 1e3) / 1e3;
}
function buildSegments(words) {
  const segments = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    segments.push({
      id: segments.length,
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" ").replace(/\s+([,.!?;:])/g, "$1"),
      words: cur
    });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const next = words[i + 1];
    const endsSentence = /[.!?。؟]["')\]]?$/.test(w.text);
    const pause = next ? next.start - w.end : 0;
    const dur = w.end - cur[0].start;
    if (endsSentence || pause > 1 || dur > 15 || cur.length >= 18 && /[,;:]$/.test(w.text)) flush();
  }
  flush();
  return segments;
}
const PILE_SPREAD = 0.06;
const PILE_WORD = 0.1;
const PILE_MIN = 3;
const LOOK = 40;
const key = (w) => w.text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");
function inOrder(pile, around) {
  let k = 0;
  for (const a of around) if (k < pile.length && a === pile[k]) k++;
  return k;
}
function copied(pile, around) {
  let best = 0;
  for (let s = 0; s < pile.length && pile.length - s > best; s++) best = Math.max(best, inOrder(pile.slice(s), around));
  return best;
}
function dropPileUps(words) {
  const out = [];
  let dropped = 0;
  let spread = 0;
  let i = 0;
  while (i < words.length) {
    let j = i;
    while (j + 1 < words.length && Math.abs(words[j + 1].start - words[i].start) < PILE_SPREAD && words[j + 1].end - words[j + 1].start < PILE_WORD) j++;
    const n = j - i + 1;
    if (n < PILE_MIN) {
      out.push(words[i]);
      i++;
      continue;
    }
    const pile = words.slice(i, j + 1).map(key).filter(Boolean);
    const before = words.slice(Math.max(0, i - LOOK), i).map(key);
    const after = words.slice(j + 1, j + 1 + LOOK).map(key);
    if (copied(pile, before) >= pile.length / 2 || copied(pile, after) >= pile.length / 2) {
      dropped += n;
    } else {
      const from = words[i].start;
      const next = j + 1 < words.length ? words[j + 1].start : from + n * 0.3;
      const step = Math.max(0.05, Math.min(0.4, (next - from) / n));
      for (let k = 0; k < n; k++) {
        const s = Math.round((from + k * step) * 1e3) / 1e3;
        out.push({ ...words[i + k], start: s, end: Math.round((s + step) * 1e3) / 1e3 });
      }
      spread += n;
    }
    i = j + 1;
  }
  return { words: out, dropped, spread };
}
const STOCK = /^(laughter|laughs|laughing|applause|music|cheering|cheers|silence|inaudible|blank_audio|noise|crowd|music playing|upbeat music|sighs|coughs|indistinct)[.!]?$/i;
function isAnnotation(text) {
  const t = text.trim();
  if (!t) return true;
  if (/^[[(*♪♫].*[\])*♪♫]$/u.test(t) || /^[♪♫]+$/u.test(t)) return true;
  return t === t.toUpperCase() && t !== t.toLowerCase() && STOCK.test(t);
}
function dropAnnotations(words) {
  const out = [];
  let open = null;
  for (const w of words) {
    const t = w.text.trim();
    if (open) {
      if (t.endsWith(open)) open = null;
      continue;
    }
    if (isAnnotation(t)) continue;
    const close = t.startsWith("[") ? "]" : t.startsWith("(") ? ")" : null;
    if (close && !t.includes(close)) {
      open = close;
      continue;
    }
    out.push(w);
  }
  return out;
}
function looksLooped(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const joined = text.replace(/\s+/g, "");
  const syllable = /(.{1,4})\1{7,}/u.exec(joined);
  const syllableRun = Boolean(syllable && syllable[0].length >= Math.max(40, joined.length * 0.3));
  if (words.length < 6) return syllableRun;
  const counts = /* @__PURE__ */ new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  let run2 = 1;
  let longest = 1;
  for (let i = 1; i < words.length; i++) {
    run2 = words[i] === words[i - 1] ? run2 + 1 : 1;
    longest = Math.max(longest, run2);
  }
  const variety = new Set(words).size / words.length;
  const commonest = Math.max(...counts.values()) / words.length;
  const runLoop = longest >= 12 || longest >= 5 && longest / words.length >= 0.2;
  return syllableRun || runLoop || variety < 0.3 || commonest > 0.25;
}
const LOOP_SPAN = 60;
function loopedSpans(words, duration, span = LOOP_SPAN) {
  const out = [];
  for (let at = 0; at < duration; at += span) {
    const text = words.filter((w) => w.start >= at && w.start < at + span).map((w) => w.text).join(" ");
    if (text && looksLooped(text)) out.push(at);
  }
  return out;
}
function collapseRuns(words) {
  const key2 = (w) => w.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return words.filter((w, i) => i === 0 || !key2(w) || key2(w) !== key2(words[i - 1]));
}
function spliceWords(words, from, to, fresh) {
  const inside = (w) => w.start >= from && w.start < to;
  return [...words.filter((w) => !inside(w)), ...fresh.filter(inside)].sort((a, b) => a.start - b.start);
}
const LOOP_RETRIES = [
  { label: "repetition penalty", options: { repetition_penalty: 1.15 } },
  { label: "temperature 0.2", options: { do_sample: true, temperature: 0.2, top_k: 0 } },
  { label: "temperature 0.4", options: { do_sample: true, temperature: 0.4, top_k: 0 } }
];
const MODEL_IDS = WHISPER_MODEL_IDS;
function platformAccelerator() {
  if (process.platform === "darwin") return "coreml";
  if (process.platform === "win32") return "dml";
  return null;
}
function loadTransformers(log) {
  const req = require;
  let backend = "native";
  try {
    if (process.env.CLIPIE_FORCE_WASM === "1") throw new Error("CLIPIE_FORCE_WASM=1");
    const fromDir = path.dirname(req.resolve("@huggingface/transformers"));
    req(req.resolve("onnxruntime-node", { paths: [fromDir] }));
  } catch (err) {
    backend = "wasm";
    log(`Native ONNX runtime unavailable on ${process.platform}/${process.arch} (${err.message.split("\n")[0]}); using WASM backend.`);
    const Module = req("node:module");
    const original = Module._resolveFilename;
    const webEntry = req.resolve("onnxruntime-web");
    Module._resolveFilename = function(request, ...rest) {
      if (request === "onnxruntime-node") return webEntry;
      return original.call(this, request, ...rest);
    };
  }
  let tf;
  try {
    tf = req("@huggingface/transformers");
  } catch (err) {
    if (/\bsharp\b/i.test(err.message ?? "")) {
      throw new Error(
        `This build of Nizam is missing its image library for ${process.platform}-${process.arch}, so the speech model cannot start. Reinstall from the latest download; if it keeps happening, please report it.`
      );
    }
    throw err;
  }
  if (backend === "wasm") {
    const distDir = path.dirname(req.resolve("onnxruntime-web"));
    const onnxEnv = tf.env.backends.onnx;
    if (onnxEnv?.wasm) {
      onnxEnv.wasm.wasmPaths = distDir + path.sep;
      onnxEnv.wasm.numThreads = Math.max(1, Math.min(8, os.cpus().length - 1));
      onnxEnv.wasm.proxy = false;
    }
  }
  return { tf, backend };
}
let cachedPipeline = null;
async function loadWhisperPipeline(opts) {
  const key2 = `${opts.modelsDir}|${opts.model}|${opts.accelerator ?? "cpu"}`;
  if (cachedPipeline?.key === key2) return cachedPipeline.value;
  const previous = cachedPipeline?.value;
  if (previous) {
    void previous.then((p) => p.transcriber.dispose?.()).catch(() => void 0);
  }
  const promise = createWhisperPipeline(opts);
  cachedPipeline = { key: key2, value: promise };
  promise.catch(() => {
    if (cachedPipeline?.key === key2) cachedPipeline = null;
  });
  return promise;
}
async function createWhisperPipeline(opts) {
  const { tf, backend } = loadTransformers(opts.log);
  const { pipeline, env } = tf;
  await node_fs.promises.mkdir(opts.modelsDir, { recursive: true });
  env.cacheDir = opts.modelsDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  opts.log(`Whisper backend: ${backend === "native" ? "onnxruntime-node (native)" : "onnxruntime-web (wasm)"}`);
  const modelId = MODEL_IDS[opts.model] ?? MODEL_IDS.base;
  const profile = WHISPER_DTYPES[opts.model] ?? WHISPER_DTYPES.base;
  const encoderDtype = process.env.CLIPIE_WHISPER_ENCODER || profile.encoder;
  const decoderDtype = process.env.CLIPIE_WHISPER_DECODER || (backend === "wasm" ? "fp32" : profile.decoder);
  const accelerator = backend === "wasm" ? "cpu" : opts.accelerator ?? "cpu";
  const device = accelerator === "cpu" ? "cpu" : { encoder_model: accelerator, decoder_model_merged: "cpu" };
  opts.log(`Whisper dtypes: encoder ${encoderDtype}, decoder ${decoderDtype} · encoder on ${accelerator}`);
  const files = /* @__PURE__ */ new Map();
  const onDisk = /* @__PURE__ */ new Map();
  const cached = (file) => {
    let known = onDisk.get(file);
    if (known === void 0) {
      known = node_fs.existsSync(path.join(opts.modelsDir, modelId, file));
      onDisk.set(file, known);
    }
    return known;
  };
  const transcriber = await pipeline("automatic-speech-recognition", modelId, {
    dtype: { encoder_model: encoderDtype, decoder_model_merged: decoderDtype },
    device,
    progress_callback: (p) => {
      if (p.status === "initiate" && p.file) {
        cached(p.file);
      } else if (p.status === "progress" && p.file) {
        if (cached(p.file)) return;
        const total = p.total ?? 0;
        const loaded = p.loaded ?? total * (p.progress ?? 0) / 100;
        files.set(p.file, { loaded, total });
        let sumLoaded = 0;
        let sumTotal = 0;
        for (const f2 of files.values()) {
          sumLoaded += f2.loaded;
          sumTotal += f2.total;
        }
        const pct = sumTotal > 0 ? sumLoaded / sumTotal * 100 : p.progress ?? 0;
        opts.onDownload(Math.min(99, pct), `Downloading ${path.basename(p.file)} (${(p.progress ?? 0).toFixed(0)}%)`);
      } else if (p.status === "done" && p.file && !cached(p.file)) {
        opts.log(`Model file ready: ${p.file}`);
      }
    }
  });
  return { transcriber, backend, modelId };
}
async function downloadWhisperModel(opts) {
  opts.onProgress(0, "Preparing download…");
  let highest = 0;
  const { modelId } = await loadWhisperPipeline({
    modelsDir: opts.modelsDir,
    model: opts.model,
    log: opts.log,
    onDownload: (pct, message) => {
      highest = Math.max(highest, pct);
      opts.onProgress(highest, message);
    }
  });
  opts.onProgress(100, "Model ready");
  return { modelId };
}
let cachedLanguage = null;
async function detectLanguage(transcriber, samples, log) {
  const model = transcriber.model;
  const processor = transcriber.processor;
  const config = model?.generation_config;
  const langToId = config?.lang_to_id;
  const startToken = config?.decoder_start_token_id;
  if (!model?.generate || typeof processor !== "function" || !langToId || startToken == null) return null;
  try {
    const clip = samples.length > DETECT_SAMPLES ? samples.subarray(0, DETECT_SAMPLES) : samples;
    const inputs = await processor(clip);
    const out = await model.generate({ ...inputs, decoder_input_ids: [[startToken]], max_new_tokens: 1 });
    const tokens = out?.sequences ?? out;
    const ids = Array.from(tokens?.data ?? []).map(Number);
    const byId = new Map(Object.entries(langToId).map(([token, id]) => [Number(id), token]));
    for (const id of ids) {
      const token = byId.get(id);
      if (token) return token.replace(/[<>|]/g, "");
    }
    return null;
  } catch (err) {
    log(`Language detection failed (${err.message.split("\n")[0]}); assuming English.`);
    return null;
  }
}
const DETECT_SAMPLES = 30 * 16e3;
async function detectSpokenLanguage(o) {
  const load = (accelerator) => loadWhisperPipeline({ modelsDir: o.modelsDir, model: o.model, accelerator, log: o.log, onDownload: () => void 0 });
  const { transcriber } = await load(o.accelerator ?? "cpu").catch(() => load("cpu"));
  return detectLanguage(transcriber, o.samples, o.log);
}
async function transcribeLocal(opts) {
  opts.onProgress(0, `Loading Whisper model (${opts.model})…`);
  const load = async (accelerator) => loadWhisperPipeline({
    modelsDir: opts.modelsDir,
    model: opts.model,
    accelerator,
    log: opts.log,
    onDownload: (pct, message) => opts.onProgress(Math.min(9, pct * 0.09), message)
  });
  let loaded;
  try {
    loaded = await load(opts.accelerator ?? "cpu");
  } catch (err) {
    if (!opts.accelerator || opts.accelerator === "cpu") throw err;
    opts.log(`${opts.accelerator} could not run this model (${err.message.split("\n")[0]}); falling back to the CPU.`);
    loaded = await load("cpu");
  }
  const { transcriber, modelId } = loaded;
  const audio = opts.samples ?? await readPcmF32(opts.pcmPath);
  let language = opts.language;
  if (language === "auto") {
    const key2 = `${opts.modelsDir}|${opts.model}`;
    if (cachedLanguage?.key === key2) {
      language = cachedLanguage.value;
    } else {
      opts.onProgress(10, "Detecting the language…");
      const detected = await detectLanguage(transcriber, audio, opts.log);
      if (detected) {
        language = detected;
        cachedLanguage = { key: key2, value: detected };
        opts.log(`Detected language: ${detected}`);
      }
    }
  }
  if ((language === "hi" || language === "ur") && opts.model !== "large") {
    opts.log(`The ${opts.model} model is not reliable for ${language === "hi" ? "Hindi" : "Urdu"}; the Large model is. Choose it in Settings → Speech for this kind of video.`);
  }
  opts.onProgress(10, "Transcribing…");
  const SR = 16e3;
  const WINDOW = 20 * 60 * SR;
  const OVERLAP = 12 * SR;
  const EDGE_GUARD = 4;
  const chunks = [];
  let offset = 0;
  const total = audio.length;
  let lastEnd = 0;
  const totalSec = total / SR;
  while (offset < total) {
    if (opts.signal?.aborted) throw new Error("Cancelled");
    const end = Math.min(total, offset + WINDOW);
    const isLast = end >= total;
    const slice = audio.subarray(offset, end);
    const base = offset / SR;
    const sliceSec = slice.length / SR;
    const pieces = sliceSec <= 30 ? 1 : Math.ceil((sliceSec - 30) / 20) + 1;
    const genOpts = {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5
    };
    if (language !== "auto") {
      genOpts.language = language;
      genOpts.task = "transcribe";
    }
    const out = await countPieces(transcriber, (done) => {
      const processed = base + Math.min(done, pieces) / pieces * sliceSec;
      const pct = 10 + processed / totalSec * 88;
      opts.onProgress(Math.min(98, pct), `Transcribing… ${fmtMin(processed)} / ${fmtMin(totalSec)}`);
    }, () => transcriber(slice, genOpts));
    const wordChunks = out.chunks ?? [];
    const windowEndSec = end / SR;
    for (const c of wordChunks) {
      const s = base + (c.timestamp[0] ?? 0);
      const e = base + (c.timestamp[1] ?? c.timestamp[0] ?? 0);
      if (!c.text.trim()) continue;
      if (s < lastEnd - 0.05) continue;
      if (!isLast && e > windowEndSec - EDGE_GUARD) continue;
      chunks.push({ text: c.text, timestamp: [s, e] });
    }
    if (chunks.length) lastEnd = chunks[chunks.length - 1].timestamp[1] ?? lastEnd;
    if (isLast) break;
    offset = end - OVERLAP;
  }
  const heard = toWords(chunks, 0);
  const repaired = await repairLoops(heard, audio, language, transcriber, opts);
  const piles = dropPileUps(dropAnnotations(repaired));
  const raw = piles.words;
  if (piles.dropped || piles.spread) {
    opts.log(`Removed ${piles.dropped} words Whisper wrote twice where its pieces join${piles.spread ? `, re-timed ${piles.spread}` : ""}.`);
  }
  const aligned = alignToAudio(raw, audio, SR);
  const words = aligned.words;
  if (aligned.lag > 0.02) {
    opts.log(`Captions moved ${Math.round(aligned.lag * 1e3)} ms earlier: that is how late this model's word times were against the audio.`);
  }
  opts.onProgress(100, "Transcription complete");
  const segments = buildSegments(words);
  return {
    language,
    duration: opts.duration,
    segments,
    words,
    provider: "local",
    model: modelId.split("/").pop() ?? modelId
  };
}
async function countPieces(transcriber, onPiece, work) {
  const model = transcriber.model;
  const own = model && Object.prototype.hasOwnProperty.call(model, "generate") ? model.generate : void 0;
  const original = model?.generate;
  if (!model || typeof original !== "function") return work();
  let done = 0;
  model.generate = (async (o) => {
    const r = await original.call(model, o);
    onPiece(++done);
    return r;
  });
  try {
    return await work();
  } finally {
    if (own) model.generate = own;
    else delete model.generate;
  }
}
function toWords(chunks, offset) {
  return chunks.map((c) => ({
    text: c.text.trim(),
    start: round(offset + c.timestamp[0]),
    end: round(offset + Math.max(c.timestamp[0] + 0.05, c.timestamp[1] ?? c.timestamp[0] + 0.3))
  })).filter((w) => w.text.length > 0);
}
async function repairLoops(words, audio, language, transcriber, opts) {
  const SR = 16e3;
  const duration = audio.length / SR;
  const spans = loopedSpans(words, duration);
  if (!spans.length) return words;
  const minutes = Math.ceil(duration / LOOP_SPAN);
  if (spans.length >= 3 && spans.length > minutes / 2) {
    opts.log(`${spans.length} of ${minutes} minutes repeat the same words over and over: this model cannot transcribe this audio well. Repeated words are kept once; the Large model is the one to try.`);
    return spans.reduce((out2, at) => spliceWords(out2, at, at + LOOP_SPAN, collapseRuns(out2.filter((w) => w.start >= at && w.start < at + LOOP_SPAN))), words);
  }
  opts.log(`${spans.length} minute(s) of the transcript repeat the same words over and over; decoding them again.`);
  const base = { return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5 };
  if (language !== "auto") Object.assign(base, { language, task: "transcribe" });
  let out = words;
  for (const [i, at] of spans.entries()) {
    if (opts.signal?.aborted) throw new Error("Cancelled");
    opts.onProgress(98, `Fixing a repeated passage (${i + 1} of ${spans.length})…`);
    const from = Math.max(0, at - 2);
    const slice = audio.subarray(Math.round(from * SR), Math.round(Math.min(duration, at + LOOP_SPAN + 2) * SR));
    let fixed = null;
    let how = "";
    for (const attempt of [{ label: "decoded on its own", options: {} }, ...LOOP_RETRIES]) {
      const res = await transcriber(slice, { ...base, ...attempt.options });
      if (!looksLooped(res.text)) {
        fixed = toWords(res.chunks ?? [], from);
        how = attempt.label;
        break;
      }
    }
    const kept = fixed ?? collapseRuns(out.filter((w) => w.start >= at && w.start < at + LOOP_SPAN));
    out = spliceWords(out, at, at + LOOP_SPAN, kept);
    opts.log(fixed ? `  ${fmtMin(at)}: fixed (${how})` : `  ${fmtMin(at)}: still repeating after every retry; kept each repeated word once`);
  }
  return out;
}
function round(n) {
  return Math.round(n * 1e3) / 1e3;
}
function fmtMin(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
async function probeAcceleration(opts) {
  const model = opts.model ?? "tiny";
  const seconds = opts.seconds ?? 8;
  const sampleRate = 16e3;
  const audio = new Float32Array(seconds * sampleRate);
  for (let i = 0; i < audio.length; i++) {
    const t = i / sampleRate;
    audio[i] = 0.22 * Math.sin(2 * Math.PI * (180 + 120 * Math.sin(t * 1.7)) * t) * (0.6 + 0.4 * Math.sin(t * 3.1));
  }
  const time = async (accelerator) => {
    const { transcriber } = await loadWhisperPipeline({
      modelsDir: opts.modelsDir,
      model,
      accelerator,
      log: () => void 0,
      onDownload: (pct, message) => opts.onProgress?.(pct * 0.5, message)
    });
    const started = Date.now();
    await transcriber(audio, { return_timestamps: "word", chunk_length_s: 30, language: "en", task: "transcribe" });
    return Date.now() - started;
  };
  opts.onProgress?.(55, "Timing the processor…");
  const cpuMs = await time("cpu");
  opts.log(`Speed test: CPU ${cpuMs} ms`);
  const gpuBackend = platformAccelerator();
  let gpuMs = null;
  let gpuError;
  if (gpuBackend) {
    opts.onProgress?.(80, "Timing the graphics card…");
    try {
      gpuMs = await time(gpuBackend);
      opts.log(`Speed test: ${gpuBackend} ${gpuMs} ms`);
    } catch (err) {
      gpuError = err.message.split("\n")[0].slice(0, 160);
      opts.log(`Speed test: ${gpuBackend} could not run (${gpuError})`);
    }
  }
  opts.onProgress?.(100, "Speed test done");
  const backend = gpuMs !== null && gpuBackend && gpuMs < cpuMs * 0.9 ? gpuBackend : "cpu";
  return { backend, cpuMs, gpuMs, gpuBackend, gpuError, testedAt: Date.now() };
}
exports.CAPTION_FONT_FILES = CAPTION_FONT_FILES;
exports.CAPTION_GROUPS = CAPTION_GROUPS;
exports.CAPTION_PRESETS = CAPTION_PRESETS;
exports.CENTRED_CROP = CENTRED_CROP;
exports.DEFAULT_CAPTION_PRESET = DEFAULT_CAPTION_PRESET;
exports.DEFAULT_JOB_DEFAULTS = DEFAULT_JOB_DEFAULTS;
exports.FRAME_MS = FRAME_MS;
exports.LANGUAGES = LANGUAGES;
exports.LOOP_SPAN = LOOP_SPAN;
exports.MAX_CROP_ZOOM = MAX_CROP_ZOOM;
exports.STAGE_WEIGHTS = STAGE_WEIGHTS;
exports.WHISPER_DTYPES = WHISPER_DTYPES;
exports.WHISPER_MODEL_IDS = WHISPER_MODEL_IDS;
exports.WHISPER_MODEL_INFO = WHISPER_MODEL_INFO;
exports.WHISPER_MODEL_SIZES = WHISPER_MODEL_SIZES;
exports.WRITING_MODEL_AUTO = WRITING_MODEL_AUTO;
exports.alignToAudio = alignToAudio;
exports.alignWords = alignWords;
exports.applyCase = applyCase;
exports.buildSegments = buildSegments;
exports.collapseRuns = collapseRuns;
exports.detectEncoder = detectEncoder;
exports.detectSpokenLanguage = detectSpokenLanguage;
exports.downloadWhisperModel = downloadWhisperModel;
exports.dropAnnotations = dropAnnotations;
exports.dropPileUps = dropPileUps;
exports.escapeFilterPath = escapeFilterPath;
exports.extractAudio = extractAudio;
exports.fallbackEncoders = fallbackEncoders;
exports.findPreset = findPreset;
exports.isAnnotation = isAnnotation;
exports.isCpuEncoder = isCpuEncoder;
exports.lastLines = lastLines;
exports.looksLooped = looksLooped;
exports.loopedSpans = loopedSpans;
exports.loudnessFrames = loudnessFrames;
exports.measureLag = measureLag;
exports.parseProgress = parseProgress;
exports.platformAccelerator = platformAccelerator;
exports.probe = probe;
exports.probeAcceleration = probeAcceleration;
exports.readPcmF32 = readPcmF32;
exports.resolveCaptionPreset = resolveCaptionPreset;
exports.run = run;
exports.sizedEncoderArgs = sizedEncoderArgs;
exports.spliceWords = spliceWords;
exports.thumbnail = thumbnail;
exports.tidy = tidy;
exports.transcribeLocal = transcribeLocal;
exports.voiceRuns = voiceRuns;
exports.whisperWeightFiles = whisperWeightFiles;
