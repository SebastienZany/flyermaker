# FlyerMaker — Implementation Plan

## Context
Building a compositing/effects-focused image editor (not a painting tool). Core workflow: import images → arrange as layers → apply non-destructive effects (bloom, halation, iridescence, etc.) → composite with blend modes → export. Effects are modular — each is an independent module with its own parameters and shader(s).

**UI Reference:** Visual mockups and design files are located in `mockup/` — use these as reference for layout, styling, and component structure during implementation.

**UI Implementation Rule:** Only ship functional UI elements (no decorative or non-working mock controls). Any element that appears in the app must do something meaningful now, while still closely following the visual structure in `mockup/`.

**Visual QA Rule:** Validate UI changes with Playwright screenshots and compare against the reference images in `mockup/` (especially `mockup/v1-initial.png` and `mockup/v2-refined.png`). Iterate until the rendered app matches the intended mockup styling and structure for the implemented scope.

**Playwright Functional QA Rule:** Playwright runs must verify real interactions (import, zoom, transforms, layer operations, etc.), not just first-load appearance checks.

**Build Tag Rule:** Every build must expose a visible build tag in the app chrome (for example in the menubar/status bar) so testers can immediately confirm which build is running.

**E2E Test Suite Rule:** Maintain an automated Playwright end-to-end suite that validates viewport/ruler/document-size behavior and other core interactions on every iteration.

## Tech Stack
- **TypeScript + Vite** — type safety, fast HMR
- **Canvas 2D** — layer compositing via `globalCompositeOperation` (all 16 blend modes)
- **WebGL 2** — effects pipeline (each effect = GLSL fragment shader module, multi-pass capable)
- **Vanilla DOM + EventBus** — UI panels, no framework

## Architecture

**Data flow:** UI → Commands → Model → EventBus → Renderer + UI

### Core Modules

- **`EventBus`** — typed pub/sub
- **`Document`** — layers[], dimensions, active layer
- **`Layer`** — source pixels (OffscreenCanvas) + effects stack + metadata (opacity, blendMode, visible, locked)
- **`EffectStack`** — ordered list of `Effect` instances per layer, non-destructive
- **`Effect`** (interface) — `name`, `enabled`, `params`, `getShader()`, `getUniforms()` — each effect is a self-contained module
- **`EffectRenderer`** (WebGL) — takes a source texture + effect stack → outputs processed texture via ping-pong framebuffers
- **`Compositor`** (Canvas 2D) — composites processed layers bottom-to-top with blend modes + opacity
- **`Renderer`** — orchestrates: for each layer, run EffectRenderer → then Compositor → viewport → overlay
- **`Viewport`** — zoom/pan, coordinate transforms
- **`History`** — Command pattern undo/redo

### Effects Pipeline (WebGL)

```
Layer source canvas
  → upload as WebGL texture
  → for each Effect in the layer's stack:
      bind input texture → run effect shader → output to framebuffer texture
      (ping-pong between two framebuffers for multi-pass effects)
  → readback final texture to layer's "processed" canvas
  → Compositor draws processed canvas with blend mode + opacity
```

Each Effect module exports:
```typescript
interface Effect {
  id: string;
  name: string;            // "Bloom", "Halation", "Iridescence"
  enabled: boolean;
  params: Record<string, EffectParam>;  // sliders, colors, dropdowns
  getFragmentShader(): string;          // GLSL source
  getUniforms(params): UniformMap;      // param values → uniform values
  passes?: number;                      // multi-pass (e.g. blur = 2 pass)
  getPassConfig?(pass: number): PassConfig;  // per-pass direction, etc.
}

interface EffectParam {
  type: 'float' | 'int' | 'color' | 'boolean' | 'select';
  label: string;
  value: any;
  min?: number; max?: number; step?: number;
  options?: string[];       // for select type
}
```

### Initial Effect Modules to Build
1. **Bloom** — extract bright areas → gaussian blur → additive blend back
2. **Halation** — similar to bloom but with color shift (red/warm channel bleed)
3. **Iridescence** — angle-dependent color shift using thin-film interference model
4. **Gaussian Blur** — separable 2-pass blur (horizontal + vertical)
5. **Chromatic Aberration** — offset RGB channels
6. **Vignette** — radial darkening
7. **Color Grading** — lift/gamma/gain, hue shift, saturation
8. **Grain/Noise** — film grain overlay

