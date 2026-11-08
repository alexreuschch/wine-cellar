'use strict';

/* Vintary: the label and the bottle. A camera with a label frame, unrolling a label from a round bottle,
   a drawn bottle per wine and a drawn label for wines without a photo. Loaded after form.js. */

/* ---------------------------------------------------------------- drawn bottle */

/* viewBox 0 0 160 360, all standing on the same ground at 352, centered on x 80, in the proportions of real bottles.
   label: [x, y, w, h] on the body; hl: where the light falls on the glass */
const BOTTLE_SHAPES = {
  bordeaux: { d: 'M72 20h16v4h-1v94c0 18 33 22 33 50V340c0 8-5 12-12 12H52c-7 0-12-4-12-12V168c0-28 33-32 33-50V24h-1z', label: [46, 212, 68, 94], foil: 'M72 20h16v4h-1v60H73V24h-1z', hl: 50 },
  burgundy: { d: 'M71 20h18v4h-1v86c0 40 35 58 35 104V340c0 8-5 12-12 12H49c-7 0-12-4-12-12V210c0-46 35-64 35-104V24h-1z', label: [44, 236, 72, 88], foil: 'M71 20h18v4h-1v56H72V24h-1z', hl: 47 },
  flute: { d: 'M73 0h14v4h-1v76c0 60 35 110 35 170V342c0 6-4 10-10 10H55c-6 0-10-4-10-10V250c0-60 35-110 35-170V4h-1z', label: [49, 264, 62, 68], foil: 'M73 0h14v4h-1v70H74V4h-1z', hl: 54 },
  bocksbeutel: { d: 'M70 118h20v4h-1v74c0 14 11 18 23 26 28 18 44 50 44 74 0 28-10 44-24 60H28C14 336 4 320 4 292c0-24 16-56 44-74 12-8 23-12 23-26v-74h-1z', label: [46, 258, 68, 68], round: true, foil: 'M70 118h20v4h-1v56H71v-56h-1z', hl: 22 },
  champagne: { d: 'M68 20h24v8h-2v72c0 50 34 76 34 132V340c0 8-5 12-12 12H48c-7 0-12-4-12-12V232c0-56 34-82 34-132V28h-2z', label: [44, 250, 72, 78], foil: 'M68 20h24v8h-2v72c0 18 4 30 9 46H61c5-16 9-28 9-46V28h-2z', hl: 46 },
  port: { d: 'M70 40h20v6h-1v56c0 12 6 16 16 22 9 6 13 14 13 26v178c0 8-5 12-12 12H54c-7 0-12-4-12-12V150c0-12 4-20 13-26 10-6 16-10 16-22V46h-1z', label: [48, 206, 64, 92], foil: 'M70 40h20v6h-1v46H71V46h-1z', hl: 50 },
  fiasco: { d: 'M72 10h16v4h-1v130c0 34 45 52 45 116 0 34-17 56-34 66v20c0 4-3 6-7 6H69c-4 0-7-2-7-6v-20c-17-10-34-32-34-66 0-64 45-82 45-116V14h-1z', label: [64, 168, 32, 26], straw: true, foil: 'M72 10h16v4h-1v44H73V14h-1z', hl: 40 }
};
const BOTTLE_NAMES = { bordeaux: 'Bordeaux', burgundy: 'Burgundy', flute: 'Riesling and Alsace', bocksbeutel: 'Bocksbeutel', champagne: 'Champagne', port: 'Port', fiasco: 'Chianti fiasco' };
const BOTTLE_GLASS = { Red: ['#4A1824', '#2A0D14'], White: ['#7C8350', '#4E5530'], 'Rosé': ['#C58E93', '#9C6168'], Sparkling: ['#33452F', '#1C2A1A'], Dessert: ['#9A6424', '#6A4012'], Fortified: ['#3A1712', '#1E0A08'], Orange: ['#A0662E', '#704218'] };

/* the usual bottle for the type, region and grapes; a shape chosen in Edit wins */
function bottleAuto(w) {
  const t = `${w.type || ''} ${w.region || ''} ${w.grapes || ''} ${w.name || ''}`;
  if (w.type === 'Sparkling' || /champagne|\bcava\b|franciacorta|cr[ée]mant|prosecco|\bsekt\b/i.test(t)) return 'champagne';
  if (w.type === 'Fortified' || /\bport\b|\bporto\b|madeira|sherry|jerez/i.test(t)) return 'port';
  if (/fiasco/i.test(t)) return 'fiasco';
  if (/franken|bocksbeutel|w[üu]rzburg|silvaner/i.test(t)) return 'bocksbeutel';
  if (/riesling|alsace|elsass|mosel|gew[üu]rz|rheingau|pfalz|nahe|wachau|kamptal|gr[üu]ner/i.test(t)) return 'flute';
  if (/burgund|bourgogne|pinot noir|chardonnay|rh[ôo]ne|syrah|chasselas|nebbiolo|barolo|barbaresco|beaujolais|loire/i.test(t)) return 'burgundy';
  return 'bordeaux';
}
const bottleShapeOf = w => (w.profile && BOTTLE_SHAPES[w.profile.bottle] ? w.profile.bottle : bottleAuto(w));

