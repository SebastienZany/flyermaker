import type { EffectDefinition, EffectParam } from './Effect';

const IRIDESCENCE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_hueShift;
uniform float u_edgeBias;
uniform float u_satBoost;
uniform float u_softness;
uniform float u_lumaCenter;
uniform float u_lumaRange;
uniform float u_seed;
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

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float dither(vec2 uv, float seed) {
  return fract(sin(12.9898 * uv.x + 78.233 * uv.y + 0.137 * (seed + 911.0)) * 43758.5453) - 0.5;
}

void main() {
  vec4 src = texture(u_texture, v_texCoord);
  vec2 px = vec2(1.0 / max(1.0, u_resolution.x), 1.0 / max(1.0, u_resolution.y));

  vec3 c = src.rgb;
  float Y = luma(c);

  vec3 cL = texture(u_texture, clamp(v_texCoord - vec2(px.x, 0.0), 0.0, 1.0)).rgb;
  vec3 cR = texture(u_texture, clamp(v_texCoord + vec2(px.x, 0.0), 0.0, 1.0)).rgb;
  vec3 cU = texture(u_texture, clamp(v_texCoord - vec2(0.0, px.y), 0.0, 1.0)).rgb;
  vec3 cD = texture(u_texture, clamp(v_texCoord + vec2(0.0, px.y), 0.0, 1.0)).rgb;

  float gx = abs(luma(cR) - luma(cL));
  float gy = abs(luma(cD) - luma(cU));
  float E = clamp(length(vec2(gx, gy)) * 6.0, 0.0, 1.0);

  float blurStep = max(0.4, u_softness * 1.2);
  vec2 bpx = px * blurStep;
  vec3 ambient = (
    texture(u_texture, clamp(v_texCoord + vec2(-bpx.x, 0.0), 0.0, 1.0)).rgb +
    texture(u_texture, clamp(v_texCoord + vec2( bpx.x, 0.0), 0.0, 1.0)).rgb +
    texture(u_texture, clamp(v_texCoord + vec2(0.0, -bpx.y), 0.0, 1.0)).rgb +
    texture(u_texture, clamp(v_texCoord + vec2(0.0,  bpx.y), 0.0, 1.0)).rgb +
    c
  ) / 5.0;

  vec3 hsv = rgb2hsv(c);
  vec3 ahsv = rgb2hsv(ambient);

  float lumRange = max(0.05, u_lumaRange);
  float Gmid = clamp(1.0 - abs(Y - u_lumaCenter) / lumRange, 0.0, 1.0);
  float Ghi = clamp((Y - 0.42) / 0.35, 0.0, 1.0) * clamp((0.995 - Y) / 0.18, 0.0, 1.0);
  float Gl = max(Gmid, 0.9 * Ghi);
  float Gw = clamp((0.995 - Y) / 0.20, 0.0, 1.0);

  float S0 = clamp(max(hsv.y, 0.9 * ahsv.y), 0.0, 1.0);
  float Gs = clamp(0.15 + 1.05 * S0, 0.0, 1.0);
  float Nb = clamp((0.28 - hsv.y) / 0.28, 0.0, 1.0);

  float R = clamp(mix(Gs, E, clamp(u_edgeBias, 0.0, 1.0)) + Nb * (0.25 + 0.45 * E), 0.0, 1.0);
  float W = clamp(R * Gl * Gw, 0.0, 1.0);
  float Ef = clamp(u_amount, 0.0, 1.0) * W;

  float Nh = clamp((0.24 - hsv.y) / 0.24, 0.0, 1.0);
  float Hs = fract(mix(hsv.x, ahsv.x, Nh));

  float phi = fract(Hs + 0.18 * Y + 0.22 * E);
  float Ht = Hs + u_hueShift
    + 0.14 * sin(6.28318530718 * (1.8 * phi + 0.65 * E))
    + 0.04 * sin(6.28318530718 * (4.2 * phi + 1.2 * Y));
  Ht = fract(Ht);

  float dH = mod((Ht - Hs + 0.5), 1.0) - 0.5;

  float D = dither(v_texCoord * u_resolution, u_seed);
  float Hp = fract(Hs + dH * Ef + D * (0.0010 + 0.0022 * Ef));

  float Q = 1.0 - exp(-clamp(1.1 * u_satBoost * Ef, 0.0, 12.0));
  float Sp = clamp(S0 + Q * (0.18 + 0.68 * (1.0 - S0)), 0.0, 1.0);
  Sp = clamp(Sp + D * (0.012 * Ef), 0.0, 1.0);
  float Vp = clamp(hsv.z * (1.0 + 0.07 * Ef) + 0.014 * Ef, 0.0, 1.0);

  vec3 remapped = hsv2rgb(vec3(Hp, Sp, Vp));
  float M = clamp(Ef * (0.55 + 0.45 * (1.0 - hsv.y)), 0.0, 1.0);

  vec3 outColor = clamp(mix(c, remapped, M), 0.0, 1.0);
  fragColor = vec4(outColor, src.a);
}
`;

export const iridescence: EffectDefinition = {
  id: 'iridescence',
  name: 'Iridescence',
  params: {
    amount: { type: 'float', label: 'Amount', value: 0.45, min: 0.0, max: 1.0, step: 0.01 },
    hueShift: { type: 'float', label: 'Hue Shift', value: 0.08, min: -1.0, max: 1.0, step: 0.005 },
    edgeBias: { type: 'float', label: 'Edge Bias', value: 0.65, min: 0.0, max: 1.0, step: 0.01 },
    satBoost: { type: 'float', label: 'Saturation Boost', value: 1.2, min: 0.0, max: 3.0, step: 0.01 },
    softness: { type: 'float', label: 'Softness', value: 1.0, min: 0.0, max: 8.0, step: 0.1 },
    lumaCenter: { type: 'float', label: 'Luma Center', value: 0.62, min: 0.0, max: 1.0, step: 0.01 },
    lumaRange: { type: 'float', label: 'Luma Range', value: 0.3, min: 0.05, max: 1.0, step: 0.01 },
    seed: { type: 'int', label: 'Seed', value: 101, min: 0, max: 9999, step: 1 }
  },
  getFragmentShader() {
    return IRIDESCENCE_FRAGMENT;
  },
  getUniforms(params: Record<string, EffectParam>) {
    const p = params as Record<string, EffectParam & { value: number }>;
    return {
      u_amount: p.amount.value,
      u_hueShift: p.hueShift.value,
      u_edgeBias: p.edgeBias.value,
      u_satBoost: p.satBoost.value,
      u_softness: p.softness.value,
      u_lumaCenter: p.lumaCenter.value,
      u_lumaRange: p.lumaRange.value,
      u_seed: p.seed.value
    };
  }
};
