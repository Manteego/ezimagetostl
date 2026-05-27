import { ImageProcessor  } from './imageProcessor.js';
import { HeightMap       } from './heightMap.js';
import { MeshGenerator   } from './meshGenerator.js';
import { Preview3D       } from './preview3d.js';
import { FilamentEditor  } from './filamentEditor.js';

const RESOLUTION_PPM = { draft: 1.5, standard: 2.5, fine: 4 };
const MAX_GRID  = 400;
const MAX_HISTORY = 10;

class App {
  constructor() {
    this.imgProc  = new ImageProcessor();
    this.hmap     = new HeightMap();
    this.meshGen  = new MeshGenerator();
    this.preview  = new Preview3D(document.getElementById('preview-container'));

    this.filEditor = new FilamentEditor(
      document.getElementById('filament-editor'),
      () => this._onFilamentChange(),
      () => this._saveSnapshot(),
    );

    this._img     = null;
    this._heights = null;
    this._gridW   = 0;
    this._gridH   = 0;
    this._aspect  = 1;
    this._debounce = null;
    this._history  = [];

    this.settings = {
      widthMm:          100,
      heightMm:         100,
      maxHeightMm:      3,
      baseMm:           0.6,
      resolution:       'standard',
      gamma:            1,
      brightness:       0,
      contrast:         1,
      invert:           false,
      textureType:      'none',
      textureIntensity: 0.3,
      textureScale:     0.2,
    };

    this._bindEvents();
    this._drawCurve();
  }

  // ── History ─────────────────────────────────────────────────────────────────

  _saveSnapshot() {
    this._history.push({
      settings:  { ...this.settings },
      filaments: this.filEditor.get().map(f => ({ ...f })),
    });
    if (this._history.length > MAX_HISTORY) this._history.shift();
    this._updateUndoBtn();
  }

  _undo() {
    if (!this._history.length) return;
    const snap = this._history.pop();
    Object.assign(this.settings, snap.settings);
    this._applySettingsToUI();
    this.filEditor.setFilaments(snap.filaments);
    this._reprocess();
    this._updateUndoBtn();
  }

  _updateUndoBtn() {
    const btn = document.getElementById('btn-undo');
    if (!btn) return;
    const n = this._history.length;
    btn.disabled = n === 0;
    btn.title    = n ? `Undo (${n} step${n > 1 ? 's' : ''} available)` : 'Nothing to undo';
  }

  _applySettingsToUI() {
    this._setSlider('width-mm',          this.settings.widthMm);
    this._setSlider('height-mm',         this.settings.heightMm);
    this._setSlider('max-height-mm',     this.settings.maxHeightMm);
    this._setSlider('base-mm',           this.settings.baseMm);
    this._setSlider('gamma',             this.settings.gamma);
    this._setSlider('brightness',        this.settings.brightness);
    this._setSlider('contrast',          this.settings.contrast);
    this._setSlider('texture-intensity', this.settings.textureIntensity);
    this._setSlider('texture-scale',     this.settings.textureScale);

    document.getElementById('invert').checked     = this.settings.invert;
    document.getElementById('texture-type').value = this.settings.textureType;

    document.querySelectorAll('input[name="resolution"]').forEach(r => {
      r.checked = r.value === this.settings.resolution;
    });

    this._drawCurve();
  }

  // ── Event binding ───────────────────────────────────────────────────────────

