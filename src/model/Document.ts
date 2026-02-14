import { Layer } from './Layer';

export class DocumentModel {
  width = 1280;
  height = 720;
  layers: Layer[] = [];
  activeLayerId: string | null = null;

  addLayer(layer: Layer): Layer {
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    return layer;
  }

  deleteLayer(id: string): void {
    const idx = this.layers.findIndex((layer) => layer.id === id);
    if (idx < 0) return;
    this.layers.splice(idx, 1);
    if (this.activeLayerId === id) {
      const neighbor = this.layers[Math.min(idx, this.layers.length - 1)];
      this.activeLayerId = neighbor ? neighbor.id : null;
    }
  }

  moveLayer(id: string, toIndex: number): void {
    const fromIndex = this.layers.findIndex((layer) => layer.id === id);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= this.layers.length) return;
    const [layer] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, layer);
  }

  get activeLayer(): Layer | null {
    return this.layers.find((layer) => layer.id === this.activeLayerId) ?? null;
  }
}
