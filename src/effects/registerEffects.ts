import { effectRegistry } from './EffectRegistry';
import { gaussianBlur } from './blur';
import { bloom } from './bloom';
import { vignette } from './vignette';
import { colorGrading } from './colorGrading';
import { halation } from './halation';
import { iridescence } from './iridescence';
import { chromaticAberration } from './chromaticAberration';
import { grain } from './grain';

export function registerAllEffects(): void {
  effectRegistry.register(gaussianBlur);
  effectRegistry.register(bloom);
  effectRegistry.register(vignette);
  effectRegistry.register(colorGrading);
  effectRegistry.register(halation);
  effectRegistry.register(iridescence);
  effectRegistry.register(chromaticAberration);
  effectRegistry.register(grain);
}