  _bindEvents() {
    // Dropzone
    const dz = document.getElementById('dropzone');
    const fi = document.getElementById('file-input');

    dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', ()  => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) this._loadImage(f);
    });
    fi.addEventListener('change', e => {
      if (e.target.files[0]) this._loadImage(e.target.files[0]);
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Dimensions (snapshot on mousedown = when user starts dragging)
    this._slider('width-mm', v => {
      this.settings.widthMm = v;
      if (document.getElementById('lock-aspect').checked) {
        const h = Math.round(v / this._aspect);
        this.settings.heightMm = h;
        this._setSlider('height-mm', h);
      }
      this._reprocess();
    });

    this._slider('height-mm', v => {
      this.settings.heightMm = v;
      if (document.getElementById('lock-aspect').checked) {
        const w = Math.round(v * this._aspect);
        this.settings.widthMm = w;
        this._setSlider('width-mm', w);
      }
      this._reprocess();
    });

    this._slider('max-height-mm', v => { this.settings.maxHeightMm = v; this._reprocess(); });
    this._slider('base-mm',       v => { this.settings.baseMm = v;      this._reprocess(); });

    document.querySelectorAll('input[name="resolution"]').forEach(r => {
      r.addEventListener('change', e => {
        this._saveSnapshot();
        this.settings.resolution = e.target.value;
        this._reprocess();
      });
    });

    // Brightness
    this._slider('gamma',      v => { this.settings.gamma      = v; this._reprocess(); this._drawCurve(); });
    this._slider('brightness', v => { this.settings.brightness = v; this._reprocess(); this._drawCurve(); });
    this._slider('contrast',   v => { this.settings.contrast   = v; this._reprocess(); this._drawCurve(); });

    document.getElementById('invert').addEventListener('change', e => {
      this._saveSnapshot();
      this.settings.invert = e.target.checked;
      this._reprocess();
      this._drawCurve();
    });

    // Texture
    document.getElementById('texture-type').addEventListener('change', e => {
      this._saveSnapshot();
      this.settings.textureType = e.target.value;
      this._reprocess();
    });
    this._slider('texture-intensity', v => { this.settings.textureIntensity = v; this._reprocess(); });
    this._slider('texture-scale',     v => { this.settings.textureScale     = v; this._reprocess(); });

    // Undo
    document.getElementById('btn-undo').addEventListener('click', () => this._undo());

    // Export
    document.getElementById('btn-export').addEventListener('click', () => this._export());
  }

  _slider(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    // Save snapshot once when the user starts dragging
    el.addEventListener('mousedown', () => this._saveSnapshot());
    el.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      const badge = document.getElementById(`${id}-val`);
      if (badge) badge.textContent = Number.isInteger(parseFloat(el.step)) ? v : v.toFixed(2);
      fn(v);
    });
  }

  _setSlider(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val;
    const badge = document.getElementById(`${id}-val`);
    if (badge) {
      const step = parseFloat(el.step || '1');
      badge.textContent = Number.isInteger(step) ? val : (+val).toFixed(2);
    }
  }

  // ── Image loading ───────────────────────────────────────────────────────────

  async _loadImage(file) {
    try {
      this._img    = await this.imgProc.loadImage(file);
      this._aspect = this.imgProc.aspectRatio;

      const h = Math.round(this.settings.widthMm / this._aspect);
      this.settings.heightMm = h;
      this._setSlider('height-mm', h);

      const objUrl = URL.createObjectURL(file);
      const dzc    = document.getElementById('dropzone-content');
      dzc.innerHTML = `
        <img src="${objUrl}" alt="Uploaded image" onload="URL.revokeObjectURL(this.src)" />
        <span>${file.name} &nbsp;<span style="color:#556;font-size:11px">${this.imgProc.originalWidth}&times;${this.imgProc.originalHeight}</span></span>
      `;

      this._reprocess();
    } catch (err) {
      console.error('Image load failed:', err);
    }
  }

  // ── Processing pipeline ─────────────────────────────────────────────────────

  _reprocess() {
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this._run(), 80);
  }

  _run() {
    if (!this._img) return;

    const ppm = RESOLUTION_PPM[this.settings.resolution] || 2.5;
    let gW    = Math.round(this.settings.widthMm  * ppm) + 1;
    let gH    = Math.round(this.settings.heightMm * ppm) + 1;

    if (gW > MAX_GRID || gH > MAX_GRID) {
      const s = MAX_GRID / Math.max(gW, gH);
      gW = Math.round(gW * s);
      gH = Math.round(gH * s);
    }

    gW = Math.max(gW, 2);
    gH = Math.max(gH, 2);

    this._gridW = gW;
    this._gridH = gH;

    const filaments      = this.filEditor.get();
    const totalFilHeight = filaments.reduce((s, f) => s + f.thickness, 0);

    const gray = this.imgProc.process(this._img, gW, gH, {
      gamma:      this.settings.gamma,
      brightness: this.settings.brightness,
      contrast:   this.settings.contrast,
      invert:     this.settings.invert,
    });

    this._heights = this.hmap.generate(gray, gW, gH, {
      baseMm:           this.settings.baseMm,
      maxHeightMm:      totalFilHeight,
      textureType:      this.settings.textureType,
      textureIntensity: this.settings.textureIntensity,
      textureScale:     this.settings.textureScale,
    });

    this.preview.update(
      this._heights, gW, gH,
      this.settings.widthMm, this.settings.heightMm,
      filaments, this.settings.baseMm,
    );

    this._updateSwapTable(filaments);
    document.getElementById('btn-export').disabled = false;
    document.getElementById('preview-placeholder').style.display = 'none';
  }

  _onFilamentChange() {
    if (!this._heights) return;
    const filaments = this.filEditor.get();
    this.preview.update(
      this._heights, this._gridW, this._gridH,
      this.settings.widthMm, this.settings.heightMm,
      filaments, this.settings.baseMm,
    );
    this._updateSwapTable(filaments);
  }

  // ── Layer swap table ────────────────────────────────────────────────────────

  _updateSwapTable(filaments) {
    const tbody = document.querySelector('#layer-swap-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let cumZ = 0;
    filaments.forEach((f, i) => {
      const startZ     = cumZ;
      const printThick = i === 0 ? this.settings.baseMm + f.thickness : f.thickness;
      cumZ += printThick;

      const tr     = document.createElement('tr');
      const dot    = `<span class="swap-dot" style="background:${f.color}"></span>`;
      const action = i === 0
        ? '<span class="action-badge start">Start</span>'
        : `<span class="action-badge swap">Swap at ${startZ.toFixed(2)} mm</span>`;

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${dot}${f.name}</td>
        <td>${startZ.toFixed(2)} mm</td>
        <td>${cumZ.toFixed(2)} mm</td>
        <td>${action}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Curve preview canvas ────────────────────────────────────────────────────

  _drawCurve() {
    const canvas = document.getElementById('curve-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    const { gamma, brightness, contrast, invert } = this.settings;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1e1e38';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(i*w/4, 0); ctx.lineTo(i*w/4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*h/4); ctx.lineTo(w, i*h/4); ctx.stroke();
    }

    ctx.strokeStyle = '#2a2a50';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();

    ctx.strokeStyle = '#4d9fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      let v = px / (w - 1);
      v += brightness / 100;
      v  = (v - 0.5) * contrast + 0.5;
      v  = Math.pow(Math.max(0, v), gamma);
      if (invert) v = 1 - v;
      v  = Math.max(0, Math.min(1, v));
      const py = h - v * h;
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // ── STL export ──────────────────────────────────────────────────────────────

  _export() {
    if (!this._heights) return;
    const buf = this.meshGen.generate(
      this._heights, this._gridW, this._gridH,
      this.settings.widthMm, this.settings.heightMm,
    );
    this.meshGen.download(buf, 'image3d.stl');
  }
}

window.addEventListener('DOMContentLoaded', () => new App());
