import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { isBuiltin, resolveId } from "../../src/core/resolver.js";
import { FsCache } from "../../src/core/fs-cache.js";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";

describe("resolver", () => {
  describe("isBuiltin", () => {
    it("should return true for core Node.js modules", () => {
      assert.strictEqual(isBuiltin("fs"), true);
      assert.strictEqual(isBuiltin("path"), true);
      assert.strictEqual(isBuiltin("http"), true);
      assert.strictEqual(isBuiltin("crypto"), true);
    });

    it("should return true for node: prefixed modules", () => {
      assert.strictEqual(isBuiltin("node:fs"), true);
      assert.strictEqual(isBuiltin("node:path"), true);
      assert.strictEqual(isBuiltin("node:http"), true);
    });

    it("should return false for non-builtin modules", () => {
      assert.strictEqual(isBuiltin("express"), false);
      assert.strictEqual(isBuiltin("lodash"), false);
      assert.strictEqual(isBuiltin("./local"), false);
    });

    it("should return false for scoped packages", () => {
      assert.strictEqual(isBuiltin("@org/package"), false);
    });

    it("should handle edge cases", () => {
      assert.strictEqual(isBuiltin(""), false);
      assert.strictEqual(isBuiltin("node:"), false);
    });
  });

  describe("resolveId", () => {
    const testDir = join(process.cwd(), ".test-resolver");
    const testFile = join(testDir, "index.js");
    const testFile2 = join(testDir, "module.ts");
    
    before(() => {
      try {
        mkdirSync(testDir, { recursive: true });
        writeFileSync(testFile, "// test");
        writeFileSync(testFile2, "// test");
      } catch {
        // ignore
      }
    });
    
    after(() => {
      try {
        unlinkSync(testFile);
        unlinkSync(testFile2);
        rmdirSync(testDir);
      } catch {
        // ignore
      }
    });

    it("should return null for builtin modules", async () => {
      const cache = new FsCache();
      const result = await resolveId(testFile, "fs", cache);
      assert.strictEqual(result, null);
    });

    it("should return null for node: prefixed modules", async () => {
      const cache = new FsCache();
      const result = await resolveId(testFile, "node:fs", cache);
      assert.strictEqual(result, null);
    });

    it("should resolve relative paths with extension", async () => {
      const cache = new FsCache();
      const result = await resolveId(testFile, "./module.ts", cache);
      assert.ok(result?.endsWith("module.ts"));
    });

    it("should resolve relative paths without extension", async () => {
      const cache = new FsCache();
      const result = await resolveId(testFile, "./module", cache);
      assert.ok(result?.includes("module"));
    });

    it("should resolve to index files", async () => {
      const cache = new FsCache();
      const result = await resolveId(testFile2, "./", cache);
      assert.ok(result?.includes("index"));
    });

    it("should cache resolution results", async () => {
      const cache = new FsCache();
      const result1 = await resolveId(testFile, "./module.ts", cache);
      const result2 = await resolveId(testFile, "./module.ts", cache);
      assert.strictEqual(result1, result2);
    });

    it("should handle non-existent modules", async () => {
      const cache = new FsCache();
      const result = await resolveId(testFile, "./nonexistent", cache);
      assert.strictEqual(result, null);
    });

    it("should try multiple extensions", async () => {
      const cache = new FsCache();
      // Should find module.ts even without extension
      const result = await resolveId(testFile, "./module", cache);
      assert.ok(result?.includes("module"));
    });

    it("should handle parent directory references", async () => {
      const cache = new FsCache();
      const subFile = join(testDir, "subdir", "file.js");
      try {
        mkdirSync(join(testDir, "subdir"), { recursive: true });
        writeFileSync(subFile, "// test");
        const result = await resolveId(subFile, "../index", cache);
        assert.ok(result?.includes("index"));
        unlinkSync(subFile);
        rmdirSync(join(testDir, "subdir"));
      } catch {
        // cleanup
      }
    });
  });
});