## Project Structure (Actual)
```
src/
  main.ts               — entry point, registers effects, bootstraps App
  app.ts                — main App class (UI, event handling, state, undo/redo)
  styles/
    main.css             — all UI styling (panels, canvas, rulers, toolbar, effects)
  core/
    EventBus.ts          — typed pub/sub event system
  model/
    Document.ts          — document dimensions, layers, active layer
    Layer.ts             — Layer with LayerContent union + effects array
    History.ts           — snapshot-based undo/redo
  effects/
    Effect.ts            — Effect/EffectParam/PassConfig types, createLayerEffect()
    EffectRegistry.ts    — singleton registry for available effect definitions
    EffectRenderer.ts    — WebGL 2 context, shader compilation, ping-pong FBOs, caching
    EffectStack.ts       — cache key generation, deep clone, eviction utilities
    registerEffects.ts   — registers all built-in effects at startup
    blur.ts              — Gaussian Blur (separable 2-pass)
    bloom.ts             — Bloom (4-pass: extract + H-blur + V-blur + composite)
    vignette.ts          — Vignette (radial darkening)
    colorGrading.ts      — Color Grading (brightness/contrast/sat/hue/lift/gamma/gain)
  renderer/
    Renderer.ts          — main render loop (compositor + selection overlay)
    Compositor.ts        — Canvas 2D layer compositing with WebGL effect integration
    Viewport.ts          — zoom/pan state + math
    RulerRenderer.ts     — horizontal/vertical ruler drawing
  ui/
    LayersPanel.ts       — layer list panel with controls
    EffectsPanel.ts      — effect stack panel with auto-generated param controls
```

## Planned Structure (Future Phases)
```
src/
  effects/
    halation.ts, iridescence.ts, chromatic-aberration.ts, grain.ts
  tools/
    ToolManager.ts, MoveTool.ts, HandTool.ts, TextTool.ts
  io/
    Exporter.ts          — PNG/JPEG export
```

## Phased Implementation

### Phase 1: Project Setup + Skeleton UI
- Vite + TypeScript config
- Extract CSS from mockup into `src/styles/`
- `App` class builds DOM from mockup structure
- **Verify:** app loads, identical to mockup

### Phase 2: Core Model + Basic Rendering
- `EventBus`, `types.ts`, `math.ts` (Vec2, Rect, Matrix3)
- `Document`, `Layer` (OffscreenCanvas per layer)
- `Viewport` (zoom/pan/coordinates)
- `Renderer` + `Compositor` (Canvas 2D, all 16 blend modes via `globalCompositeOperation`)
- Real `<canvas>` replaces mockup div, default 800×600 white background
- **Verify:** white canvas with checkerboard

### Phase 3: Viewport + Rulers
- Mouse wheel zoom, spacebar+drag pan
- Hand/Zoom tools, zoom buttons (+/−/fit)
- `RulerRenderer`, `StatusBar` with live coords
- **Verify:** zoom/pan, rulers update

### Phase 4: Layer System
- `LayersPanel` from Document state
- Add/delete/reorder/visibility/lock/rename
- Blend mode dropdown + opacity slider
- Layer thumbnails
- `LayerCommand` for undo
- **Verify:** layer operations work, compositing with blend modes visible

### Phase 5: Image Import
- `ImageImporter`: file dialog, URL fetch, drag-and-drop
- New raster layer from loaded image
- Scale oversized images
- **Verify:** drop image → appears as layer

### Phase 6: Move + Transform
- `MoveTool`: click to select, drag to move
- Transform handles (scale, rotate) via `OverlayRenderer`
- `TransformPanel` (X/Y/W/H/R) bidirectional binding
- Aspect ratio lock
- **Verify:** select, move, resize, rotate layers

### Phase 7: Undo/Redo
- `History` with command stack
- Ctrl+Z / Ctrl+Shift+Z
- All Commands from phases 4–6 wired in
- **Verify:** undo/redo all operations

