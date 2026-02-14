import type { EffectDefinition, EffectParam } from './Effect';
import { uniformInt } from './Effect';

const GRAIN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_size;
uniform float u_seed;
uniform int u_mode;
out vec4 fragColor;

float rand(vec2 p, float seed) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed * 0.137) * 43758.5453);
}

float gaussian(vec2 p, float seed) {
  float u1 = max(rand(p + vec2(13.1, 7.7), seed), 1e-6);
  float u2 = rand(p + vec2(2.2, 17.3), seed + 19.17);
  return sqrt(-2.0 * log(u1)) * cos(6.28318530718 * u2);
}

void main() {
  vec4 src = texture(u_texture, v_texCoord);
  float amount = max(u_amount, 0.0);
  float scale = max(u_size, 1.0);

  vec2 px = floor(v_texCoord * u_resolution / scale);
  vec3 noise = vec3(0.0);

  if (u_mode == 0) {
    float n = gaussian(px, u_seed) * amount;
    noise = vec3(n);
  } else if (u_mode == 1) {
    noise.r = gaussian(px + vec2(11.0, 29.0), u_seed + 1.0) * amount;
    noise.g = gaussian(px + vec2(37.0, 3.0), u_seed + 2.0) * amount;
    noise.b = gaussian(px + vec2(5.0, 43.0), u_seed + 3.0) * amount;
  } else if (u_mode == 2) {
    vec3 c;
    c.r = gaussian(px + vec2(11.0, 29.0), u_seed + 4.0);
    c.g = gaussian(px + vec2(37.0, 3.0), u_seed + 5.0);
    c.b = gaussian(px + vec2(5.0, 43.0), u_seed + 6.0);
    c *= amount * 1.35;
    float meanC = (c.r + c.g + c.b) / 3.0;
    noise = c - vec3(meanC);
  } else {
    float n = gaussian(px, u_seed + 8.0) * amount * 1.2;
    noise = vec3(n);
  }

  fragColor = vec4(clamp(src.rgb + noise, 0.0, 1.0), src.a);
}
`;

export const grain: EffectDefinition = {
  id: 'grain',
  name: 'Grain / Noise',
  params: {
    amount: { type: 'float', label: 'Amount', value: 0.08, min: 0.0, max: 0.6, step: 0.005 },
    size: { type: 'float', label: 'Size', value: 1.0, min: 1.0, max: 8.0, step: 0.1 },
    seed: { type: 'int', label: 'Seed', value: 1, min: 0, max: 9999, step: 1 },
    mode: {
      type: 'select',
      label: 'Mode',
      value: 'fine-mono',
      options: ['fine-mono', 'color-speckle', 'soft-chroma', 'coarse-film']
    }
  },
  getFragmentShader() {
    return GRAIN_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    const p = params as Record<string, EffectParam & { value: number | string }>;
    const modeName = p.mode.value as string;
    const mode =
      modeName === 'color-speckle' ? 1 :
      modeName === 'soft-chroma' ? 2 :
      modeName === 'coarse-film' ? 3 : 0;

    return {
      u_amount: p.amount.value as number,
      u_size: p.size.value as number,
      u_seed: p.seed.value as number,
      u_mode: uniformInt(mode)
    };
  }
};
