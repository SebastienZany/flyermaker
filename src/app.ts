import { EventBus } from './core/EventBus';
import { History } from './model/History';
import { DocumentModel } from './model/Document';
import type { BlendMode, Layer, LayerContent, LayerEffect } from './model/Layer';
import { Layer as LayerModel } from './model/Layer';
import { Renderer } from './renderer/Renderer';
import { Viewport } from './renderer/Viewport';
import { RulerRenderer } from './renderer/RulerRenderer';
import { LayersPanel } from './ui/LayersPanel';
import { EffectsPanel } from './ui/EffectsPanel';
import type { EffectParam } from './effects/Effect';
import { cloneLayerEffects } from './effects/EffectStack';

declare const __BUILD_TAG__: string;

interface AppEvents { rerender: undefined; }
type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

interface LayerSnapshot {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  content: LayerContent;
  effects: LayerEffect[];
}

interface DocumentSnapshot {
  width: number;
  height: number;
  activeLayerId: string | null;
  layers: LayerSnapshot[];
}

const TOOL_HELP: Record<string, string> = {
  Move: 'Move tool: drag selected layers to reposition. Drag corner handles to resize.',
  Select: 'Select tool: keeps layer focus while you adjust transform/layer settings.',
  Hand: 'Hand tool: click-drag to pan the full document view.',
  Zoom: 'Zoom tool: use wheel or +/- controls to zoom the document and rulers in 5% steps.'
};

export class App {
  private readonly events = new EventBus<AppEvents>();
  private readonly doc = new DocumentModel();
  private readonly history = new History<DocumentSnapshot>();
  private readonly viewport = new Viewport();
  private readonly renderer: Renderer;
  private readonly rulerRenderer = new RulerRenderer();
  private readonly layersPanel: LayersPanel;
  private readonly effectsPanel: EffectsPanel;
  private activeTool = 'Move';
  private autoSelect = true;
  private activeMenu: string | null = null;
  private hoveredHelp: string | null = null;
  private menuCloseTimer: number | null = null;