### Phase 8: WebGL Effects Pipeline ← core differentiator — COMPLETE
- `EffectRenderer`: WebGL 2 context, shader compilation + caching, ping-pong framebuffers
- `Effect` interface with typed `EffectParam` system (float/int/color/boolean/select)
- `EffectRegistry` singleton for registering available effect definitions
- `EffectStack` utilities: cache key generation, deep clone for undo snapshots, per-layer cache eviction
- `PassConfig` with `bindOriginal` flag for multi-texture composite passes (e.g. bloom)
- `UNPACK_FLIP_Y_WEBGL` for correct texture orientation
- Compositor integration: layers with enabled effects → WebGL processing → cached canvas → Canvas 2D compositing
- **Verified:** shader pipeline processes layers, cache prevents redundant re-renders

### Phase 9: Effects Panel UI — COMPLETE
- `EffectsPanel`: shows effect stack for active layer in right sidebar
- Add effect dropdown populated from `EffectRegistry`
- Remove, reorder (up/down buttons), toggle enable/disable per effect
- Auto-generated parameter controls from `EffectParam` definitions:
  - Float/int: range slider + number input (bidirectional)
  - Color: native color picker with RGB float conversion
  - Boolean: checkbox
  - Select: dropdown
- Full undo/redo via snapshot-based history (effects cloned in snapshots)
- Live preview as params change — each slider drag triggers re-render
- **Verified:** add effect → tweak params → see result update on canvas in real time

### Phase 10: First Effects Batch — COMPLETE
- **Gaussian Blur** — separable 2-pass (H + V), `sigma` param, GLSL loop with dynamic kernel radius
- **Bloom** — 4-pass pipeline: (1) extract bright areas via luminance threshold, (2) H-blur, (3) V-blur, (4) composite blurred highlights onto original via `bindOriginal`/`u_original` sampler. Params: threshold, radius, strength
- **Vignette** — radial darkening from center. Uses `1.0 - smoothstep(radius - softness, radius, dist)` for correct edge ordering. Params: centerX, centerY, radius, softness, color
- **Color Grading** — brightness, contrast, saturation (luma-preserving), hue shift (HSV), lift/gamma/gain color correction. Single-pass shader
- **Verified:** each effect works independently and stacked (e.g. Bloom → Color Grading → Blur)

### Phase 11: Advanced Effects
- **Halation** — like bloom but with warm color shift, affects specific luminance ranges
- **Iridescence** — thin-film interference based on view angle / surface normal approximation
- **Chromatic Aberration** — per-channel offset (radial or linear)
- **Grain/Noise** — animated film grain, intensity + size params
- **Verify:** effects stack and interact correctly

### Phase 12: Text + Export + Polish
- `TextTool`, text layers with font/size/color/alignment
- `Exporter` (PNG/JPEG with quality)
- Keyboard shortcuts, dropdown menus, tool cursors
- Copy/paste support (clipboard API)
- **Verify:** full workflow: import → layers → effects → export

## Key Design Decisions

**Non-destructive effects:** Each layer stores source pixels unchanged. The effect stack is metadata. `EffectRenderer` processes source → output on demand. Changing a param just re-runs shaders — original data is never touched.

**WebGL ping-pong for multi-pass:** Two framebuffers alternate as input/output. Bloom needs 3+ passes (threshold extract → H-blur → V-blur → composite). The ping-pong pattern handles arbitrary pass counts cleanly. A dedicated third texture (`effectOriginalTexture`) snapshots the effect's input before multi-pass processing begins — this is necessary because intermediate passes overwrite the ping-pong textures, so any pass that needs the pre-effect image (via `bindOriginal`/`u_original`) must read from this stable snapshot instead.

**Effect caching:** Each layer caches its processed (post-effects) canvas. Invalidated when: source pixels change, effect params change, effects added/removed/reordered. If nothing changed, Compositor reuses the cached result. This makes viewport changes (zoom/pan) instant.

**Modular effects:** Adding a new effect = one file that exports an `Effect` object with shader + params. Register it in `EffectRegistry`. The UI auto-generates controls from param definitions. Zero changes to the pipeline code.

**Canvas 2D for compositing, WebGL for effects:** Blend modes work natively in Canvas 2D (`globalCompositeOperation`). Effects need GPU. By splitting these concerns, we avoid running the entire app in WebGL (which would complicate text rendering, DOM interaction, etc.).

## Architectural Insights

### Layer Content Model (Discriminated Union)

The `Layer` class uses a **required** `content: LayerContent` property instead of a nullable `image` field. `LayerContent` is a discriminated union keyed on `type`:

