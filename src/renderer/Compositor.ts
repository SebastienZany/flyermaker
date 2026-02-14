import type { DocumentModel } from '../model/Document';
import type { Layer } from '../model/Layer';

export class Compositor {
  draw(ctx: CanvasRenderingContext2D, doc: DocumentModel): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      this.drawContent(ctx, layer);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawContent(ctx: CanvasRenderingContext2D, layer: Layer): void {
    const { content } = layer;
    switch (content.type) {
      case 'image':
        ctx.drawImage(content.source, layer.x, layer.y, layer.width, layer.height);
        break;
    }
  }
}
