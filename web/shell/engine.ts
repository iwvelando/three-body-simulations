// One worker for the whole site. Every simulation talks to the Go engine
// through `ask`; replies to requests that a newer one has superseded are
// the caller's to drop (see useLatest in each simulation).

export class EngineError extends Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message);
  }
}

type Pending = {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
};

const startupLimit = 30_000;

export class Engine {
  private worker: Worker;
  private next = 0;
  private pending = new Map<number, Pending>();
  readonly ready: Promise<void>;

  constructor() {
    this.worker = new Worker(
      new URL("worker.js", new URL(import.meta.env.BASE_URL, location.href)),
    );
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("The simulation engine took too long to start.")),
        startupLimit,
      );
      const fail = (message: string) => {
        clearTimeout(timer);
        const error = new Error(message);
        reject(error);
        for (const task of this.pending.values()) task.reject(error);
        this.pending.clear();
      };
      this.worker.onerror = () =>
        fail("The simulation engine could not start.");
      this.worker.onmessage = ({ data }) => {
        if (data.type === "ready") {
          clearTimeout(timer);
          resolve();
        } else if (data.type === "error") fail(String(data.error));
        else if (data.type === "result") {
          const task = this.pending.get(data.id);
          if (!task) return;
          this.pending.delete(data.id);
          if (data.result && typeof data.result.error === "string")
            task.reject(
              new EngineError(data.result.error, data.result.field ?? ""),
            );
          else task.resolve(data.result);
        }
      };
    });
    // A rejected start is reported by whoever awaits it.
    this.ready.catch(() => {});
  }

  async ask<T>(request: object): Promise<T> {
    await this.ready;
    return new Promise<T>((resolve, reject) => {
      const id = ++this.next;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, request });
    });
  }

  dispose() {
    this.worker.terminate();
    for (const task of this.pending.values())
      task.reject(new Error("The simulation engine was closed."));
    this.pending.clear();
  }
}
