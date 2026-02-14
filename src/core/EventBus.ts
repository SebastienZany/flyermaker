export class EventBus<TEvents extends object> {
  private listeners = new Map<keyof TEvents, Set<(payload: any) => void>>();

  on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): () => void {
    const current = this.listeners.get(event) ?? new Set();
    current.add(listener as (payload: any) => void);
    this.listeners.set(event, current);
    return () => this.off(event, listener);
  }

  off<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void {
    const current = this.listeners.get(event);
    if (!current) return;
    current.delete(listener as (payload: any) => void);
    if (!current.size) this.listeners.delete(event);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
