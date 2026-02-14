import type { EffectDefinition, EffectParam } from './Effect';

const COLOR_GRADING_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;
uniform vec3 u_lift;
uniform vec3 u_gamma;
uniform vec3 u_gain;
out vec4 fragColor;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;

  // Brightness
  color *= u_brightness;

  // Contrast
  color = (color - 0.5) * u_contrast + 0.5;

  // Saturation
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, u_saturation);

  // Hue shift
  vec3 hsv = rgb2hsv(color);
  hsv.x = fract(hsv.x + u_hue / 360.0);
  color = hsv2rgb(hsv);

  // Lift/Gamma/Gain
  color = u_gain * (u_lift * (1.0 - color) + color);
  color = pow(max(color, vec3(0.0)), 1.0 / max(u_gamma, vec3(0.01)));

  fragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
`;

export const colorGrading: EffectDefinition = {
  id: 'color-grading',
  name: 'Color Grading',
  params: {
    brightness: { type: 'float', label: 'Brightness', value: 1.0, min: 0.0, max: 2.0, step: 0.01 },
    contrast: { type: 'float', label: 'Contrast', value: 1.0, min: 0.0, max: 2.0, step: 0.01 },
    saturation: { type: 'float', label: 'Saturation', value: 1.0, min: 0.0, max: 2.0, step: 0.01 },
    hue: { type: 'float', label: 'Hue Shift', value: 0, min: -180, max: 180, step: 1 },
    lift: { type: 'color', label: 'Lift', value: [0, 0, 0] },
    gamma: { type: 'color', label: 'Gamma', value: [1, 1, 1] },
    gain: { type: 'color', label: 'Gain', value: [1, 1, 1] }
  },
  getFragmentShader() {
    return COLOR_GRADING_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    const p = params as Record<string, EffectParam & { value: number | [number, number, number] }>;
    return {
      u_brightness: p.brightness.value as number,
      u_contrast: p.contrast.value as number,
      u_saturation: p.saturation.value as number,
      u_hue: p.hue.value as number,
      u_lift: p.lift.value as [number, number, number],
      u_gamma: p.gamma.value as [number, number, number],
      u_gain: p.gain.value as [number, number, number]
    };
  }
};
