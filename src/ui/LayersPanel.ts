import type { Layer } from '../model/Layer';

export interface LayersPanelCallbacks {
  onSelectLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
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

        const name = document.createElement('div');
        name.className = 'layer-name';
        name.textContent = layer.name;

        const meta = document.createElement('div');
        meta.className = 'layer-meta';
        meta.textContent = `${layer.image ? `${layer.image.width}×${layer.image.height}` : 'Empty'} · ${Math.round(layer.opacity * 100)}%`;

        info.append(name, meta);

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
