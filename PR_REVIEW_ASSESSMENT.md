# Assessment of Competing PRs #9, #10, #11 (Layer Effects System)

All three PRs implement the same feature — a visual effects pipeline for layers
(Phases 8–10). They differ in scope, architecture, and quality.

## PR #9: "Add WebGL effects pipeline, Effects panel UI, and wire effects into undo/redo"

- **Scope:** 5 color-adjustment effects (exposure, brightness, contrast, saturation, hue)
- **Size:** ~415 additions across 8 files — smallest and most focused
- **Architecture:** Single `WebGLEffectsPipeline.ts` with 2D fallback; effects defined inline in `EffectStack`
- **Bugs found:** 1 P1 — Y-axis inversion (WebGL texture upload doesn't compensate for flipped coordinate origin, so all effected layers render upside-down)
- **Verdict:** Narrowest feature set (color adjustments only, no blur/bloom/vignette). The Y-flip bug is a straightforward fix. Clean integration with undo/redo. However, the flat architecture would need refactoring to support additional effect types later.

## PR #10: "Implement phases 8-10 with WebGL effects pipeline and stack UI"

- **Scope:** 4 effects (gaussian blur, bloom, vignette, color grading) with full parameter UI
- **Size:** Larger than #9, with typed registry, WebGL2 ping-pong framebuffers
- **Architecture:** `EffectRegistry` + `EffectRenderer` with per-effect type definitions
- **Bugs found:** 2 P1s — (1) Shared canvas reuse (renderer returns a single mutable canvas, so multi-layer renders overwrite each other) and (2) Bloom compositing data loss (blur pass destroys the original texture needed for bloom blending)
- **Verdict:** Better extensibility than #9, but has two serious bugs. The shared-canvas bug causes visually corrupt output for any multi-layer document with effects. The bloom bug means one of its four effects doesn't work correctly.

## PR #11: "Add layer effects system with GPU-accelerated rendering"

- **Scope:** Same 4 effects as #10 (blur, bloom, vignette, color grading)
- **Size:** Largest — ~15 files, highly modular with each effect in its own file
- **Architecture:** Most modular: `Effect.ts` interface, `EffectRegistry`, individual effect files (`blur.ts`, `bloom.ts`, `vignette.ts`, `colorGrading.ts`), `EffectRenderer` with ping-pong FBOs, cache invalidation, `EffectStack` utilities
- **Bugs found:** None flagged by reviewers
- **Verdict:** Best separation of concerns. Each effect is self-contained with its own shader and parameter schema. The registry pattern makes adding new effects trivial. Result caching with invalidation is a meaningful performance optimization.

## Recommendation: Merge PR #11

Close PRs #9 and #10. Reasons:

1. **No known bugs.** PR #9 has a Y-flip bug and PR #10 has two P1 bugs (shared canvas corruption and broken bloom). PR #11 had no bugs flagged.

2. **Best architecture.** PR #11's modular per-effect file structure with a registry pattern is the most maintainable and extensible. Adding a new effect means adding one file and registering it.

3. **Richer feature set than #9.** PR #11 includes blur, bloom, vignette, and color grading (which subsumes #9's brightness/contrast/saturation/hue). PR #9's exposure effect could be added to #11's registry later with minimal effort.

4. **Performance optimization.** PR #11 includes result caching with invalidation, avoiding redundant GPU work when effect stacks haven't changed.

### Caveat

Do a thorough manual test of PR #11's rendering pipeline before merging — specifically test multi-layer documents with effects, and verify the bloom compositing path (since PR #10 had a bug with the same architectural pattern).
