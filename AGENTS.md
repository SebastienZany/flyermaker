# FlyerMaker — Status Tracker

## Workflow Requirement
- ALWAYS consult `PLAN.md` before making changes and keep `PLAN.md` up to date with the current plan/status.

## Current Phase
**Phase 10: First Effects Batch** — COMPLETE

## Phase Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | Project Setup + Skeleton UI | COMPLETE | Vite + TypeScript + CSS shell + App bootstrap |
| 2 | Core Model + Basic Rendering | COMPLETE | EventBus, DocumentModel, Layer, Compositor, Renderer |
| 3 | Viewport + Rulers | COMPLETE | Zoom/pan, ruler canvases, status readout |
| 4 | Layer System | COMPLETE | Layers panel add/delete/reorder/select |
| 5 | Image Import | COMPLETE | File dialog, URL import, drag-and-drop import |
| 6 | Move + Transform | COMPLETE | Move tool dragging, corner resize handles, Transform panel (X/Y/W/H) |
| 7 | Undo/Redo | COMPLETE | Command history for layer/document edits + keyboard/menu shortcuts |
| 8 | WebGL Effects Pipeline | COMPLETE | EffectRenderer (WebGL 2, ping-pong FBOs, shader cache), Effect/EffectParam type system, EffectRegistry, per-layer effect stack integrated into Compositor |
| 9 | Effects Panel UI | COMPLETE | EffectsPanel with auto-generated param controls (sliders, color pickers, checkboxes, selects), add/remove/reorder/toggle, full undo/redo via snapshot history |
| 10 | First Effects Batch | COMPLETE | Gaussian Blur (separable 2-pass), Bloom (4-pass: extract+H-blur+V-blur+composite with bindOriginal), Vignette (radial darkening), Color Grading (brightness/contrast/saturation/hue/lift/gamma/gain) |
| 11 | Advanced Effects | NOT STARTED | |
| 12 | Text + Export + Polish | NOT STARTED | |

