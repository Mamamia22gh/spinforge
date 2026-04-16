/**
 * Pub/sub event bus with re-entrant safety.
 */
export class EventBus {
  #listeners = new Map();
  #queue = [];
  #dispatching = false;

  on(event, fn) {
    if (typeof fn !== 'function') throw new TypeError('Listener must be a function');
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, once: false });
    return () => this.off(event, fn);
  }

  once(event, fn) {
    if (typeof fn !== 'function') throw new TypeError('Listener must be a function');
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, once: true });
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const entries = this.#listeners.get(event);
    if (!entries) return;
    const idx = entries.findIndex(e => e.fn === fn);
    if (idx !== -1) entries.splice(idx, 1);
    if (entries.length === 0) this.#listeners.delete(event);
  }

  emit(event, ...args) {
    if (this.#dispatching) {
      this.#queue.push({ event, args });
      return;
    }
    this.#dispatching = true;
    try {
      this.#dispatch(event, args);
      while (this.#queue.length > 0) {
        const { event: e, args: a } = this.#queue.shift();
        this.#dispatch(e, a);
      }
    } finally {
      this.#dispatching = false;
    }
  }

  removeAll(event) {
    event ? this.#listeners.delete(event) : this.#listeners.clear();
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.length ?? 0;
  }

  #dispatch(event, args) {
    const entries = this.#listeners.get(event);
    if (!entries) return;
    for (const entry of [...entries]) {
      entry.fn(...args);
      if (entry.once) this.off(event, entry.fn);
    }
  }
}
