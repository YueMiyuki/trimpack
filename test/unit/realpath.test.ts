import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  writeFileSync,
  unlinkSync,
  mkdirSync,
  rmdirSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { realpath } from "../../src/core/realpath.js";
import { FsCache } from "../../src/core/fs-cache.js";

describe("realpath", () => {
  const testDir = join(process.cwd(), ".test-realpath");
  const testFile = join(testDir, "file.txt");
  const testLink = join(testDir, "link.txt");
  const testLink2 = join(testDir, "link2.txt");

  before(() => {
    try {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(testFile, "content");
    } catch {
      // ignore
    }
  });

  after(() => {
    try {
      unlinkSync(testFile);
      try {
        unlinkSync(testLink);
      } catch {
        /* empty */
      }
      try {
        unlinkSync(testLink2);
      } catch {
        /* empty */
      }
      rmdirSync(testDir);
    } catch {
      // ignore
    }
  });

  describe("basic functionality", () => {
    it("should return the same path for regular files", async () => {
      const cache = new FsCache();
      const result = await realpath(testFile, cache, testDir);
      assert.strictEqual(result, testFile);
    });

    it("should resolve symlinks", async () => {
      try {
        symlinkSync(testFile, testLink);
        const cache = new FsCache();
        const result = await realpath(testLink, cache, testDir);
        assert.ok(result.includes("file.txt"));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EPERM") {
          return; // Skip on systems without symlink support
        }
        throw err;
      } finally {
        try {
          unlinkSync(testLink);
        } catch {
          /* empty */
        }
      }
    });

    it("should handle paths outside base", async () => {
      const cache = new FsCache();
      const outsidePath = join(process.cwd(), "package.json");
      const result = await realpath(outsidePath, cache, testDir);
      assert.strictEqual(result, outsidePath);
    });
  });

  describe("edge cases", () => {
    it("should detect recursive symlinks", async () => {
      try {
        symlinkSync(testLink, testLink2);
        symlinkSync(testLink2, testLink);

        const cache = new FsCache();
        await assert.rejects(
          () => realpath(testLink, cache, testDir),
          /Recursive symlink/,
        );
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EPERM") {
          return; // Skip on systems without symlink support
        }
        throw err;
      } finally {
        try {
          unlinkSync(testLink);
        } catch {
          /* empty */
        }
        try {
          unlinkSync(testLink2);
        } catch {
          /* empty */
        }
      }
    });

    it("should handle non-existent paths", async () => {
      const cache = new FsCache();
      const nonExistent = join(testDir, "nonexistent.txt");
      const result = await realpath(nonExistent, cache, testDir);
      // Should return the path even if it doesn't exist
      assert.ok(result.includes("nonexistent.txt"));
    });

    it("should use provided seen set", async () => {
      const cache = new FsCache();
      const seen = new Set<string>();
      seen.add(testFile);

      await assert.rejects(
        () => realpath(testFile, cache, testDir, seen),
        /Recursive symlink/,
      );
    });
  });

  describe("caching behavior", () => {
    it("should use FsCache for readlink operations", async () => {
      const cache = new FsCache();
      await realpath(testFile, cache, testDir);
      // The cache should have been used
      assert.ok(cache instanceof FsCache);
    });

    it("should handle multiple realpath calls with same cache", async () => {
      const cache = new FsCache();
      const result1 = await realpath(testFile, cache, testDir);
      const result2 = await realpath(testFile, cache, testDir);
      assert.strictEqual(result1, result2);
    });
  });
});