```typescript
type LayerContent = ImageContent;  // extend with | TextContent | ShapeContent etc.

interface ImageContent {
  type: 'image';
  source: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  name: string;
}
```

**Why required, not nullable:** Every layer must have content at construction time. This eliminates the concept of "empty layers" which served no purpose — they couldn't render, confused users, and required null checks throughout the pipeline. The "Add Layer" button was replaced with "Add Image" which opens a file picker, enforcing that layers always have substance.

**Why discriminated union:** When text, shape, or video layers are added, they become new variants of `LayerContent`. The Compositor's `drawContent()` method uses a `switch (content.type)` dispatch, so adding a new content type is:
1. Define the new `*Content` interface with `type` discriminant
2. Add it to the `LayerContent` union
3. Add a `case` in `drawContent()`
4. TypeScript exhaustiveness checking catches any missed cases

**Natural vs display dimensions:** `ImageContent` stores `naturalWidth`/`naturalHeight` (the source image's intrinsic size), separate from `layer.width`/`layer.height` (the display bounds on canvas). This distinction matters for quality — knowing the natural size lets future features like "reset to original size" or DPI-aware export work correctly.

### Rendering Pipeline Architecture

The rendering pipeline separates **compositing** from **content drawing**:

```
Document.layers (bottom → top)
  → Compositor.draw()        — iterates layers, sets globalAlpha/blendMode
    → drawContent(layer)     — switches on content.type, draws to canvas
  → Renderer.render()        — calls Compositor, then draws selection UI overlay
```

The Compositor owns per-layer rendering logic. The Renderer owns the full frame (composite + overlays). This split means the future WebGL `EffectRenderer` slots in cleanly:

```
Layer.content → EffectRenderer (WebGL, per-layer) → processed texture
  → Compositor draws processed texture with blend mode
```

### Snapshot-Based Undo/Redo

The undo system captures full `DocumentSnapshot` objects (all layers, positions, content references) before and after each change. Snapshots are compared with `snapshotsEqual()` to avoid pushing no-op entries.

**Trade-off:** This is simple and correct but stores O(layers) data per history entry. Content objects (e.g. `ImageContent.source`) are shared by reference — only the lightweight metadata is copied. For the expected document sizes (tens of layers, not thousands), this is efficient enough. If memory becomes a concern, the architecture supports switching to a command-based approach without changing the public API.

### Single-Event Refresh Model

The `EventBus` emits a single `rerender` event that triggers a full `refreshUI()` cycle: layer panel DOM rebuild, viewport layout, canvas redraw, ruler update, and control sync. This is intentionally coarse-grained:

- **Pro:** Impossible to have stale UI — every state change refreshes everything
- **Con:** Redundant work on targeted changes (e.g. toggling visibility redraws rulers)
- **Acceptable because:** Canvas 2D compositing for <50 layers is sub-millisecond, DOM updates are lightweight with current panel complexity
- **Exception:** Effect param updates skip the effects panel rebuild (`skipEffectsPanelRender` flag) to avoid destroying the slider/input being dragged. History commits are debounced (300ms) so continuous slider drags produce one undo entry.

If performance becomes an issue, the fix is targeted: add fine-grained events (`layer-changed`, `viewport-changed`) and have each UI component subscribe only to what it needs. The EventBus already supports this — it's a design knob, not a rewrite.

### UI Without a Framework

All UI is vanilla DOM generated by `App.template()` and wired by `bindControls()`. The `LayersPanel` is the only extracted component (callback-based, not event-based). This keeps the bundle tiny (~8KB gzipped) but means:

- DOM updates are imperative (manual `innerHTML` / element creation)
- No virtual DOM diffing — panels are fully rebuilt on each render
- State flows one-way: Model → UI (no two-way binding)

This works well at current complexity. If the effects panel (Phase 9) introduces many interactive controls, extracting more panel components with the same callback pattern used by `LayersPanel` keeps things manageable without introducing a framework.

### Layer Effects System (Phases 8–10)

Each `Layer` has an `effects: LayerEffect[]` array. A `LayerEffect` references an `EffectDefinition` by ID and stores per-instance parameter values. The `EffectsPanel` auto-generates UI controls from `EffectParam` type definitions (with NaN guards on number inputs falling back to the current slider value). The `EffectRenderer` processes effects through a WebGL 2 ping-pong pipeline with three textures: two for ping-pong alternation, plus a dedicated `effectOriginalTexture` that snapshots the effect's input before multi-pass processing (preventing intermediate passes from overwriting data needed by composite passes). Per-layer caching is bounded to one cached canvas per layer, evicted on param change. The `Compositor` checks each layer for enabled effects and routes through WebGL processing before Canvas 2D compositing. Multi-texture support via `PassConfig.bindOriginal` enables effects like bloom that need to reference the pre-effect image via `u_original` sampler in a composite pass. Snapshot-based undo/redo deep-clones effect params to capture/restore effect state.

## Verification
Each phase: `npx vite dev` + visual check + Playwright screenshot. Unit tests (`vitest`) for model/math. The key end-to-end test: import image → add bloom effect → adjust intensity → change blend mode → export PNG → verify output.

---

# Appendix: Image Effects Mathematical Specification

## 1) Scope

This document specifies a deterministic image-effect pipeline in mathematical terms so it can be implemented in any language.

The pipeline has two parts:

1. Single-image effect rendering (`apply_photo_effect`).
2. Multi-layer compositing (`composite_layer_images` + blend modes).

All operations are defined on normalized float RGB unless stated otherwise.

## 2) Data Model And Notation

Let an image be a tensor:

- \(I \in [0,1]^{H \times W \times 3}\), with channels \(R,G,B\).

Helper operators:

- `clip(x, a, b) = min(max(x, a), b)`.
- `mix(a,b,t) = a(1-t) + bt`, where \(t \in [0,1]\).
- Channel-wise operations are pointwise unless otherwise noted.

Luma is Rec.709:

\[
Y = 0.2126R + 0.7152G + 0.0722B
\]

## 3) Input Normalization

Before effects:

1. Apply EXIF orientation correction.
2. Convert to sRGB color space.
3. If alpha exists, composite over opaque white.
4. Convert to RGB float in \([0,1]\).

If `resize_enabled = true` and `resize_max > 0`, resize so the long edge is at most `resize_max` (high-quality Lanczos or equivalent).

## 4) Pipeline Order (Normative)

Given normalized input \(I_0\), produce \(I_{out}\) by applying enabled stages in this exact order:

1. Softness diffusion.
2. Glow block (bloom, halation, haze), if enabled.
3. Color FX block (prism split, reactive iridescence), if enabled.
4. Tone block, if enabled.
5. Texture/grain block, if enabled.

Formally:

\[
I_{out} = T \circ C \circ G \circ S (I_0)
\]

where any disabled stage is identity.

## 5) Softness Diffusion

Parameters: `soft_blur_radius`, `soft_mix`.

1. \(B = \text{GaussianBlur}(I, \text{soft\_blur\_radius})\).
2. \(I \leftarrow \text{mix}(I, B, \text{clip}(\text{soft\_mix},0,1))\).

## 6) Shared Highlight Mask

Used by glow/color blocks:

\[
Y = \text{luma}(I)
\]
\[
M_b = \text{clip}\left(\frac{Y-\tau_b}{\max(10^{-5},1-\tau_b)},0,1\right)
\]

where \(\tau_b =\) `bloom_threshold`.

## 7) Glow Block

### 7.1 Bloom

Parameters: `bloom_radius`, `bloom_strength`.

\[
B_s = I \odot M_b
\]
\[
B = \text{GaussianBlur}(B_s,\text{bloom\_radius})
\]
\[
I \leftarrow \text{clip}(I + \text{bloom\_strength}\cdot B,0,1)
\]

(\(\odot\) means broadcasting mask to RGB.)

### 7.2 Halation

Parameters: `halation_threshold`, `halation_radius`, `halation_strength`.

\[
M_h = \text{clip}\left(\frac{Y-\tau_h}{\max(10^{-5},1-\tau_h)},0,1\right)
\]
\[
H_s = \text{GaussianBlur}(I \odot M_h,\text{halation\_radius})
\]
Warm tint constant:
\[
c_h = (1.0,\ 0.58,\ 0.32)
\]
\[
I \leftarrow \text{clip}(I + \text{halation\_strength}\cdot (H_s \odot c_h),0,1)
\]

### 7.3 Haze

Parameters: `haze_strength`, `haze_radius`.

If both parameters are \(>0\):

\[
H = \text{GaussianBlur}(I,\text{haze\_radius})
\]
\[
S(I,H)=1-(1-I)(1-H)\ \ \text{(screen blend)}
\]
\[
I \leftarrow \text{mix}(I,S(I,H),\text{haze\_strength})
\]

## 8) Color FX Block

### 8.1 Prism RGB Split

Parameters: `prism_shift`, `prism_mix`.

If `prism_shift > 0` and `prism_mix > 0`:

1. Shift red by \((+\Delta,+\Delta)\), blue by \((-\Delta,-\Delta)\), green unchanged; \(\Delta=\) `prism_shift`.
2. Use edge-clamp indexing at borders.
3. Build \(P=(R_\Delta,\ G,\ B_{-\Delta})\).
4. Weight:
\[
w_p = 0.2 + 0.8M_b
\]
\[
I \leftarrow \text{clip}\left(I\cdot(1-\text{prism\_mix}\cdot w_p) + P\cdot(\text{prism\_mix}\cdot w_p),0,1\right)
\]

### 8.2 Reactive Iridescence

Parameters:

- `reactive_iri_amount`
- `reactive_iri_hue_shift`
- `reactive_iri_edge_bias`
- `reactive_iri_sat_boost`
- `reactive_iri_softness`
- `reactive_iri_luma_center`
- `reactive_iri_luma_range`
- `grain_seed` (for dither source)

If `reactive_iri_amount <= 0`, stage is identity.

#### 8.2.1 Edge Activity

Let \(Y\) be luma.

\[
g_x = |\partial_x Y|,\ \ g_y = |\partial_y Y|
\]
using one-sided finite differences with edge replication.

\[
E = \sqrt{g_x^2+g_y^2}
\]
\[
E \leftarrow \text{normalize\_map}(E) = \text{clip}(E/P_{98}(E),0,1)
\]
with \(P_{98}\) the 98th percentile; if \(P_{98}\le 10^{-6}\), map is zero.

Then:
\[
E \leftarrow \text{GaussianBlurGray}(E,\ 0.35\cdot \text{reactive\_iri\_softness})
\]

#### 8.2.2 HSV Context

Convert \(I \rightarrow (H,S,V)\) in HSV.
Compute blurred ambient image:

\[
I_a = \text{GaussianBlur}(I,\ \max(1.5,1.6\cdot \text{reactive\_iri\_softness}))
\]

and ambient HSV \((H_a,S_a,V_a)\).

#### 8.2.3 Luma/Saturation Gating

Let:

\[
c=\text{reactive\_iri\_luma\_center},\ \ r=\max(0.05,\text{reactive\_iri\_luma\_range})
\]
\[
G_{mid}=\text{clip}(1-|Y-c|/r,0,1)
\]
\[
G_{hi}=\text{clip}((Y-0.42)/0.35,0,1)\cdot \text{clip}((0.995-Y)/0.18,0,1)
\]
\[
G_l=\max(G_{mid},0.9G_{hi})
\]
\[
G_w=\text{clip}((0.995-Y)/0.20,0,1)
\]
\[
S_0=\text{clip}(\max(S,0.9S_a),0,1)
\]
\[
G_s=\text{clip}(0.15+1.05S_0,0,1)
\]
\[
N_b=\text{clip}((0.28-S)/0.28,0,1)
\]

Edge-vs-saturation blend:

\[
\beta=\text{clip}(\text{reactive\_iri\_edge\_bias},0,1)
\]
\[
R = \beta E + (1-\beta)G_s
\]
\[
R \leftarrow \text{clip}(R + N_b(0.25+0.45E),0,1)
\]
\[
W=\text{clip}(R\cdot G_l\cdot G_w,0,1)
\]

If softness \(>0\), blur \(W\) by `reactive_iri_softness`.

Effect scalar:

\[
a=\text{clip}(\text{reactive\_iri\_amount},0,1),\ \ E_f = aW
\]

#### 8.2.4 Hue Remap And Dither

Neutral hue mixing:

\[
N_h=\text{clip}((0.24-S)/0.24,0,1)
\]
\[
H_s = (1-N_h)H + N_hH_a \mod 1
\]

Phase:

\[
\phi = (H_s + 0.18Y + 0.22E)\mod 1
\]

Target hue:

\[
H_t = H_s + \text{reactive\_iri\_hue\_shift}
+ 0.14\sin(2\pi(1.8\phi + 0.65E))
+ 0.04\sin(2\pi(4.2\phi + 1.2Y))
\]
\[
H_t \leftarrow H_t \mod 1
\]

Shortest signed hue delta:

\[
\Delta H = ((H_t - H_s + 0.5)\mod 1)-0.5
\]

Deterministic dither map \(D \in [-0.5,0.5)\):

\[
D(x,y)=\text{fract}(\sin(12.9898x + 78.233y + 0.137(\text{grain\_seed}+911))\cdot 43758.5453)-0.5
\]

\[
H' = (H_s + \Delta H\cdot E_f + D(0.0010 + 0.0022E_f))\mod 1
\]

Saturation drive:

\[
Q = 1 - \exp(-\text{clip}(1.1\cdot \text{reactive\_iri\_sat\_boost}\cdot E_f,0,12))
\]
\[
S' = \text{clip}(S_0 + Q(0.18 + 0.68(1-S_0)),0,1)
\]
\[
S' \leftarrow \text{clip}(S' + D(0.012E_f),0,1)
\]
\[
V' = \text{clip}(V(1+0.07E_f)+0.014E_f,0,1)
\]

