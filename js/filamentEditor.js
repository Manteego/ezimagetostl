export class FilamentEditor {
  constructor(container, onChange, onBeforeChange) {
    this.container      = container;
    this.onChange       = onChange;
    this.onBeforeChange = onBeforeChange || (() => {});
    this.filaments = [
      { name: 'White (Base)',  color: '#f0f0f0', thickness: 0.6 },
      { name: 'Gray (Mid)',    color: '#7a7a7a', thickness: 0.4 },
      { name: 'Black (Top)',   color: '#1a1a1a', thickness: 0.4 },
    ];
    this._dragSrc = null;
    this._render();
  }

  get() { return this.filaments; }

  setFilaments(filaments) {
    this.filaments = filaments.map(f => ({ ...f }));
    this._render();
  }

  _render() {
    this.container.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'filament-list';

    this.filaments.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'filament-row';
      row.draggable = true;
      row.dataset.i = i;

      row.innerHTML = `
        <span class="drag-handle" title="Drag to reorder">&#x2807;</span>
        <input type="color" class="fil-color" value="${f.color}" title="Filament color" />
        <input type="text"  class="fil-name"  value="${f.name}"  placeholder="Name" />
        <span class="fil-thick-wrap">
          <input type="number" class="fil-thick" value="${f.thickness}" min="0.1" max="10" step="0.1" />
          <span class="fil-thick-unit">mm</span>
        </span>
        <button class="fil-del" title="Remove filament">&times;</button>
      `;

      // Save snapshot when user starts picking a color (mousedown fires once)
      row.querySelector('.fil-color').addEventListener('mousedown', () => this.onBeforeChange());
      row.querySelector('.fil-color').addEventListener('input', e => {
        this.filaments[i].color = e.target.value;
        this.onChange();
      });

      row.querySelector('.fil-name').addEventListener('input', e => {
        this.filaments[i].name = e.target.value;
      });

      // Save snapshot when thickness field gains focus (one snapshot per edit session)
      row.querySelector('.fil-thick').addEventListener('focus', () => this.onBeforeChange());
      row.querySelector('.fil-thick').addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        if (v > 0) { this.filaments[i].thickness = v; this.onChange(); }
      });

      row.querySelector('.fil-del').addEventListener('click', () => {
        if (this.filaments.length <= 1) return;
        this.onBeforeChange();
        this.filaments.splice(i, 1);
        this._render();
        this.onChange();
      });

      // Drag reorder — snapshot on drag start
      row.addEventListener('dragstart', e => {
        this.onBeforeChange();
        this._dragSrc = i;
        e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => { row.style.opacity = ''; });
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (this._dragSrc === null || this._dragSrc === i) return;
        const [item] = this.filaments.splice(this._dragSrc, 1);
        this.filaments.splice(i, 0, item);
        this._dragSrc = null;
        this._render();
        this.onChange();
      });

      list.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-filament';
    addBtn.textContent = '+ Add Filament';
    addBtn.addEventListener('click', () => {
      this.onBeforeChange();
      this.filaments.push({ name: 'New Filament', color: '#ff6600', thickness: 0.4 });
      this._render();
      this.onChange();
    });

    this.container.appendChild(list);
    this.container.appendChild(addBtn);
  }
}
