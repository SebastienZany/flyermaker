import type { LayerEffect } from './types';

interface ProgramInfo {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export class EffectRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext | null;
  private readonly passProgram: ProgramInfo | null;
  private readonly blurProgram: ProgramInfo | null;
  private readonly bloomExtractProgram: ProgramInfo | null;
  private readonly bloomCompositeProgram: ProgramInfo | null;
  private readonly quad: WebGLBuffer | null;

  private frontTex: WebGLTexture | null = null;
  private backTex: WebGLTexture | null = null;
  private frontFbo: WebGLFramebuffer | null = null;
  private backFbo: WebGLFramebuffer | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
    if (!this.gl) {
      this.passProgram = null;
      this.blurProgram = null;
      this.bloomExtractProgram = null;
      this.bloomCompositeProgram = null;
      this.quad = null;
      return;
    }

    const gl = this.gl;
    this.passProgram = this.createProgram(baseFragmentShader, ['uTexture', 'uMode', 'uParamsA', 'uParamsB', 'uColor']);
    this.blurProgram = this.createProgram(blurFragmentShader, ['uTexture', 'uTexel', 'uDirection', 'uRadius']);
    this.bloomExtractProgram = this.createProgram(bloomExtractFragmentShader, ['uTexture', 'uThreshold']);
    this.bloomCompositeProgram = this.createProgram(bloomCompositeFragmentShader, ['uBase', 'uBloom', 'uIntensity']);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  }

  isSupported(): boolean {
    return Boolean(this.gl && this.passProgram && this.blurProgram && this.bloomExtractProgram && this.bloomCompositeProgram && this.quad);
  }

  process(source: TexImageSource, effects: LayerEffect[], width: number, height: number): CanvasImageSource {
    if (!this.isSupported() || effects.length === 0) return source as unknown as CanvasImageSource;
    const gl = this.gl as WebGL2RenderingContext;
    this.ensureTargets(width, height);
    if (!this.frontTex || !this.backTex || !this.frontFbo || !this.backFbo || !this.quad) return source as unknown as CanvasImageSource;

    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.frontTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    for (const effect of effects) {
      if (!effect.enabled) continue;
      if (effect.type === 'gaussian-blur') {
        const sigma = Number(effect.params.sigma ?? 0);
        this.runBlurPass(sigma);
      } else if (effect.type === 'bloom') {
        this.runBloom(effect.params);
      } else if (effect.type === 'vignette') {
        this.runPass(2, Number(effect.params.radius ?? 0.75), Number(effect.params.softness ?? 0.35), Number(effect.params.strength ?? 0.45), 0, String(effect.params.color ?? '#000000'));
      } else if (effect.type === 'color-grading') {
        this.runPass(
          1,
          Number(effect.params.brightness ?? 1),
          Number(effect.params.contrast ?? 1),
          Number(effect.params.saturation ?? 1),
          Number(effect.params.hueShift ?? 0),
          '#000000',
          Number(effect.params.lift ?? 0),
          Number(effect.params.gamma ?? 1),
          Number(effect.params.gain ?? 1)
        );
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drawTextureToScreen(this.frontTex);
    return this.canvas;
  }

  private runBloom(params: Record<string, number | string | boolean>): void {
    const threshold = Number(params.threshold ?? 0.7);
    const radius = Number(params.radius ?? 8);
    const intensity = Number(params.intensity ?? 0.8);
    const gl = this.gl as WebGL2RenderingContext;

    const baseTexture = this.frontTex;

    const extract = this.bloomExtractProgram;
    if (!extract || !baseTexture) return;
    gl.useProgram(extract.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.backFbo);
    this.bindTexture(baseTexture, 0);
    gl.uniform1i(extract.uniforms.uTexture, 0);
    gl.uniform1f(extract.uniforms.uThreshold, threshold);
    this.drawQuad(extract.program);
    this.swapBuffers();

    this.runBlurPass(radius);

    const bloomTexture = this.frontTex;
    if (!bloomTexture || !this.backFbo || !this.bloomCompositeProgram || !baseTexture) return;

    gl.useProgram(this.bloomCompositeProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.backFbo);
    this.bindTexture(baseTexture, 0);
    this.bindTexture(bloomTexture, 1);
    gl.uniform1i(this.bloomCompositeProgram.uniforms.uBase, 0);
    gl.uniform1i(this.bloomCompositeProgram.uniforms.uBloom, 1);
    gl.uniform1f(this.bloomCompositeProgram.uniforms.uIntensity, intensity);
    this.drawQuad(this.bloomCompositeProgram.program);
    this.swapBuffers();
  }

  private runBlurPass(radius: number): void {
    const gl = this.gl as WebGL2RenderingContext;
    const blur = this.blurProgram;
    if (!blur || !this.backFbo) return;

    gl.useProgram(blur.program);
    gl.uniform2f(blur.uniforms.uTexel, 1 / this.width, 1 / this.height);
    gl.uniform1f(blur.uniforms.uRadius, Math.max(0, radius));

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.backFbo);
    this.bindTexture(this.frontTex, 0);
    gl.uniform1i(blur.uniforms.uTexture, 0);
    gl.uniform2f(blur.uniforms.uDirection, 1, 0);
    this.drawQuad(blur.program);
    this.swapBuffers();

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.backFbo);
    this.bindTexture(this.frontTex, 0);
    gl.uniform2f(blur.uniforms.uDirection, 0, 1);
    this.drawQuad(blur.program);
    this.swapBuffers();
  }

  private runPass(mode: number, a: number, b: number, c: number, d: number, colorHex: string, e = 0, f = 1, g = 1): void {
    const gl = this.gl as WebGL2RenderingContext;
    if (!this.passProgram || !this.backFbo) return;
    const color = this.hexToRgb(colorHex);

    gl.useProgram(this.passProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.backFbo);
    this.bindTexture(this.frontTex, 0);
    gl.uniform1i(this.passProgram.uniforms.uTexture, 0);
    gl.uniform1i(this.passProgram.uniforms.uMode, mode);
    gl.uniform4f(this.passProgram.uniforms.uParamsA, a, b, c, d);
    gl.uniform4f(this.passProgram.uniforms.uParamsB, e, f, g, 0);
    gl.uniform3f(this.passProgram.uniforms.uColor, color[0], color[1], color[2]);
    this.drawQuad(this.passProgram.program);
    this.swapBuffers();
  }

  private drawTextureToScreen(texture: WebGLTexture): void {
    const gl = this.gl as WebGL2RenderingContext;
    gl.useProgram(this.passProgram?.program ?? null);
    if (!this.passProgram) return;
    this.bindTexture(texture, 0);
    gl.uniform1i(this.passProgram.uniforms.uTexture, 0);
    gl.uniform1i(this.passProgram.uniforms.uMode, 0);
    gl.uniform4f(this.passProgram.uniforms.uParamsA, 0, 0, 0, 0);
    gl.uniform4f(this.passProgram.uniforms.uParamsB, 0, 1, 1, 0);
    gl.uniform3f(this.passProgram.uniforms.uColor, 0, 0, 0);
    this.drawQuad(this.passProgram.program);
  }

  private swapBuffers(): void {
    [this.frontTex, this.backTex] = [this.backTex, this.frontTex];
    [this.frontFbo, this.backFbo] = [this.backFbo, this.frontFbo];
  }

  private ensureTargets(width: number, height: number): void {
    const gl = this.gl as WebGL2RenderingContext;
    if (this.width === width && this.height === height && this.frontTex && this.backTex && this.frontFbo && this.backFbo) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;

    this.frontTex = this.createTexture(width, height);
    this.backTex = this.createTexture(width, height);
    this.frontFbo = this.createFramebuffer(this.frontTex);
    this.backFbo = this.createFramebuffer(this.backTex);

    gl.viewport(0, 0, width, height);
  }

  private createTexture(width: number, height: number): WebGLTexture {
    const gl = this.gl as WebGL2RenderingContext;
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return texture;
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl as WebGL2RenderingContext;
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fbo;
  }

  private createProgram(fragmentSource: string, uniformNames: string[]): ProgramInfo {
    const gl = this.gl as WebGL2RenderingContext;
    const vertex = this.compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'Program link failed');
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
    return { program, uniforms };
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl as WebGL2RenderingContext;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Shader creation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
    }
    return shader;
  }

  private drawQuad(program: WebGLProgram): void {
    const gl = this.gl as WebGL2RenderingContext;
    if (!this.quad) return;
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindTexture(texture: WebGLTexture | null, unit: number): void {
    if (!texture) return;
    const gl = this.gl as WebGL2RenderingContext;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const num = Number.parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }
}

