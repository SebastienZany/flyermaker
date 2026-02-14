import type { EffectDefinition } from './Effect';

class EffectRegistryImpl {
  private readonly definitions = new Map<string, EffectDefinition>();

  register(definition: EffectDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  get(id: string): EffectDefinition | undefined {
    return this.definitions.get(id);
  }

  getAll(): EffectDefinition[] {
    return [...this.definitions.values()];
  }
}

export const effectRegistry = new EffectRegistryImpl();
