import { FILAMENT_LIBRARY } from './filamentLibrary.js';

/**
 * Detects the dominant colors in an image (median-cut quantization) and matches
 * each to the nearest filament in the built-in library using perceptual (CIELAB)
 * color distance. Returns a filament stack ordered light -> dark (print order),
 * which suits the app's luminance model (bright pixels expose the bottom filament).
 */
export class ColorDetector {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    // Precompute Lab for every library filament once.
    this._library = FILAMENT_LIBRARY.map(f => {
      const rgb = hexToRgb(f.hex);
      return { ...f, rgb, lab: rgbToLab(rgb) };
    });
  }

  /**
   * @param {HTMLImageElement} img
   * @param {number} count  desired number of palette colors (2..8)
   * @returns {{
   *   detected: {rgb:number[], hex:string, population:number}[],
   *   stack: {name:string, hex:string, color:string, detectedHex:string,
   *           deltaE:number, population:number, luminance:number}[]
   * }}
   */
  analyze(img, count = 5) {
    const pixels = this._samplePixels(img);
    if (!pixels.length) return { detected: [], stack: [] };

    const boxes = medianCut(pixels, Math.max(2, Math.min(8, count)));
    const total = boxes.reduce((s, b) => s + b.population, 0) || 1;

    const detected = boxes.map(b => ({
      rgb: b.rgb,
      hex: rgbToHex(b.rgb),
      population: b.population / total,
    }));

    // Match each detected color to its nearest library filament.
    const matched = detected.map(d => {
      const lab = rgbToLab(d.rgb);
      let best = this._library[0];
      let bestDist = Infinity;
      for (const fil of this._library) {
        const dist = deltaE(lab, fil.lab);
        if (dist < bestDist) { bestDist = dist; best = fil; }
      }
      return {
        name: best.name,
        hex: best.hex,
        color: best.hex,               // FilamentEditor expects `color`
        detectedHex: d.hex,
        deltaE: bestDist,
        population: d.population,
        luminance: relLuminance(best.rgb),
      };
    });

    // Collapse duplicates (several detected colors can map to one filament),
    // summing their population share and keeping the closest match.
    const byName = new Map();
    for (const m of matched) {
      const prev = byName.get(m.name);
      if (!prev) {
        byName.set(m.name, { ...m });
      } else {
        prev.population += m.population;
        if (m.deltaE < prev.deltaE) prev.detectedHex = m.detectedHex;
        prev.deltaE = Math.min(prev.deltaE, m.deltaE);
      }
    }

    // Print order: lightest at the bottom (index 0 = base = exposed by bright pixels),
    // darkest on top. Bright image pixels sit low in the height field, so the base
    // filament must be the lightest for the preview/print to match the photo's tones.
    const stack = [...byName.values()].sort((a, b) => b.luminance - a.luminance);

    return { detected, stack };
  }

  /**
   * Full-color mode: assign every grid cell the color of its nearest filament
   * (by perceptual CIELAB distance to the cell's ACTUAL image color).
   * @param {Uint8ClampedArray} rgbGrid  flat [r,g,b, r,g,b, ...] per grid cell
   * @param {{color:string}[]} filaments the applied filament stack
   * @returns {{ colors: Float32Array, counts: number[] }}
   *   colors: per-cell rgb in 0..1 for the mesh; counts: pixels assigned to each filament
   */
  mapToFilaments(rgbGrid, filaments) {
    const pal = filaments.map(f => {
      const rgb = hexToRgb(f.color);
      return { rgb, lab: rgbToLab(rgb) };
    });
    const n = rgbGrid.length / 3;
    const colors = new Float32Array(n * 3);
    const counts = new Array(filaments.length).fill(0);

    for (let i = 0; i < n; i++) {
      const lab = rgbToLab([rgbGrid[i * 3], rgbGrid[i * 3 + 1], rgbGrid[i * 3 + 2]]);
      let best = 0, bestDist = Infinity;
      for (let p = 0; p < pal.length; p++) {
        const d = deltaE(lab, pal[p].lab);
        if (d < bestDist) { bestDist = d; best = p; }
      }
      counts[best]++;
      colors[i * 3]     = pal[best].rgb[0] / 255;
      colors[i * 3 + 1] = pal[best].rgb[1] / 255;
      colors[i * 3 + 2] = pal[best].rgb[2] / 255;
    }
    return { colors, counts };
  }

  _samplePixels(img, maxDim = 128) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(img, 0, 0, w, h);
    const { data } = this.ctx.getImageData(0, 0, w, h);

    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // skip mostly-transparent pixels
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    return pixels;
  }
}

// ── Median-cut quantization ───────────────────────────────────────────────────

function medianCut(pixels, targetCount) {
  let boxes = [makeBox(pixels)];

  while (boxes.length < targetCount) {
    // Split the box with the largest color range that still has >1 pixel.
    let idx = -1, maxRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pixels.length > 1 && boxes[i].range > maxRange) {
        maxRange = boxes[i].range;
        idx = i;
      }
    }
    if (idx === -1) break; // nothing left to split

    const [a, b] = splitBox(boxes[idx]);
    boxes.splice(idx, 1, a, b);
  }

  return boxes.map(b => ({ rgb: averageColor(b.pixels), population: b.pixels.length }));
}

function makeBox(pixels) {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const p of pixels) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
    }
  }
  const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const longest = ranges[0] >= ranges[1] && ranges[0] >= ranges[2] ? 0 : ranges[1] >= ranges[2] ? 1 : 2;
  return { pixels, longest, range: ranges[longest] };
}

function splitBox(box) {
  const ch = box.longest;
  const sorted = box.pixels.slice().sort((p, q) => p[ch] - q[ch]);
  const mid = sorted.length >> 1;
  return [makeBox(sorted.slice(0, mid)), makeBox(sorted.slice(mid))];
}

function averageColor(pixels) {
  const sum = [0, 0, 0];
  for (const p of pixels) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
  const n = pixels.length || 1;
  return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
}

// ── Color math ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]) {
  const c = v => v.toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relLuminance([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// sRGB (0..255) -> CIELAB (D65)
function rgbToLab([r, g, b]) {
  const lin = v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);

  // linear RGB -> XYZ (D65)
  let x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;

  // normalize by D65 white point
  x /= 0.95047; y /= 1.0; z /= 1.08883;

  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIE76 delta-E
function deltaE([l1, a1, b1], [l2, a2, b2]) {
  const dl = l1 - l2, da = a1 - a2, db = b1 - b2;
  return Math.sqrt(dl * dl + da * da + db * db);
}
