import { zipSync, strToU8 } from 'fflate';

export class ThreeMfExporter {
  generate(heights, gridW, gridH, physW, physH, filaments, baseMm) {
    const modelXml    = this._model(heights, gridW, gridH, physW, physH);
    const settingsXml = this._modelSettings(filaments, baseMm);

    const zip = zipSync({
      '[Content_Types].xml':            [strToU8(this._contentTypes()), { level: 6 }],
      '_rels/.rels':                    [strToU8(this._rels()),         { level: 6 }],
      '3D/3dmodel.model':               [strToU8(modelXml),            { level: 6 }],
      'Metadata/model_settings.config': [strToU8(settingsXml),         { level: 6 }],
    });

    return zip; // Uint8Array (ZIP)
  }

  _contentTypes() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="application/xml"/>
</Types>`;
  }

  _rels() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  }

  _model(heights, gridW, gridH, physW, physH) {
    const dx = physW / (gridW - 1);
    const dy = physH / (gridH - 1);
    const nTop = gridW * gridH;

    // Vertex index helpers
    const tIdx = (xi, yi) => yi * gridW + xi;
    const bIdx = (xi, yi) => nTop + yi * gridW + xi;

    const verts = [];
    // Top surface vertices
    for (let yi = 0; yi < gridH; yi++) {
      for (let xi = 0; xi < gridW; xi++) {
        const z = Math.max(0.001, heights[yi * gridW + xi]);
        verts.push(`<vertex x="${(xi*dx).toFixed(4)}" y="${(yi*dy).toFixed(4)}" z="${z.toFixed(4)}"/>`);
      }
    }
    // Bottom surface vertices (flat at z=0)
    for (let yi = 0; yi < gridH; yi++) {
      for (let xi = 0; xi < gridW; xi++) {
        verts.push(`<vertex x="${(xi*dx).toFixed(4)}" y="${(yi*dy).toFixed(4)}" z="0.0000"/>`);
      }
    }

    const tris = [];

    // ── Top surface (CCW from above → normal +Z) ──────────────────────────────
    for (let yi = 0; yi < gridH - 1; yi++) {
      for (let xi = 0; xi < gridW - 1; xi++) {
        const t00=tIdx(xi,yi), t10=tIdx(xi+1,yi), t01=tIdx(xi,yi+1), t11=tIdx(xi+1,yi+1);
        tris.push(`<triangle v1="${t00}" v2="${t10}" v3="${t11}"/>`);
        tris.push(`<triangle v1="${t00}" v2="${t11}" v3="${t01}"/>`);
      }
    }

    // ── Bottom surface (CCW from below → normal -Z) ───────────────────────────
    for (let yi = 0; yi < gridH - 1; yi++) {
      for (let xi = 0; xi < gridW - 1; xi++) {
        const b00=bIdx(xi,yi), b10=bIdx(xi+1,yi), b01=bIdx(xi,yi+1), b11=bIdx(xi+1,yi+1);
        tris.push(`<triangle v1="${b00}" v2="${b11}" v3="${b10}"/>`);
        tris.push(`<triangle v1="${b00}" v2="${b01}" v3="${b11}"/>`);
      }
    }

    // ── Front wall (yi=0, normal -Y) ─────────────────────────────────────────
    for (let xi = 0; xi < gridW - 1; xi++) {
      const t0=tIdx(xi,0), t1=tIdx(xi+1,0), b0=bIdx(xi,0), b1=bIdx(xi+1,0);
      tris.push(`<triangle v1="${b0}" v2="${b1}" v3="${t1}"/>`);
      tris.push(`<triangle v1="${b0}" v2="${t1}" v3="${t0}"/>`);
    }

    // ── Back wall (yi=gridH-1, normal +Y) ────────────────────────────────────
    for (let xi = 0; xi < gridW - 1; xi++) {
      const yi=gridH-1, t0=tIdx(xi,yi), t1=tIdx(xi+1,yi), b0=bIdx(xi,yi), b1=bIdx(xi+1,yi);
      tris.push(`<triangle v1="${b0}" v2="${t0}" v3="${b1}"/>`);
      tris.push(`<triangle v1="${t0}" v2="${t1}" v3="${b1}"/>`);
    }

    // ── Left wall (xi=0, normal -X) ───────────────────────────────────────────
    for (let yi = 0; yi < gridH - 1; yi++) {
      const t0=tIdx(0,yi), t1=tIdx(0,yi+1), b0=bIdx(0,yi), b1=bIdx(0,yi+1);
      tris.push(`<triangle v1="${b0}" v2="${t0}" v3="${t1}"/>`);
      tris.push(`<triangle v1="${b0}" v2="${t1}" v3="${b1}"/>`);
    }

    // ── Right wall (xi=gridW-1, normal +X) ───────────────────────────────────
    for (let yi = 0; yi < gridH - 1; yi++) {
      const xi=gridW-1, t0=tIdx(xi,yi), t1=tIdx(xi,yi+1), b0=bIdx(xi,yi), b1=bIdx(xi,yi+1);
      tris.push(`<triangle v1="${b0}" v2="${b1}" v3="${t0}"/>`);
      tris.push(`<triangle v1="${t0}" v2="${b1}" v3="${t1}"/>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">
  <resources>
    <object id="1" type="model" slic3rpe:extruder="1">
      <mesh>
        <vertices>
          ${verts.join('\n          ')}
        </vertices>
        <triangles>
          ${tris.join('\n          ')}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
  </build>
</model>`;
  }

  /**
   * Bambu Studio / OrcaSlicer model_settings.config
   *
   * layer_config_ranges assigns an extruder to each z-height band.
   * Bambu Studio with AMS reads this and automatically queues filament
   * changes at the correct layer heights. For manual (non-AMS) printers,
   * it inserts pause/color-change markers in the preview.
   */
  _modelSettings(filaments, baseMm) {
    // Build z-ranges: each filament occupies its cumulative z band.
    // Filament 1 covers [0, baseMm + fil[0].thickness].
    // Filament N covers its own thickness on top.
    const ranges = [];
    let cumZ = 0;
    filaments.forEach((f, i) => {
      const startZ = cumZ;
      const thick  = i === 0 ? baseMm + f.thickness : f.thickness;
      cumZ = +(cumZ + thick).toFixed(4);

      ranges.push(`      <range min_z="${startZ.toFixed(4)}" max_z="${cumZ.toFixed(4)}">
        <metadata key="extruder" value="${i + 1}"/>
      </range>`);
    });

    const filamentColorAttr = filaments
      .map(f => f.color)
      .join(';');

    return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="1">
    <metadata key="extruder" value="1"/>
    <metadata key="filament_color" value="${filamentColorAttr}"/>
    <layer_config_ranges>
${ranges.join('\n')}
    </layer_config_ranges>
  </object>
</config>`;
  }

  download(data, filename = 'model.3mf') {
    const blob = new Blob([data], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
}