  private dragMode: DragMode | null = null;
  private dragLayerId: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOrigin = { x: 0, y: 0, width: 0, height: 0 };
  private dragHistoryBefore: DocumentSnapshot | null = null;
  private panning = false;
  private panStartClientX = 0;
  private panStartClientY = 0;
  private effectParamBefore: DocumentSnapshot | null = null;
  private paramCommitTimer: number | null = null;
  private skipEffectsPanelRender = false;

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
      onSelectLayer: (id) => {
        this.doc.activeLayerId = id;
        this.events.emit('rerender', undefined);
      },
      onDeleteLayer: (id) => {
        this.applyDocumentChange(() => {
          this.doc.deleteLayer(id);
        });
      },
      onToggleVisibility: (id) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.layers.find((entry) => entry.id === id);
          if (!layer) return;
          layer.visible = !layer.visible;
        });
      },
      onChangeOpacity: (id, opacity) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.layers.find((entry) => entry.id === id);
          if (!layer) return;
          layer.opacity = opacity;
        });
      },
      onChangeBlendMode: (id, blendMode) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.layers.find((entry) => entry.id === id);
          if (!layer) return;
          layer.blendMode = blendMode;
        });
      }
    });

    const effectsRoot = this.root.querySelector<HTMLElement>('#effects-list');
    if (!effectsRoot) throw new Error('Effects panel missing');
    this.effectsPanel = new EffectsPanel(effectsRoot, {
      onAddEffect: (effect) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.activeLayer;
          if (!layer) return;
          layer.effects.push(effect);
        });
      },
      onRemoveEffect: (index) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.activeLayer;
          if (!layer) return;
          layer.effects.splice(index, 1);
        });
      },
      onToggleEffect: (index) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.activeLayer;
          if (!layer) return;
          layer.effects[index].enabled = !layer.effects[index].enabled;
        });
      },
      onUpdateParam: (index, paramKey, value) => {
        if (!this.effectParamBefore) {
          this.effectParamBefore = this.captureSnapshot();
        }
        const layer = this.doc.activeLayer;
        if (!layer) return;
        const param = layer.effects[index].params[paramKey];
        if (param) (param as EffectParam).value = value as never;

        // Redraw canvas without rebuilding effects panel DOM
        // (rebuilding would destroy the slider/input being dragged)
        this.skipEffectsPanelRender = true;
        this.events.emit('rerender', undefined);
        this.skipEffectsPanelRender = false;

        // Debounce history commit — one undo entry per drag, not per tick
        if (this.paramCommitTimer !== null) {
          window.clearTimeout(this.paramCommitTimer);
        }
        this.paramCommitTimer = window.setTimeout(() => {
          this.commitHistoryEntry(this.effectParamBefore);
          this.effectParamBefore = null;
          this.paramCommitTimer = null;
        }, 300);
      },
      onMoveEffect: (fromIndex, toIndex) => {
        this.applyDocumentChange(() => {
          const layer = this.doc.activeLayer;
          if (!layer) return;
          const [moved] = layer.effects.splice(fromIndex, 1);
          layer.effects.splice(toIndex, 0, moved);
        });
      }
    });

    this.bindControls(canvas);
    window.addEventListener('resize', () => this.events.emit('rerender', undefined));
    this.events.on('rerender', () => this.refreshUI());
    this.events.emit('rerender', undefined);
  }

  private bindControls(canvas: HTMLCanvasElement): void {
    const menubar = this.root.querySelector<HTMLElement>('.menubar');
    const menuGroups = this.root.querySelectorAll<HTMLElement>('.menu-group');

    menuGroups.forEach((group) => {
      group.addEventListener('mouseenter', () => {
        this.cancelMenuClose();
        if (!this.activeMenu) return;
        const menu = group.dataset.menu;
        if (!menu || menu === this.activeMenu) return;
        this.activeMenu = menu;
        this.syncMenuState();
      });
    });

    menubar?.addEventListener('mouseenter', () => this.cancelMenuClose());

    menubar?.addEventListener('mouseleave', () => {
      if (!this.activeMenu) return;
      this.scheduleMenuClose();
    });

    this.root.querySelectorAll<HTMLElement>('.menu-item').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        const menu = item.dataset.menu;
        if (!menu) return;
        this.cancelMenuClose();
        this.activeMenu = this.activeMenu === menu ? null : menu;
        this.syncMenuState();
      });
    });

    this.root.querySelectorAll<HTMLElement>('.menu-action').forEach((item) => {
      item.addEventListener('click', async () => {
        const action = item.dataset.menuAction;
        if (!action) return;
        await this.runSafeAction(() => this.handleMenuAction(action));
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
      const key = event.key.toLowerCase();
      const meta = event.ctrlKey || event.metaKey;
      if (meta && key === 'z') {
        if (this.isEditableTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
        return;
      }
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
      this.root.querySelector<HTMLInputElement>('#file-input')?.click();
    });

    this.root.querySelector('#undo-action')?.addEventListener('click', () => this.undo());
    this.root.querySelector('#redo-action')?.addEventListener('click', () => this.redo());

    this.root.querySelector('#zoom-in')?.addEventListener('click', () => this.applyZoom(0.05));
    this.root.querySelector('#zoom-out')?.addEventListener('click', () => this.applyZoom(-0.05));
    this.root.querySelector('#zoom-fit')?.addEventListener('click', () => this.fitToViewport());

    for (const key of ['x', 'y', 'w', 'h'] as const) {
      this.root.querySelector<HTMLInputElement>(`#transform-${key}`)?.addEventListener('change', () => this.applyTransformInputs());
    }

    const fileInput = this.root.querySelector<HTMLInputElement>('#file-input');
    fileInput?.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await this.runSafeAction(() => this.importFile(file));
      (event.target as HTMLInputElement).value = '';
    });

    const canvasWrap = this.root.querySelector<HTMLElement>('#canvas-wrap');
    canvasWrap?.addEventListener('dragover', (event) => { event.preventDefault(); canvasWrap.classList.add('drag-over'); });
    canvasWrap?.addEventListener('dragleave', () => canvasWrap.classList.remove('drag-over'));
    canvasWrap?.addEventListener('drop', async (event) => {
      event.preventDefault();
      canvasWrap.classList.remove('drag-over');
      const file = event.dataTransfer?.files?.[0];
      if (file) await this.runSafeAction(() => this.importFile(file));
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

  private scheduleMenuClose(): void {
    this.cancelMenuClose();
    this.menuCloseTimer = window.setTimeout(() => {
      this.activeMenu = null;
      this.syncMenuState();
      this.menuCloseTimer = null;
    }, 140);
  }

  private cancelMenuClose(): void {
    if (this.menuCloseTimer === null) return;
    window.clearTimeout(this.menuCloseTimer);
    this.menuCloseTimer = null;
  }

  private onCanvasDown(point: { x: number; y: number }): void {
    if (this.activeTool !== 'Move') return;
    const activeLayer = this.doc.activeLayer;
    if (activeLayer) {
      const activeHandle = this.hitHandle(activeLayer, point.x, point.y);
      if (activeHandle) {
        this.dragHistoryBefore = this.captureSnapshot();
        this.dragMode = activeHandle;
        this.dragLayerId = activeLayer.id;
        this.dragStartX = point.x;
        this.dragStartY = point.y;
        this.dragOrigin = { x: activeLayer.x, y: activeLayer.y, width: activeLayer.width, height: activeLayer.height };
        this.events.emit('rerender', undefined);
        return;
      }
    }

    const layer = this.findLayerAtPoint(point.x, point.y);
    if (!layer) return;
    this.dragHistoryBefore = this.captureSnapshot();
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

  private clearDrag(): void {
    this.commitHistoryEntry(this.dragHistoryBefore);
    this.dragHistoryBefore = null;
    this.dragMode = null;
    this.dragLayerId = null;
  }

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
      if (!layer.visible) continue;
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

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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
      return;
    }
    if (action === 'undo') {
      this.undo();
      return;
    }
    if (action === 'redo') {
      this.redo();
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
    this.applyDocumentChange(() => {
      this.doc.width = width;
      this.doc.height = height;
    });
    widthInput.value = `${width}`;
    heightInput.value = `${height}`;
  }

  private applyTransformInputs(): void {
    this.applyDocumentChange(() => {
      const layer = this.doc.activeLayer;
      if (!layer) return;
      layer.x = Number(this.root.querySelector<HTMLInputElement>('#transform-x')?.value ?? layer.x);
      layer.y = Number(this.root.querySelector<HTMLInputElement>('#transform-y')?.value ?? layer.y);
      layer.width = Math.max(20, Number(this.root.querySelector<HTMLInputElement>('#transform-w')?.value ?? layer.width));
      layer.height = Math.max(20, Number(this.root.querySelector<HTMLInputElement>('#transform-h')?.value ?? layer.height));
    });
  }

  private async promptImportUrl(): Promise<void> {
    const value = window.prompt('Import image URL');
    if (!value) return;
    await this.runSafeAction(() => this.importFromUrl(value.trim()));
  }

  private async runSafeAction(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.setHoveredHelp(`Action failed: ${reason}. URL imports may require CORS support.`);
    }
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
    const content: LayerContent = {
      type: 'image',
      source: image,
      naturalWidth: image.width,
      naturalHeight: image.height,
      name
    };
    this.applyDocumentChange(() => {
      const previous = this.doc.activeLayerId;
      const layer = this.doc.addLayer(new LayerModel(name, content));
      const scale = Math.min(this.doc.width / image.width, this.doc.height / image.height, 1);
      layer.width = Math.round(image.width * scale);
      layer.height = Math.round(image.height * scale);
      layer.x = Math.round((this.doc.width - layer.width) / 2);
      layer.y = Math.round((this.doc.height - layer.height) / 2);
      if (!this.autoSelect && previous) this.doc.activeLayerId = previous;
    });
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

  private snapshotsEqual(a: DocumentSnapshot, b: DocumentSnapshot): boolean {
    if (a.width !== b.width || a.height !== b.height || a.activeLayerId !== b.activeLayerId) return false;
    if (a.layers.length !== b.layers.length) return false;
    for (let i = 0; i < a.layers.length; i += 1) {
      const al = a.layers[i];
      const bl = b.layers[i];
      if (
        al.id !== bl.id ||
        al.name !== bl.name ||
        al.visible !== bl.visible ||
        al.locked !== bl.locked ||
        al.opacity !== bl.opacity ||
        al.blendMode !== bl.blendMode ||
        al.x !== bl.x ||
        al.y !== bl.y ||
        al.width !== bl.width ||
        al.height !== bl.height ||
        !this.contentEqual(al.content, bl.content) ||
        !this.effectsEqual(al.effects, bl.effects)
      ) return false;
    }
    return true;
  }

  private contentEqual(a: LayerContent, b: LayerContent): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'image' && b.type === 'image') {
      return a.source === b.source && a.naturalWidth === b.naturalWidth
        && a.naturalHeight === b.naturalHeight && a.name === b.name;
    }
    return false;
  }

  private effectsEqual(a: LayerEffect[], b: LayerEffect[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].definitionId !== b[i].definitionId) return false;
      if (a[i].enabled !== b[i].enabled) return false;
      const aKeys = Object.keys(a[i].params);
      const bKeys = Object.keys(b[i].params);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        const ap = a[i].params[key];
        const bp = b[i].params[key];
        if (!bp || ap.type !== bp.type) return false;
        if (JSON.stringify(ap.value) !== JSON.stringify(bp.value)) return false;
      }
    }
    return true;
  }

  private captureSnapshot(): DocumentSnapshot {
    return {
      width: this.doc.width,
      height: this.doc.height,
      activeLayerId: this.doc.activeLayerId,
      layers: this.doc.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        content: { ...layer.content },
        effects: cloneLayerEffects(layer.effects)
      }))
    };
  }

  private restoreSnapshot(snapshot: DocumentSnapshot): void {
    this.doc.width = snapshot.width;
    this.doc.height = snapshot.height;
    this.doc.layers = snapshot.layers.map((layer) => {
      const next = new LayerModel(layer.name, { ...layer.content }, layer.id);
      next.visible = layer.visible;
      next.locked = layer.locked;
      next.opacity = layer.opacity;
      next.blendMode = layer.blendMode;
      next.x = layer.x;
      next.y = layer.y;
      next.width = layer.width;
      next.height = layer.height;
      next.effects = cloneLayerEffects(layer.effects);
      return next;
    });
    this.doc.activeLayerId = snapshot.activeLayerId;
  }

  private commitHistoryEntry(before: DocumentSnapshot | null): void {
    if (!before) return;
    const after = this.captureSnapshot();
    if (this.snapshotsEqual(before, after)) return;
    this.history.push({ before, after });
    this.syncHistoryControls();
  }

  private applyDocumentChange(change: () => void): void {
    const before = this.captureSnapshot();
    change();
    this.commitHistoryEntry(before);
    this.events.emit('rerender', undefined);
  }

  private undo(): void {
    const snapshot = this.history.undo();
    if (!snapshot) return;
    this.restoreSnapshot(snapshot);
    this.syncHistoryControls();
    this.events.emit('rerender', undefined);
  }

  private redo(): void {
    const snapshot = this.history.redo();
    if (!snapshot) return;
    this.restoreSnapshot(snapshot);
    this.syncHistoryControls();
    this.events.emit('rerender', undefined);
  }

  private syncHistoryControls(): void {
    const undoButton = this.root.querySelector<HTMLButtonElement>('#undo-action');
    const redoButton = this.root.querySelector<HTMLButtonElement>('#redo-action');
    if (undoButton) undoButton.disabled = !this.history.canUndo;
    if (redoButton) redoButton.disabled = !this.history.canRedo;
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
    if (!this.skipEffectsPanelRender) {
      const activeLayer = this.doc.activeLayer;
      this.effectsPanel.render(activeLayer?.effects ?? [], !!activeLayer);
    }
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
    this.syncHistoryControls();
  }

  private template(): string {
    return `
      <div class="menubar"><div class="menubar-logo">FlyerMaker <span class="build-tag">${__BUILD_TAG__}</span></div><div class="menu-group" data-menu="file"><button class="menu-item" data-menu="file">File</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="import-file">Import Image…</button></div></div><div class="menu-group" data-menu="edit"><button class="menu-item" data-menu="edit">Edit</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="undo">Undo</button><button class="menu-action" data-menu-action="redo">Redo</button></div></div><div class="menu-group" data-menu="image"><button class="menu-item" data-menu="image">Image</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="import-url">Import URL…</button></div></div><div class="menu-group" data-menu="view"><button class="menu-item" data-menu="view">View</button><div class="menu-dropdown"><button class="menu-action" data-menu-action="zoom-fit">Fit to View</button><button class="menu-action" data-menu-action="zoom-100">Actual Size (100%)</button></div></div><div class="menubar-spacer"></div></div>
      <div class="optionsbar"><div class="opt-group"><button id="undo-action" class="opt-btn" data-info="Undo (Ctrl/Cmd+Z): revert the latest layer/document edit.">Undo</button><button id="redo-action" class="opt-btn" data-info="Redo (Ctrl/Cmd+Shift+Z): re-apply the most recently undone edit.">Redo</button></div><div class="opt-divider"></div><div class="opt-group"><span class="opt-label">Tool:</span><select id="tool-select" class="opt-select"><option>Move</option><option>Select</option><option>Hand</option><option>Zoom</option></select></div><div class="opt-divider"></div><div class="opt-group"><span class="opt-label">Image</span><input id="doc-width" class="opt-input" type="number" min="64" max="4096" step="1" value="800"><span class="opt-label">×</span><input id="doc-height" class="opt-input" type="number" min="64" max="4096" step="1" value="600"><button id="apply-doc-size" class="opt-btn">Apply</button></div><div class="opt-divider"></div><div class="opt-group"><span class="opt-label">Auto-Select</span><input id="auto-select" type="checkbox" checked data-info="Auto-Select: when enabled, newly imported images automatically become the active layer."></div></div>
      <div class="main">
        <div class="toolbar"><button class="tool-btn active" data-tool="Move" data-info="Move tool: drag a selected layer to reposition it. Drag corner handles to resize.">Move</button><button class="tool-btn" data-tool="Select" data-info="Select tool: keeps layer focus without moving; useful when adjusting panel values.">Select</button><button class="tool-btn" data-tool="Hand" data-info="Hand tool: click-drag in the canvas to pan the whole document view.">Hand</button><button class="tool-btn" data-tool="Zoom" data-info="Zoom tool: use wheel or +/- controls to zoom the entire document and rulers in 5% increments.">Zoom</button></div>
        <div class="canvas-wrapper"><canvas id="ruler-h" class="ruler-h" height="20"></canvas><div class="canvas-with-ruler"><canvas id="ruler-v" class="ruler-v" width="20"></canvas><div class="canvas-area"><div id="canvas-wrap" class="canvas-wrap"><canvas id="main-canvas" width="800" height="600"></canvas></div><div class="zoom-controls"><button class="zoom-btn" id="zoom-out" data-info="Zoom out by 5%.">−</button><div class="zoom-level" id="zoom-level">100%</div><button class="zoom-btn" id="zoom-in" data-info="Zoom in by 5%.">+</button><button class="zoom-btn" id="zoom-fit" data-info="Fit: scales the entire document to fit inside the current canvas viewport.">Fit</button></div></div></div></div>
        <div class="panels-right"><div class="panel"><div class="panel-header panel-header-actions"><span class="panel-title">Layers</span><button id="add-layer" class="opt-btn panel-add-btn" data-info="Import an image as a new layer.">+ Image</button></div><div class="panel-body"><div id="layers-list" class="layers-list"></div></div></div><div class="panel"><div class="panel-header"><span class="panel-title">Transform</span></div><div class="panel-body transform-grid"><label>X <input id="transform-x" class="opt-select" type="number"></label><label>Y <input id="transform-y" class="opt-select" type="number"></label><label>W <input id="transform-w" class="opt-select" type="number"></label><label>H <input id="transform-h" class="opt-select" type="number"></label></div></div><div class="panel panel-effects"><div class="panel-header"><span class="panel-title">Effects</span></div><div class="panel-body"><div id="effects-list" class="effects-list"></div></div></div></div>
      </div>
      <div class="statusbar"><div class="status-item status-help-only" id="status-help">Move tool: drag selected layers to reposition. Drag corner handles to resize.</div></div>
      <input id="file-input" type="file" accept="image/*" hidden />
    `;
  }
}
