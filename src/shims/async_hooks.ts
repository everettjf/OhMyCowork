export class AsyncLocalStorage<T = unknown> {
  disable() {
    return undefined;
  }

  getStore(): T | undefined {
    return undefined;
  }

  run<R>(_store: T, callback: (...args: unknown[]) => R, ...args: unknown[]) {
    return callback(...args);
  }

  enterWith(_store: T) {
    return undefined;
  }
}
