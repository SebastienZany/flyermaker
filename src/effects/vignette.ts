import type { EffectDefinition, EffectParam } from './Effect';

const VIGNETTE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_radius;
uniform float u_softness;
uniform vec2 u_center;
uniform vec3 u_color;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  vec2 uv = v_texCoord - u_center;
  float dist = length(uv);
  float vignette = smoothstep(u_radius, u_radius - u_softness, dist);
  color.rgb = mix(u_color, color.rgb, vignette);
  fragColor = color;
}
`;

export const vignette: EffectDefinition = {
  id: 'vignette',
  name: 'Vignette',
  params: {
    centerX: { type: 'float', label: 'Center X', value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    centerY: { type: 'float', label: 'Center Y', value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    radius: { type: 'float', label: 'Radius', value: 0.75, min: 0.0, max: 2.0, step: 0.01 },
    softness: { type: 'float', label: 'Softness', value: 0.45, min: 0.0, max: 1.0, step: 0.01 },
    color: { type: 'color', label: 'Color', value: [0, 0, 0] }
  },
  getFragmentShader() {
    return VIGNETTE_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    const p = params as Record<string, EffectParam & { value: number | [number, number, number] }>;
    return {
      u_radius: p.radius.value as number,
      u_softness: p.softness.value as number,
      u_center: [p.centerX.value as number, p.centerY.value as number],
      u_color: p.color.value as [number, number, number]
    };
  }
};
