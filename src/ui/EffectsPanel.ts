import type { LayerEffect, EffectParam } from '../effects/Effect';
import { effectRegistry } from '../effects/EffectRegistry';
import { createLayerEffect } from '../effects/Effect';

export interface EffectsPanelCallbacks {
  onAddEffect: (effect: LayerEffect) => void;
  onRemoveEffect: (index: number) => void;
  onToggleEffect: (index: number) => void;
  onUpdateParam: (index: number, paramKey: string, value: EffectParam['value']) => void;
  onMoveEffect: (fromIndex: number, toIndex: number) => void;
}

export class EffectsPanel {
  constructor(private readonly root: HTMLElement, private readonly callbacks: EffectsPanelCallbacks) {}

  render(effects: LayerEffect[], hasActiveLayer: boolean): void {
    this.root.innerHTML = '';

    if (!hasActiveLayer) {
      const empty = document.createElement('div');
      empty.className = 'effects-empty';
      empty.textContent = 'Select a layer to add effects';
      this.root.append(empty);
      return;
    }

    const addRow = document.createElement('div');
    addRow.className = 'effects-add-row';

    const select = document.createElement('select');
    select.className = 'opt-select effects-add-select';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '+ Add Effect...';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    select.append(defaultOpt);

    for (const def of effectRegistry.getAll()) {
      const opt = document.createElement('option');
      opt.value = def.id;
      opt.textContent = def.name;
      select.append(opt);
    }

    select.onchange = () => {
      const id = select.value;
      const def = effectRegistry.get(id);
      if (!def) return;
      this.callbacks.onAddEffect(createLayerEffect(def));
      select.selectedIndex = 0;
    };

    addRow.append(select);
    this.root.append(addRow);

    effects.forEach((effect, index) => {
      const def = effectRegistry.get(effect.definitionId);
      const card = document.createElement('div');
      card.className = `effect-card ${effect.enabled ? '' : 'effect-disabled'}`;

      const header = document.createElement('div');
      header.className = 'effect-header';

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = effect.enabled;
      toggle.className = 'effect-toggle';
      toggle.onchange = (e) => {
        e.stopPropagation();
        this.callbacks.onToggleEffect(index);
      };

      const title = document.createElement('span');
      title.className = 'effect-title';
      title.textContent = def?.name ?? effect.definitionId;

      const actions = document.createElement('div');
      actions.className = 'effect-actions';

      if (index > 0) {
        const upBtn = document.createElement('button');
        upBtn.className = 'effect-action-btn';
        upBtn.textContent = '\u25B2';
        upBtn.title = 'Move up';
        upBtn.onclick = (e) => { e.stopPropagation(); this.callbacks.onMoveEffect(index, index - 1); };
        actions.append(upBtn);
      }
      if (index < effects.length - 1) {
        const downBtn = document.createElement('button');
        downBtn.className = 'effect-action-btn';
        downBtn.textContent = '\u25BC';
        downBtn.title = 'Move down';
        downBtn.onclick = (e) => { e.stopPropagation(); this.callbacks.onMoveEffect(index, index + 1); };
        actions.append(downBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'effect-action-btn effect-remove-btn';
      removeBtn.textContent = '\u2715';
      removeBtn.title = 'Remove effect';
      removeBtn.onclick = (e) => { e.stopPropagation(); this.callbacks.onRemoveEffect(index); };
      actions.append(removeBtn);

      header.append(toggle, title, actions);
      card.append(header);

      const paramsContainer = document.createElement('div');
      paramsContainer.className = 'effect-params';

      for (const [key, param] of Object.entries(effect.params)) {
        const control = this.createParamControl(index, key, param);
        paramsContainer.append(control);
      }

      card.append(paramsContainer);
      this.root.append(card);
    });
  }

  private createParamControl(effectIndex: number, key: string, param: EffectParam): HTMLElement {
    const row = document.createElement('div');
    row.className = 'effect-param-row';

    const label = document.createElement('label');
    label.className = 'effect-param-label';
    label.textContent = param.label;

    switch (param.type) {
      case 'float':
      case 'int': {
        const wrapper = document.createElement('div');
        wrapper.className = 'effect-param-slider-wrap';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'effect-param-slider';
        slider.min = `${param.min}`;
        slider.max = `${param.max}`;
        slider.step = `${param.step}`;
        slider.value = `${param.value}`;

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.className = 'effect-param-number';
        numInput.min = `${param.min}`;
        numInput.max = `${param.max}`;
        numInput.step = `${param.step}`;
        numInput.value = `${param.value}`;

        slider.oninput = () => {
          const v = param.type === 'int' ? parseInt(slider.value, 10) : parseFloat(slider.value);
          numInput.value = `${v}`;
          this.callbacks.onUpdateParam(effectIndex, key, v);
        };

        numInput.onchange = () => {
          const raw = param.type === 'int' ? parseInt(numInput.value, 10) : parseFloat(numInput.value);
          if (Number.isNaN(raw)) {
            numInput.value = `${param.value}`;
            slider.value = `${param.value}`;
            return;
          }
          const clamped = Math.min(param.max, Math.max(param.min, raw));
          slider.value = `${clamped}`;
          numInput.value = `${clamped}`;
          this.callbacks.onUpdateParam(effectIndex, key, clamped);
        };

        wrapper.append(slider, numInput);
        row.append(label, wrapper);
        break;
      }
      case 'color': {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'effect-param-color';
        colorInput.value = rgbToHex(param.value);

        colorInput.oninput = () => {
          const rgb = hexToRgb(colorInput.value);
          this.callbacks.onUpdateParam(effectIndex, key, rgb);
        };

        row.append(label, colorInput);
        break;
      }
      case 'boolean': {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'effect-param-checkbox';
        checkbox.checked = param.value;

        checkbox.onchange = () => {
          this.callbacks.onUpdateParam(effectIndex, key, checkbox.checked);
        };

        row.append(label, checkbox);
        break;
      }
      case 'select': {
        const sel = document.createElement('select');
        sel.className = 'opt-select effect-param-select';
        for (const opt of param.options) {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          sel.append(option);
        }
        sel.value = param.value;

        sel.onchange = () => {
          this.callbacks.onUpdateParam(effectIndex, key, sel.value);
        };

        row.append(label, sel);
        break;
      }
    }

    return row;
  }
}

function rgbToHex(rgb: [number, number, number]): string {
  const r = Math.round(rgb[0] * 255).toString(16).padStart(2, '0');
  const g = Math.round(rgb[1] * 255).toString(16).padStart(2, '0');
  const b = Math.round(rgb[2] * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}
