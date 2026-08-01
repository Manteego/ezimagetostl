export class ImageProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.originalWidth = 0;
    this.originalHeight = 0;
    this._img = null;
    this.rgbGrid = null; // raw downsampled RGB (flat, Y-flipped) from the last process()
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        this.originalWidth = img.width;
        this.originalHeight = img.height;
        this._img = img;
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
      img.src = url;
    });
  }

  process(img, targetW, targetH, settings) {
    this.canvas.width = targetW;
    this.canvas.height = targetH;
    this.ctx.drawImage(img, 0, 0, targetW, targetH);
    const { data } = this.ctx.getImageData(0, 0, targetW, targetH);

    const gray = new Float32Array(targetW * targetH);
    const rgb  = new Uint8ClampedArray(targetW * targetH * 3);
    for (let yi = 0; yi < targetH; yi++) {
      const srcYi = targetH - 1 - yi; // flip Y: canvas row 0 = image top, 3D y=0 = near edge
      for (let xi = 0; xi < targetW; xi++) {
        const src = (srcYi * targetW + xi) * 4;
        const cell = yi * targetW + xi;
        const r = data[src], g = data[src + 1], b = data[src + 2];
        rgb[cell * 3] = r; rgb[cell * 3 + 1] = g; rgb[cell * 3 + 2] = b;
        gray[cell] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      }
    }
    this.rgbGrid = rgb;

    return this.applyCurves(gray, settings);
  }

  /**
   * Auto-levels: sample the image and return luminance percentiles in 0..1,
   * used to derive brightness/contrast/gamma that use the full tonal range.
   */
  autoLevels(img, sample = 160) {
    const scale = Math.min(1, sample / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(img, 0, 0, w, h);
    const { data } = this.ctx.getImageData(0, 0, w, h);

    const lum = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      lum.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
    }
    if (!lum.length) return { lo: 0, hi: 1, median: 0.5 };
    lum.sort((a, b) => a - b);
    const q = p => lum[Math.min(lum.length - 1, Math.max(0, Math.floor(p * (lum.length - 1))))];
    return { lo: q(0.02), hi: q(0.98), median: q(0.5) };
  }

  applyCurves(gray, { gamma, brightness, contrast, invert }) {
    const out = new Float32Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
      let v = gray[i];
      v += brightness / 100;
      v = (v - 0.5) * contrast + 0.5;
      v = Math.pow(Math.max(0, v), gamma);
      if (invert) v = 1 - v;
      out[i] = Math.max(0, Math.min(1, v));
    }
    return out;
  }

  get aspectRatio() {
    return this.originalWidth / (this.originalHeight || 1);
  }
}
