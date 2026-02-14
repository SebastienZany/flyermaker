import { effectRegistry } from './EffectRegistry';
import { gaussianBlur } from './blur';
import { bloom } from './bloom';
import { vignette } from './vignette';
import { colorGrading } from './colorGrading';

export function registerAllEffects(): void {
  effectRegistry.register(gaussianBlur);
  effectRegistry.register(bloom);
  effectRegistry.register(vignette);
  effectRegistry.register(colorGrading);
}
