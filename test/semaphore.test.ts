import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Semaphore } from "../src/core/semaphore.js";

describe("Semaphore", () => {
  describe("constructor", () => {
    it("should create a semaphore with the specified limit", () => {
      const sem = new Semaphore(5);
      assert.ok(sem instanceof Semaphore);
    });

    it("should accept zero as limit", () => {
      const sem = new Semaphore(0);
      assert.ok(sem instanceof Semaphore);
    });

    it("should accept large limits", () => {
      const sem = new Semaphore(10000);
      assert.ok(sem instanceof Semaphore);
    });
  });

  describe("acquire/release", () => {
    it("should allow immediate acquisition when under limit", async () => {
      const sem = new Semaphore(2);
      const release1 = await sem.acquire();
      assert.ok(typeof release1 === "function");
      release1();
    });

    it("should queue requests when limit is reached", async () => {
      const sem = new Semaphore(1);
      const release1 = await sem.acquire();
      
      let acquired2 = false;
      const promise2 = sem.acquire().then((release) => {
        acquired2 = true;
        return release;
      });
      
      // Should not acquire immediately
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(acquired2, false);
      
      // Release first, then second should acquire
      release1();
      const release2 = await promise2;
      assert.equal(acquired2, true);
      release2();
    });

    it("should handle multiple concurrent acquisitions", async () => {
      const sem = new Semaphore(3);
      const releases = await Promise.all([
        sem.acquire(),
        sem.acquire(),
        sem.acquire(),
      ]);
      
      assert.equal(releases.length, 3);
      releases.forEach(release => release());
    });

    it("should respect FIFO order for queued requests", async () => {
      const sem = new Semaphore(1);
      const order: number[] = [];
      
      const release1 = await sem.acquire();
      
      const p2 = sem.acquire().then((release) => {
        order.push(2);
        return release;
      });
      const p3 = sem.acquire().then((release) => {
        order.push(3);
        return release;
      });
      const p4 = sem.acquire().then((release) => {
        order.push(4);
        return release;
      });
      
      release1();
      const [r2, r3, r4] = await Promise.all([p2, p3, p4]);
      
      assert.deepEqual(order, [2, 3, 4]);
      r2();
      r3();
      r4();
    });

    it("should handle rapid acquire/release cycles", async () => {
      const sem = new Semaphore(2);
      const results: number[] = [];
      
      const tasks = Array.from({ length: 10 }, (_, i) =>
        sem.acquire().then(async (release) => {
          results.push(i);
          await new Promise(resolve => setTimeout(resolve, 1));
          release();
        })
      );
      
      await Promise.all(tasks);
      assert.equal(results.length, 10);
    });

    it("should allow releases to be called multiple times safely", async () => {
      const sem = new Semaphore(1);
      const release = await sem.acquire();
      
      // First release
      release();
      
      // Second release should not cause issues
      release();
      
      // Should still work after double release
      const release2 = await sem.acquire();
      release2();
    });
  });

  describe("concurrency limiting", () => {
    it("should limit concurrent operations to specified limit", async () => {
      const sem = new Semaphore(2);
      let concurrent = 0;
      let maxConcurrent = 0;
      
      const task = async () => {
        const release = await sem.acquire();
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrent--;
        release();
      };
      
      await Promise.all([task(), task(), task(), task(), task()]);
      assert.equal(maxConcurrent, 2);
    });

    it("should handle zero limit (all operations queue)", async () => {
      const sem = new Semaphore(0);
      let acquired = false;
      
      sem.acquire().then((release) => {
        acquired = true;
        return release;
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.equal(acquired, false, "Should not acquire with limit 0");
    });

    it("should scale with large concurrency limits", async () => {
      const limit = 100;
      const sem = new Semaphore(limit);
      
      const tasks = Array.from({ length: limit }, () =>
        sem.acquire().then((release) => {
          release();
        })
      );
      
      await Promise.all(tasks);
      // If we reach here without hanging, the test passes
      assert.ok(true);
    });
  });

  describe("error handling", () => {
    it("should not break if release is called without acquire", () => {
      const sem = new Semaphore(1);
      // This shouldn't throw but behavior may be undefined
      // Just ensure it doesn't crash
      assert.doesNotThrow(() => {
        const mockRelease = () => (sem as unknown).release();
        mockRelease();
      });
    });

    it("should handle exceptions during acquisition gracefully", async () => {
      const sem = new Semaphore(1);
      const release = await sem.acquire();
      
      // Ensure we can still use the semaphore after exception
      try {
        throw new Error("Test error");
      } catch {
        release();
      }
      
      // Should still work
      const release2 = await sem.acquire();
      release2();
    });
  });
});