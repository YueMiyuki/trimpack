import { describe, it } from "node:test";
import assert from "node:assert";
import { Semaphore } from "../../src/core/semaphore.js";

describe("Semaphore", () => {
  describe("constructor", () => {
    it("should create a semaphore with specified limit", () => {
      const sem = new Semaphore(5);
      assert.ok(sem instanceof Semaphore);
    });

    it("should handle limit of 1 (mutex)", () => {
      const sem = new Semaphore(1);
      assert.ok(sem instanceof Semaphore);
    });

    it("should handle large limits", () => {
      const sem = new Semaphore(1000);
      assert.ok(sem instanceof Semaphore);
    });
  });

  describe("acquire and release", () => {
    it("should acquire and release successfully within limit", async () => {
      const sem = new Semaphore(2);
      const release1 = await sem.acquire();
      const release2 = await sem.acquire();

      assert.strictEqual(typeof release1, "function");
      assert.strictEqual(typeof release2, "function");

      release1();
      release2();
    });

    it("should block when limit is reached", async () => {
      const sem = new Semaphore(1);
      let secondAcquired = false;

      const release1 = await sem.acquire();

      // Start second acquire (should block)
      const promise = sem.acquire().then((release) => {
        secondAcquired = true;
        return release;
      });

      // Give it time to potentially acquire (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.strictEqual(secondAcquired, false);

      // Release first, second should now acquire
      release1();
      const release2 = await promise;
      assert.strictEqual(secondAcquired, true);
      release2();
    });

    it("should handle multiple concurrent acquisitions", async () => {
      const sem = new Semaphore(3);
      const releases: Array<() => void> = [];

      // Acquire all 3 slots
      for (let i = 0; i < 3; i++) {
        releases.push(await sem.acquire());
      }

      const results: number[] = [];

      // Try to acquire 5 more (should queue)
      const promises = Array.from({ length: 5 }, (_, i) =>
        sem.acquire().then((release) => {
          results.push(i);
          release();
        }),
      );

      // Release in order
      for (const release of releases) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        release();
      }

      await Promise.all(promises);
      assert.strictEqual(results.length, 5);
    });

    it("should maintain FIFO order for queued acquisitions", async () => {
      const sem = new Semaphore(1);
      const order: number[] = [];

      const release1 = await sem.acquire();

      // Queue 3 acquisitions
      const promises = [0, 1, 2].map(async (i) => {
        const release = await sem.acquire();
        order.push(i);
        release();
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      release1();

      await Promise.all(promises);
      assert.deepStrictEqual(order, [0, 1, 2]);
    });

    it("should handle rapid acquire-release cycles", async () => {
      const sem = new Semaphore(5);
      const iterations = 100;
      let completed = 0;

      const tasks = Array.from({ length: iterations }, async () => {
        const release = await sem.acquire();
        completed++;
        release();
      });

      await Promise.all(tasks);
      assert.strictEqual(completed, iterations);
    });

    it("should not double-release", async () => {
      const sem = new Semaphore(1);
      const release = await sem.acquire();

      release();
      // Second release should be safe (no error)
      release();

      // Should be able to acquire again
      const release2 = await sem.acquire();
      assert.strictEqual(typeof release2, "function");
      release2();
    });
  });

  describe("edge cases", () => {
    it("should handle zero limit gracefully", async () => {
      const sem = new Semaphore(0);
      let acquired = false;

      // This should hang indefinitely, so we timeout
      const promise = Promise.race([
        sem.acquire().then(() => {
          acquired = true;
        }),
        new Promise((resolve) => setTimeout(resolve, 50)),
      ]);

      await promise;
      assert.strictEqual(acquired, false);
    });

    it("should handle concurrent releases", async () => {
      const sem = new Semaphore(2);
      const release1 = await sem.acquire();
      const release2 = await sem.acquire();

      // Release concurrently
      await Promise.all([
        Promise.resolve(release1()),
        Promise.resolve(release2()),
      ]);

      // Should be able to acquire again
      const release3 = await sem.acquire();
      assert.ok(release3);
      release3();
    });
  });
});
