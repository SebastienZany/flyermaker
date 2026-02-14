import { EventBus } from './core/EventBus';
import { DocumentModel } from './model/Document';
import type { BlendMode, Layer } from './model/Layer';
import { Layer as LayerModel } from './model/Layer';
import { Renderer } from './renderer/Renderer';
import { Viewport } from './renderer/Viewport';
import { RulerRenderer } from './renderer/RulerRenderer';
import { LayersPanel } from './ui/LayersPanel';

declare const __BUILD_TAG__: string;

interface AppEvents { rerender: undefined; }
type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

const BLEND_OPTIONS: BlendMode[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];

const TOOL_HELP: Record<string, string> = {
  Move: 'Move tool: drag selected layers to reposition. Drag corner handles to resize.',
  Select: 'Select tool: keeps layer focus while you adjust transform/layer settings.',
  Hand: 'Hand tool: click-drag to pan the full document view.',
  Zoom: 'Zoom tool: use wheel or +/- controls to zoom the document and rulers in 5% steps.'
};

export class App {
  private readonly events = new EventBus<AppEvents>();
  private readonly doc = new DocumentModel();
  private readonly viewport = new Viewport();
  private readonly renderer: Renderer;
  private readonly rulerRenderer = new RulerRenderer();
  private readonly layersPanel: LayersPanel;
  private activeTool = 'Move';
  private autoSelect = true;
  private activeMenu: string | null = null;
  private hoveredHelp: string | null = null;

  private dragMode: DragMode | null = null;
  private dragLayerId: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOrigin = { x: 0, y: 0, width: 0, height: 0 };
  private panning = false;
  private panStartClientX = 0;
  private panStartClientY = 0;

  constructor(private readonly root: HTMLElement) {
    this.doc.width = 800;
    this.doc.height = 600;
    this.viewport.zoom = 1;
    this.root.innerHTML = this.template();

    const canvas = this.root.querySelector<HTMLCanvasElement>('#main-canvas');
    if (!canvas) throw new Error('Main canvas missing');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    this.renderer = new Renderer(ctx);

    const layersRoot = this.root.querySelector<HTMLElement>('#layers-list');
    if (!layersRoot) throw new Error('Layers panel missing');
    this.layersPanel = new LayersPanel(layersRoot, {
      onSelectLayer: (id) => { this.doc.activeLayerId = id; this.syncLayerControls(); this.events.emit('rerender', undefined); },
      onDeleteLayer: (id) => { this.doc.deleteLayer(id); this.syncLayerControls(); this.events.emit('rerender', undefined); },
      onToggleVisibility: (id) => {
        const layer = this.doc.layers.find((entry) => entry.id === id);
        if (!layer) return;
        layer.visible = !layer.visible;
        this.events.emit('rerender', undefined);
      }
    });

    this.bindControls(canvas);
    window.addEventListener('resize', () => this.events.emit('rerender', undefined));
    this.events.on('rerender', () => this.refreshUI());
    this.events.emit('rerender', undefined);
  }

