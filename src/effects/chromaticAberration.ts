import type { EffectDefinition, EffectParam } from './Effect';
import { uniformInt } from './Effect';

const CHROMATIC_ABERRATION_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_shift;
uniform float u_angle;
uniform float u_mix;
uniform int u_mode;
out vec4 fragColor;

void main() {
  vec2 uv = v_texCoord;
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = vec2(cos(u_angle), sin(u_angle));
  vec2 px = vec2(1.0 / max(1.0, u_resolution.x), 1.0 / max(1.0, u_resolution.y));

  vec2 offset;
  if (u_mode == 0) {
    vec2 radial = uv - center;
    float radialLen = max(length(radial), 0.00001);
    vec2 radialNorm = radial / radialLen;
    offset = radialNorm * u_shift * px;
  } else {
    offset = dir * u_shift * px;
  }

  vec4 src = texture(u_texture, uv);
  float r = texture(u_texture, clamp(uv + offset, 0.0, 1.0)).r;
  float g = src.g;
  float b = texture(u_texture, clamp(uv - offset, 0.0, 1.0)).b;

  vec3 shifted = vec3(r, g, b);
  vec3 color = clamp(mix(src.rgb, shifted, u_mix), 0.0, 1.0);
  fragColor = vec4(color, src.a);
}
`;

export const chromaticAberration: EffectDefinition = {
  id: 'chromatic-aberration',
  name: 'Chromatic Aberration',
  params: {
    mode: { type: 'select', label: 'Mode', value: 'radial', options: ['radial', 'linear'] },
    shift: { type: 'float', label: 'Shift (px)', value: 2.5, min: 0.0, max: 40.0, step: 0.1 },
    angle: { type: 'float', label: 'Angle (deg)', value: 0, min: -180, max: 180, step: 1 },
    mix: { type: 'float', label: 'Mix', value: 1.0, min: 0.0, max: 1.0, step: 0.01 }
  },
  getFragmentShader() {
    return CHROMATIC_ABERRATION_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    const p = params as Record<string, EffectParam & { value: number | string }>;
    const mode = (p.mode.value as string) === 'linear' ? 1 : 0;
    return {
      u_mode: uniformInt(mode),
      u_shift: p.shift.value as number,
      u_angle: ((p.angle.value as number) * Math.PI) / 180,
      u_mix: p.mix.value as number
    };
  }
};
