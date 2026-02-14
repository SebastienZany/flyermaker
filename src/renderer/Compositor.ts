import type { DocumentModel } from '../model/Document';
import type { Layer } from '../model/Layer';
import { EffectRenderer } from '../effects/EffectRenderer';
import { generateCacheKey } from '../effects/EffectStack';

export class Compositor {
  private readonly effectRenderer = new EffectRenderer();

  draw(ctx: CanvasRenderingContext2D, doc: DocumentModel): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const activeIds = new Set(doc.layers.map((l) => l.id));
    this.effectRenderer.pruneDeletedLayers(activeIds);

    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      this.drawContent(ctx, layer);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  invalidateEffectCache(layerId?: string): void {
    this.effectRenderer.invalidateCache(layerId);
  }

  private drawContent(ctx: CanvasRenderingContext2D, layer: Layer): void {
    const { content } = layer;
    switch (content.type) {
      case 'image': {
        if (layer.effects.length > 0 && layer.effects.some((e) => e.enabled)) {
          const cacheKey = generateCacheKey(layer.id, layer.effects);
          const processed = this.effectRenderer.process(
            content.source,
            content.naturalWidth,
            content.naturalHeight,
            layer.effects,
            cacheKey
          );
          if (processed) {
            ctx.drawImage(processed, layer.x, layer.y, layer.width, layer.height);
          } else {
            ctx.drawImage(content.source, layer.x, layer.y, layer.width, layer.height);
          }
        } else {
          ctx.drawImage(content.source, layer.x, layer.y, layer.width, layer.height);
        }
        break;
      }
    }
  }
}
