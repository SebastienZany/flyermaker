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
    this.layers = this.layers.filter((layer) => layer.id !== id);
    if (this.activeLayerId === id) this.activeLayerId = this.layers.length ? this.layers[this.layers.length - 1].id : null;
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
