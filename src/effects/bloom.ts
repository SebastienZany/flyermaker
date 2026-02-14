import type { EffectDefinition, EffectParam, PassConfig } from './Effect';

const BLOOM_EXTRACT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_threshold;
uniform float u_strength;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float contribution = smoothstep(u_threshold, u_threshold + 0.1, brightness);
  vec4 bright = color * contribution * u_strength;
  fragColor = color + bright;
}
`;

const BLOOM_BLUR_H_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
out vec4 fragColor;

void main() {
  float sigma = max(u_radius, 0.001);
  int rad = int(ceil(sigma * 3.0));
  float total = 0.0;
  vec4 color = vec4(0.0);
  for (int i = -rad; i <= rad; i++) {
    float x = float(i);
    float w = exp(-(x * x) / (2.0 * sigma * sigma));
    vec2 offset = vec2(x / u_resolution.x, 0.0);
    color += texture(u_texture, v_texCoord + offset) * w;
    total += w;
  }
  fragColor = color / total;
}
`;

const BLOOM_BLUR_V_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
out vec4 fragColor;

void main() {
  float sigma = max(u_radius, 0.001);
  int rad = int(ceil(sigma * 3.0));
  float total = 0.0;
  vec4 color = vec4(0.0);
  for (int i = -rad; i <= rad; i++) {
    float y = float(i);
    float w = exp(-(y * y) / (2.0 * sigma * sigma));
    vec2 offset = vec2(0.0, y / u_resolution.y);
    color += texture(u_texture, v_texCoord + offset) * w;
    total += w;
  }
  fragColor = color / total;
}
`;

export const bloom: EffectDefinition = {
  id: 'bloom',
  name: 'Bloom',
  params: {
    threshold: { type: 'float', label: 'Threshold', value: 0.6, min: 0.0, max: 1.0, step: 0.01 },
    radius: { type: 'float', label: 'Radius', value: 8.0, min: 0.1, max: 40.0, step: 0.1 },
    strength: { type: 'float', label: 'Strength', value: 0.8, min: 0.0, max: 2.0, step: 0.01 }
  },
  passes: 3,
  getFragmentShader() {
    return BLOOM_EXTRACT_FRAGMENT;
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
      return {
        fragmentShader: BLOOM_EXTRACT_FRAGMENT,
        uniforms: { u_threshold: p.threshold.value, u_strength: p.strength.value }
      };
    } else if (pass === 1) {
      return {
        fragmentShader: BLOOM_BLUR_H_FRAGMENT,
        uniforms: { u_radius: p.radius.value }
      };
    } else {
      return {
        fragmentShader: BLOOM_BLUR_V_FRAGMENT,
        uniforms: { u_radius: p.radius.value }
      };
    }
  }
};
