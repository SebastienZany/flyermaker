import type { EffectDefinition, EffectParam, PassConfig } from './Effect';

const BLUR_H_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_sigma;
out vec4 fragColor;

void main() {
  float sigma = max(u_sigma, 0.001);
  int radius = int(ceil(sigma * 3.0));
  float total = 0.0;
  vec4 color = vec4(0.0);
  for (int i = -radius; i <= radius; i++) {
    float x = float(i);
    float w = exp(-(x * x) / (2.0 * sigma * sigma));
    vec2 offset = vec2(x / u_resolution.x, 0.0);
    color += texture(u_texture, v_texCoord + offset) * w;
    total += w;
  }
  fragColor = color / total;
}
`;

const BLUR_V_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_sigma;
out vec4 fragColor;

void main() {
  float sigma = max(u_sigma, 0.001);
  int radius = int(ceil(sigma * 3.0));
  float total = 0.0;
  vec4 color = vec4(0.0);
  for (int i = -radius; i <= radius; i++) {
    float y = float(i);
    float w = exp(-(y * y) / (2.0 * sigma * sigma));
    vec2 offset = vec2(0.0, y / u_resolution.y);
    color += texture(u_texture, v_texCoord + offset) * w;
    total += w;
  }
  fragColor = color / total;
}
`;

export const gaussianBlur: EffectDefinition = {
  id: 'gaussian-blur',
  name: 'Gaussian Blur',
  params: {
    sigma: { type: 'float', label: 'Radius', value: 4.0, min: 0.1, max: 50.0, step: 0.1 }
  },
  passes: 2,
  getFragmentShader() {
    return BLUR_H_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    return { u_sigma: (params.sigma as EffectParam & { value: number }).value };
  },
  getPassConfig(pass: number, params: Record<string, EffectParam>): PassConfig {
    const sigma = (params.sigma as EffectParam & { value: number }).value;
    return {
      fragmentShader: pass === 0 ? BLUR_H_FRAGMENT : BLUR_V_FRAGMENT,
      uniforms: { u_sigma: sigma }
    };
  }
};