const vertexShader = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const baseFragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform int uMode;
uniform vec4 uParamsA;
uniform vec4 uParamsB;
uniform vec3 uColor;

vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0., -1./3., 2./3., -1.);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y)/(6.*d + e)), d/(q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(0.,1./3.,2./3.))*6.-3.);
  return c.z * mix(vec3(1.), clamp(p-1.,0.,1.), c.y);
}

void main() {
  vec4 src = texture(uTexture, vUv);
  if (uMode == 1) {
    vec3 col = src.rgb;
    col *= uParamsA.x;
    col = (col - 0.5) * uParamsA.y + 0.5;
    vec3 hsv = rgb2hsv(col);
    hsv.y = clamp(hsv.y * uParamsA.z, 0.0, 1.0);
    hsv.x = fract(hsv.x + uParamsA.w);
    col = hsv2rgb(hsv);
    col = (col + vec3(uParamsB.x)) * vec3(uParamsB.z);
    col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.001, uParamsB.y)));
    fragColor = vec4(clamp(col, 0.0, 1.0), src.a);
    return;
  }
  if (uMode == 2) {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) / max(0.001, uParamsA.x);
    float mask = smoothstep(1.0 - uParamsA.y, 1.0, dist);
    vec3 mixed = mix(src.rgb, uColor, mask * uParamsA.z);
    fragColor = vec4(clamp(mixed, 0.0, 1.0), src.a);
    return;
  }
  fragColor = src;
}`;

const blurFragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uRadius;
void main() {
  if (uRadius <= 0.01) {
    fragColor = texture(uTexture, vUv);
    return;
  }
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -12; i <= 12; i++) {
    float fi = float(i);
    float weight = exp(-(fi * fi) / (2.0 * uRadius * uRadius));
    vec2 offset = uDirection * uTexel * fi;
    sum += texture(uTexture, vUv + offset) * weight;
    total += weight;
  }
  fragColor = sum / max(total, 0.0001);
}`;

const bloomExtractFragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform float uThreshold;
void main() {
  vec4 src = texture(uTexture, vUv);
  float luma = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  float mask = smoothstep(uThreshold, min(1.0, uThreshold + 0.25), luma);
  fragColor = vec4(src.rgb * mask, src.a);
}`;

const bloomCompositeFragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform float uIntensity;
void main() {
  vec4 base = texture(uBase, vUv);
  vec4 bloom = texture(uBloom, vUv);
  fragColor = vec4(clamp(base.rgb + bloom.rgb * uIntensity, 0.0, 1.0), base.a);
}`;
