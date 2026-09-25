const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SPLAT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uField;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  float g = exp(-dot(p, p) / radius);
  vec4 f = texture(uField, vUv);
  float w = clamp(g * color.x, 0.0, 1.0);
  fragColor = vec4(
    f.r + g * color.x,
    mix(f.g, color.y, w),
    mix(f.b, color.z, w),
    1.0
  );
}`;

const SIM = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uField;
uniform vec2 texelSize;
uniform float dt;
uniform float friction;
uniform float spread;
uniform float decay;
uniform float wobble;
uniform float grain;
uniform float time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  return noise(p) * 0.55 + noise(p * 2.6) * 0.3 + noise(p * 6.3) * 0.15;
}

void main() {
  vec2 vel = texture(uField, vUv).gb;
  vec2 coord = vUv - vel * dt;
  vec4 s = texture(uField, coord);
  float t = time * 0.3;
  vec2 warp = (vec2(
    fbm(vUv * 11.0 + t),
    fbm(vUv * 11.0 + 37.2 - t)
  ) - 0.5) * 2.0 * wobble * texelSize;
  vec4 nL = texture(uField, coord + vec2(-texelSize.x, 0.0) + warp);
  vec4 nR = texture(uField, coord + vec2(texelSize.x, 0.0) + warp);
  vec4 nT = texture(uField, coord + vec2(0.0, texelSize.y) + warp);
  vec4 nB = texture(uField, coord + vec2(0.0, -texelSize.y) + warp);
  float avgD = (nL.r + nR.r + nT.r + nB.r) * 0.25;
  vec2 avgV = (nL.gb + nR.gb + nT.gb + nB.gb) * 0.25;
  float d = mix(s.r, avgD, spread);
  vec2 v = mix(s.gb, avgV, spread * 0.5);
  float g = fbm(vUv * 15.0 + 5.1 + t * 0.6);
  d *= 1.0 / (1.0 + (decay + grain * decay * (g - 0.5) * 2.0) * dt);
  v *= 1.0 / (1.0 + friction * dt);
  fragColor = vec4(max(d, 0.0), v, 1.0);
}`;

const DRAW = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uField;
uniform sampler2D uPaper;
uniform vec2 uPaperSize;
uniform vec2 uViewSize;
uniform vec2 edge;
uniform float bottomFade;
uniform float time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  return noise(p) * 0.55 + noise(p * 2.6) * 0.3 + noise(p * 6.3) * 0.15;
}

void main() {
  float d = texture(uField, vUv).r;
  float n = fbm(vec2(vUv.x * 9.0, time * 0.25));
  float localFade = bottomFade * (0.35 + n * 1.3);
  d *= smoothstep(0.0, localFade, vUv.y);
        float alpha = 1.0 - smoothstep(edge.x, edge.y, d);
        float imgAspect = uPaperSize.x / uPaperSize.y;
        float viewAspect = uViewSize.x / uViewSize.y;
        vec2 cover = vec2(1.0);
        if (viewAspect > imgAspect) cover.y = imgAspect / viewAspect;
        else cover.x = viewAspect / imgAspect;
        vec2 paperUv = (vUv - 0.5) * cover + 0.5;
        vec3 paper = texture(uPaper, paperUv).rgb;
        fragColor = vec4(paper * alpha, alpha);
      }`;

const FLUID = {
  radius: 0.004,
  density: 3.5,
  friction: 3,
  spread: 0.79,
  decay: 1.5,
  wobble: 2.6,
  grain: 0.7,
  edge: [0.39, 0.4],
  bottomFade: 0.05,
  velocityScale: 1.6,
  velocityClamp: 4,
};

function must(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

function loadJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} failed`);
    return response.json();
  });
}

