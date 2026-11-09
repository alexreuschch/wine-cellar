'use strict';

/* Vintary: bottles rendered in 3D on the phone. The outline of each shape is turned into a body of revolution;
   glass, wine, a metal capsule and the label are lit by two soft boxes like in a photo studio. The label photo
   is wrapped around the glass; a wine without a photo gets a label set in type from its own details. */

const B3_WINE = { Red: '#5A0F1E', White: '#E6D27E', 'Rosé': '#EE8E92', Sparkling: '#E8DA98', Dessert: '#C98A2E', Fortified: '#5A2414', Orange: '#D9893C' };
const B3_ACCENT = { Red: '#6E1A2A', White: '#7C6A2E', 'Rosé': '#B05A6A', Sparkling: '#A88A4A', Dessert: '#A0661C', Fortified: '#5A2414', Orange: '#A8641C' };
const b3Rgb = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

/* the outline: a smooth curve through the profile points that never overshoots (monotone cubic), and its slope */
const B3_SHAPES = {};
function b3Shape(k) {
  if (B3_SHAPES[k]) return B3_SHAPES[k];
  const b = BOTTLES[k];
  const P = b.p.filter((q, i) => i === 0 || q[0] > b.p[i - 1][0] + 1e-6);
  const n = P.length, x = P.map(q => q[0]), y = P.map(q => q[1]);
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h[i] = x[i + 1] - x[i]; d[i] = (y[i + 1] - y[i]) / h[i]; }
  const m = new Array(n).fill(0);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  const N = 1200, ys = new Float32Array(N), rs = new Float32Array(N);
  let seg = 0;
  for (let j = 0; j < N; j++) {
    const t = x[n - 1] * j / (N - 1);
    while (seg < n - 2 && t > x[seg + 1]) seg++;
    const hh = h[seg], s = (t - x[seg]) / hh, s2 = s * s, s3 = s2 * s;
    ys[j] = t;
    rs[j] = (2 * s3 - 3 * s2 + 1) * y[seg] + (s3 - 2 * s2 + s) * hh * m[seg] + (-2 * s3 + 3 * s2) * y[seg + 1] + (s3 - s2) * hh * m[seg + 1];
  }
  const rmax = Math.max(...rs);
  return (B3_SHAPES[k] = { b, ys, rs, N, len: x[n - 1], rmax });
}
const b3R = (sh, y) => { const f = clamp(y / sh.len, 0, 1) * (sh.N - 1), i = Math.floor(f), t = f - i; return i >= sh.N - 1 ? sh.rs[sh.N - 1] : sh.rs[i] * (1 - t) + sh.rs[i + 1] * t; };

/* what the glass reflects: a tall soft box on the left, a narrow strip on the right, a bright ceiling */
function b3Env(x, y) {
  const sm = (a, lo, hi) => clamp((a - lo) / 0.12, 0, 1) * clamp((hi - a) / 0.12, 0, 1);
  return 3.2 * sm(x, -0.95, -0.55) * sm(y, -0.75, 0.55) + 1.5 * sm(x, 0.62, 0.86) * sm(y, -0.6, 0.45) + 0.7 * clamp((-y - 0.55) / 0.45, 0, 1) + 0.05;
}

/* pixels of an image or canvas, for wrapping */
function b3Pixels(src, maxH = 700) {
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  if (!w0 || !h0) return null;
  const k = Math.min(1, maxH / h0), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0, c.width, c.height);
  try { return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; } catch (e) { return null; }
}

/**
 * Draws a bottle into a canvas.
 * o: { shape, glass, type, rose, label: { src, oval } | null, plain (drawn placeholder label), neck (text), gloss, pxcm (pixels per cm) }
 */
