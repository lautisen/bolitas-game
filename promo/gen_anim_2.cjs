const fs = require('fs');

const W = 1920, H = 1080, FPS = 60, FRAMES = 300;
const FONT_SIZE = 300;
const Y_TEXT = 650;       // text baseline — visually centers caps near y=540
const SPACING = 260;      // px between letter centers
const STAGGER = 24;       // frames between each letter pop

const LETTERS = [
  { char: 'G', fc: [0.231, 0.510, 0.965] },  // blue
  { char: 'L', fc: [0.937, 0.267, 0.267] },  // red
  { char: 'O', fc: [0.961, 0.620, 0.043] },  // yellow
  { char: 'O', fc: [0.063, 0.725, 0.506] },  // green
  { char: 'P', fc: [0.925, 0.282, 0.600] },  // pink
];

// Letter X centers: [440, 700, 960, 1220, 1480]
const XS = LETTERS.map((_, i) => Math.round(W/2 + (i - (LETTERS.length-1)/2) * SPACING));

// Vertical center of capital letters (for glow/particle origin)
const Y_CAP = Y_TEXT - Math.round(FONT_SIZE * 0.355);

// Easing keyframe helpers — use legacy "e" format for max compat
const kfB = (t,s,e) => ({"i":{"x":0.34,"y":1.56},"o":{"x":0.64,"y":1.0},"t":t,"s":s,"e":e});
const kfE = (t,s,e) => ({"i":{"x":0.42,"y":1.0}, "o":{"x":0.58,"y":0.0},"t":t,"s":s,"e":e});
const kfO = (t,s,e) => ({"i":{"x":0.0, "y":1.0}, "o":{"x":0.60,"y":0.0},"t":t,"s":s,"e":e});
const kfZ = (t,s)   => ({"t":t,"s":s});

let IND = 1;

function tr() {
  return {"ty":"tr","p":{"a":0,"k":[0,0]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},
    "r":{"a":0,"k":0},"o":{"a":0,"k":100},"sk":{"a":0,"k":0},"sa":{"a":0,"k":0},"nm":"Transform"};
}

