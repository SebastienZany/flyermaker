import type { EffectDefinition } from './types';

export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  {
    type: 'gaussian-blur',
    label: 'Gaussian Blur',
    params: [
      { key: 'sigma', label: 'Sigma', type: 'range', min: 0, max: 20, step: 0.1, defaultValue: 3 }
    ]
  },
  {
    type: 'bloom',
    label: 'Bloom',
    params: [
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, defaultValue: 0.7 },
      { key: 'radius', label: 'Radius', type: 'range', min: 1, max: 20, step: 1, defaultValue: 8 },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2.5, step: 0.05, defaultValue: 0.8 }
    ]
  },
  {
    type: 'vignette',
    label: 'Vignette',
    params: [
      { key: 'radius', label: 'Radius', type: 'range', min: 0.1, max: 1.5, step: 0.01, defaultValue: 0.75 },
      { key: 'softness', label: 'Softness', type: 'range', min: 0.01, max: 1, step: 0.01, defaultValue: 0.35 },
      { key: 'strength', label: 'Strength', type: 'range', min: 0, max: 1, step: 0.01, defaultValue: 0.45 },
      { key: 'color', label: 'Color', type: 'color', defaultValue: '#000000' }
    ]
  },
  {
    type: 'color-grading',
    label: 'Color Grading',
    params: [
      { key: 'brightness', label: 'Brightness', type: 'range', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'hueShift', label: 'Hue Shift', type: 'range', min: -1, max: 1, step: 0.01, defaultValue: 0 },
      { key: 'lift', label: 'Lift', type: 'range', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0 },
      { key: 'gamma', label: 'Gamma', type: 'range', min: 0.3, max: 3, step: 0.01, defaultValue: 1 },
      { key: 'gain', label: 'Gain', type: 'range', min: 0.2, max: 3, step: 0.01, defaultValue: 1 }
    ]
  }
];

export function getEffectDefinition(type: string): EffectDefinition | undefined {
  return EFFECT_DEFINITIONS.find((entry) => entry.type === type);
}