  private bindControls(canvas: HTMLCanvasElement): void {
    this.root.querySelectorAll<HTMLElement>('.menu-item').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        const menu = item.dataset.menu;
        if (!menu) return;
        this.activeMenu = this.activeMenu === menu ? null : menu;
        this.syncMenuState();
      });
    });

    this.root.querySelectorAll<HTMLElement>('.menu-action').forEach((item) => {
      item.addEventListener('click', async () => {
        const action = item.dataset.menuAction;
        if (!action) return;
        await this.handleMenuAction(action);
        this.activeMenu = null;
        this.syncMenuState();
      });
    });

    this.root.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.menu-group')) return;
      this.activeMenu = null;
      this.syncMenuState();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      this.activeMenu = null;
      this.syncMenuState();
    });

    this.root.querySelectorAll<HTMLElement>('.tool-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.root.querySelectorAll('.tool-btn').forEach((entry) => entry.classList.remove('active'));
        button.classList.add('active');
        this.activeTool = button.dataset.tool ?? 'Move';
        const toolSelect = this.root.querySelector<HTMLSelectElement>('#tool-select');
        if (toolSelect) toolSelect.value = this.activeTool;
        this.events.emit('rerender', undefined);
      });
    });

    this.root.querySelector<HTMLSelectElement>('#tool-select')?.addEventListener('change', (event) => {
      const selected = (event.target as HTMLSelectElement).value;
      this.activeTool = selected;
      this.root.querySelectorAll<HTMLElement>('.tool-btn').forEach((entry) => entry.classList.toggle('active', entry.dataset.tool === selected));
      this.events.emit('rerender', undefined);
    });

    this.root.querySelector<HTMLInputElement>('#auto-select')?.addEventListener('change', (event) => {
      this.autoSelect = (event.target as HTMLInputElement).checked;
    });

    this.root.querySelector('#apply-doc-size')?.addEventListener('click', () => this.applyDocumentSize());
    this.root.querySelectorAll<HTMLInputElement>('#doc-width,#doc-height').forEach((input) => {
      input.addEventListener('change', () => this.applyDocumentSize());
    });

    this.root.querySelector('#add-layer')?.addEventListener('click', () => {
      const layer = this.doc.addLayer(new LayerModel(`Layer ${this.doc.layers.length + 1}`));
      layer.width = this.doc.width * 0.4;
      layer.height = this.doc.height * 0.4;
      layer.x = this.doc.width * 0.3;
      layer.y = this.doc.height * 0.3;
      this.syncLayerControls();
      this.events.emit('rerender', undefined);
    });

    this.root.querySelector('#zoom-in')?.addEventListener('click', () => this.applyZoom(0.05));
    this.root.querySelector('#zoom-out')?.addEventListener('click', () => this.applyZoom(-0.05));
    this.root.querySelector('#zoom-fit')?.addEventListener('click', () => this.fitToViewport());

    this.root.querySelector('#blend-select')?.addEventListener('change', (event) => {
      const layer = this.doc.activeLayer;
      if (!layer) return;
      layer.blendMode = (event.target as HTMLSelectElement).value as BlendMode;
      this.events.emit('rerender', undefined);
    });

    this.root.querySelector('#opacity-input')?.addEventListener('change', (event) => {
      const layer = this.doc.activeLayer;
      if (!layer) return;
      const value = Math.min(100, Math.max(0, Number((event.target as HTMLInputElement).value.replace('%', '')) || 0));
      layer.opacity = value / 100;
      this.syncLayerControls();
      this.events.emit('rerender', undefined);
    });

    this.root.querySelector('#opacity-track')?.addEventListener('click', (event) => {
      const layer = this.doc.activeLayer;
      if (!layer) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const ratio = ((event as MouseEvent).clientX - rect.left) / rect.width;
      layer.opacity = Math.min(1, Math.max(0, ratio));
      this.syncLayerControls();
      this.events.emit('rerender', undefined);
    });

    for (const key of ['x', 'y', 'w', 'h'] as const) {
      this.root.querySelector<HTMLInputElement>(`#transform-${key}`)?.addEventListener('change', () => this.applyTransformInputs());
    }

    const fileInput = this.root.querySelector<HTMLInputElement>('#file-input');
    fileInput?.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await this.importFile(file);
      (event.target as HTMLInputElement).value = '';
    });

    const canvasWrap = this.root.querySelector<HTMLElement>('#canvas-wrap');
    canvasWrap?.addEventListener('dragover', (event) => { event.preventDefault(); canvasWrap.classList.add('drag-over'); });
    canvasWrap?.addEventListener('dragleave', () => canvasWrap.classList.remove('drag-over'));
    canvasWrap?.addEventListener('drop', async (event) => {
      event.preventDefault();
      canvasWrap.classList.remove('drag-over');
      const file = event.dataTransfer?.files?.[0];
      if (file) await this.importFile(file);
    });

    canvas.addEventListener('mousemove', (event) => {
      const point = this.screenToCanvas(event, canvas);

      if (this.panning) {
        const dx = event.clientX - this.panStartClientX;
        const dy = event.clientY - this.panStartClientY;
        this.viewport.panBy(dx, dy);
        this.panStartClientX = event.clientX;
        this.panStartClientY = event.clientY;
        this.events.emit('rerender', undefined);
        return;
      }
      this.onCanvasDrag(point);
    });

    canvas.addEventListener('mousedown', (event) => {
      if (this.activeTool === 'Hand') {
        this.panning = true;
        this.panStartClientX = event.clientX;
        this.panStartClientY = event.clientY;
        return;
      }
      this.onCanvasDown(this.screenToCanvas(event, canvas));
    });
    window.addEventListener('mouseup', () => { this.clearDrag(); this.panning = false; });

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.05 : -0.05;
      this.applyZoom(delta, event.clientX, event.clientY);
    });

    this.root.querySelectorAll<HTMLElement>('[data-info]').forEach((entry) => {
      const show = () => this.setHoveredHelp(entry.dataset.info ?? null);
      const hide = () => this.setHoveredHelp(null);
      entry.addEventListener('mouseenter', show);
      entry.addEventListener('mouseleave', hide);
      entry.addEventListener('focus', show);
      entry.addEventListener('blur', hide);
    });
  }

  private onCanvasDown(point: { x: number; y: number }): void {
    if (this.activeTool !== 'Move') return;
    const layer = this.findLayerAtPoint(point.x, point.y);
    if (!layer) return;
    this.doc.activeLayerId = layer.id;
    this.dragMode = this.hitHandle(layer, point.x, point.y) ?? 'move';
    this.dragLayerId = layer.id;
    this.dragStartX = point.x;
    this.dragStartY = point.y;
    this.dragOrigin = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
    this.events.emit('rerender', undefined);
  }

  private onCanvasDrag(point: { x: number; y: number }): void {
    if (!this.dragMode || !this.dragLayerId) return;
    const layer = this.doc.layers.find((entry) => entry.id === this.dragLayerId);
    if (!layer) return;
    const dx = point.x - this.dragStartX;
    const dy = point.y - this.dragStartY;

    if (this.dragMode === 'move') {
      layer.x = this.dragOrigin.x + dx;
      layer.y = this.dragOrigin.y + dy;
    } else {
      const minSize = 20;
      if (this.dragMode.includes('e')) layer.width = Math.max(minSize, this.dragOrigin.width + dx);
      if (this.dragMode.includes('s')) layer.height = Math.max(minSize, this.dragOrigin.height + dy);
      if (this.dragMode.includes('w')) {
        const nextWidth = Math.max(minSize, this.dragOrigin.width - dx);
        layer.x = this.dragOrigin.x + (this.dragOrigin.width - nextWidth);
        layer.width = nextWidth;
      }
      if (this.dragMode.includes('n')) {
        const nextHeight = Math.max(minSize, this.dragOrigin.height - dy);
        layer.y = this.dragOrigin.y + (this.dragOrigin.height - nextHeight);
        layer.height = nextHeight;
      }
    }

    this.syncTransformPanel();
    this.events.emit('rerender', undefined);
  }

  private clearDrag(): void { this.dragMode = null; this.dragLayerId = null; }

  private hitHandle(layer: Layer, x: number, y: number): DragMode | null {
    const size = 8;
    const points: Array<[DragMode, number, number]> = [
      ['resize-nw', layer.x, layer.y], ['resize-ne', layer.x + layer.width, layer.y],
      ['resize-sw', layer.x, layer.y + layer.height], ['resize-se', layer.x + layer.width, layer.y + layer.height]
    ];
    for (const [mode, hx, hy] of points) if (Math.abs(x - hx) <= size && Math.abs(y - hy) <= size) return mode;
    return null;
  }

  private findLayerAtPoint(x: number, y: number): Layer | null {
    for (let i = this.doc.layers.length - 1; i >= 0; i -= 1) {
      const layer = this.doc.layers[i];
      if (!layer.visible || !layer.image) continue;
      if (x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height) return layer;
    }
    return null;
  }

  private screenToCanvas(event: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  private syncMenuState(): void {
    this.root.querySelectorAll<HTMLElement>('.menu-group').forEach((group) => {
      const menu = group.dataset.menu;
      group.classList.toggle('open', menu === this.activeMenu);
    });
  }

  private async handleMenuAction(action: string): Promise<void> {
    if (action === 'import-file') {
      this.root.querySelector<HTMLInputElement>('#file-input')?.click();
      return;
    }
    if (action === 'import-url') {
      await this.promptImportUrl();
      return;
    }
    if (action === 'zoom-fit') {
      this.fitToViewport();
      return;
    }
    if (action === 'zoom-100') {
      this.viewport.zoom = 1;
      this.viewport.panX = 0;
      this.viewport.panY = 0;
      this.events.emit('rerender', undefined);
    }
  }

  private fitToViewport(): void {
    const area = this.root.querySelector<HTMLElement>('.canvas-area');
    if (!area) return;
    const fitZoom = Math.min(area.clientWidth / this.doc.width, area.clientHeight / this.doc.height);
    this.viewport.zoom = Math.max(0.2, Math.min(4, fitZoom));
    this.viewport.panX = 0;
    this.viewport.panY = 0;
    this.events.emit('rerender', undefined);
  }

  private applyDocumentSize(): void {
    const widthInput = this.root.querySelector<HTMLInputElement>('#doc-width');
    const heightInput = this.root.querySelector<HTMLInputElement>('#doc-height');
    if (!widthInput || !heightInput) return;
    const width = Math.max(64, Math.min(4096, Number(widthInput.value) || this.doc.width));
    const height = Math.max(64, Math.min(4096, Number(heightInput.value) || this.doc.height));
    this.doc.width = width;
    this.doc.height = height;
    widthInput.value = `${width}`;
    heightInput.value = `${height}`;
    this.events.emit('rerender', undefined);
  }

  private applyTransformInputs(): void {
    const layer = this.doc.activeLayer;
    if (!layer) return;
    layer.x = Number(this.root.querySelector<HTMLInputElement>('#transform-x')?.value ?? layer.x);
    layer.y = Number(this.root.querySelector<HTMLInputElement>('#transform-y')?.value ?? layer.y);
    layer.width = Math.max(20, Number(this.root.querySelector<HTMLInputElement>('#transform-w')?.value ?? layer.width));
    layer.height = Math.max(20, Number(this.root.querySelector<HTMLInputElement>('#transform-h')?.value ?? layer.height));
    this.events.emit('rerender', undefined);
  }

  private async promptImportUrl(): Promise<void> {
    const value = window.prompt('Import image URL');
    if (!value) return;
    await this.importFromUrl(value.trim());
  }

  private applyZoom(delta: number, clientX?: number, clientY?: number): void {
    const area = this.root.querySelector<HTMLElement>('.canvas-area');
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const cx = typeof clientX === 'number' ? clientX - rect.left : rect.width / 2;
    const cy = typeof clientY === 'number' ? clientY - rect.top : rect.height / 2;
    this.viewport.zoomBy(delta, cx, cy, rect.width, rect.height, this.doc.width, this.doc.height);
    this.events.emit('rerender', undefined);
  }

  private async importFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    await this.importImage(url, file.name);
    URL.revokeObjectURL(url);
  }

  private async importFromUrl(url: string): Promise<void> { await this.importImage(url, `URL ${this.doc.layers.length + 1}`); }

  private async importImage(src: string, name: string): Promise<void> {
    const image = await this.loadImage(src);
    const previous = this.doc.activeLayerId;
    const layer = this.doc.addLayer(new LayerModel(name));
    layer.image = { source: image, width: image.width, height: image.height, name };
    const scale = Math.min(this.doc.width / image.width, this.doc.height / image.height, 1);
    layer.width = Math.round(image.width * scale);
    layer.height = Math.round(image.height * scale);
    layer.x = Math.round((this.doc.width - layer.width) / 2);
    layer.y = Math.round((this.doc.height - layer.height) / 2);
    if (!this.autoSelect && previous) this.doc.activeLayerId = previous;
    this.syncLayerControls();
    this.events.emit('rerender', undefined);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = src;
    });
  }

  private setHoveredHelp(message: string | null): void {
    this.hoveredHelp = message;
    this.syncStatusHelp();
  }

  private syncStatusHelp(): void {
    const help = this.root.querySelector('#status-help');
    if (help) help.textContent = this.hoveredHelp ?? TOOL_HELP[this.activeTool] ?? TOOL_HELP.Move;
  }

  private syncTransformPanel(): void {
    const layer = this.doc.activeLayer;
    this.setInputValue('#transform-x', Math.round(layer?.x ?? 0));
    this.setInputValue('#transform-y', Math.round(layer?.y ?? 0));
    this.setInputValue('#transform-w', Math.round(layer?.width ?? 0));
    this.setInputValue('#transform-h', Math.round(layer?.height ?? 0));
  }

  private setInputValue(selector: string, value: number): void {
    const input = this.root.querySelector<HTMLInputElement>(selector);
    if (input) input.value = `${value}`;
  }

  private syncLayerControls(): void {
    const layer = this.doc.activeLayer;
    const blend = this.root.querySelector<HTMLSelectElement>('#blend-select');
    const opacityInput = this.root.querySelector<HTMLInputElement>('#opacity-input');
    const fill = this.root.querySelector<HTMLElement>('#opacity-fill');
    if (blend) blend.value = layer?.blendMode ?? 'source-over';
    const opacityPercent = Math.round((layer?.opacity ?? 1) * 100);
    if (opacityInput) opacityInput.value = `${opacityPercent}%`;
    if (fill) fill.style.width = `${opacityPercent}%`;
    this.syncTransformPanel();
  }

  private updateViewportLayout(): void {
    const wrap = this.root.querySelector<HTMLElement>('#canvas-wrap');
    const canvas = this.root.querySelector<HTMLCanvasElement>('#main-canvas');
    const area = this.root.querySelector<HTMLElement>('.canvas-area');
    if (!wrap || !canvas || !area) return;

    canvas.width = this.doc.width;
    canvas.height = this.doc.height;
    wrap.style.width = `${this.doc.width}px`;
    wrap.style.height = `${this.doc.height}px`;

    const areaWidth = area.clientWidth;
    const areaHeight = area.clientHeight;
    const baseX = (areaWidth - this.doc.width * this.viewport.zoom) / 2 + this.viewport.panX;
    const baseY = (areaHeight - this.doc.height * this.viewport.zoom) / 2 + this.viewport.panY;

    wrap.style.left = `${baseX}px`;
    wrap.style.top = `${baseY}px`;
    wrap.style.transform = `scale(${this.viewport.zoom})`;
  }

  private refreshUI(): void {
    this.layersPanel.render(this.doc.layers, this.doc.activeLayerId);
    this.updateViewportLayout();
    this.renderer.render(this.doc, this.activeTool);

    const area = this.root.querySelector<HTMLElement>('.canvas-area');
    const hCanvas = this.root.querySelector<HTMLCanvasElement>('#ruler-h');
    const vCanvas = this.root.querySelector<HTMLCanvasElement>('#ruler-v');

    if (area && hCanvas && vCanvas) {
      hCanvas.width = area.clientWidth;
      vCanvas.height = area.clientHeight;
      const hCtx = hCanvas.getContext('2d');
      const vCtx = vCanvas.getContext('2d');
      if (hCtx && vCtx) {
        this.rulerRenderer.draw(
          hCtx,
          vCtx,
          this.viewport.zoom,
          this.viewport.panX,
          this.viewport.panY,
          area.clientWidth,
          area.clientHeight,
          this.doc.width,
          this.doc.height
        );
      }
    }

    this.syncLayerControls();
    this.setInputValue('#doc-width', this.doc.width);
    this.setInputValue('#doc-height', this.doc.height);

    const zoomPercent = Math.round(this.viewport.zoom * 100);
    const zoom = this.root.querySelector('#zoom-level');
    if (zoom) zoom.textContent = `${zoomPercent}%`;
    this.syncStatusHelp();
  }

  private template(): string {
    return `
      <div class="menubar"><div class="menubar-logo">FlyerMaker <span class="build-tag">${__BUILD_TAG__}</span></div><div class="menu-group" data-menu="file"><button class="menu-item" data-menu="file">File</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="import-file">Import Image…</button></div></div><div class="menu-group" data-menu="image"><button class="menu-item" data-menu="image">Image</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="import-url">Import URL…</button></div></div><div class="menu-group" data-menu="view"><button class="menu-item" data-menu="view">View</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="zoom-fit">Fit to View</button><button class="menu-action" data-menu-action="zoom-100">Actual Size (100%)</button></div></div><div class="menubar-spacer"></div></div>
      <div class="optionsbar"><div class="opt-group"><span class="opt-label">Tool:</span><select id="tool-select" class="opt-select"><option>Move</option><option>Select</option><option>Hand</option><option>Zoom</option></select></div><div class="opt-divider"></div><div class="opt-group"><span class="opt-label">Image</span><input id="doc-width" class="opt-input" type="number" min="64" max="4096" step="1" value="800"><span class="opt-label">×</span><input id="doc-height" class="opt-input" type="number" min="64" max="4096" step="1" value="600"><button id="apply-doc-size" class="opt-btn">Apply</button></div><div class="opt-divider"></div><div class="opt-group"><span class="opt-label">Auto-Select</span><input id="auto-select" type="checkbox" checked data-info="Auto-Select: when enabled, newly imported images automatically become the active layer."></div></div>
      <div class="main">
        <div class="toolbar"><button class="tool-btn active" data-tool="Move" data-info="Move tool: drag a selected layer to reposition it. Drag corner handles to resize.">Move</button><button class="tool-btn" data-tool="Select" data-info="Select tool: keeps layer focus without moving; useful when adjusting panel values.">Select</button><button class="tool-btn" data-tool="Hand" data-info="Hand tool: click-drag in the canvas to pan the whole document view.">Hand</button><button class="tool-btn" data-tool="Zoom" data-info="Zoom tool: use wheel or +/- controls to zoom the entire document and rulers in 5% increments.">Zoom</button></div>
        <div class="canvas-wrapper"><canvas id="ruler-h" class="ruler-h" height="20"></canvas><div class="canvas-with-ruler"><canvas id="ruler-v" class="ruler-v" width="20"></canvas><div class="canvas-area"><div id="canvas-wrap" class="canvas-wrap"><canvas id="main-canvas" width="800" height="600"></canvas></div><div class="zoom-controls"><button class="zoom-btn" id="zoom-out" data-info="Zoom out by 5%.">−</button><div class="zoom-level" id="zoom-level">100%</div><button class="zoom-btn" id="zoom-in" data-info="Zoom in by 5%.">+</button><button class="zoom-btn" id="zoom-fit" data-info="Fit: scales the entire document to fit inside the current canvas viewport.">Fit</button></div></div></div></div>
        <div class="panels-right"><div class="panel"><div class="panel-header panel-header-actions"><span class="panel-title">Layers</span><button id="add-layer" class="opt-btn panel-add-btn" data-info="Create a new empty layer at the document center.">+ Layer</button></div><div class="panel-body"><div class="blend-row"><select id="blend-select" class="blend-select">${BLEND_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></div><div class="opacity-row"><span class="opacity-label">Opacity</span><div class="opacity-track" id="opacity-track"><div class="opacity-fill" id="opacity-fill"></div></div><input id="opacity-input" class="opacity-input" value="100%"></div><div id="layers-list" class="layers-list"></div></div></div><div class="panel"><div class="panel-header"><span class="panel-title">Transform</span></div><div class="panel-body transform-grid"><label>X <input id="transform-x" class="opt-select" type="number"></label><label>Y <input id="transform-y" class="opt-select" type="number"></label><label>W <input id="transform-w" class="opt-select" type="number"></label><label>H <input id="transform-h" class="opt-select" type="number"></label></div></div></div>
      </div>
      <div class="statusbar"><div class="status-item status-help-only" id="status-help">Move tool: drag selected layers to reposition. Drag corner handles to resize.</div></div>
      <input id="file-input" type="file" accept="image/*" hidden />
    `;
  }
}
