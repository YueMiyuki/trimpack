export class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly limit: number) {
    // Enforce a minimum limit of 1
    if (limit < 1) {
      throw new Error("Semaphore limit must be at least 1");
    }
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    if (this.active > 0) this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}