function watchImage(img, src) {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed: ${src}`));
    img.src = src;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function simSize(width, height) {
  const aspect = width / Math.max(height, 1);
  const base = 512;
  const max = 1440;
  if (aspect >= 1) return [Math.min(Math.round(base * aspect), max), base];
  return [base, Math.min(Math.round(base / aspect), max)];
}

function createFluid(canvas, paperImage) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) throw new Error("WebGL2 is required for the reveal");
  if (!gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("Float render targets are required for the reveal");
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader failed");
    }
    return shader;
  }

  function program(source) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, source));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "Program failed");
    }
    return prog;
  }

  function locations(prog, names) {
    const out = {};
    names.forEach((name) => {
      const loc = gl.getUniformLocation(prog, name);
      if (loc === null) throw new Error(`Missing uniform ${name}`);
      out[name] = loc;
    });
    return out;
  }

  const splatProg = program(SPLAT);
  const simProg = program(SIM);
  const drawProg = program(DRAW);
  const splatLoc = locations(splatProg, ["uField", "aspectRatio", "color", "point", "radius"]);
  const simLoc = locations(simProg, [
    "uField", "texelSize", "dt", "friction", "spread", "decay", "wobble", "grain", "time",
  ]);
  const drawLoc = locations(drawProg, ["uField", "uPaper", "uPaperSize", "uViewSize", "edge", "bottomFade", "time"]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);

  const paperTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, paperTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paperImage);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  let read = null;
  let write = null;
  let simW = 0;
  let simH = 0;

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Reveal buffer incomplete");
    }
    return { tex, fbo, w, h };
  }

  function drop(target) {
    if (!target) return;
    gl.deleteTexture(target.tex);
    gl.deleteFramebuffer(target.fbo);
  }

  function bindTarget(target) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
    const [sw, sh] = simSize(w, h);
    if (sw === simW && sh === simH) return;
    drop(read);
    drop(write);
    read = makeTarget(sw, sh);
    write = makeTarget(sw, sh);
    simW = sw;
    simH = sh;
  }

  function splat(x, y, vx, vy) {
    gl.useProgram(splatProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(splatLoc.uField, 0);
    gl.uniform1f(splatLoc.aspectRatio, canvas.width / Math.max(canvas.height, 1));
    gl.uniform2f(splatLoc.point, x, y);
    gl.uniform3f(splatLoc.color, FLUID.density, vx, vy);
    gl.uniform1f(splatLoc.radius, FLUID.radius);
    bindTarget(write);
    const previous = read;
    read = write;
    write = previous;
  }

  function step(dt, time) {
    gl.useProgram(simProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(simLoc.uField, 0);
    gl.uniform2f(simLoc.texelSize, 1 / simW, 1 / simH);
    gl.uniform1f(simLoc.dt, dt);
    gl.uniform1f(simLoc.friction, FLUID.friction);
    gl.uniform1f(simLoc.spread, FLUID.spread);
    gl.uniform1f(simLoc.decay, FLUID.decay);
    gl.uniform1f(simLoc.wobble, FLUID.wobble);
    gl.uniform1f(simLoc.grain, FLUID.grain);
    gl.uniform1f(simLoc.time, time);
    bindTarget(write);
    const previous = read;
    read = write;
    write = previous;
  }

  function present(time) {
    gl.useProgram(drawProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(drawLoc.uField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paperTex);
    gl.uniform1i(drawLoc.uPaper, 1);
    gl.uniform2f(drawLoc.uPaperSize, paperImage.naturalWidth, paperImage.naturalHeight);
    gl.uniform2f(drawLoc.uViewSize, canvas.width, canvas.height);
    gl.uniform2f(drawLoc.edge, FLUID.edge[0], FLUID.edge[1]);
    gl.uniform1f(drawLoc.bottomFade, FLUID.bottomFade);
    gl.uniform1f(drawLoc.time, time);
    bindTarget(null);
  }

  resize();
  return { resize, splat, step, present };
}

function placeOrbit(figures, seconds) {
  const stage = figures[0].parentElement.getBoundingClientRect();
  const count = figures.length;
  const radiusX = Math.min(stage.width * 0.46, 520);
  const radiusY = Math.min(window.innerHeight * 0.3, 280);
  const rig = seconds * 0.12;
  const travel = seconds * 0.28;
  figures.forEach((figure, index) => {
    const phase = travel + (index / count) * Math.PI * 2;
    const x0 = Math.sin(phase) * radiusX;
    const y0 = Math.cos(phase) * radiusY;
    const x = Math.cos(rig) * x0 - Math.sin(rig) * y0 * 0.25;
    const y = Math.sin(rig) * x0 * 0.25 + Math.cos(rig) * y0;
    const front = ((Math.cos(phase) + 1) / 2) ** 1.3;
    const scale = 0.46 + 0.54 * front;
    const blur = (1 - front) * 12;
    const brightness = 0.3 + 0.7 * front;
    figure.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
    figure.style.filter = `blur(${blur}px) brightness(${brightness})`;
    figure.style.zIndex = String(Math.round(1000 * front));
  });
}

function spherePoint(index, count) {
  const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * Math.PI * (3 - Math.sqrt(5));
  return { x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring };
}

function rotatePoint(point, rx, ry) {
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x = point.x * cosY + point.z * sinY;
  const z0 = -point.x * sinY + point.z * cosY;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  return {
    x,
    y: point.y * cosX - z0 * sinX,
    z: point.y * sinX + z0 * cosX,
  };
}

function mountGlobe(sphere, pieces) {
  const distance = 250;
  const points = pieces.map((piece, index) => {
    const point = spherePoint(index, pieces.length);
    const figure = document.createElement("figure");
    figure.className = "plane";
    const img = document.createElement("img");
    img.alt = piece.title;
    img.draggable = false;
    img.src = piece.still;
    figure.append(img);
    sphere.append(figure);
    return { piece, point, figure };
  });

  let rx = -0.4;
  let ry = 0.6;
  let vx = 0;
  let vy = 0;
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  const name = must("#globe-name");
  const globe = must("#globe");

  function frontPiece() {
    return points.reduce((best, entry) => {
      return rotatePoint(entry.point, rx, ry).z > rotatePoint(best.point, rx, ry).z ? entry : best;
    }).piece;
  }

  function apply() {
    let front = points[0];
    let frontZ = -Infinity;
    points.forEach((entry) => {
      const placed = rotatePoint(entry.point, rx, ry);
      const depth = (placed.z + 1) / 2;
      entry.figure.style.transform = `translate(-50%, -50%) translate3d(${placed.x * distance}px, ${placed.y * distance}px, ${placed.z * distance}px)`;
      entry.figure.style.zIndex = String(Math.round(1000 + placed.z * 100));
      entry.figure.style.opacity = String(0.4 + 0.6 * depth);
      if (placed.z > frontZ) {
        frontZ = placed.z;
        front = entry;
      }
    });
    name.textContent = front.piece.title;
  }

  globe.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    vx = 0;
    vy = 0;
    globe.classList.add("is-grabbing");
    globe.setPointerCapture(event.pointerId);
  });
  globe.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    vy = dx * 0.008;
    vx = dy * 0.006;
    ry += vy;
    rx = clamp(rx + vx, -1.15, 1.15);
    lastX = event.clientX;
    lastY = event.clientY;
    apply();
  });
  function release(event) {
    if (!dragging) return;
    dragging = false;
    globe.classList.remove("is-grabbing");
    if (moved < 8) {
      const piece = frontPiece();
      window.open(piece.watchUrl, "_blank", "noopener");
    }
    if (globe.hasPointerCapture(event.pointerId)) globe.releasePointerCapture(event.pointerId);
  }
  globe.addEventListener("pointerup", release);
  globe.addEventListener("pointercancel", release);

  apply();
  return () => {
    if (dragging) return;
    vy *= 0.94;
    vx *= 0.94;
    if (Math.abs(vy) + Math.abs(vx) < 0.02) return;
    ry += vy;
    rx = clamp(rx + vx, -1.15, 1.15);
    apply();
  };
}

function londonClock() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    hour12: false,
  }).format(new Date());
}

const GALLERY_SPOTS = [
  { x: 27, y: 70, w: 22, h: 28, r: 3, z: 5 },
  { x: 1, y: 2, w: 23, h: 32, r: -6, z: 5 },
  { x: 75, y: 2, w: 23, h: 30, r: 6, z: 5 },
  { x: 76, y: 36, w: 22, h: 32, r: 5, z: 5 },
  { x: 0, y: 36, w: 23, h: 32, r: -5, z: 5 },
  { x: 74, y: 66, w: 23, h: 32, r: 4, z: 5 },
  { x: 2, y: 68, w: 23, h: 32, r: -4, z: 5 },
  { x: 30, y: 24, w: 40, h: 48, r: -1.5, z: 8 },
  { x: 24, y: 0, w: 22, h: 28, r: -3, z: 4 },
  { x: 50, y: 0, w: 22, h: 22, r: 3, z: 4 },
  { x: 52, y: 68, w: 22, h: 28, r: -3, z: 5 },
];

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function mountName(reduce) {
  const mark = document.querySelector(".watermark");
  const left = mark.querySelector("span:first-child");
  const right = mark.querySelector("span:last-child");
  const apply = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const remaining = max - window.scrollY;
    const travel = window.innerHeight * 0.42;
    let amount = max <= 0 ? 1 : clamp(1 - remaining / travel, 0, 1);
    if (reduce) amount = amount > 0.5 ? 1 : 0;
    else amount = easeInOut(amount);
    const view = window.innerWidth;
    const leftW = left.offsetWidth;
    const rightW = right.offsetWidth;
    const gap = parseFloat(getComputedStyle(mark).fontSize) * 0.38;
    const pair = leftW + rightW + gap;
    const finalLeft = (view - pair) / 2;
    const finalRight = finalLeft + leftW + gap;
    const leftEdge = left.offsetLeft + (finalLeft - left.offsetLeft) * amount;
    const rightEdge = right.offsetLeft + (finalRight - right.offsetLeft) * amount;
    left.style.transform = `translate3d(${leftEdge - left.offsetLeft}px,0,0)`;
    right.style.transform = `translate3d(${rightEdge - right.offsetLeft}px,0,0)`;
    mark.style.opacity = String(0.2 + 0.8 * amount);
    const space = Math.ceil(left.offsetHeight + 96);
    const closing = document.querySelector(".closing");
    if (closing.style.paddingBottom !== `${space}px`) closing.style.paddingBottom = `${space}px`;
  };
  apply();
  window.addEventListener("scroll", apply, { passive: true });
  window.addEventListener("resize", apply);
  if (document.fonts) document.fonts.ready.then(apply);
}

function mountSelected(work, extras, loads, reduce) {
  const row = must(".selected-row");
  const stillByUrl = new Map(extras.map((item) => [item.watchUrl, item.still]));
  const lead = [
    "https://lauraramifer.myportfolio.com/photography",
    "https://lauraramifer.myportfolio.com/official-music-video-rock-infame",
    "https://lauraramifer.myportfolio.com/berlitz-ctv-ad",
    "https://lauraramifer.myportfolio.com/ttec-bethespark",
    "https://lauraramifer.myportfolio.com/corporate-event-recaps",
  ];
  const leadAt = new Map(lead.map((url, index) => [url, index]));
  const seen = new Set();
  const pieces = [];
  const add = (title, watchUrl, still) => {
    if (!watchUrl || !still || seen.has(watchUrl)) return;
    seen.add(watchUrl);
    pieces.push({ title, watchUrl, still });
  };
  work.forEach((item) => {
    const still = stillByUrl.get(item.watchUrl) || (item.still && item.still.startsWith("assets/") ? item.still : "");
    add(item.title, item.watchUrl, still);
  });
  extras.forEach((item) => add(item.title, item.watchUrl, item.still));
  pieces.sort((a, b) => (leadAt.get(a.watchUrl) ?? 100) - (leadAt.get(b.watchUrl) ?? 100));
  pieces.forEach((piece) => {
    const card = document.createElement("a");
    card.className = "selected-card";
    card.href = piece.watchUrl;
    card.target = "_blank";
    card.rel = "noreferrer";
    const img = document.createElement("img");
    img.alt = piece.title;
    const play = document.createElement("span");
    play.className = "play";
    play.setAttribute("aria-hidden", "true");
    card.append(img, play);
    row.append(card);
    loads.push(watchImage(img, piece.still));
  });
  cycleSelected(row, reduce);
}

function cycleSelected(row, reduce) {
  const originals = [...row.children];
  if (reduce || originals.length < 6) return;
  originals.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    row.append(clone);
  });
  row.classList.add("is-cycling");
  let loop = 0;
  let stride = 0;
  const measure = () => {
    const first = originals[0];
    const clone = row.children[originals.length];
    loop = clone.offsetLeft - first.offsetLeft;
    stride = originals[1].offsetLeft - first.offsetLeft;
  };
  measure();
  window.addEventListener("resize", measure);
  let holding = false;
  let holdUntil = 0;
  let last = 0;
  const pause = (ms) => {
    holdUntil = performance.now() + ms;
  };
  row.addEventListener("pointerdown", () => {
    holding = true;
  });
  row.addEventListener("pointerup", () => {
    holding = false;
    pause(700);
  });
  row.addEventListener("pointercancel", () => {
    holding = false;
    pause(700);
  });
  row.addEventListener("keydown", () => pause(1200));
  row.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) pause(900);
  }, { passive: true });
  row.addEventListener("focusin", () => pause(1200));
  const step = (now) => {
    if (loop <= 0) measure();
    const dt = last ? Math.min(now - last, 200) : 16;
    last = now;
    const running = !holding && now >= holdUntil && !document.hidden && loop > 0 && stride > 0;
    if (running) {
      row.scrollLeft += (stride / 6400) * dt;
      if (row.scrollLeft >= loop) row.scrollLeft -= loop;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function mountPlayground(pieces, loads, reduce) {
  const section = must("#playground");
  const stage = must(".play-stage");
  const gallery = must("#gallery");
  const words = [...stage.querySelectorAll(".play-word")];
  if (pieces.length !== GALLERY_SPOTS.length) {
    throw new Error(`Gallery expects ${GALLERY_SPOTS.length} stills`);
  }

  const chars = [];
  words.forEach((word) => {
    const text = word.textContent;
    word.replaceChildren();
    [...text].forEach((ch) => {
      const span = document.createElement("span");
      span.className = "play-char";
      span.textContent = ch === " " ? "\u00a0" : ch;
      word.append(span);
      chars.push(span);
    });
  });

  const cards = pieces.map((piece, index) => {
    const spot = GALLERY_SPOTS[index];
    const card = document.createElement("a");
    card.className = "card";
    card.href = piece.watchUrl;
    card.target = "_blank";
    card.rel = "noreferrer";
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = piece.title;
    card.append(img, name);
    card.style.left = `${spot.x}%`;
    card.style.top = `${spot.y}%`;
    card.style.width = `${spot.w}%`;
    card.style.height = `${spot.h}%`;
    card.style.zIndex = String(spot.z);
    gallery.append(card);
    loads.push(watchImage(img, piece.still));
    return { card, rot: spot.r, z: spot.z, dx: 0, dy: 0, px: 0, py: 0, sx: 0, sy: 0, tx: 0, ty: 0, scale: 1 };
  });

  const origin = (el) => {
    const stageBox = stage.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { x: box.left - stageBox.left, y: box.top - stageBox.top };
  };

  const measure = () => {
    stage.dataset.layout = "line";
    words.forEach((word) => {
      word.style.position = "";
      word.style.left = "";
      word.style.top = "";
    });
    const line = words.map(origin);
    stage.dataset.layout = "split";
    const split = words.map(origin);
    stage.dataset.layout = "live";
    words.forEach((word) => {
      word.style.position = "absolute";
    });
    return { line, split };
  };

  let frames = measure();
  let typed = reduce;
  let typeTimer = 0;
  if (reduce) chars.forEach((span) => { span.style.opacity = "1"; });

  const showAllChars = () => {
    chars.forEach((span) => { span.style.opacity = "1"; });
    if (typeTimer) window.clearInterval(typeTimer);
    typed = true;
  };

  const startType = () => {
    if (typed || typeTimer) return;
    let index = 0;
    typeTimer = window.setInterval(() => {
      chars[index].style.opacity = "1";
      index += 1;
      if (index >= chars.length) showAllChars();
    }, 42);
  };

  const scrollProgress = () => {
    const total = section.offsetHeight - window.innerHeight;
    if (total <= 0) return 1;
    return clamp(-section.getBoundingClientRect().top, 0, total) / total;
  };

  let splitAmount = reduce ? 1 : 0;
  const paintCard = (item, reveal) => {
    const lift = item.scale;
    item.card.style.opacity = String(reveal);
    item.card.style.transform = `translate(${item.sx + item.dx}px, ${item.sy + item.dy}px) rotate(${item.rot}deg) scale(${lift})`;
  };

  const apply = () => {
    const progress = reduce ? 1 : scrollProgress();
    const viewTop = section.getBoundingClientRect().top;
    if (viewTop < window.innerHeight * 0.78) startType();
    if (progress > 0.1) showAllChars();
    const split = reduce ? 1 : easeInOut(clamp((progress - 0.14) / 0.72, 0, 1));
    splitAmount = split;
    words.forEach((word, index) => {
      const from = frames.line[index];
      const to = frames.split[index];
      word.style.left = `${from.x + (to.x - from.x) * split}px`;
      word.style.top = `${from.y + (to.y - from.y) * split}px`;
    });
    gallery.style.opacity = String(split);
    gallery.style.transform = `translate(-50%, -50%) scale(${0.94 + split * 0.06})`;
    gallery.classList.toggle("is-live", split > 0.62);
    cards.forEach((item, index) => {
      const reveal = clamp((split - index * 0.035) / 0.42, 0, 1);
      paintCard(item, reveal);
    });
  };

  let drag = null;
  const raise = (item) => {
    cards.forEach((other) => {
      other.card.style.zIndex = other === item ? "40" : String(other.z);
    });
  };
  cards.forEach((item) => {
    item.card.addEventListener("pointerdown", (event) => {
      if (splitAmount < 0.62) return;
      item.card.setPointerCapture(event.pointerId);
      drag = { item, x: event.clientX, y: event.clientY, ox: item.dx, oy: item.dy, moved: 0 };
      item.scale = 1.05;
      raise(item);
    });
    item.card.addEventListener("pointermove", (event) => {
      if (!drag || drag.item !== item) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved = Math.hypot(dx, dy);
      item.dx = drag.ox + dx;
      item.dy = drag.oy + dy;
      paintCard(item, 1);
    });
    const release = () => {
      if (!drag || drag.item !== item) return;
      item.dragged = drag.moved > 6;
      item.scale = 1;
      drag = null;
      paintCard(item, 1);
    };
    item.card.addEventListener("pointerup", release);
    item.card.addEventListener("pointercancel", release);
    item.card.addEventListener("click", (event) => {
      if (!item.dragged) return;
      event.preventDefault();
      item.dragged = false;
    });
    item.card.addEventListener("pointerenter", () => {
      if (drag || splitAmount < 0.62) return;
      item.scale = 1.06;
      raise(item);
      paintCard(item, 1);
    });
    item.card.addEventListener("pointerleave", () => {
      if (drag && drag.item === item) return;
      item.scale = 1;
      item.card.style.zIndex = String(item.z);
      paintCard(item, 1);
    });
  });

  stage.addEventListener("pointermove", (event) => {
    if (splitAmount < 0.62 || drag) return;
    const box = gallery.getBoundingClientRect();
    const nx = (event.clientX - box.left) / box.width - 0.5;
    const ny = (event.clientY - box.top) / box.height - 0.5;
    cards.forEach((item, index) => {
      const depth = 6 + (index % 3) * 5;
      item.tx = nx * depth;
      item.ty = ny * depth;
    });
  });

  let coasting = 0;
  const coast = () => {
    let moving = false;
    cards.forEach((item) => {
      item.sx += (item.tx - item.sx) * 0.14;
      item.sy += (item.ty - item.sy) * 0.14;
      if (Math.abs(item.tx - item.sx) > 0.15 || Math.abs(item.ty - item.sy) > 0.15) moving = true;
      if (splitAmount > 0.62) paintCard(item, 1);
    });
    coasting = moving ? requestAnimationFrame(coast) : 0;
  };
  stage.addEventListener("pointermove", () => {
    if (!coasting && splitAmount > 0.62) coasting = requestAnimationFrame(coast);
  });

  apply();
  window.addEventListener("scroll", apply, { passive: true });
  window.addEventListener("resize", () => {
    frames = measure();
    apply();
  });
  if (document.fonts) document.fonts.ready.then(() => {
    frames = measure();
    apply();
  });
}

async function boot() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [site, work, extras] = await Promise.all([
    loadJson("data/site.json"),
    loadJson("data/work.json?v=5"),
    loadJson("data/orbit.json"),
  ]);
  const pieces = work.filter((item) => Number.isInteger(item.reel)).sort((a, b) => a.reel - b.reel);
  if (!pieces.length) throw new Error("No reel pieces");
  pieces.forEach((piece) => {
    if (!piece.still) throw new Error(`${piece.id} has no still`);
    if (!piece.watchUrl) throw new Error(`${piece.id} has no watchUrl`);
  });

  if (!extras.length) throw new Error("No extra orbit stills");
  extras.forEach((piece) => {
    if (!piece.still) throw new Error(`${piece.title} has no still`);
  });

  if (site.about.length < 3) throw new Error("About copy is incomplete");
  const aimHeading = must("#aim");
  const aimText = site.about[2];
  const motionAt = aimText.indexOf("motion");
  if (motionAt < 0) throw new Error("Aim copy has no motion");
  aimHeading.append(aimText.slice(0, motionAt));
  const motionWord = document.createElement("span");
  motionWord.className = "aim-word";
  const motion = document.createElement("span");
  motion.className = "aim-mark";
  motion.textContent = "motion";
  motionWord.append(motion, "-driven");
  aimHeading.append(motionWord);
  aimHeading.append(aimText.slice(motionAt + "motion-driven".length));
  const about = must("#about-body");
  site.about.slice(0, 2).forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    about.append(p);
  });
  must("#client-list").textContent = site.clients.join("  ·  ");
  const mail = must("#mail");
  mail.href = `mailto:${site.email}`;
  mail.textContent = site.email;
  must("#fine").textContent = `${site.location}  ·  ${new Date().getFullYear()}`;
  const socials = must("#socials");
  site.socials.forEach((social) => {
    const link = document.createElement("a");
    link.href = social.url;
    link.textContent = social.label;
    link.target = "_blank";
    link.rel = "noreferrer";
    socials.append(link);
  });

  const loads = [];
  mountSelected(work, extras, loads, reduce);
  mountPlayground([...pieces, ...extras.slice(0, 3)], loads, reduce);

  const orbit = must("#orbit");
  [...pieces, ...extras].forEach((piece) => {
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    figure.append(img);
    orbit.append(figure);
    loads.push(watchImage(img, piece.still));
  });
  const figures = [...orbit.children];

  const menu = must("#menu");
  const menuButton = must("#menu-open");
  const setMenu = (open) => {
    menu.hidden = !open;
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    menuButton.textContent = open ? "Close" : "Menu";
  };
  menuButton.addEventListener("click", () => setMenu(menu.hidden));
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  const paper = new Image();
  loads.push(watchImage(paper, "assets/paper.jpg?v=2"));
  const stage = must("#stage");
  const canvas = must("#fluid");
  let fluid = null;
  if (!reduce) {
    try {
      await loads[loads.length - 1];
      fluid = createFluid(canvas, paper);
    } catch (error) {
      fluid = null;
      console.error(error);
    }
  }

  let aim = null;
  let stamped = null;
  let pending = false;
  const onPointer = (event) => {
    if (!fluid) return;
    const rect = stage.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) {
      aim = null;
      stamped = null;
      pending = false;
      return;
    }
    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - (event.clientY - rect.top) / rect.height;
    const now = performance.now();
    if (!aim) {
      aim = { x, y, vx: 0, vy: 0, when: now };
      stamped = { x, y };
      pending = true;
      return;
    }
    const dt = Math.max((now - aim.when) / 1000, 0.004);
    aim.vx = clamp((x - aim.x) / dt, -FLUID.velocityClamp, FLUID.velocityClamp) * FLUID.velocityScale;
    aim.vy = clamp((y - aim.y) / dt, -FLUID.velocityClamp, FLUID.velocityClamp) * FLUID.velocityScale;
    aim.x = x;
    aim.y = y;
    aim.when = now;
    pending = true;
  };
  window.addEventListener("pointermove", onPointer);
  window.addEventListener("pointerdown", onPointer);

  let last = performance.now();
  let frameId = 0;
  const frame = (now) => {
    frameId = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    if (!reduce) placeOrbit(figures, now / 1000);
    else placeOrbit(figures, 0);
    if (!fluid) return;
    if (pending && aim && stamped) {
      const aspect = canvas.width / Math.max(canvas.height, 1);
      const dist = Math.hypot((aim.x - stamped.x) * aspect, aim.y - stamped.y);
      const steps = Math.max(1, Math.ceil(dist / (0.4 * Math.sqrt(FLUID.radius))));
      for (let i = 0; i < steps; i += 1) {
        const t = steps === 1 ? 1 : i / (steps - 1);
        fluid.splat(
          stamped.x + (aim.x - stamped.x) * t,
          stamped.y + (aim.y - stamped.y) * t,
          aim.vx,
          aim.vy,
        );
      }
      stamped = { x: aim.x, y: aim.y };
      pending = false;
    }
    fluid.step(Math.max(dt, 0.004), now * 0.001);
    fluid.present(now * 0.001);
  };

  const onResize = () => {
    if (fluid) fluid.resize();
    placeOrbit(figures, reduce ? 0 : performance.now() / 1000);
  };
  window.addEventListener("resize", onResize);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      return;
    }
    if (!frameId) {
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  });

  mountName(reduce);

  const count = must("#count");
  let loaded = 0;
  loads.forEach((job) => {
    job.then(() => {
      loaded += 1;
      count.textContent = String(Math.round((loaded / loads.length) * 100)).padStart(2, "0");
    });
  });
  await Promise.allSettled(loads);
  count.textContent = "100";
  placeOrbit(figures, 0);
  window.setTimeout(() => must("#preloader").classList.add("is-done"), 320);
  frameId = requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  const preloader = document.querySelector("#preloader");
  if (preloader) preloader.classList.add("is-done");
});
