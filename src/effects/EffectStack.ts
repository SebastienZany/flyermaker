import type { LayerEffect, LayerEffectType } from '../model/Layer';

interface EffectDefinition {
  type: LayerEffectType;
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const EFFECT_DEFINITIONS: EffectDefinition[] = [
  { type: 'exposure', name: 'Exposure', min: -2, max: 2, step: 0.05, defaultValue: 0 },
  { type: 'brightness', name: 'Brightness', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { type: 'contrast', name: 'Contrast', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { type: 'saturation', name: 'Saturation', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { type: 'hue', name: 'Hue', min: -180, max: 180, step: 1, defaultValue: 0 }
];

export class EffectStack {
  static createDefault(): LayerEffect[] {
    return EFFECT_DEFINITIONS.map((definition) => ({
      id: definition.type,
      type: definition.type,
      name: definition.name,
      enabled: false,
      value: definition.defaultValue,
      min: definition.min,
      max: definition.max,
      step: definition.step,
      defaultValue: definition.defaultValue
    }));
  }

  static clone(effects: LayerEffect[]): LayerEffect[] {
    return effects.map((effect) => ({ ...effect }));
  }

  static normalize(effects: LayerEffect[]): LayerEffect[] {
    const byType = new Map(effects.map((effect) => [effect.type, effect]));
    return EFFECT_DEFINITIONS.map((definition) => {
      const effect = byType.get(definition.type);
      if (!effect) {
        return {
          id: definition.type,
          type: definition.type,
          name: definition.name,
          enabled: false,
          value: definition.defaultValue,
          min: definition.min,
          max: definition.max,
          step: definition.step,
          defaultValue: definition.defaultValue
        };
      }
      return {
        ...effect,
        id: definition.type,
        name: definition.name,
        min: definition.min,
        max: definition.max,
        step: definition.step,
        defaultValue: definition.defaultValue,
        value: Math.max(definition.min, Math.min(definition.max, effect.value))
      };
    });
  }
}
