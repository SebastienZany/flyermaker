# FlyerMaker — Status Tracker

## Workflow Requirement
- ALWAYS consult `PLAN.md` before making changes and keep `PLAN.md` up to date with the current plan/status.

## Current Phase
**Phase 7: Undo/Redo** — COMPLETE

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
| 8 | WebGL Effects Pipeline | NOT STARTED | |
| 9 | Effects Panel UI | NOT STARTED | |
| 10 | First Effects Batch | NOT STARTED | |
| 11 | Advanced Effects | NOT STARTED | |
| 12 | Text + Export + Polish | NOT STARTED | |

## Files Created

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.ts`, `src/app.ts`
- `src/styles/main.css`
- `src/core/EventBus.ts`
- `src/model/Document.ts`, `src/model/Layer.ts`
- `src/renderer/Renderer.ts`, `src/renderer/Compositor.ts`, `src/renderer/Viewport.ts`, `src/renderer/RulerRenderer.ts`
- `src/ui/LayersPanel.ts`
- `src/effects/EffectStack.ts`

## Open Issues

- URL import currently depends on remote host CORS behavior and network availability.

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


## Browser QA Notes

- Local `npm run test:e2e` currently defaults to Chromium and may fail in restricted environments if Playwright browser binaries cannot be downloaded.
- Verified Phase 7 undo/redo flow in **Firefox** using the browser container Playwright runner (`p.firefox.launch()`), exercising add layer + transform edit + undo/redo keyboard shortcuts.
- Recommended fallback when Chromium install is blocked: run browser-container Playwright scripts against Firefox for functional validation and attach a screenshot artifact.
