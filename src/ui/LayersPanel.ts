import type { BlendMode, Layer } from '../model/Layer';

const BLEND_OPTIONS: BlendMode[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];

export interface LayersPanelCallbacks {
  onSelectLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onChangeBlendMode: (id: string, blendMode: BlendMode) => void;
}

export class LayersPanel {
  constructor(private readonly root: HTMLElement, private readonly callbacks: LayersPanelCallbacks) {}

  render(layers: Layer[], activeLayerId: string | null): void {
    this.root.innerHTML = '';

    [...layers]
      .reverse()
      .forEach((layer) => {
        const row = document.createElement('div');
        row.className = `layer-item ${activeLayerId === layer.id ? 'selected' : ''}`;

        const visibility = document.createElement('button');
        visibility.className = 'layer-vis';
        visibility.textContent = layer.visible ? '👁' : '🚫';
        visibility.title = layer.visible ? 'Hide layer' : 'Show layer';
        visibility.onclick = (event) => {
          event.stopPropagation();
          this.callbacks.onToggleVisibility(layer.id);
        };

        const info = document.createElement('div');
        info.className = 'layer-info';

        const name = document.createElement('div');
        name.className = 'layer-name';
        name.textContent = layer.name;

        const meta = document.createElement('div');
        meta.className = 'layer-meta';
        meta.textContent = `${layer.image ? `${layer.image.width}×${layer.image.height}` : 'Empty'}`;

        const controls = document.createElement('div');
        controls.className = 'layer-controls';

        const blend = document.createElement('select');
        blend.className = 'blend-select layer-blend';
        blend.title = 'Layer blend mode';
        blend.innerHTML = BLEND_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('');
        blend.value = layer.blendMode;
        blend.onchange = (event) => {
          event.stopPropagation();
          this.callbacks.onChangeBlendMode(layer.id, (event.target as HTMLSelectElement).value as BlendMode);
        };
        blend.onclick = (event) => event.stopPropagation();

        const opacity = document.createElement('input');
        opacity.className = 'opacity-input layer-opacity';
        opacity.title = 'Layer opacity';
        opacity.value = `${Math.round(layer.opacity * 100)}%`;
        opacity.onchange = (event) => {
          event.stopPropagation();
          const value = Math.min(100, Math.max(0, Number((event.target as HTMLInputElement).value.replace('%', '')) || 0));
          this.callbacks.onChangeOpacity(layer.id, value / 100);
        };
        opacity.onclick = (event) => event.stopPropagation();

        controls.append(blend, opacity);
        info.append(name, meta, controls);

        const remove = document.createElement('button');
        remove.className = 'layer-lock';
        remove.textContent = '✕';
        remove.title = 'Delete layer';
        remove.onclick = (event) => {
          event.stopPropagation();
          this.callbacks.onDeleteLayer(layer.id);
        };

        row.onclick = () => this.callbacks.onSelectLayer(layer.id);
        row.append(visibility, info, remove);
        this.root.append(row);
      });
  }
}