// ── Background ────────────────────────────────────────────────────────────────
function bgLayer() {
  return {
    "ddd":0,"ind":IND++,"ty":4,"nm":"BG","sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{"o":{"a":0,"k":100},"r":{"a":0,"k":0},"p":{"a":0,"k":[W/2,H/2,0]},
      "a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}},
    "shapes":[{"ty":"gr","it":[
      {"ty":"rc","d":1,"s":{"a":0,"k":[W,H]},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":0},"nm":"R"},
      {"ty":"fl","c":{"a":0,"k":[0.059,0.090,0.165,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"F"},
      tr()
    ],"nm":"G","bm":0}]
  };
}

// ── Glow burst (circle that expands and fades when letter pops) ───────────────
function glowLayer(x, y, fc, popF) {
  const fc4 = [...fc, 1];
  return {
    "ddd":0,"ind":IND++,"ty":4,"nm":"Glow","sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfO(popF,[0],[55]),kfE(popF+24,[55],[0]),kfZ(FRAMES,[0])]},
      "r":{"a":0,"k":0},"p":{"a":0,"k":[x,y,0]},"a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[kfZ(0,[5,5,100]),kfO(popF,[5,5,100],[230,230,100]),kfZ(FRAMES,[230,230,100])]}
    },
    "shapes":[{"ty":"gr","it":[
      {"ty":"el","d":1,"s":{"a":0,"k":[200,200]},"p":{"a":0,"k":[0,0]},"nm":"E"},
      {"ty":"fl","c":{"a":0,"k":fc4},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"F"},
      tr()
    ],"nm":"G","bm":0}]
  };
}

// ── Particle dot ──────────────────────────────────────────────────────────────
function particleLayer(x, y, fc, popF, idx, n) {
  const angle = (idx / n) * Math.PI * 2;
  const d = 165;
  const dx = Math.round(Math.cos(angle) * d);
  const dy = Math.round(Math.sin(angle) * d);
  const fc4 = [...fc, 1];
  const sz = 10 + (idx % 3) * 8;
  return {
    "ddd":0,"ind":IND++,"ty":4,"nm":`P${idx}`,"sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfO(popF,[0],[100]),kfE(popF+30,[100],[0]),kfZ(FRAMES,[0])]},
      "r":{"a":0,"k":0},
      "p":{"a":1,"k":[kfO(popF,[x,y,0],[x+dx,y+dy,0]),kfZ(FRAMES,[x+Math.round(dx*1.5),y+Math.round(dy*1.5),0])]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[kfZ(0,[100,100,100]),kfE(popF+30,[100,100,100],[0,0,100]),kfZ(FRAMES,[0,0,100])]}
    },
    "shapes":[{"ty":"gr","it":[
      {"ty":"el","d":1,"s":{"a":0,"k":[sz,sz]},"p":{"a":0,"k":[0,0]},"nm":"E"},
      {"ty":"fl","c":{"a":0,"k":fc4},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"F"},
      tr()
    ],"nm":"G","bm":0}]
  };
}

// ── Letter text layer ─────────────────────────────────────────────────────────
// NOTE: In Lottie text documents — "t" = text string, "s" = font size
function letterLayer(char, x, fc, idx) {
  const popF  = idx * STAGGER;
  const exitF = 222 + (LETTERS.length - 1 - idx) * 14; // reverse stagger exit
  const y = Y_TEXT;

  return {
    "ddd":0,"ind":IND++,"ty":5,"nm":char,"sr":1,"st":0,"ip":0,"op":FRAMES,"bm":0,
    "ks":{
      "o":{"a":1,"k":[
        kfZ(0,[0]),
        kfO(popF,   [0],   [100]),
        kfE(exitF,  [100], [100]),
        kfE(exitF+20,[100],[0]),
        kfZ(FRAMES, [0])
      ]},
      "r":{"a":0,"k":0},
      "p":{"a":1,"k":[
        kfB(popF,    [x, y-215, 0], [x, y+30, 0]),   // drop in, overshoot down
        kfB(popF+17, [x, y+30,  0], [x, y-15, 0]),   // bounce up
        kfB(popF+26, [x, y-15,  0], [x, y,    0]),   // settle
        kfB(165,     [x, y,     0], [x, y-40, 0]),   // sync bounce
        kfB(180,     [x, y-40,  0], [x, y,    0]),
        kfZ(FRAMES,  [x, y,     0])
      ]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[
        kfZ(0,        [0,   0,   100]),
        kfB(popF,     [0,   0,   100], [155, 155, 100]),  // overshoot big
        kfB(popF+13,  [155, 155, 100], [82,  82,  100]),  // undershoot
        kfB(popF+21,  [82,  82,  100], [110, 110, 100]),  // overshoot small
        kfB(popF+29,  [110, 110, 100], [100, 100, 100]),  // settle
        kfB(165,      [100, 100, 100], [130, 130, 100]),  // sync pulse
        kfB(180,      [130, 130, 100], [100, 100, 100]),
        kfB(exitF,    [100, 100, 100], [148, 148, 100]),  // exit pop
        kfZ(exitF+18, [0,   0,   100])
      ]}
    },
    "t":{
      "d":{"k":[{
        "s":{
          "t": char,           // text string  (t = text in Lottie spec)
          "f": "Arial-BoldMT",
          "s": FONT_SIZE,      // font size    (s = size in Lottie spec)
          "j": 2,              // center justified
          "tr": 0,
          "lh": Math.round(FONT_SIZE * 1.2),
          "ls": 0,
          "fc": fc,
          "sc": [1,1,1],
          "sw": 0,
          "of": false,
          "ca": 0
        },
        "t": 0
      }]},
      "m":{"g":1,"a":{"a":0,"k":[0,0]}},
      "a":[]
    }
  };
}

// ── Assemble (first = topmost layer) ─────────────────────────────────────────
const layers = [];

// Letters on top
for (let i = 0; i < LETTERS.length; i++)
  layers.push(letterLayer(LETTERS[i].char, XS[i], LETTERS[i].fc, i));

// Glow bursts behind letters
for (let i = 0; i < LETTERS.length; i++)
  layers.push(glowLayer(XS[i], Y_CAP, LETTERS[i].fc, i * STAGGER));

// Particles behind glows
const N = 6;
for (let i = 0; i < LETTERS.length; i++)
  for (let p = 0; p < N; p++)
    layers.push(particleLayer(XS[i], Y_CAP, LETTERS[i].fc, i * STAGGER, p, N));

// Background last
layers.push(bgLayer());

const out = {
  "v":"5.7.1","fr":FPS,"ip":0,"op":FRAMES,"w":W,"h":H,
  "nm":"GLOOP Letters Pop","ddd":0,"assets":[],
  "fonts":{"list":[{
    "ascent":75.9994506835938,"fClass":"","fFamily":"Arial","fName":"Arial-BoldMT",
    "fPath":"","fSearch":"","fStyle":"Bold","fWeight":"","origin":0
  }]},
  "layers":layers
};

const path = './gloop_promo_animation_2.json';
fs.writeFileSync(path, JSON.stringify(out));
const kb = (fs.statSync(path).size/1024).toFixed(1);
console.log(`Done — ${layers.length} layers, ${kb} KB`);