Reconstruct remapped color \(I_r = HSV^{-1}(H',S',V')\).

Blend mask:

\[
M = \text{clip}(E_f(0.55 + 0.45(1-S)),0,1)
\]
\[
M \leftarrow \text{GaussianBlurGray}(M,\max(0.3,0.22\cdot \text{reactive\_iri\_softness}))
\]
\[
I \leftarrow \text{clip}(I(1-M)+I_rM,0,1)
\]

## 9) Tone Block

Parameters:

- `temperature`, `tint`
- `saturation`, `vibrance`
- `highlight_rolloff`
- `brightness`, `contrast`, `fade`

### 9.1 Channel Gains

\[
t=\text{clip}(\text{temperature},-1,1),\ \ m=\text{clip}(\text{tint},-1,1)
\]

\[
g_R = 1 + 0.18t + 0.05m
\]
\[
g_G = 1 - 0.08|t| - 0.10m
\]
\[
g_B = 1 - 0.18t + 0.05m
\]

\[
I \leftarrow \text{clip}(I \odot (g_R,g_G,g_B),0,1)
\]

### 9.2 Saturation + Vibrance

Convert \(I\to HSV\). Let \(s=\text{clip}(s\cdot \text{saturation},0,1)\).
Let \(v_b=\text{vibrance}-1\).

If \(v_b \ge 0\):

\[
s \leftarrow \text{clip}(s + (1-s)\cdot 0.75v_b,0,1)
\]

Else:

\[
s \leftarrow \text{clip}(s(1+0.65v_b),0,1)
\]

Reconstruct RGB.

### 9.3 Highlight Rolloff

If `highlight_rolloff > 0`, with pivot \(p=0.72\):

\[
I = \begin{cases}
I, & I \le p \\
p + \frac{I-p}{1+2.4\cdot \text{highlight\_rolloff}}, & I > p
\end{cases}
\]

### 9.4 Global Exposure/Contrast/Fade

\[
I \leftarrow \text{clip}(I\cdot \text{brightness},0,1)
\]
\[
I \leftarrow \text{clip}((I-0.5)\cdot \text{contrast} + 0.5,0,1)
\]
\[
I \leftarrow \text{clip}(I(1-\text{fade}) + 0.08\cdot \text{fade},0,1)
\]

## 10) Texture / Grain Block

If `grain <= 0`, identity.
Let \(a=\max(0,\text{grain})\), \(k=\max(1,\text{grain\_size})\), seed = `grain_seed`.
Use seeded zero-mean Gaussian noise.

### 10.1 Fine Monochrome

\[
N \sim \mathcal{N}(0,a),\ \ N \in \mathbb{R}^{H\times W\times 1}
\]
\[
I \leftarrow \text{clip}(I + N,0,1)
\]

### 10.2 Color Speckle

\[
N \sim \mathcal{N}(0,a),\ \ N \in \mathbb{R}^{H\times W\times 3}
\]
\[
I \leftarrow \text{clip}(I + N,0,1)
\]

### 10.3 Soft Chroma

\[
N \sim \mathcal{N}(0,1.35a),\ \ N \in \mathbb{R}^{H\times W\times 3}
\]
\[
N_b = \text{GaussianBlur}(N,\max(0.4,0.7k))
\]
\[
N_c = N_b - \text{mean}_{ch}(N_b)
\]
\[
I \leftarrow \text{clip}(I + N_c,0,1)
\]

### 10.4 Coarse Film

1. Low-res mono noise:
   \(H_s=\max(1,\text{round}(H/k))\), \(W_s=\max(1,\text{round}(W/k))\).
2. Sample \(B\sim \mathcal{N}(0,1.2a)\) with shape \(H_s\times W_s\times 1\).
3. Nearest-neighbor upsample to \(H\times W\times 1\) by repetition.
4. Replicate to 3 channels and add.

## 11) Layer Compositing

Given ordered rendered layers \((L_i, I_i)\), with `visible`, `opacity` \(\alpha_i\in[0,1]\), and `blend_mode`.
Canvas size is taken from first rendered image; others are resized to that size.

Initialize:

\[
C_0 = 0,\ \ A_0 = 0
\]

For each visible layer with \(\alpha>0\):

1. Compute blend result \(B_i = \text{BlendMode}(C_{i-1}, I_i)\).
2. Alpha update:
\[
A_i = \alpha_i + A_{i-1}(1-\alpha_i)
\]
3. Color update:
\[
N_i = C_{i-1}A_{i-1}(1-\alpha_i) + B_i\alpha_i
\]
\[
C_i = \begin{cases}
N_i/A_i, & A_i>10^{-6} \\
0, & \text{otherwise}
\end{cases}
\]

Final composite over white:

\[
C_{final} = \text{clip}(C_nA_n + (1-A_n),0,1)
\]

## 12) Blend Mode Equations

Let base \(B\), top \(T\), epsilon \(\varepsilon=10^{-6}\). All formulas are channel-wise except luma-based mode selection and HSV component modes.

- Normal: \(T\)
- Darken: \(\min(B,T)\)
- Multiply: \(BT\)
- Color Burn: \(1-\text{clip}((1-B)/(T+\varepsilon),0,1)\), with \(T\le\varepsilon \Rightarrow 0\)
- Linear Burn: \(\text{clip}(B+T-1,0,1)\)
- Darker Color: choose pixel from image with lower luma
- Lighten: \(\max(B,T)\)
- Screen: \(1-(1-B)(1-T)\)
- Color Dodge: \(\text{clip}(B/(1-T+\varepsilon),0,1)\), with \(T\ge1-\varepsilon \Rightarrow 1\)
- Linear Dodge (Add): \(\text{clip}(B+T,0,1)\)
- Lighter Color: choose pixel from image with higher luma
- Overlay: if \(B\le0.5\): \(2BT\), else \(1-2(1-B)(1-T)\)
- Soft Light: \(\text{clip}((1-2T)B^2 + 2TB,0,1)\)
- Hard Light: overlay with roles swapped by threshold on \(T\)
- Vivid Light: burn for \(T\le0.5\), dodge for \(T>0.5\) with doubled terms
- Linear Light: \(\text{clip}(B+2T-1,0,1)\)
- Pin Light: if \(T\le0.5\): \(\min(B,2T)\), else \(\max(B,2(T-0.5))\)
- Hard Mix: thresholded Vivid Light (<0.5 => 0 else 1)
- Difference: \(|B-T|\)
- Exclusion: \(B+T-2BT\)
- Subtract: \(\text{clip}(B-T,0,1)\)
- Divide: \(\text{clip}(B/(T+\varepsilon),0,1)\)
- Hue/Saturation/Color/Luminosity: convert both to HSV, then replace:
  - Hue: \(H_T,S_B,V_B\)
  - Saturation: \(H_B,S_T,V_B\)
  - Color: \(H_T,S_T,V_B\)
  - Luminosity: \(H_B,S_B,V_T\)

## 13) Determinism Guidance

To maximize cross-language consistency:

1. Keep all working values in float32 or float64 until final quantization.
2. Apply clipping after each stage exactly as defined.
3. Use deterministic seeded PRNG for grain/noise maps.
4. Use equivalent HSV conversion conventions:
   - hue in \([0,1)\),
   - saturation/value in \([0,1]\),
   - achromatic pixels with hue \(0\).
5. Final output quantization: \(\text{uint8} = \text{clip}(255I,0,255)\).
