import type { LayerEffect, UniformMap } from './Effect';
import { effectRegistry } from './EffectRegistry';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const PASSTHROUGH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 fragColor;
void main() {
  fragColor = texture(u_texture, v_texCoord);
}
`;

interface PingPongBuffers {
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  textures: [WebGLTexture, WebGLTexture];
  width: number;
  height: number;
}

interface ShaderProgram {
  program: WebGLProgram;
  attribs: { position: number; texCoord: number };
  uniforms: { texture: WebGLUniformLocation | null };
}

export class EffectRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private pingPong: PingPongBuffers | null = null;
  private shaderCache = new Map<string, ShaderProgram>();
  private vertexBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private sourceTexture: WebGLTexture | null = null;
  private effectOriginalTexture: WebGLTexture | null = null;
  private effectOriginalFb: WebGLFramebuffer | null = null;
  private effectOriginalSize: { width: number; height: number } = { width: 0, height: 0 };
  private resultCanvas: HTMLCanvasElement | null = null;
  private cacheMap = new Map<string, HTMLCanvasElement>();

  private ensureContext(): WebGL2RenderingContext {
    if (this.gl) return this.gl;
    this.offscreenCanvas = new OffscreenCanvas(1, 1);
    const gl = this.offscreenCanvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (!gl) throw new Error('WebGL 2 not supported');
    this.gl = gl;
    this.initBuffers(gl);
    return gl;
  }

  private initBuffers(gl: WebGL2RenderingContext): void {
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  private ensurePingPong(gl: WebGL2RenderingContext, width: number, height: number): PingPongBuffers {
    if (this.pingPong && this.pingPong.width === width && this.pingPong.height === height) {
      return this.pingPong;
    }
    if (this.pingPong) {
      gl.deleteFramebuffer(this.pingPong.framebuffers[0]);
      gl.deleteFramebuffer(this.pingPong.framebuffers[1]);
      gl.deleteTexture(this.pingPong.textures[0]);
      gl.deleteTexture(this.pingPong.textures[1]);
    }
    const fbs: [WebGLFramebuffer, WebGLFramebuffer] = [gl.createFramebuffer()!, gl.createFramebuffer()!];
    const texs: [WebGLTexture, WebGLTexture] = [gl.createTexture()!, gl.createTexture()!];
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, texs[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbs[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texs[i], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pingPong = { framebuffers: fbs, textures: texs, width, height };
    return this.pingPong;
  }

  private snapshotEffectInput(gl: WebGL2RenderingContext, inputTex: WebGLTexture, width: number, height: number): WebGLTexture {
    if (
      !this.effectOriginalTexture ||
      this.effectOriginalSize.width !== width ||
      this.effectOriginalSize.height !== height
    ) {
      if (this.effectOriginalTexture) gl.deleteTexture(this.effectOriginalTexture);
      if (this.effectOriginalFb) gl.deleteFramebuffer(this.effectOriginalFb);

      this.effectOriginalTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.effectOriginalTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.effectOriginalFb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.effectOriginalFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.effectOriginalTexture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      this.effectOriginalSize = { width, height };
    }

    // Copy inputTex into the snapshot texture via a blit
    const passThroughProg = this.getProgram(gl, PASSTHROUGH_FRAGMENT);
    this.drawPass(gl, passThroughProg, inputTex, this.effectOriginalFb!, {}, width, height);

    return this.effectOriginalTexture;
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${log}`);
    }
    return shader;
  }

  private getProgram(gl: WebGL2RenderingContext, fragmentSource: string): ShaderProgram {
    const cached = this.shaderCache.get(fragmentSource);
    if (cached) return cached;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${log}`);
    }

    const result: ShaderProgram = {
      program,
      attribs: {
        position: gl.getAttribLocation(program, 'a_position'),
        texCoord: gl.getAttribLocation(program, 'a_texCoord')
      },
      uniforms: {
        texture: gl.getUniformLocation(program, 'u_texture')
      }
    };
    this.shaderCache.set(fragmentSource, result);
    return result;
  }

  private uploadSource(gl: WebGL2RenderingContext, source: CanvasImageSource, width: number, height: number): WebGLTexture {
    if (!this.sourceTexture) {
      this.sourceTexture = gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return this.sourceTexture;
  }

  private drawPass(gl: WebGL2RenderingContext, prog: ShaderProgram, inputTex: WebGLTexture, outputFb: WebGLFramebuffer | null, uniforms: UniformMap, width: number, height: number, originalTex?: WebGLTexture): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFb);
    gl.viewport(0, 0, width, height);

    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    if (prog.uniforms.texture !== null) {
      gl.uniform1i(prog.uniforms.texture, 0);
    }

    if (originalTex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, originalTex);
      const origLoc = gl.getUniformLocation(prog.program, 'u_original');
      if (origLoc !== null) gl.uniform1i(origLoc, 1);
      gl.activeTexture(gl.TEXTURE0);
    }

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(prog.program, name);
      if (loc === null) continue;
      if (typeof value === 'boolean') {
        gl.uniform1i(loc, value ? 1 : 0);
      } else if (typeof value === 'number') {
        gl.uniform1f(loc, value);
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else if (value.length === 4) gl.uniform4fv(loc, value);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(prog.attribs.position);
    gl.vertexAttribPointer(prog.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(prog.attribs.texCoord);
    gl.vertexAttribPointer(prog.attribs.texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  process(source: CanvasImageSource, width: number, height: number, effects: LayerEffect[], cacheKey: string): HTMLCanvasElement | null {
    const enabledEffects = effects.filter((e) => e.enabled);
    if (enabledEffects.length === 0) return null;

    const cached = this.cacheMap.get(cacheKey);
    if (cached && cached.width === width && cached.height === height) {
      return cached;
    }

    const gl = this.ensureContext();
    this.offscreenCanvas!.width = width;
    this.offscreenCanvas!.height = height;

    const pp = this.ensurePingPong(gl, width, height);
    const srcTex = this.uploadSource(gl, source, width, height);

    let readIndex = 0;
    let inputTexture = srcTex;

    for (const effect of enabledEffects) {
      const def = effectRegistry.get(effect.definitionId);
      if (!def) continue;

      const passCount = def.passes ?? 1;

      // For multi-pass effects, snapshot the current input into a
      // separate texture so it survives ping-pong overwrites.
      let effectOriginalTex: WebGLTexture | undefined;
      if (passCount > 1) {
        effectOriginalTex = this.snapshotEffectInput(gl, inputTexture, width, height);
      }

      for (let pass = 0; pass < passCount; pass++) {
        let fragmentSource: string;
        let uniforms: UniformMap;
        let bindOriginal = false;

        if (def.getPassConfig && passCount > 1) {
          const config = def.getPassConfig(pass, effect.params);
          fragmentSource = config.fragmentShader;
          uniforms = config.uniforms;
          bindOriginal = config.bindOriginal === true;
        } else {
          fragmentSource = def.getFragmentShader();
          uniforms = def.getUniforms(effect.params);
        }

        uniforms['u_resolution'] = [width, height];

        const prog = this.getProgram(gl, fragmentSource);
        const writeIndex = readIndex === 0 ? 1 : 0;
        this.drawPass(gl, prog, inputTexture, pp.framebuffers[writeIndex], uniforms, width, height, bindOriginal ? effectOriginalTex : undefined);
        inputTexture = pp.textures[writeIndex];
        readIndex = writeIndex;
      }
    }

    // Read back to a canvas
    if (!this.resultCanvas) {
      this.resultCanvas = document.createElement('canvas');
    }
    this.resultCanvas.width = width;
    this.resultCanvas.height = height;

    // Copy from last written framebuffer to the passthrough (screen) then read
    const passThroughProg = this.getProgram(gl, PASSTHROUGH_FRAGMENT);
    this.drawPass(gl, passThroughProg, inputTexture, null, {}, width, height);

    const resultCtx = this.resultCanvas.getContext('2d')!;
    resultCtx.clearRect(0, 0, width, height);
    resultCtx.drawImage(this.offscreenCanvas! as unknown as CanvasImageSource, 0, 0);

    // Cache it — evict stale entries for the same layer first
    const layerId = cacheKey.split('|')[0];
    for (const key of this.cacheMap.keys()) {
      if (key.startsWith(layerId + '|') && key !== cacheKey) {
        this.cacheMap.delete(key);
      }
    }
    const cacheCanvas = document.createElement('canvas');
    cacheCanvas.width = width;
    cacheCanvas.height = height;
    const cacheCtx = cacheCanvas.getContext('2d')!;
    cacheCtx.drawImage(this.resultCanvas, 0, 0);
    this.cacheMap.set(cacheKey, cacheCanvas);

    return cacheCanvas;
  }

  pruneDeletedLayers(activeLayerIds: Set<string>): void {
    for (const key of this.cacheMap.keys()) {
      const id = key.split('|')[0];
      if (!activeLayerIds.has(id)) {
        this.cacheMap.delete(key);
      }
    }
  }

  invalidateCache(layerId?: string): void {
    if (layerId) {
      for (const key of this.cacheMap.keys()) {
        if (key.startsWith(layerId)) {
          this.cacheMap.delete(key);
        }
      }
    } else {
      this.cacheMap.clear();
    }
  }
}
