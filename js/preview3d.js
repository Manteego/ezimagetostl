import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Preview3D {
  constructor(container) {
    this.container = container;
    this.mesh = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x08080f);

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    this.camera.position.set(50, -80, 70);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dir1.position.set(1, -0.8, 1.5);
    const dir2 = new THREE.DirectionalLight(0x8899ff, 0.3);
    dir2.position.set(-1, 1, -0.5);
    this.scene.add(ambient, dir1, dir2);

    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(container);

    this._animate();
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  update(heights, gridW, gridH, physW, physH, filaments, baseMm) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    const dx = physW / (gridW - 1);
    const dy = physH / (gridH - 1);

    // Build filament zone boundaries
    const zones = [];
    let cumZ = baseMm;
    for (const f of filaments) {
      const hex = parseInt(f.color.replace('#', ''), 16);
      zones.push({
        maxZ: cumZ + f.thickness,
        r: ((hex >> 16) & 0xff) / 255,
        g: ((hex >>  8) & 0xff) / 255,
        b: ( hex        & 0xff) / 255,
      });
      cumZ += f.thickness;
    }

    const getColor = (z) => {
      for (const zone of zones) {
        if (z <= zone.maxZ) return zone;
      }
      return zones[zones.length - 1] || { r: 0.5, g: 0.5, b: 0.5 };
    };

    const pos    = [];
    const colors = [];
    const idx    = [];

    for (let yi = 0; yi < gridH; yi++) {
      for (let xi = 0; xi < gridW; xi++) {
        const z = Math.max(0.001, heights[yi * gridW + xi]);
        pos.push(xi * dx, yi * dy, z);
        const c = getColor(z);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let yi = 0; yi < gridH - 1; yi++) {
      for (let xi = 0; xi < gridW - 1; xi++) {
        const i00 = yi * gridW + xi;
        const i10 = i00 + 1;
        const i01 = i00 + gridW;
        const i11 = i01 + 1;
        idx.push(i00, i10, i11, i00, i11, i01);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,    3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      shininess: 40,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);

    // Start with a near-top-down view so the image faces the user
    const span = Math.max(physW, physH);
    this.controls.target.set(physW / 2, physH / 2, 0);
    this.camera.position.set(physW / 2, physH / 2 - span * 0.25, span * 1.4);
    this.controls.update();
  }

  showPlaceholder() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