function b3Render(o) {
  const sh = b3Shape(o.shape), b = sh.b, k = o.pxcm;
  const H = Math.ceil(b.h * k) + 2, W = Math.ceil(2 * sh.rmax * k) + 4, cx = W / 2;
  const cnv = document.createElement('canvas'); cnv.width = W; cnv.height = H;
  const g = cnv.getContext('2d'), img = g.createImageData(W, H), px = img.data;
  // a smooth slope per row, so the reflections run over the shoulder without seams
  const R = new Float32Array(H), DR = new Float32Array(H);
  for (let j = 0; j < H; j++) R[j] = b3R(sh, (j + 0.5) / k);
  const sig = Math.max(1, 0.35 * k), rad = Math.ceil(3 * sig), ker = [];
  let ks = 0; for (let i = -rad; i <= rad; i++) { const v = Math.exp(-0.5 * (i / sig) ** 2); ker.push(v); ks += v; }
  const RS = new Float32Array(H);
  for (let j = 0; j < H; j++) { let s = 0; for (let i = -rad; i <= rad; i++) s += R[clamp(j + i, 0, H - 1)] * ker[i + rad]; RS[j] = s / ks; }
  for (let j = 0; j < H; j++) DR[j] = (RS[Math.min(H - 1, j + 1)] - RS[Math.max(0, j - 1)]) / (2 / k);
  const clear = o.glass === 'clear';
  const gc = GLASSES[o.glass] || GLASSES.green, gt = b3Rgb(gc.c[0]), gb = b3Rgb(gc.c[1]);
  const base = [gt[0] * 0.75 + gb[0] * 0.25, gt[1] * 0.75 + gb[1] * 0.25, gt[2] * 0.75 + gb[2] * 0.25];
  const wc = b3Rgb(B3_WINE[o.rose ? 'Rosé' : o.type] || B3_WINE.White);
  const capC = o.type === 'Sparkling' ? [0.74, 0.64, 0.46] : ['Red', 'Fortified'].includes(o.type) ? [0.30, 0.06, 0.09] : [0.42, 0.45, 0.5];
  const paper = b3Rgb('#EFE6D6');
  // the foil of sparkling wine: random creases
  const crease = new Float32Array(220);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 220; i++) crease[i] = (rnd() + rnd() + rnd() - 1.5) * 0.3;
  // the label: photo or set in type, kept in its proportions inside the label zone of the shape
  const [l0, l1] = b.label;
  let tex = null, lab = null;
  if (o.label && o.label.src) tex = b3Pixels(o.label.src);
  if (tex) {
    const ymid = (l0 + l1) / 2, rmid = b3R(sh, ymid);
    const half = Math.min(b3R(sh, l0), b3R(sh, l1)) * (b.round ? 0.98 : 0.9);
    const thmax = Math.asin(Math.min(half / rmid, 0.999)), arcMax = 2 * thmax * rmid, hg = l1 - l0, asp = tex.w / tex.h;
    let arc = asp * hg, hh = hg;
    if (arc > arcMax) { arc = arcMax; hh = arcMax / asp; }
    lab = { ya: ymid - hh / 2, hh, arc, oval: !!o.label.oval || b.round };
  }
  let ntex = null, nk = null;
  if (o.neck) { ntex = b3Pixels(b3NeckLabel(o.neck), 200); nk = { ya: b.cap + 0.35, hh: 1.5 }; }
  const LP = [-0.5, -0.3, 0.81], lpn = Math.hypot(...LP), L = LP.map(v => v / lpn);
  const gloss = o.gloss || 0;
  const sample = (t, u, v) => { const i = clamp(Math.floor(v * (t.h - 1) + 0.5), 0, t.h - 1), j = clamp(Math.floor(u * (t.w - 1) + 0.5), 0, t.w - 1), q = (i * t.w + j) * 4; return [t.d[q] / 255, t.d[q + 1] / 255, t.d[q + 2] / 255, t.d[q + 3] / 255]; };
  for (let j = 0; j < H; j++) {
    const yc = (j + 0.5) / k;
    if (yc > b.h) continue;
    const r = R[j], dr = DR[j];
    for (let i = 0; i < W; i++) {
      const xc = (i + 0.5 - cx) / k;
      const edge = (r - Math.abs(xc)) * k * 0.9;
      if (edge <= 0) continue;
      const u = clamp(xc / Math.max(r, 1e-6), -1, 1), nz0 = Math.sqrt(Math.max(0, 1 - u * u));
      let nx = u, ny = -dr, nz = nz0;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const ndv = Math.max(0, nz);
      const rx = 2 * ndv * nx, ry = 2 * ndv * ny;
      const E = b3Env(rx, ry);
      const fres = 0.045 + 0.955 * (1 - ndv) ** 5;
      const thick = 1 / Math.max(ndv, 0.08);
      let c0, c1, c2;
      if (clear) {
        if (yc >= b.fill) {
          const ab = Math.exp(-0.55 * (thick - 1)), f = (0.42 + 0.58 * ab) * (0.55 + 0.45 * nz0 ** 0.6);
          c0 = wc[0] * f; c1 = wc[1] * f; c2 = wc[2] * f;
        } else { const a = 0.06 + 0.1 * (1 - nz0) ** 2; c0 = 0.18 + a; c1 = 0.108 + a; c2 = 0.126 + a; }
        const rim = 0.22 * (1 - nz0) ** 6; c0 += rim; c1 += rim; c2 += rim;
      } else {
        const tr = Math.exp(-0.9 * (thick - 1)), f = (0.18 + 0.55 * tr) * (0.6 + 0.4 * nz0), up = yc < b.fill;
        const e4 = 0.35 * (1 - nz0) ** 4;
        c0 = base[0] * (f * (up ? 1.35 : 0.85) + (up ? 0.08 : 0) + e4); c1 = base[1] * (f * (up ? 1.35 : 0.85) + (up ? 0.08 : 0) + e4); c2 = base[2] * (f * (up ? 1.35 : 0.85) + (up ? 0.08 : 0) + e4);
      }
      const spec = Math.max(0, E - 1) * (0.1 + 0.9 * fres) * 0.55;
      c0 = c0 * (1 - fres) + E * fres + spec; c1 = c1 * (1 - fres) + E * fres + spec; c2 = c2 * (1 - fres) + E * fres + spec;
      // capsule
      if (yc < b.cap) {
        let cnx = nx;
        if (b.foil) { const p = clamp((xc / sh.rmax + 1) / 2, 0, 0.999) * 219; cnx += (crease[p | 0] * (1 - p % 1) + crease[Math.min(219, (p | 0) + 1)] * (p % 1)) * (yc / b.cap); }
        const cl = Math.hypot(cnx, ny, nz), cxn = cnx / cl, cyn = ny / cl, czn = nz / cl;
        const cd = Math.max(0, czn), cE = b3Env(2 * cd * cxn, 2 * cd * cyn);
        const diff = Math.max(0, cxn * -0.45 / 1.07 + cyn * -0.35 / 1.07 + czn * 0.82 / 1.07);
        const hi = 0.25 * Math.max(0, cE - 1.2), ring = Math.abs(yc - (b.cap - 0.15)) < 0.05 ? 0.55 : 1;
        c0 = (capC[0] * (0.25 + 0.55 * diff) + capC[0] * cE * 0.55 + hi) * ring;
        c1 = (capC[1] * (0.25 + 0.55 * diff) + capC[1] * cE * 0.55 + hi) * ring;
        c2 = (capC[2] * (0.25 + 0.55 * diff) + capC[2] * cE * 0.55 + hi) * ring;
      }
      // paper: the label wrapped around the glass, a neck label, or the drawn placeholder
      let pc = null;
      if (lab && yc >= lab.ya && yc <= lab.ya + lab.hh) {
        const th = Math.asin(u), uu = 0.5 + th * r / lab.arc, vv = (yc - lab.ya) / lab.hh;
        if (uu >= 0 && uu <= 1 && (!lab.oval || (uu - 0.5) ** 2 + (vv - 0.5) ** 2 < 0.25)) { const s = sample(tex, uu, vv); if (s[3] > 0.5) pc = s; }
      } else if (ntex && yc >= nk.ya && yc <= nk.ya + nk.hh) {
        const th = Math.asin(u), uu = 0.5 + th / Math.PI, vv = (yc - nk.ya) / nk.hh;
        pc = sample(ntex, uu, vv);
      } else if (!lab && o.plain) {
        const half = (b.round ? (l1 - l0) / 2 : Math.min(b3R(sh, l0), b3R(sh, l1)) * 0.86);
        const inL = b.round ? xc * xc + (yc - (l0 + l1) / 2) ** 2 < half * half : yc > l0 && yc < l1 && Math.abs(xc) < half;
        if (inL) {
          pc = [paper[0], paper[1], paper[2], 1];
          const lyA = l0 + (l1 - l0) * 0.42, lyB = l0 + (l1 - l0) * 0.56, lt = Math.max(0.08, (l1 - l0) * 0.022);
          if (Math.abs(yc - lyA) < lt && Math.abs(xc) < half * 0.56) pc = [paper[0] * 0.62, paper[1] * 0.36, paper[2] * 0.4, 1];
          else if (Math.abs(yc - lyB) < lt && Math.abs(xc) < half * 0.4) pc = [paper[0] * 0.72, paper[1] * 0.72, paper[2] * 0.72, 1];
        }
      }
      if (pc) {
        const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), lit = 0.34 + 0.74 * diff, sh2 = (0.05 + gloss * 0.5) * fres * E + gloss * 0.25 * spec;
        c0 = pc[0] * lit + sh2; c1 = pc[1] * lit + sh2; c2 = pc[2] * lit + sh2;
      }
      const q = (j * W + i) * 4, gm = 1 / 1.08;
      px[q] = 255 * clamp(c0, 0, 1) ** gm; px[q + 1] = 255 * clamp(c1, 0, 1) ** gm; px[q + 2] = 255 * clamp(c2, 0, 1) ** gm; px[q + 3] = 255 * Math.min(1, edge);
    }
  }
  g.putImageData(img, 0, 0);
  return cnv;
}

