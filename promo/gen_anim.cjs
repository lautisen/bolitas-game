const fs = require('fs');

const W = 1920, H = 1080, FPS = 60, FRAMES = 300;
const CELL = 150, BALL = 110;
const COLS = 5, ROWS = 5;
const GX = (W - COLS * CELL) / 2; // 585
const GY = (H - ROWS * CELL) / 2; // 165

const C = {
  red:    [0.937, 0.267, 0.267, 1],
  blue:   [0.231, 0.510, 0.965, 1],
  yellow: [0.961, 0.620, 0.043, 1],
  green:  [0.063, 0.725, 0.506, 1],
  pink:   [0.925, 0.282, 0.600, 1],
  cyan:   [0.024, 0.714, 0.831, 1],
  purple: [0.545, 0.361, 0.965, 1],
  orange: [0.976, 0.451, 0.094, 1],
};

const GRID = [
  ['red',    'blue',   'yellow', 'green',  'pink'],
  ['yellow', 'blue',   'blue',   'red',    'cyan'],
  ['green',  'blue',   'red',    'yellow', 'purple'],
  ['pink',   'orange', 'yellow', 'green',  'red'],
  ['cyan',   'red',    'green',  'purple', 'orange'],
];

// 4 connected blue balls that pop (L-shape)
const POP = [[0,1],[1,1],[1,2],[2,1]];
const POP_SET = new Set(POP.map(([r,c])=>`${r},${c}`));

// New balls that drop in after pop
const NEW = [
  {row:0,col:1,color:'green'},
  {row:1,col:1,color:'pink'},
  {row:2,col:1,color:'orange'},
  {row:0,col:2,color:'red'},  // yellow at [0,2] falls to [1,2]
];

function center(row, col) {
  return [GX + col*CELL + CELL/2, GY + row*CELL + CELL/2];
}

// Easing helpers — use "e" (legacy) format for max compatibility
const kfL = (t,s,e)  => ({"i":{"x":0.5,"y":0.5},"o":{"x":0.5,"y":0.5},"t":t,"s":s,"e":e});
const kfE = (t,s,e)  => ({"i":{"x":0.42,"y":1.0},"o":{"x":0.58,"y":0.0},"t":t,"s":s,"e":e});
const kfB = (t,s,e)  => ({"i":{"x":0.34,"y":1.56},"o":{"x":0.64,"y":1.0},"t":t,"s":s,"e":e});
const kfO = (t,s,e)  => ({"i":{"x":0.0,"y":1.0},"o":{"x":0.6,"y":0.0},"t":t,"s":s,"e":e});
const kfZ = (t,s)    => ({"t":t,"s":s}); // terminal keyframe

function tr() {
  return {"ty":"tr","p":{"a":0,"k":[0,0]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},
    "r":{"a":0,"k":0},"o":{"a":0,"k":100},"sk":{"a":0,"k":0},"sa":{"a":0,"k":0},"nm":"Transform"};
}

let IND = 1;

