export interface EffectParamFloat {
  type: 'float';
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface EffectParamInt {
  type: 'int';
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface EffectParamColor {
  type: 'color';
  label: string;
  value: [number, number, number];
}

export interface EffectParamBoolean {
  type: 'boolean';
  label: string;
  value: boolean;
}

export interface EffectParamSelect {
  type: 'select';
  label: string;
  value: string;
  options: string[];
}

export type EffectParam = EffectParamFloat | EffectParamInt | EffectParamColor | EffectParamBoolean | EffectParamSelect;

export interface PassConfig {
  fragmentShader: string;
  uniforms: UniformMap;
  bindOriginal?: boolean;
}

export interface UniformInt { __int: true; value: number; }
export function uniformInt(value: number): UniformInt { return { __int: true, value }; }
export type UniformValue = number | number[] | boolean | UniformInt;
export type UniformMap = Record<string, UniformValue>;

export interface EffectDefinition {
  id: string;
  name: string;
  params: Record<string, EffectParam>;
  getFragmentShader(): string;
  getUniforms(params: Record<string, EffectParam>): UniformMap;
  passes?: number;
  getPassConfig?(pass: number, params: Record<string, EffectParam>): PassConfig;
}

export interface LayerEffect {
  definitionId: string;
  enabled: boolean;
  params: Record<string, EffectParam>;
}

export function createLayerEffect(definition: EffectDefinition): LayerEffect {
  const params: Record<string, EffectParam> = {};
  for (const [key, param] of Object.entries(definition.params)) {
    params[key] = { ...param, value: param.type === 'color' ? [...param.value] : param.value } as EffectParam;
  }
  return {
    definitionId: definition.id,
    enabled: true,
    params
  };
}
