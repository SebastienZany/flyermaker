export type EffectParamType = 'range' | 'color' | 'checkbox';

export interface EffectParamDefinition {
  key: string;
  label: string;
  type: EffectParamType;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | string | boolean;
}

export interface EffectDefinition {
  type: string;
  label: string;
  params: EffectParamDefinition[];
}

export type EffectParams = Record<string, number | string | boolean>;

export interface LayerEffect {
  id: string;
  type: string;
  enabled: boolean;
  params: EffectParams;
}