## Files Created

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.ts`, `src/app.ts`
- `src/styles/main.css`
- `src/core/EventBus.ts`
- `src/model/Document.ts`, `src/model/Layer.ts`, `src/model/History.ts`
- `src/renderer/Renderer.ts`, `src/renderer/Compositor.ts`, `src/renderer/Viewport.ts`, `src/renderer/RulerRenderer.ts`
- `src/ui/LayersPanel.ts`, `src/ui/EffectsPanel.ts`
- `src/effects/Effect.ts`, `src/effects/EffectRegistry.ts`, `src/effects/EffectRenderer.ts`, `src/effects/EffectStack.ts`, `src/effects/registerEffects.ts`
- `src/effects/blur.ts`, `src/effects/bloom.ts`, `src/effects/vignette.ts`, `src/effects/colorGrading.ts`

## Open Issues

- URL import currently depends on remote host CORS behavior and network availability.

## Recent Bug Fixes (Post Phase 10)

- **Ping-pong texture overwrite (P1):** Multi-pass effects after other effects (e.g., Color Grading → Bloom) would overwrite the effect's input texture during intermediate passes. Fixed by adding a dedicated third texture (`effectOriginalTexture`) that snapshots the effect's input via blit before multi-pass processing begins. This texture lives outside the ping-pong pair and is stable across all passes.
- **u_original binding:** Was using global source texture instead of per-effect input in composite passes. Fixed to use the snapshot texture so stacked effects compose correctly.
- **Color grading lift default:** Lift parameter defaulted to `[1,1,1]` instead of `[0,0,0]`, causing incorrect identity behavior. Fixed.
- **NaN param input:** Typing non-numeric values in effect parameter number inputs would propagate NaN to WebGL uniforms. Added NaN guard with fallback to current slider value.
- **NaN fallback staleness:** The NaN fallback initially used `param.value` (captured at render time), which goes stale after slider interactions without a full panel re-render. Fixed to use `slider.value` which is always kept in sync.
- **Y-flip:** Source textures were uploaded without `UNPACK_FLIP_Y_WEBGL`, causing vertically flipped effect output. Fixed.
- **Bloom compositing:** Original image was lost through blur passes. Fixed with `bindOriginal`/`u_original` sampler pattern.
- **Vignette smoothstep edge order:** `smoothstep` arguments were in wrong order, producing inverted falloff. Fixed.
- **Effect cache growth:** Cache was unbounded. Fixed with per-layer eviction (one cached canvas per layer).
- **Slider destruction during param updates (P1):** Every slider `oninput` event triggered a full `refreshUI` which rebuilt the effects panel DOM, destroying the active slider mid-drag. Fixed by skipping effects panel rebuild during param updates (`skipEffectsPanelRender` flag) and debouncing history commits (one undo entry per drag session, not per tick).
- **Stale param-history timer vs undo/redo (P1):** The 300ms debounced param commit timer was never cancelled when undo/redo or other document changes ran. If a user tweaked a param then hit Undo within 300ms, the stale timer would fire, pushing an out-of-order history entry and clearing the redo stack. Fixed by adding `flushPendingParamCommit()` called at the start of `undo()`, `redo()`, and `applyDocumentChange()`.
- **Integer shader uniforms sent via uniform1f (P2):** All numeric uniforms were dispatched with `uniform1f`, but WebGL requires `uniform1i` for `int`/`sampler` uniforms. Added `UniformInt` tagged wrapper type and `uniformInt()` helper; `drawPass` now checks for the tag and uses `uniform1i` accordingly.

## Completed Milestones

- Established Vite/TypeScript project skeleton and panel-based UI.
- Implemented model-render loop with canvas compositing.
- Added viewport zoom/pan and ruler drawing.
- Implemented practical layer management controls.
- Implemented image import via file picker, URL, and drag-and-drop.
- Ran high-fidelity visual pass to align app shell with `mockup/v2-refined.png`.
- Simplified UI to functional controls only; removed non-functional mock elements while preserving phase-5 behavior.
- Restored mockup-like chrome (menu/options/toolbar/rulers/status) with only functional controls.
- Implemented move + transform interactions (drag/resize + transform panel).
- Corrected ruler rendering and zoom behavior with functional Playwright interaction checks.
- Added visible build tags to app chrome/status and documented the build-tag requirement in `PLAN.md`.
- Added document-size controls, aligned rulers/checkerboard to the document frame, changed zoom to 100% start with ±5% steps, and introduced Playwright E2E coverage for viewport/ruler behavior.
- Added an Ableton-style Info View in the lower-right chrome with hover help text for tools and key controls.
- Refined Info View styling and placement for a cleaner Ableton-like lower-right appearance while preserving hover-help behavior.
- Replaced the lower-right Info View panel with status-bar hover help (falling back to selected-tool guidance when nothing is hovered).
- Simplified the status bar to only the contextual help text, removing all other status readouts.
- Reworked top chrome: removed top-right status noise, converted menu labels into real dropdown menus, renamed toolbar buttons with clear labels, made Fit perform true viewport fit, and added Auto-Select hover help text.


- Restored a visible build tag in the menubar chrome and fixed zoom-center math edge cases for wheel zoom near viewport edges.

- Implemented undo/redo history for layer/document edits with Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z shortcuts, plus Edit menu and options-bar controls.

- Implemented WebGL 2 effects pipeline (Phase 8): EffectRenderer with shader compilation, ping-pong framebuffers, source texture upload with UNPACK_FLIP_Y_WEBGL, per-layer effect caching with bounded eviction, and PassConfig with bindOriginal support for multi-texture composite passes.
- Built EffectsPanel UI (Phase 9): auto-generated parameter controls from EffectParam definitions, add/remove/reorder/toggle effects, live preview on parameter change, full undo/redo via snapshot-based history with effect cloning.
- Shipped first effects batch (Phase 10): Gaussian Blur (separable 2-pass H+V), Bloom (4-pass: bright extraction → H-blur → V-blur → composite onto original via u_original sampler), Vignette (radial darkening with center/radius/softness/color), Color Grading (brightness/contrast/saturation/hue shift/lift/gamma/gain).

## Browser QA Notes

- Local `npm run test:e2e` currently defaults to Chromium and may fail in restricted environments if Playwright browser binaries cannot be downloaded.
- Verified Phase 7 undo/redo flow in **Firefox** using the browser container Playwright runner (`p.firefox.launch()`), exercising add layer + transform edit + undo/redo keyboard shortcuts.
- Recommended fallback when Chromium install is blocked: run browser-container Playwright scripts against Firefox for functional validation and attach a screenshot artifact.
