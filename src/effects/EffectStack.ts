import type { EffectDefinition, EffectParams, LayerEffect } from './types';

export class EffectStack {
  readonly effects: LayerEffect[] = [];

  addEffect(definition: EffectDefinition): LayerEffect {
    const params: EffectParams = {};
    for (const param of definition.params) params[param.key] = param.defaultValue;
    const effect: LayerEffect = {
      id: crypto.randomUUID(),
      type: definition.type,
      enabled: true,
      params
    };
    this.effects.push(effect);
    return effect;
  }
}
