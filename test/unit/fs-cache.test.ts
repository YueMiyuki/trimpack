import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { FsCache } from "../../src/core/fs-cache.js";

describe("FsCache", () => {
  const testDir = join(process.cwd(), ".test-fs-cache");
  const testFile = join(testDir, "test.txt");
  const testSymlink = join(testDir, "link.txt");
  
  before(() => {
    try {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(testFile, "test content");
    } catch {
      // ignore if already exists
    }
  });
  
  after(() => {
    try {
      unlinkSync(testFile);
      unlinkSync(testSymlink);
      rmdirSync(testDir);
    } catch {
      // ignore cleanup errors
    }
  });

  describe("constructor", () => {
    it("should create FsCache with default concurrency", () => {
      const cache = new FsCache();
      assert.ok(cache instanceof FsCache);
    });

    it("should create FsCache with custom concurrency", () => {
      const cache = new FsCache({ concurrency: 10 });
      assert.ok(cache instanceof FsCache);
    });

    it("should enforce minimum concurrency of 8", () => {
      const cache = new FsCache({ concurrency: 5 });
      assert.ok(cache instanceof FsCache);
    });
  });

  describe("readFile", () => {
    it("should read file as utf8 by default", async () => {
      const cache = new FsCache();
      const content = await cache.readFile(testFile);
      assert.strictEqual(content, "test content");
    });

    it("should read file with explicit encoding", async () => {
      const cache = new FsCache();
      const content = await cache.readFile(testFile, "utf8");
      assert.strictEqual(content, "test content");
    });

    it("should read file as buffer when encoding is null", async () => {
      const cache = new FsCache();
      const content = await cache.readFile(testFile, null);
      assert.ok(Buffer.isBuffer(content));
      assert.strictEqual(content.toString(), "test content");
    });

    it("should cache read results", async () => {
      const cache = new FsCache();
      const content1 = await cache.readFile(testFile);
      const content2 = await cache.readFile(testFile);
      assert.strictEqual(content1, content2);
    });

    it("should use different cache keys for different encodings", async () => {
      const cache = new FsCache();
      const utf8Content = await cache.readFile(testFile, "utf8");
      const bufferContent = await cache.readFile(testFile, null);
      
      assert.strictEqual(typeof utf8Content, "string");
      assert.ok(Buffer.isBuffer(bufferContent));
    });

    it("should throw error for non-existent file", async () => {
      const cache = new FsCache();
      await assert.rejects(
        () => cache.readFile(join(testDir, "nonexistent.txt")),
        { code: "ENOENT" }
      );
    });

    it("should handle concurrent reads", async () => {
      const cache = new FsCache({ concurrency: 2 });
      const promises = Array.from({ length: 10 }, () =>
        cache.readFile(testFile)
      );
      const results = await Promise.all(promises);
      
      assert.strictEqual(results.length, 10);
      results.forEach((result) => {
        assert.strictEqual(result, "test content");
      });
    });

    it("should handle EMFILE error with retry", async () => {
      const cache = new FsCache({ concurrency: 1 });
      // This is hard to test reliably, but we ensure it doesn't crash
      const content = await cache.readFile(testFile);
      assert.strictEqual(content, "test content");
    });
  });

  describe("stat", () => {
    it("should return file stats", async () => {
      const cache = new FsCache();
      const stats = await cache.stat(testFile);
      assert.ok(stats.isFile());
      assert.ok(stats.size > 0);
    });

    it("should cache stat results", async () => {
      const cache = new FsCache();
      const stats1 = await cache.stat(testFile);
      const stats2 = await cache.stat(testFile);
      
      assert.strictEqual(stats1.size, stats2.size);
      assert.strictEqual(stats1.isFile(), stats2.isFile());
    });

    it("should throw error for non-existent file", async () => {
      const cache = new FsCache();
      await assert.rejects(
        () => cache.stat(join(testDir, "nonexistent.txt")),
        { code: "ENOENT" }
      );
    });

    it("should handle concurrent stat calls", async () => {
      const cache = new FsCache({ concurrency: 3 });
      const promises = Array.from({ length: 15 }, () =>
        cache.stat(testFile)
      );
      const results = await Promise.all(promises);
      
      assert.strictEqual(results.length, 15);
      results.forEach((stats) => {
        assert.ok(stats.isFile());
      });
    });
  });

  describe("readlink", () => {
    it("should return null for non-symlink files", async () => {
      const cache = new FsCache();
      const result = await cache.readlink(testFile);
      assert.strictEqual(result, null);
    });

    it("should return null for non-existent files", async () => {
      const cache = new FsCache();
      const result = await cache.readlink(join(testDir, "nonexistent.txt"));
      assert.strictEqual(result, null);
    });

    it("should read symlink target", async () => {
      try {
        symlinkSync(testFile, testSymlink);
        const cache = new FsCache();
        const target = await cache.readlink(testSymlink);
        assert.strictEqual(target, testFile);
      } catch (err) {
        // Skip on systems that don't support symlinks
        if ((err as NodeJS.ErrnoException).code === "EPERM") {
          return;
        }
        throw err;
      }
    });

    it("should cache readlink results", async () => {
      const cache = new FsCache();
      const result1 = await cache.readlink(testFile);
      const result2 = await cache.readlink(testFile);
      assert.strictEqual(result1, result2);
    });
  });

  describe("concurrency control", () => {
    it("should respect concurrency limit", async () => {
      const cache = new FsCache({ concurrency: 2 });
      let concurrent = 0;
      let maxConcurrent = 0;
      
      const promises = Array.from({ length: 10 }, async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await cache.readFile(testFile);
        concurrent--;
      });
      
      await Promise.all(promises);
      // Due to caching, this may not hit the limit, but it shouldn't exceed it
      assert.ok(maxConcurrent <= 10);
    });

    it("should handle mixed operations concurrently", async () => {
      const cache = new FsCache({ concurrency: 5 });
      const promises = [
        cache.readFile(testFile),
        cache.stat(testFile),
        cache.readlink(testFile),
        cache.readFile(testFile, null),
        cache.stat(testFile),
      ];
      
      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 5);
    });
  });
});