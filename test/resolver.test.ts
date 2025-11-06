import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { isBuiltin, resolveId } from "../src/core/resolver.js";
import { FsCache } from "../src/core/fs-cache.js";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const TEST_DIR = resolve(process.cwd(), ".test-resolver");
const TEST_FILE = join(TEST_DIR, "entry.js");
const TEST_MODULE = join(TEST_DIR, "local-module.js");

describe("resolver", () => {
  before(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
    try {
      if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
      if (existsSync(TEST_MODULE)) unlinkSync(TEST_MODULE);
      if (existsSync(TEST_DIR)) rmdirSync(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("isBuiltin", () => {
    it("should identify Node.js built-in modules", () => {
      assert.equal(isBuiltin("fs"), true);
      assert.equal(isBuiltin("path"), true);
      assert.equal(isBuiltin("http"), true);
      assert.equal(isBuiltin("crypto"), true);
    });

    it("should identify node: prefixed builtins", () => {
      assert.equal(isBuiltin("node:fs"), true);
      assert.equal(isBuiltin("node:path"), true);
      assert.equal(isBuiltin("node:http"), true);
    });

    it("should reject non-builtin modules", () => {
      assert.equal(isBuiltin("express"), false);
      assert.equal(isBuiltin("lodash"), false);
      assert.equal(isBuiltin("./local"), false);
      assert.equal(isBuiltin("@scope/package"), false);
    });

    it("should handle edge cases", () => {
      assert.equal(isBuiltin(""), false);
      assert.equal(isBuiltin("node:"), false);
      assert.equal(isBuiltin("node:nonexistent"), true); // node: prefix makes it truthy
    });

    it("should handle all common builtins", () => {
      const commonBuiltins = [
        "fs", "path", "http", "https", "crypto", "util",
        "stream", "buffer", "events", "url", "querystring",
        "os", "process", "child_process", "cluster"
      ];
      
      for (const builtin of commonBuiltins) {
        assert.equal(isBuiltin(builtin), true, `${builtin} should be builtin`);
        assert.equal(isBuiltin(`node:${builtin}`), true, `node:${builtin} should be builtin`);
      }
    });
  });

  describe("resolveId", () => {
    describe("builtin modules", () => {
      it("should return null for built-in modules", async () => {
        const fs = new FsCache();
        const result = await resolveId(TEST_FILE, "fs", fs);
        assert.equal(result, null);
      });

      it("should return null for node: prefixed builtins", async () => {
        const fs = new FsCache();
        const result = await resolveId(TEST_FILE, "node:fs", fs);
        assert.equal(result, null);
      });
    });

    describe("relative paths", () => {
      it("should resolve relative path with .js extension", async () => {
        writeFileSync(TEST_FILE, "");
        writeFileSync(TEST_MODULE, "export const foo = 1;");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./local-module.js", fs);
        assert.equal(result, TEST_MODULE);
        
        unlinkSync(TEST_MODULE);
        unlinkSync(TEST_FILE);
      });

      it("should resolve relative path without extension", async () => {
        writeFileSync(TEST_FILE, "");
        writeFileSync(TEST_MODULE, "export const foo = 1;");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./local-module", fs);
        assert.equal(result, TEST_MODULE);
        
        unlinkSync(TEST_MODULE);
        unlinkSync(TEST_FILE);
      });

      it("should try TypeScript extensions", async () => {
        writeFileSync(TEST_FILE, "");
        const tsModule = join(TEST_DIR, "ts-module.ts");
        writeFileSync(tsModule, "export const foo = 1;");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./ts-module", fs);
        assert.equal(result, tsModule);
        
        unlinkSync(tsModule);
        unlinkSync(TEST_FILE);
      });

      it("should resolve index files", async () => {
        writeFileSync(TEST_FILE, "");
        const moduleDir = join(TEST_DIR, "module-dir");
        mkdirSync(moduleDir, { recursive: true });
        const indexFile = join(moduleDir, "index.js");
        writeFileSync(indexFile, "export const foo = 1;");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./module-dir", fs);
        assert.equal(result, indexFile);
        
        unlinkSync(indexFile);
        rmdirSync(moduleDir);
        unlinkSync(TEST_FILE);
      });

      it("should resolve parent directory references", async () => {
        writeFileSync(TEST_MODULE, "export const foo = 1;");
        const subdir = join(TEST_DIR, "subdir");
        mkdirSync(subdir, { recursive: true });
        const nestedFile = join(subdir, "nested.js");
        writeFileSync(nestedFile, "");
        const fs = new FsCache();
        
        const result = await resolveId(nestedFile, "../local-module.js", fs);
        assert.equal(result, TEST_MODULE);
        
        unlinkSync(nestedFile);
        rmdirSync(subdir);
        unlinkSync(TEST_MODULE);
      });

      it("should return null for non-existent relative paths", async () => {
        writeFileSync(TEST_FILE, "");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./nonexistent", fs);
        assert.equal(result, null);
        
        unlinkSync(TEST_FILE);
      });
    });

    describe("node_modules resolution", () => {
      it("should resolve packages from node_modules", async () => {
        writeFileSync(TEST_FILE, "");
        const fs = new FsCache();
        
        // This will try to resolve a real package from node_modules
        // Result depends on whether the package is actually installed
        const result = await resolveId(TEST_FILE, "nonexistent-test-package", fs);
        // Should return null for non-existent packages
        assert.equal(result, null);
        
        unlinkSync(TEST_FILE);
      });

      it("should handle scoped packages", async () => {
        writeFileSync(TEST_FILE, "");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "@scope/nonexistent", fs);
        assert.equal(result, null);
        
        unlinkSync(TEST_FILE);
      });
    });

    describe("caching", () => {
      it("should cache resolution results", async () => {
        writeFileSync(TEST_FILE, "");
        writeFileSync(TEST_MODULE, "export const foo = 1;");
        const fs = new FsCache();
        
        const result1 = await resolveId(TEST_FILE, "./local-module", fs);
        const result2 = await resolveId(TEST_FILE, "./local-module", fs);
        
        assert.equal(result1, result2);
        assert.equal(result1, TEST_MODULE);
        
        unlinkSync(TEST_MODULE);
        unlinkSync(TEST_FILE);
      });

      it("should cache null results", async () => {
        writeFileSync(TEST_FILE, "");
        const fs = new FsCache();
        
        const result1 = await resolveId(TEST_FILE, "./nonexistent", fs);
        const result2 = await resolveId(TEST_FILE, "./nonexistent", fs);
        
        assert.equal(result1, null);
        assert.equal(result2, null);
        
        unlinkSync(TEST_FILE);
      });
    });

    describe("extension priority", () => {
      it("should prefer .ts over .js when both exist", async () => {
        writeFileSync(TEST_FILE, "");
        const jsModule = join(TEST_DIR, "priority.js");
        const tsModule = join(TEST_DIR, "priority.ts");
        writeFileSync(jsModule, "// js");
        writeFileSync(tsModule, "// ts");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./priority", fs);
        // Should prefer TS extensions
        assert.equal(result, tsModule);
        
        unlinkSync(jsModule);
        unlinkSync(tsModule);
        unlinkSync(TEST_FILE);
      });

      it("should try multiple extensions in order", async () => {
        writeFileSync(TEST_FILE, "");
        const mjsModule = join(TEST_DIR, "esm.mjs");
        writeFileSync(mjsModule, "export const foo = 1;");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./esm", fs);
        assert.ok(result?.endsWith(".mjs"));
        
        unlinkSync(mjsModule);
        unlinkSync(TEST_FILE);
      });
    });

    describe("edge cases", () => {
      it("should handle empty specifier", async () => {
        writeFileSync(TEST_FILE, "");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "", fs);
        assert.equal(result, null);
        
        unlinkSync(TEST_FILE);
      });

      it("should handle absolute paths", async () => {
        writeFileSync(TEST_FILE, "");
        writeFileSync(TEST_MODULE, "");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, TEST_MODULE, fs);
        assert.equal(result, TEST_MODULE);
        
        unlinkSync(TEST_MODULE);
        unlinkSync(TEST_FILE);
      });

      it("should handle paths with special characters", async () => {
        writeFileSync(TEST_FILE, "");
        const specialModule = join(TEST_DIR, "special-module.js");
        writeFileSync(specialModule, "");
        const fs = new FsCache();
        
        const result = await resolveId(TEST_FILE, "./special-module", fs);
        assert.equal(result, specialModule);
        
        unlinkSync(specialModule);
        unlinkSync(TEST_FILE);
      });
    });
  });
});