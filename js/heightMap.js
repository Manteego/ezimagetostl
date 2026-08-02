export class HeightMap {
  generate(grayscale, width, height, { baseMm, maxHeightMm, textureType, textureIntensity, textureScale, smoothing = 0 }) {
    const heights = new Float32Array(width * height);

    for (let i = 0; i < grayscale.length; i++) {
      // Dark pixel (0) = tall; bright pixel (1) = short (baseMm only)
      heights[i] = baseMm + (1 - grayscale[i]) * maxHeightMm;
    }

    if (textureType !== 'none') {
      this._applyTexture(heights, width, height, textureType, textureIntensity, textureScale);
    }

    // Smooth the surface: softens pixel-scale steps and merges the tiny isolated
    // peaks that otherwise become thousands of separate infill regions per layer,
    // which is what makes slicers crawl on "generating infill regions".
    if (smoothing > 0) {
      this._smooth(heights, width, height, Math.round(smoothing));
    }

    // Clamp to valid range
    const maxH = baseMm + maxHeightMm + textureIntensity;
    for (let i = 0; i < heights.length; i++) {
      heights[i] = Math.max(0.01, Math.min(maxH, heights[i]));
    }

    return heights;
  }

  // Separable 3-tap box blur, `iterations` passes (approximates a Gaussian).
  _smooth(heights, width, height, iterations) {
    const tmp = new Float32Array(heights.length);
    for (let it = 0; it < iterations; it++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const l = x > 0         ? heights[i - 1] : heights[i];
          const r = x < width - 1 ? heights[i + 1] : heights[i];
          tmp[i] = (l + heights[i] + r) / 3;
        }
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const u = y > 0          ? tmp[i - width] : tmp[i];
          const d = y < height - 1 ? tmp[i + width] : tmp[i];
          heights[i] = (u + tmp[i] + d) / 3;
        }
      }
    }
  }

  _applyTexture(heights, width, height, type, intensity, scale) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let overlay = 0;

        if (type === 'noise') {
          overlay = this._fbm(x * scale, y * scale, 4);
        } else if (type === 'crosshatch') {
          overlay = this._crosshatch(x, y, scale);
        } else if (type === 'woodgrain') {
          overlay = this._woodgrain(x, y, scale);
        }

        // overlay is [0..1]; shift to [-0.5..0.5] and scale by intensity
        heights[i] += (overlay - 0.5) * intensity * 2;
      }
    }
  }

  _fbm(x, y, octaves) {
    let val = 0, amp = 0.5, freq = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      val += this._valueNoise(x * freq, y * freq) * amp;
      total += amp;
      freq *= 2;
      amp *= 0.5;
    }
    return val / total;
  }

  _valueNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const ux = xf * xf * (3 - 2 * xf);
    const uy = yf * yf * (3 - 2 * yf);

    const v00 = this._hash(xi,     yi);
    const v10 = this._hash(xi + 1, yi);
    const v01 = this._hash(xi,     yi + 1);
    const v11 = this._hash(xi + 1, yi + 1);

    return v00*(1-ux)*(1-uy) + v10*ux*(1-uy) + v01*(1-ux)*uy + v11*ux*uy;
  }

  _hash(x, y) {
    let n = Math.imul(x, 1234567) ^ Math.imul(y, 7654321);
    n = n ^ (n >>> 13);
    n = Math.imul(n, 1274126177);
    n = n ^ (n >>> 16);
    return ((n >>> 0) & 0xffff) / 0xffff;
  }

  _crosshatch(x, y, scale) {
    const u = 0.5 + 0.5 * Math.sin(x * scale * Math.PI * 2);
    const v = 0.5 + 0.5 * Math.sin(y * scale * Math.PI * 2);
    return Math.max(u, v);
  }

  _woodgrain(x, y, scale) {
    const fiber = this._fbm(x * scale * 0.4, y * scale * 0.4, 3);
    return 0.5 + 0.5 * Math.sin((x * scale + fiber * 6) * Math.PI);
  }
}
