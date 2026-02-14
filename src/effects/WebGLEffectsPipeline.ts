import type { LayerEffect } from '../model/Layer';

interface EffectUniforms {
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

const VERTEX_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_exposure;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;

vec3 applyHue(vec3 color, float angleDegrees) {
  float angle = radians(angleDegrees);
  float s = sin(angle);
  float c = cos(angle);
  mat3 hueRotation = mat3(
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
  );
  return clamp(hueRotation * color, 0.0, 1.0);
}

void main() {
  vec4 base = texture2D(u_image, v_uv);
  vec3 color = base.rgb;
  color *= pow(2.0, u_exposure);
  color += vec3(u_brightness);
  color = (color - 0.5) * (1.0 + u_contrast) + 0.5;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, 1.0 + u_saturation);
  color = applyHue(color, u_hue);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), base.a);
}
`;

export class WebGLEffectsPipeline {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  apply(source: CanvasImageSource, width: number, height: number, effects: LayerEffect[]): CanvasImageSource {
    const uniforms = this.readUniforms(effects);
    if (!this.hasActiveEffect(uniforms)) return source;

    const gl = this.ensureContext();
    if (!gl || !this.program || !this.texture) return source;

    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    gl.viewport(0, 0, width, height);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);

    gl.useProgram(this.program);
    gl.uniform1i(this.uniforms.image, 0);
    gl.uniform1f(this.uniforms.exposure, uniforms.exposure);
    gl.uniform1f(this.uniforms.brightness, uniforms.brightness);
    gl.uniform1f(this.uniforms.contrast, uniforms.contrast);
    gl.uniform1f(this.uniforms.saturation, uniforms.saturation);
    gl.uniform1f(this.uniforms.hue, uniforms.hue);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  private hasActiveEffect(uniforms: EffectUniforms): boolean {
    return uniforms.exposure !== 0
      || uniforms.brightness !== 0
      || uniforms.contrast !== 0
      || uniforms.saturation !== 0
      || uniforms.hue !== 0;
  }

  private readUniforms(effects: LayerEffect[]): EffectUniforms {
    const getValue = (type: LayerEffect['type']): number => {
      const effect = effects.find((entry) => entry.type === type);
      if (!effect || !effect.enabled) return 0;
      return effect.value;
    };
    return {
      exposure: getValue('exposure'),
      brightness: getValue('brightness'),
      contrast: getValue('contrast'),
      saturation: getValue('saturation'),
      hue: getValue('hue')
    };
  }

  private ensureContext(): WebGLRenderingContext | null {
    if (this.gl && this.program && this.texture) return this.gl;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true });
    if (!gl) return null;

    const vertex = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

    const buffer = gl.createBuffer();
    if (!buffer) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        1, 1, 1, 1
      ]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);
    const aPosition = gl.getAttribLocation(program, 'a_position');
    const aUv = gl.getAttribLocation(program, 'a_uv');
    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    const texture = gl.createTexture();
    if (!texture) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.gl = gl;
    this.program = program;
    this.texture = texture;
    this.uniforms = {
      image: gl.getUniformLocation(program, 'u_image'),
      exposure: gl.getUniformLocation(program, 'u_exposure'),
      brightness: gl.getUniformLocation(program, 'u_brightness'),
      contrast: gl.getUniformLocation(program, 'u_contrast'),
      saturation: gl.getUniformLocation(program, 'u_saturation'),
      hue: gl.getUniformLocation(program, 'u_hue')
    };
    return this.gl;
  }

  private compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  }
}
