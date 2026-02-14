import type { EffectDefinition, EffectParam, PassConfig } from './Effect';

const HALATION_EXTRACT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_threshold;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  float y = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float mask = clamp((y - u_threshold) / max(0.00001, 1.0 - u_threshold), 0.0, 1.0);
  fragColor = vec4(color.rgb * mask, color.a);
}
`;

const HALATION_BLUR_H_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
out vec4 fragColor;

void main() {
  float sigma = max(0.001, u_radius);
  int radius = int(ceil(sigma * 3.0));
  vec4 acc = vec4(0.0);
  float total = 0.0;
  for (int i = -radius; i <= radius; i++) {
    float x = float(i);
    float w = exp(-(x * x) / (2.0 * sigma * sigma));
    acc += texture(u_texture, v_texCoord + vec2(x / u_resolution.x, 0.0)) * w;
    total += w;
  }
  fragColor = acc / total;
}
`;

const HALATION_BLUR_V_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
out vec4 fragColor;

void main() {
  float sigma = max(0.001, u_radius);
  int radius = int(ceil(sigma * 3.0));
  vec4 acc = vec4(0.0);
  float total = 0.0;
  for (int i = -radius; i <= radius; i++) {
    float y = float(i);
    float w = exp(-(y * y) / (2.0 * sigma * sigma));
    acc += texture(u_texture, v_texCoord + vec2(0.0, y / u_resolution.y)) * w;
    total += w;
  }
  fragColor = acc / total;
}
`;

const HALATION_COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform sampler2D u_original;
uniform float u_strength;
out vec4 fragColor;

void main() {
  vec3 warm = vec3(1.0, 0.58, 0.32);
  vec4 blurred = texture(u_texture, v_texCoord);
  vec4 original = texture(u_original, v_texCoord);
  vec3 outColor = clamp(original.rgb + (blurred.rgb * warm * u_strength), 0.0, 1.0);
  fragColor = vec4(outColor, original.a);
}
`;

export const halation: EffectDefinition = {
  id: 'halation',
  name: 'Halation',
  params: {
    threshold: { type: 'float', label: 'Threshold', value: 0.55, min: 0.0, max: 1.0, step: 0.01 },
    radius: { type: 'float', label: 'Radius', value: 10.0, min: 0.1, max: 48.0, step: 0.1 },
    strength: { type: 'float', label: 'Strength', value: 0.65, min: 0.0, max: 2.0, step: 0.01 }
  },
  passes: 4,
  getFragmentShader() {
    return HALATION_EXTRACT_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    const p = params as Record<string, EffectParam & { value: number }>;
    return {
      u_threshold: p.threshold.value,
      u_radius: p.radius.value,
      u_strength: p.strength.value
    };
  },
  getPassConfig(pass: number, params: Record<string, EffectParam>): PassConfig {
    const p = params as Record<string, EffectParam & { value: number }>;
    if (pass === 0) {
      return { fragmentShader: HALATION_EXTRACT_FRAGMENT, uniforms: { u_threshold: p.threshold.value } };
    }
    if (pass === 1) {
      return { fragmentShader: HALATION_BLUR_H_FRAGMENT, uniforms: { u_radius: p.radius.value } };
    }
    if (pass === 2) {
      return { fragmentShader: HALATION_BLUR_V_FRAGMENT, uniforms: { u_radius: p.radius.value } };
    }
    return {
      fragmentShader: HALATION_COMPOSITE_FRAGMENT,
      uniforms: { u_strength: p.strength.value },
      bindOriginal: true
    };
  }
};
