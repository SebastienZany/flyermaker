import type { Layer, LayerEffect } from '../model/Layer';

export interface EffectsPanelCallbacks {
  onToggleEnabled: (effectId: string, enabled: boolean) => void;
  onChangeValue: (effectId: string, value: number) => void;
  onResetEffect: (effectId: string) => void;
}

export class EffectsPanel {
  constructor(private readonly root: HTMLElement, private readonly callbacks: EffectsPanelCallbacks) {}

  render(layer: Layer | null): void {
    this.root.innerHTML = '';
    if (!layer) {
      this.root.innerHTML = '<div class="effects-empty">Select a layer to edit effects.</div>';
      return;
    }

    layer.effects.forEach((effect) => {
      this.root.append(this.renderEffect(effect));
    });
  }

  private renderEffect(effect: LayerEffect): HTMLElement {
    const row = document.createElement('div');
    row.className = 'effect-row';

    const header = document.createElement('div');
    header.className = 'effect-header';

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = effect.enabled;
    enabled.onchange = () => this.callbacks.onToggleEnabled(effect.id, enabled.checked);

    const name = document.createElement('span');
    name.className = 'effect-name';
    name.textContent = effect.name;

    const value = document.createElement('span');
    value.className = 'effect-value';
    value.textContent = this.formatValue(effect);

    const reset = document.createElement('button');
    reset.className = 'opt-btn effect-reset';
    reset.textContent = 'Reset';
    reset.onclick = () => this.callbacks.onResetEffect(effect.id);

    header.append(enabled, name, value, reset);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = `${effect.min}`;
    slider.max = `${effect.max}`;
    slider.step = `${effect.step}`;
    slider.value = `${effect.value}`;
    slider.disabled = !effect.enabled;
    slider.className = 'effect-slider';
    slider.oninput = () => {
      const next = Number(slider.value);
      value.textContent = this.formatValue({ ...effect, value: next });
      this.callbacks.onChangeValue(effect.id, next);
    };

    row.append(header, slider);
    return row;
  }

  private formatValue(effect: LayerEffect): string {
    if (effect.type === 'hue') return `${Math.round(effect.value)}°`;
    return `${effect.value.toFixed(2)}`;
  }
}