function bottleSvg(w, shape) {
  const k = shape || bottleShapeOf(w), s = BOTTLE_SHAPES[k];
  const g = BOTTLE_GLASS[w.type] || BOTTLE_GLASS.Red;
  const id = 'bt' + Math.random().toString(36).slice(2, 8);
  const [lx, ly, lw, lh] = s.label;
  const cap = w.type === 'Sparkling' ? '#BFA884' : ['White', 'Rosé', 'Dessert', 'Orange'].includes(w.type) ? '#6F7783' : '#5E1E2A';
  const lab = s.round
    ? `<ellipse cx="${lx + lw / 2}" cy="${ly + lh / 2}" rx="${lw / 2}" ry="${lh / 2}" fill="#EFE6D6"/>`
    : `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="2" fill="#EFE6D6"/>`;
  // the straw of a Chianti fiasco around its round lower half
  const straw = s.straw ? `<g clip-path="url(#${id}c)"><rect x="0" y="232" width="160" height="128" fill="#C9B489"/>${[34, 46, 58, 70, 82, 94, 106, 118].map(x => `<path d="M${x} 232c-2 30 2 60 0 90" stroke="#9C8659" stroke-width="1" fill="none" opacity=".7"/>`).join('')}<rect x="0" y="318" width="160" height="4" fill="#9C8659" opacity=".8"/></g>` : '';
  return `<svg class="bottle-svg" viewBox="0 0 160 360" role="img" aria-label="${esc(BOTTLE_NAMES[k])} bottle">
    <defs>
      <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="${g[1]}"/><stop offset=".38" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient>
      <linearGradient id="${id}h" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
      <clipPath id="${id}c"><path d="${s.d}"/></clipPath>
    </defs>
    <path d="${s.d}" fill="url(#${id}g)"/>
    <g clip-path="url(#${id}c)"><rect x="0" y="0" width="160" height="360" fill="url(#${id}s)"/><rect x="${s.hl}" y="0" width="8" height="360" fill="url(#${id}h)"/></g>
    ${straw}
    <path d="${s.foil}" fill="${cap}"/>
    ${lab}
    <rect x="${lx + lw * 0.22}" y="${ly + lh * 0.42}" width="${lw * 0.56}" height="${Math.max(2, lh * 0.04)}" rx="1.5" fill="#7A2B37" opacity=".5"/>
    <rect x="${lx + lw * 0.3}" y="${ly + lh * 0.56}" width="${lw * 0.4}" height="${Math.max(1.6, lh * 0.03)}" rx="1.2" fill="#5A4A40" opacity=".32"/>
  </svg>`;
}

/* ---------------------------------------------------------------- drawn label, for wines without a photo */

function labelCardHtml(w) {
  return `<div class="dl"><span class="dl-p">${esc(w.producer)}</span><i></i><b class="dl-n">${esc(w.name || w.producer || 'Wine')}</b>${w.region ? `<span class="dl-r">${esc(str(w.region).split(',')[0])}</span>` : ''}<span class="dl-v">${esc(w.vintage || 'NV')}</span></div>`;
}
/* in the lists: the vintage is the one thing that can still be read */
const labelMiniHtml = (w, sm) => `<div class="thumb${sm ? ' sm' : ''} dl-mini" aria-hidden="true"><span>${esc(w.vintage || 'NV')}</span><i></i></div>`;

/* the top of the wine page: the bottle on the left, the label on the right */
function wineTopHtml(w) {
  const photo = w.thumb || w.labelFileId;
  const label = photo
    ? `<button class="wtop-lab" data-act="label-zoom" aria-label="Show the label large"><img id="label-img" class="label-photo"${w.thumb ? ` src="${esc(w.thumb)}"` : ''} alt="Label of ${esc(fullName(w))}"></button>`
    : `<div class="wtop-lab">${labelCardHtml(w)}</div>`;
  return `<div class="wtop"><div class="wtop-b">${bottleSvg(w)}</div>${label}</div>`;
}
function labelZoom() {
  const img = $('#label-img');
  if (!img || !img.src) return;
  const z = document.createElement('div');
  z.className = 'zoom';
  z.innerHTML = `<img src="${esc(img.src)}" alt="${esc(img.alt)}"><button class="icon-btn" aria-label="Close">${ICON.x}</button>`;
  z.onclick = () => { z.remove(); window.removeEventListener('hashchange', off); };
  const off = () => z.remove();
  window.addEventListener('hashchange', off, { once: true });
  document.body.appendChild(z);
}

