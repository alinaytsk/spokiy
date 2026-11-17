// Procedural textures for the hero scene, drawn on canvases at startup. No image files:
// the board, its traces and the chip markings are generated, so the scene ships as code
// and a reload can never 404 on an asset.
//
// A seeded random generator keeps the layout identical on every visit - the board should
// look like one object, not reshuffle itself each time.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c, { color = true } = {}) {
  const texture = new CanvasTexture(c);
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/**
 * A printed circuit board: solder mask, copper traces routed at 0/45/90 degrees, vias,
 * pads round component footprints and white silkscreen.
 *
 * `keepOut` lists rectangles (in 0..1 board coordinates) where parts sit, so footprints
 * line up with the 3D components placed on top.
 */
export function boardTextures({ seed = 7, width = 2048, height = 1330, keepOut = [] } = {}) {
  const random = rng(seed);
  const c = canvas(width, height);
  const g = c.getContext('2d');

  // Solder mask: deep green with a faint sheen gradient.
  const mask = g.createLinearGradient(0, 0, width, height);
  mask.addColorStop(0, '#1d4a33');
  mask.addColorStop(0.5, '#163d2a');
  mask.addColorStop(1, '#1a4430');
  g.fillStyle = mask;
  g.fillRect(0, 0, width, height);

  // Fine fibre noise so flat areas do not look like plastic.
  for (let i = 0; i < 9000; i += 1) {
    g.fillStyle = `rgba(255,255,255,${random() * 0.025})`;
    g.fillRect(random() * width, random() * height, 1 + random() * 2, 1);
  }

  // Copper traces under the mask: muted gold, slightly raised in tone.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 260; i += 1) {
    let x = Math.round((random() * width) / 8) * 8;
    let y = Math.round((random() * height) / 8) * 8;
    g.beginPath();
    g.moveTo(x, y);
    const segments = 2 + Math.floor(random() * 4);
    for (let k = 0; k < segments; k += 1) {
      const len = 40 + random() * 260;
      const dir = Math.floor(random() * 8);
      const angle = (dir * Math.PI) / 4;
      x += Math.round(Math.cos(angle) * len);
      y += Math.round(Math.sin(angle) * len);
      g.lineTo(x, y);
    }
    const w = random() < 0.15 ? 7 : 2 + random() * 2.5;
    g.strokeStyle = `rgba(191, 160, 92, ${0.35 + random() * 0.3})`;
    g.lineWidth = w;
    g.stroke();
    // A via at the end of most traces.
    if (random() < 0.7) {
      g.fillStyle = 'rgba(214, 188, 120, 0.9)';
      g.beginPath();
      g.arc(x, y, w + 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0d241a';
      g.beginPath();
      g.arc(x, y, w * 0.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Pad rings around every footprint the 3D parts will cover.
  for (const [u, v, uw, vh] of keepOut) {
    const x0 = u * width;
    const y0 = v * height;
    const w = uw * width;
    const h = vh * height;
    g.fillStyle = '#0f2a1d';
    g.fillRect(x0 - 10, y0 - 10, w + 20, h + 20);
    g.fillStyle = 'rgba(206, 178, 110, 0.95)';
    const step = 12;
    for (let px = x0; px < x0 + w; px += step) {
      g.fillRect(px, y0 - 22, 6, 10);
      g.fillRect(px, y0 + h + 12, 6, 10);
    }
    for (let py = y0; py < y0 + h; py += step) {
      g.fillRect(x0 - 22, py, 10, 6);
      g.fillRect(x0 + w + 12, py, 10, 6);
    }
    g.strokeStyle = 'rgba(235, 235, 225, 0.75)';
    g.lineWidth = 2;
    g.strokeRect(x0 - 30, y0 - 30, w + 60, h + 60);
  }

  // Silkscreen designators.
  g.fillStyle = 'rgba(235, 235, 225, 0.7)';
  g.font = '600 18px "Inter", Arial, sans-serif';
  for (let i = 0; i < 70; i += 1) {
    const label = `${'CRUQL'[Math.floor(random() * 5)]}${Math.floor(random() * 90) + 1}`;
    g.fillText(label, random() * width, random() * height);
  }
  g.font = '600 26px "Inter", Arial, sans-serif';
  g.fillText('sPOKiy · COP-UCU · REV B', width * 0.06, height * 0.93);

  // Mounting holes.
  for (const [u, v] of [
    [0.03, 0.05],
    [0.97, 0.05],
    [0.03, 0.95],
    [0.97, 0.95],
  ]) {
    g.fillStyle = 'rgba(214, 188, 120, 1)';
    g.beginPath();
    g.arc(u * width, v * height, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0a0a0a';
    g.beginPath();
    g.arc(u * width, v * height, 15, 0, Math.PI * 2);
    g.fill();
  }

  return finish(c);
}

/** The laser-etched top of an epoxy package. */
export function chipTexture({ title = 'SP-01', subtitle = 'sPOKiy', seed = 3 } = {}) {
  const random = rng(seed);
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#141416';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i += 1) {
    g.fillStyle = `rgba(255,255,255,${random() * 0.03})`;
    g.fillRect(random() * 512, random() * 512, 1, 1);
  }
  g.fillStyle = 'rgba(200, 200, 205, 0.55)';
  g.font = '700 64px "Inter", Arial, sans-serif';
  g.fillText(title, 48, 250);
  g.font = '500 34px "Inter", Arial, sans-serif';
  g.fillText(subtitle, 48, 305);
  g.font = '400 26px "JetBrains Mono", monospace';
  g.fillText('2611 · TW', 48, 355);
  g.beginPath();
  g.arc(70, 70, 16, 0, Math.PI * 2);
  g.fill();
  return finish(c);
}

/** Brushed aluminium: fine streaks, used as a roughness and colour variation. */
export function brushedTexture({ seed = 11 } = {}) {
  const random = rng(seed);
  const c = canvas(1024, 1024);
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i += 1) {
    const y = random() * 1024;
    const shade = 120 + Math.floor(random() * 90);
    g.strokeStyle = `rgba(${shade},${shade},${shade},0.35)`;
    g.lineWidth = random() * 1.6;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y + (random() - 0.5) * 4);
    g.stroke();
  }
  return finish(c, { color: false });
}