/* ---------------------------------------------------------------- labels set in type */

/* the monogram: the first letters of the producer's name, without small words like de, des or am */
const b3Initials = p => {
  const words = str(p).split(/[\s-]+/).filter(x => x && !/^(de|des|du|di|del|della|la|le|les|am|an|im|von|vom|zu|zum|y|e|et|and|und|&)$/i.test(x));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?')[0]).toUpperCase();
};
/* the label zone of a shape in width to height, so the typeset label fits it */
function b3LabelAspect(k) {
  const sh = b3Shape(k), b = sh.b, [l0, l1] = b.label;
  if (b.round) return 1;
  const rmid = b3R(sh, (l0 + l1) / 2), half = Math.min(b3R(sh, l0), b3R(sh, l1)) * 0.9;
  return 2 * Math.asin(Math.min(half / rmid, 0.999)) * rmid / (l1 - l0);
}
function b3TypoLabel(w, shape) {
  const round = BOTTLES[shape].round, asp = round ? 1 : b3LabelAspect(shape);
  const H = 640, W = Math.round(H * asp), u = Math.min(W, H) / 100;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), acc = B3_ACCENT[w.type] || B3_ACCENT.Red;
  const clipShape = inset => { g.beginPath(); if (round) g.ellipse(W / 2, H / 2, W / 2 - inset, H / 2 - inset, 0, 0, Math.PI * 2); else g.rect(inset, inset, W - 2 * inset, H - 2 * inset); };
  const bg = g.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#FBF5EA'); bg.addColorStop(1, '#EFE5D2');
  clipShape(0); g.fillStyle = bg; g.fill();
  g.strokeStyle = acc; g.globalAlpha = 0.8;
  g.lineWidth = 2; clipShape(Math.min(W, H) * 0.045); g.stroke();
  g.lineWidth = 1; clipShape(Math.min(W, H) * 0.045 + 6); g.stroke();
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (text, font, max) => { g.font = font; let t = text; while (t.length > 1 && g.measureText(t).width > max) t = t.slice(0, -1); return t === text ? t : t.trim() + '…'; };
  const spaced = (text, y, font, color, max, track) => {
    g.font = font; g.fillStyle = color;
    const chars = [...text.toUpperCase()];
    let wsum = chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + track * (chars.length - 1);
    let tr = track;
    if (wsum > max) { tr = Math.max(0, track - (wsum - max) / Math.max(1, chars.length - 1)); wsum = chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + tr * (chars.length - 1); }
    let x = W / 2 - wsum / 2;
    g.textAlign = 'left';
    chars.forEach(ch => { g.fillText(ch, x, y); x += g.measureText(ch).width + tr; });
    g.textAlign = 'center';
  };
  const inner = W * (round ? 0.66 : 0.8);
  // monogram
  let y = H * (round ? 0.27 : 0.3);
  const mr = u * 10.5;
  g.strokeStyle = acc; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, y, mr, 0, Math.PI * 2); g.stroke();
  g.fillStyle = acc; g.font = `${(u * 8).toFixed(0)}px 'DM Serif Display', Georgia, serif`; g.fillText(b3Initials(w.producer || w.name), W / 2, y + u * 0.6);
  y += mr + u * 7;
  if (w.producer) spaced(fit(w.producer, `600 ${(u * 3.3).toFixed(1)}px Inter, sans-serif`, inner), y, `600 ${(u * 3.3).toFixed(1)}px Inter, sans-serif`, '#3A2A2C', inner, u * 0.9);
  y += u * 4;
  g.fillStyle = acc; g.fillRect(W / 2 - W * 0.13, y, W * 0.26, 1.5);
  // the name, in one or two lines
  y += u * 9;
  const nm = w.name || w.producer || 'Wine';
  g.fillStyle = '#241416';
  let size = u * 9.2;
  g.font = `${size.toFixed(1)}px 'DM Serif Display', Georgia, serif`;
  let lines = [nm];
  if (g.measureText(nm).width > inner) {
    const words = nm.split(' '); let a = '', best = null;
    for (let i = 1; i < words.length; i++) { const l1t = words.slice(0, i).join(' '), l2t = words.slice(i).join(' '); const m = Math.max(g.measureText(l1t).width, g.measureText(l2t).width); if (!best || m < best[0]) best = [m, l1t, l2t]; }
    lines = best ? [best[1], best[2]] : [nm];
    const m = Math.max(...lines.map(l => g.measureText(l).width));
    if (m > inner) { size *= inner / m; g.font = `${size.toFixed(1)}px 'DM Serif Display', Georgia, serif`; }
  }
  lines.forEach((l, i) => g.fillText(l, W / 2, y + i * size * 1.05));
  y += (lines.length - 1) * size * 1.05 + u * 8;
  const reg = str(w.region).split(',')[0].trim();
  if (reg) spaced(fit(reg, `500 ${(u * 2.9).toFixed(1)}px Inter, sans-serif`, inner), y, `500 ${(u * 2.9).toFixed(1)}px Inter, sans-serif`, acc, inner, u * 0.85);
  y += u * 6.5;
  g.fillStyle = acc; g.font = `${(u * 6).toFixed(1)}px 'DM Serif Display', Georgia, serif`; g.fillText(str(w.vintage) || 'NV', W / 2, y);
  return c;
}
function b3NeckLabel(text) {
  const c = document.createElement('canvas'); c.width = 1100; c.height = 200;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 200);
  gr.addColorStop(0, '#EFE3C6'); gr.addColorStop(1, '#E2D2AC');
  g.fillStyle = gr; g.fillRect(0, 0, 1100, 200);
  g.font = "120px 'DM Serif Display', Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6E5A2E';
  g.fillText(text, 550, 108);
  const tw = g.measureText(text).width;
  g.fillStyle = '#A88A4A'; g.fillRect(550 - tw / 2 - 200, 99, 160, 3); g.fillRect(550 + tw / 2 + 40, 99, 160, 3);
  return c;
}