/* ---------------------------------------------------------------- camera with a label frame */

const CAM = { stream: null, torch: false, canTorch: false };
const camOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
function camStop() {
  if (CAM.stream) CAM.stream.getTracks().forEach(t => t.stop());
  Object.assign(CAM, { stream: null, torch: false, canTorch: false });
}
function camHtml() {
  return `<div class="cam" id="cam"><video id="cam-video" playsinline muted autoplay></video><div class="cam-frame" id="cam-frame"></div><p class="cam-hint">Fit the label into the frame</p></div>
    <div class="cam-bar"><button class="btn" data-act="cam-cancel">Cancel</button><button class="cam-shot" data-act="cam-shot" aria-label="Take the photo"></button>
      <button class="icon-btn cam-torch" id="cam-torch" data-act="cam-torch" aria-label="Light" aria-pressed="false" hidden><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 2L5 13h6l-1 9 8-11h-6z"/></svg></button></div>
    <label class="btn ghost">Choose from gallery<input type="file" accept="image/*" data-change="photo" hidden></label>`;
}
async function setupCamera() {
  const v = $('#cam-video');
  if (!v) return;
  if (!CAM.stream) {
    try {
      CAM.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
    } catch (e) {
      camStop();
      if (D && D.step === 'camera') { D.step = 'photo'; D.camFail = true; render(); }
      return;
    }
    if (!D || D.step !== 'camera') { camStop(); return; }
  }
  const el = $('#cam-video');
  if (!el) return;
  el.srcObject = CAM.stream;
  try { await el.play(); } catch (e) { /* starts on its own */ }
  const track = CAM.stream.getVideoTracks()[0];
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  CAM.canTorch = !!caps.torch;
  const t = $('#cam-torch');
  if (t) { t.hidden = !CAM.canTorch; t.setAttribute('aria-pressed', String(CAM.torch)); t.classList.toggle('on', CAM.torch); }
}
async function camTorch() {
  const track = CAM.stream && CAM.stream.getVideoTracks()[0];
  if (!track) return;
  try { await track.applyConstraints({ advanced: [{ torch: !CAM.torch }] }); CAM.torch = !CAM.torch; } catch (e) { toast('The light cannot be switched on here.'); }
  const t = $('#cam-torch');
  if (t) { t.setAttribute('aria-pressed', String(CAM.torch)); t.classList.toggle('on', CAM.torch); }
}
/* the photo: the frame and a margin around it, so the edges can still be found */
function camShot() {
  const v = $('#cam-video'), box = $('#cam'), fr = $('#cam-frame');
  if (!v || !v.videoWidth || !box || !fr) return;
  const vw = v.videoWidth, vh = v.videoHeight, b = box.getBoundingClientRect(), f = fr.getBoundingClientRect();
  const s = Math.max(b.width / vw, b.height / vh), ox = (b.width - vw * s) / 2, oy = (b.height - vh * s) / 2;
  const toV = (x, y) => ({ x: (x - b.left - ox) / s, y: (y - b.top - oy) / s });
  const a = toV(f.left, f.top), z = toV(f.right, f.bottom);
  const mx = (z.x - a.x) * 0.12, my = (z.y - a.y) * 0.12;
  const sx = clamp(a.x - mx, 0, vw), sy = clamp(a.y - my, 0, vh), ex = clamp(z.x + mx, 0, vw), ey = clamp(z.y + my, 0, vh);
  const k = Math.min(1, 2000 / Math.max(ex - sx, ey - sy));
  const c = document.createElement('canvas');
  c.width = Math.round((ex - sx) * k);
  c.height = Math.round((ey - sy) * k);
  c.getContext('2d').drawImage(v, sx, sy, ex - sx, ey - sy, 0, 0, c.width, c.height);
  camStop();
  const fx = (a.x - sx) * k, fy = (a.y - sy) * k, fw = (z.x - a.x) * k, fh = (z.y - a.y) * k;
  D.src = c;
  D.corners = [{ x: fx, y: fy }, { x: fx + fw, y: fy }, { x: fx + fw, y: fy + fh }, { x: fx, y: fy + fh }];
  D.mids = null;
  D.cornersTouched = false;
  D.detectStarted = false;
  D.step = 'crop';
  render();
}

/* ---------------------------------------------------------------- unrolling a label from a round bottle
   Six points: the four corners and the middle of the top and the bottom edge. The edges become straight,
   and the text squeezed at the sides of the bottle gets its width back. */

