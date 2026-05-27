export class ImageProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.originalWidth = 0;
    this.originalHeight = 0;
    this._img = null;
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
    for (let i = 0; i < gray.length; i++) {
      const r = data[i * 4]     / 255;
      const g = data[i * 4 + 1] / 255;
      const b = data[i * 4 + 2] / 255;
      gray[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    return this.applyCurves(gray, settings);
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
