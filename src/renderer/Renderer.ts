import type { DocumentModel } from '../model/Document';
import { Compositor } from './Compositor';

export class Renderer {
  private compositor = new Compositor();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(doc: DocumentModel, activeTool = 'Move'): void {
    const { canvas } = this.ctx;
    this.compositor.draw(this.ctx, doc);

    if (activeTool === 'Move' && doc.activeLayer?.image) {
      const layer = doc.activeLayer;
      const handle = 8;
      this.ctx.save();
      this.ctx.strokeStyle = '#4a9eff';
      this.ctx.setLineDash([5, 3]);
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      this.ctx.setLineDash([]);
      this.ctx.fillStyle = '#4a9eff';
      const points = [
        [layer.x, layer.y],
        [layer.x + layer.width, layer.y],
        [layer.x, layer.y + layer.height],
        [layer.x + layer.width, layer.y + layer.height]
      ];
      for (const [x, y] of points) {
        this.ctx.fillRect(x - handle / 2, y - handle / 2, handle, handle);
      }
      this.ctx.restore();
    }

    canvas.dataset.zoom = '1.00';
  }
}