const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/* the middle points as they are now: dragged, found, or simply between the corners */
function cropMids() {
  const [tl, tr, br, bl] = D.corners;
  const off = D.mids || [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const t = midOf(tl, tr), b = midOf(bl, br);
  return [{ x: t.x + off[0].x, y: t.y + off[0].y }, { x: b.x + off[1].x, y: b.y + off[1].y }];
}
function setCropMid(i, p) {
  const [tl, tr, br, bl] = D.corners;
  const base = i === 0 ? midOf(tl, tr) : midOf(bl, br);
  D.mids = D.mids || [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  D.mids[i] = { x: p.x - base.x, y: p.y - base.y };
}
/* how strongly the edges bend, compared to the width */
function cropSag(quad, mids) {
  const [tl, tr, br, bl] = quad;
  const w = (dist(tl, tr) + dist(bl, br)) / 2 || 1;
  return Math.max(dist(mids[0], midOf(tl, tr)), dist(mids[1], midOf(bl, br))) / w;
}
const bezPt = (a, c, b, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
/* the control point of a curve that passes through m in its middle */
const bezCtrl = (a, m, b) => ({ x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 });

function warpCurved(srcCanvas, quad, mids, maxSide = 1400) {
  const [tl, tr, br, bl] = quad;
  const ct = bezCtrl(tl, mids[0], tr), cb = bezCtrl(bl, mids[1], br);
  // a label around a bottle: the more the edges bend, the more of the bottle it covers
  const th = clamp(cropSag(quad, mids) * 9, 0, 1.1);
  const unroll = th > 0.05;
  const sOf = u => (unroll ? 0.5 + Math.sin((u - 0.5) * 2 * th) / (2 * Math.sin(th)) : u);
  let W = (dist(tl, tr) + dist(bl, br)) / 2 * (unroll ? th / Math.sin(th) : 1), H = (dist(tl, bl) + dist(tr, br)) / 2;
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(8, Math.round(W * k));
  H = Math.max(8, Math.round(H * k));
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const od = img.data;
  for (let u = 0; u < W; u++) {
    const s = sOf((u + 0.5) / W);
    const T = bezPt(tl, ct, tr, s), B = bezPt(bl, cb, br, s);
    for (let v = 0; v < H; v++) {
      const f = (v + 0.5) / H;
      const x = clamp(T.x + (B.x - T.x) * f - 0.5, 0, sw - 1), y = clamp(T.y + (B.y - T.y) * f - 0.5, 0, sh - 1);
      const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = x - x0, fy = y - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, o = (v * W + u) * 4;
      for (let c = 0; c < 3; c++) {
        const t0 = sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx;
        const t1 = sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx;
        od[o + c] = t0 * (1 - fy) + t1 * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}
/* straight edges keep the exact perspective correction, bent ones are unrolled */
const warpLabel = (src, quad, mids, maxSide) => (cropSag(quad, mids) < 0.012 ? warpQuad(src, quad, maxSide) : warpCurved(src, quad, mids, maxSide));

/* the bend of the edges from the outline found by the scanner: the outline point in the middle of each edge */
function midsFromContour(contour, quad, k) {
  try {
    const d = contour.data32S;
    if (!d || d.length < 8) return null;
    const pts = [];
    for (let i = 0; i < d.length; i += 2) pts.push({ x: d[i] / k, y: d[i + 1] / k });
    const [tl, tr, br, bl] = quad;
    const w = (dist(tl, tr) + dist(bl, br)) / 2, h = (dist(tl, bl) + dist(tr, br)) / 2;
    const near = (a, b, top) => {
      const m = midOf(a, b);
      const cand = pts.filter(p => Math.abs(p.x - m.x) < w * 0.05 && Math.abs(p.y - m.y) < h * 0.2 && (top ? p.y < (tl.y + bl.y) / 2 + h * 0.1 : p.y > (tl.y + bl.y) / 2 - h * 0.1));
      if (!cand.length) return { x: 0, y: 0 };
      cand.sort((p, q) => p.y - q.y);
      const p = cand[cand.length >> 1];
      return { x: 0, y: p.y - m.y };
    };
    const mids = [near(tl, tr, true), near(bl, br, false)];
    return mids.every(m => Math.abs(m.y) < h * 0.12) ? mids : null;
  } catch (e) { return null; }
}

/* the crop step: a small preview of what comes out */
let cropPrevT = 0;
function cropPreview() {
  clearTimeout(cropPrevT);
  cropPrevT = setTimeout(() => {
    const c = $('#crop-prev');
    if (!c || !D || !D.src || !D.corners) return;
    try {
      const out = warpLabel(D.src, D.corners, cropMids(), 260);
      c.width = out.width;
      c.height = out.height;
      c.getContext('2d').drawImage(out, 0, 0);
    } catch (e) { /* corners too close together */ }
  }, 60);
}