/* ---------------------------------------------------------------- in the app */

let b3Fonts = null;
const b3FontsReady = () => b3Fonts || (b3Fonts = (document.fonts ? Promise.all([document.fonts.load("40px 'DM Serif Display'"), document.fonts.load('600 20px Inter'), document.fonts.load('500 20px Inter')]).catch(() => null) : Promise.resolve()));

/* the options of a wine's bottle: shape, glass, wine colour, label shape and a neck label for sparkling wine */
function b3Opts(w, shape, glass) {
  const k = shape || bottleShapeOf(w);
  return { shape: k, glass: glass || glassOf(w, k), type: w.type, rose: w.type === 'Sparkling' && /ros[ée]/i.test(`${w.name} ${w.producer}`), oval: !!(w.profile && w.profile.label === 'oval') };
}
const B3_CACHE = new Map();
/* a canvas for a bottle, painted right after the view is drawn */
function b3Html(w, o, heightPx, extra = '') {
  const sh = b3Shape(o.shape), wpx = heightPx * (2 * sh.rmax + 4 / (heightPx / sh.b.h)) / sh.b.h;
  const id = 'b3' + Math.random().toString(36).slice(2, 8);
  B3_PENDING.set(id, { w, o, heightPx });
  setTimeout(b3PaintPending, 0);
  return `<canvas id="${id}" class="bottle-svg b3" ${extra} style="height:${heightPx.toFixed(0)}px;width:${wpx.toFixed(0)}px" role="img" aria-label="${esc(BOTTLES[o.shape].name)} bottle, ${esc(GLASSES[o.glass].name.toLowerCase())} glass"></canvas>`;
}
const B3_PENDING = new Map();
function b3PaintPending() {
  B3_PENDING.forEach((v, id) => {
    const el = document.getElementById(id);
    B3_PENDING.delete(id);
    if (el) b3Paint(el, v.w, v.o, v.heightPx, v.label || null);
  });
}
/* paints one canvas; a label image (photo or typeset) is wrapped onto the glass */
function b3Paint(el, w, o, heightPx, labelSrc) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), pxcm = heightPx * dpr / BOTTLES[o.shape].h;
  const key = [o.shape, o.glass, o.type, o.rose, o.oval, Math.round(pxcm * 10), labelSrc ? (labelSrc.src ? labelSrc.src.length + labelSrc.src.slice(-40) : 'c') : o.plain ? 'plain' : 'none', o.neck || ''].join('|');
  let cnv = B3_CACHE.get(key);
  if (!cnv) {
    cnv = b3Render({ shape: o.shape, glass: o.glass, type: o.type, rose: o.rose, label: labelSrc ? { src: labelSrc, oval: o.oval } : null, plain: !labelSrc && !!o.plain, neck: o.neck, gloss: labelSrc && labelSrc.dataset && labelSrc.dataset.typo ? 0 : 0.3, pxcm });
    if (B3_CACHE.size > 60) B3_CACHE.delete(B3_CACHE.keys().next().value);
    B3_CACHE.set(key, cnv);
  }
  el.width = cnv.width; el.height = cnv.height;
  el.style.width = (cnv.width / dpr).toFixed(1) + 'px';
  el.style.height = (cnv.height / dpr).toFixed(1) + 'px';
  el.getContext('2d').drawImage(cnv, 0, 0);
}