function ball(row, col, colorName, isPop) {
  const [cx,cy] = center(row, col);
  const col4 = C[colorName];
  const ind = IND++;
  const lag = (col * 3 + row * 2) % 18;  // drop-in stagger
  const ds = lag, de = lag + 22;
  const HS = [BALL*0.42, BALL*0.28];
  const HP = [-BALL*0.15, -BALL*0.23];

  // Does this ball fall? Only [0,2] yellow falls → row increases by CELL
  const falls = col===2 && row===0 && !isPop;

  let p, s, o;

  if (isPop) {
    p = {"a":1,"k":[kfB(ds,[cx,cy-380,0],[cx,cy,0]), kfZ(300,[cx,cy,0])]};
    s = {"a":1,"k":[
      kfE(ds,[0,0,100],[108,108,100]),
      kfE(de,[108,108,100],[100,100,100]),
      kfL(65,[100,100,100],[120,120,100]),  // pulse 1
      kfL(82,[120,120,100],[100,100,100]),
      kfL(100,[100,100,100],[120,120,100]), // pulse 2
      kfL(118,[120,120,100],[100,100,100]),
      kfE(126,[100,100,100],[165,165,100]), // pop expand
      kfZ(143,[0,0,100])
    ]};
    o = {"a":1,"k":[kfE(ds,[0],[100]),kfZ(130,[100]),kfE(143,[100],[0]),kfZ(300,[0])]};
  } else if (falls) {
    p = {"a":1,"k":[
      kfB(ds,[cx,cy-380,0],[cx,cy,0]),
      kfE(de,[cx,cy,0],[cx,cy,0]),
      kfB(155,[cx,cy,0],[cx,cy+CELL,0]),
      kfZ(300,[cx,cy+CELL,0])
    ]};
    s = {"a":1,"k":[kfE(ds,[0,0,100],[108,108,100]),kfE(de,[108,108,100],[100,100,100]),kfZ(300,[100,100,100])]};
    o = {"a":1,"k":[kfE(ds,[0],[100]),kfZ(300,[100])]};
  } else {
    p = {"a":1,"k":[kfB(ds,[cx,cy-380,0],[cx,cy,0]),kfZ(300,[cx,cy,0])]};
    s = {"a":1,"k":[kfE(ds,[0,0,100],[108,108,100]),kfE(de,[108,108,100],[100,100,100]),kfZ(300,[100,100,100])]};
    o = {"a":1,"k":[kfE(ds,[0],[100]),kfZ(300,[100])]};
  }

  return {
    "ddd":0,"ind":ind,"ty":4,"nm":`Ball ${colorName} R${row}C${col}`,
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{"o":o,"r":{"a":0,"k":0},"p":p,"a":{"a":0,"k":[0,0,0]},"s":s},
    "shapes":[
      // Shadow
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[BALL,BALL]},"p":{"a":0,"k":[7,10]},"nm":"Sh"},
        {"ty":"fl","c":{"a":0,"k":[0,0,0,1]},"o":{"a":0,"k":28},"r":1,"bm":0,"nm":"ShFill"},
        tr()
      ],"nm":"Shadow","bm":0},
      // Body
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[BALL,BALL]},"p":{"a":0,"k":[0,0]},"nm":"Body"},
        {"ty":"fl","c":{"a":0,"k":col4},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"BodyFill"},
        tr()
      ],"nm":"Body","bm":0},
      // Specular highlight (top-left white oval)
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":HS},"p":{"a":0,"k":HP},"nm":"Hl"},
        {"ty":"fl","c":{"a":0,"k":[1,1,1,1]},"o":{"a":0,"k":58},"r":1,"bm":0,"nm":"HlFill"},
        tr()
      ],"nm":"Highlight","bm":0},
      // Rim highlight (bottom, darker)
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[BALL*0.5,BALL*0.15]},"p":{"a":0,"k":[BALL*0.08,BALL*0.32]},"nm":"Rim"},
        {"ty":"fl","c":{"a":0,"k":[0,0,0,1]},"o":{"a":0,"k":18},"r":1,"bm":0,"nm":"RimFill"},
        tr()
      ],"nm":"Rim","bm":0}
    ]
  };
}

function newBall(row, col, colorName, delayOffset) {
  const [cx,cy] = center(row,col);
  const col4 = C[colorName];
  const ind = IND++;
  const ds = 195 + delayOffset, de = ds + 28;
  const HS = [BALL*0.42, BALL*0.28];
  const HP = [-BALL*0.15, -BALL*0.23];
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":`NewBall ${colorName} R${row}C${col}`,
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfE(ds,[0],[100]),kfZ(FRAMES,[100])]},
      "r":{"a":0,"k":0},
      "p":{"a":1,"k":[kfB(ds,[cx,cy-420,0],[cx,cy,0]),kfZ(FRAMES,[cx,cy,0])]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[kfE(ds,[0,0,100],[112,112,100]),kfE(de,[112,112,100],[100,100,100]),kfZ(FRAMES,[100,100,100])]}
    },
    "shapes":[
      {"ty":"gr","it":[{"ty":"el","d":1,"s":{"a":0,"k":[BALL,BALL]},"p":{"a":0,"k":[7,10]},"nm":"Sh"},{"ty":"fl","c":{"a":0,"k":[0,0,0,1]},"o":{"a":0,"k":28},"r":1,"bm":0,"nm":"ShFill"},tr()],"nm":"Shadow","bm":0},
      {"ty":"gr","it":[{"ty":"el","d":1,"s":{"a":0,"k":[BALL,BALL]},"p":{"a":0,"k":[0,0]},"nm":"Body"},{"ty":"fl","c":{"a":0,"k":col4},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"BodyFill"},tr()],"nm":"Body","bm":0},
      {"ty":"gr","it":[{"ty":"el","d":1,"s":{"a":0,"k":HS},"p":{"a":0,"k":HP},"nm":"Hl"},{"ty":"fl","c":{"a":0,"k":[1,1,1,1]},"o":{"a":0,"k":58},"r":1,"bm":0,"nm":"HlFill"},tr()],"nm":"Highlight","bm":0}
    ]
  };
}

