import type { LayerEffect, EffectParam } from './Effect';

let cacheCounter = 0;

export function generateCacheKey(layerId: string, effects: LayerEffect[]): string {
  const parts = effects
    .filter((e) => e.enabled)
    .map((e) => {
      const paramStr = Object.entries(e.params)
        .map(([k, p]) => `${k}=${JSON.stringify(p.value)}`)
        .join(',');
      return `${e.definitionId}:{${paramStr}}`;
    });
  return `${layerId}|${parts.join('|')}`;
}

export function cloneEffectParams(params: Record<string, EffectParam>): Record<string, EffectParam> {
  const result: Record<string, EffectParam> = {};
  for (const [key, param] of Object.entries(params)) {
    if (param.type === 'color') {
      result[key] = { ...param, value: [...param.value] };
    } else {
      result[key] = { ...param };
    }
  }
  return result;
}

export function cloneLayerEffects(effects: LayerEffect[]): LayerEffect[] {
  return effects.map((e) => ({
    definitionId: e.definitionId,
    enabled: e.enabled,
    params: cloneEffectParams(e.params)
  }));
}

export function invalidateCacheKey(): string {
  return `cache_${++cacheCounter}_${Date.now()}`;
}
