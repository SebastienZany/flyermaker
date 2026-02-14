import type { DocumentModel } from '../model/Document';

export class Compositor {
  draw(ctx: CanvasRenderingContext2D, doc: DocumentModel): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const layer of doc.layers) {
      if (!layer.visible || !layer.image) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(layer.image.source, layer.x, layer.y, layer.width, layer.height);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