function selectionGlow(row, col) {
  const [cx,cy] = center(row,col);
  const ind = IND++;
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":`Glow R${row}C${col}`,
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfE(63,[0],[75]),kfE(82,[75],[25]),kfE(100,[25],[75]),kfE(118,[75],[25]),kfE(130,[25],[0]),kfZ(FRAMES,[0])]},
      "r":{"a":0,"k":0},
      "p":{"a":0,"k":[cx,cy,0]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[kfL(63,[95,95,100],[130,130,100]),kfL(82,[130,130,100],[95,95,100]),kfL(100,[95,95,100],[130,130,100]),kfL(118,[130,130,100],[95,95,100]),kfZ(FRAMES,[95,95,100])]}
    },
    "shapes":[
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[BALL+22,BALL+22]},"p":{"a":0,"k":[0,0]},"nm":"GlowEl"},
        {"ty":"st","c":{"a":0,"k":[1,1,1,1]},"o":{"a":0,"k":100},"w":{"a":0,"k":5},"lc":2,"lj":2,"bm":0,"nm":"GlowSt"},
        tr()
      ],"nm":"GlowGroup","bm":0}
    ]
  };
}

function particle(row, col, idx) {
  const [cx,cy] = center(row,col);
  const ind = IND++;
  const angle = (idx/6)*Math.PI*2;
  const dist = 140;
  const dx = Math.round(Math.cos(angle)*dist);
  const dy = Math.round(Math.sin(angle)*dist);
  const pColors = [[1,1,1,1],C.blue,C.yellow,C.green,C.pink,C.cyan];
  const pc = pColors[idx%6];
  const sz = 10 + (idx%3)*7;
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":`P R${row}C${col} ${idx}`,
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfE(126,[0],[100]),kfE(180,[100],[0]),kfZ(FRAMES,[0])]},
      "r":{"a":0,"k":0},
      "p":{"a":1,"k":[kfO(126,[cx,cy,0],[cx+dx,cy+dy,0]),kfZ(210,[cx+Math.round(dx*1.4),cy+Math.round(dy*1.4),0])]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[kfZ(0,[100,100,100]),kfE(170,[100,100,100],[0,0,100]),kfZ(FRAMES,[0,0,100])]}
    },
    "shapes":[
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[sz,sz]},"p":{"a":0,"k":[0,0]},"nm":"P"},
        {"ty":"fl","c":{"a":0,"k":pc},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"PFill"},
        tr()
      ],"nm":"PGroup","bm":0}
    ]
  };
}

function scoreBurst() {
  const pts = POP.map(([r,c])=>center(r,c));
  const cx = Math.round(pts.reduce((s,p)=>s+p[0],0)/pts.length);
  const cy = Math.round(pts.reduce((s,p)=>s+p[1],0)/pts.length);
  const ind = IND++;
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":"Score Burst",
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfE(143,[0],[100]),kfE(180,[100],[100]),kfE(235,[100],[0]),kfZ(FRAMES,[0])]},
      "r":{"a":0,"k":0},
      "p":{"a":1,"k":[kfB(143,[cx,cy+30,0],[cx,cy-60,0]),kfE(200,[cx,cy-60,0],[cx,cy-190,0]),kfZ(FRAMES,[cx,cy-280,0])]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":1,"k":[kfB(143,[15,15,100],[100,100,100]),kfE(175,[100,100,100],[100,100,100]),kfZ(FRAMES,[88,88,100])]}
    },
    "shapes":[
      // Pill badge
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[200,62]},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":31},"nm":"Pill"},
        {"ty":"fl","c":{"a":0,"k":[0.231,0.510,0.965,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"PillFill"},
        tr()
      ],"nm":"PillGroup","bm":0},
      // Gold sparkle dot right
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[22,22]},"p":{"a":0,"k":[116,0]},"nm":"Sp1"},
        {"ty":"fl","c":{"a":0,"k":[0.961,0.820,0.043,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"SpFill"},
        tr()
      ],"nm":"Sparkle1","bm":0},
      // Gold sparkle dot left
      {"ty":"gr","it":[
        {"ty":"el","d":1,"s":{"a":0,"k":[16,16]},"p":{"a":0,"k":[-116,0]},"nm":"Sp2"},
        {"ty":"fl","c":{"a":0,"k":[0.961,0.820,0.043,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"SpFill2"},
        tr()
      ],"nm":"Sparkle2","bm":0},
      // White shine stripe inside pill
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[180,16]},"p":{"a":0,"k":[0,-10]},"r":{"a":0,"k":8},"nm":"Shine"},
        {"ty":"fl","c":{"a":0,"k":[1,1,1,1]},"o":{"a":0,"k":20},"r":1,"bm":0,"nm":"ShineFill"},
        tr()
      ],"nm":"Shine","bm":0}
    ]
  };
}

function popFlash() {
  const ind = IND++;
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":"Pop Flash",
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":1,"k":[kfZ(0,[0]),kfE(126,[0],[0]),kfE(134,[0],[35]),kfE(148,[35],[0]),kfZ(FRAMES,[0])]},
      "r":{"a":0,"k":0},
      "p":{"a":0,"k":[W/2,H/2,0]},
      "a":{"a":0,"k":[0,0,0]},
      "s":{"a":0,"k":[100,100,100]}
    },
    "shapes":[
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[W,H]},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":0},"nm":"Flash"},
        {"ty":"fl","c":{"a":0,"k":[0.231,0.510,0.965,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"FlashFill"},
        tr()
      ],"nm":"FlashGroup","bm":0}
    ]
  };
}

function gridPanel() {
  const ind = IND++;
  const GW = COLS*CELL, GH = ROWS*CELL;
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":"Grid Panel",
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":0,"k":100},"r":{"a":0,"k":0},
      "p":{"a":0,"k":[W/2,H/2,0]},"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}
    },
    "shapes":[
      // Outer card shadow
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[GW+40,GH+40]},"p":{"a":0,"k":[0,8]},"r":{"a":0,"k":16},"nm":"CardShadow"},
        {"ty":"fl","c":{"a":0,"k":[0,0,0,1]},"o":{"a":0,"k":40},"r":1,"bm":0,"nm":"CardShadowFill"},
        tr()
      ],"nm":"CardShadow","bm":0},
      // Card body
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[GW+30,GH+30]},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":14},"nm":"Card"},
        {"ty":"fl","c":{"a":0,"k":[0.118,0.161,0.235,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"CardFill"},
        tr()
      ],"nm":"Card","bm":0},
      // Subtle top edge highlight
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[GW+30,3]},"p":{"a":0,"k":[0,-(GH+30)/2]},"r":{"a":0,"k":0},"nm":"TopEdge"},
        {"ty":"fl","c":{"a":0,"k":[1,1,1,1]},"o":{"a":0,"k":8},"r":1,"bm":0,"nm":"TopEdgeFill"},
        tr()
      ],"nm":"TopEdge","bm":0}
    ]
  };
}

function background() {
  const ind = IND++;
  return {
    "ddd":0,"ind":ind,"ty":4,"nm":"Background",
    "sr":1,"st":0,"ip":0,"op":FRAMES,
    "ks":{
      "o":{"a":0,"k":100},"r":{"a":0,"k":0},
      "p":{"a":0,"k":[W/2,H/2,0]},"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}
    },
    "shapes":[
      {"ty":"gr","it":[
        {"ty":"rc","d":1,"s":{"a":0,"k":[W,H]},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":0},"nm":"BG"},
        {"ty":"fl","c":{"a":0,"k":[0.059,0.090,0.165,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"BGFill"},
        tr()
      ],"nm":"BGGroup","bm":0}
    ]
  };
}

// ── Build layers (top → bottom) ──────────────────────────────────────
const layers = [];

layers.push(scoreBurst());
layers.push(popFlash());

// Particles
for (const [r,c] of POP)
  for (let i=0;i<6;i++) layers.push(particle(r,c,i));

// Selection glows
for (const [r,c] of POP)
  layers.push(selectionGlow(r,c));

// New balls
NEW.forEach((nb,i) => layers.push(newBall(nb.row,nb.col,nb.color,i*8)));

// All 25 original balls
for (let r=0;r<ROWS;r++)
  for (let c=0;c<COLS;c++)
    layers.push(ball(r,c,GRID[r][c],POP_SET.has(`${r},${c}`)));

layers.push(gridPanel());
layers.push(background());

const out = {
  "v":"5.7.1","fr":FPS,"ip":0,"op":FRAMES,"w":W,"h":H,
  "nm":"Gloop Promo 60fps","ddd":0,"assets":[],
  "layers":layers
};

const path = require('path').join(__dirname, 'gloop_promo_animation.json');
fs.writeFileSync(path, JSON.stringify(out));
const kb = (fs.statSync(path).size/1024).toFixed(1);
console.log(`Done — ${layers.length} layers, ${kb} KB`);
