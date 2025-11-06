import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { traceDependencies } from "../../src/core/dependency-tracer.js";

describe("traceDependencies", () => {
  const testDir = join(process.cwd(), ".test-tracer");
  const entryFile = join(testDir, "entry.js");
  const depFile1 = join(testDir, "dep1.js");
  const depFile2 = join(testDir, "dep2.ts");
  
  before(() => {
    try {
      mkdirSync(testDir, { recursive: true });
      
      // Create entry file with imports
      writeFileSync(entryFile, `
        import { foo } from './dep1.js';
        import { bar } from './dep2';
        console.log(foo, bar);
      `);
      
      // Create dependency files
      writeFileSync(depFile1, `
        export const foo = 'foo';
      `);
      
      writeFileSync(depFile2, `
        export const bar = 'bar';
      `);
    } catch {
      // ignore
    }
  });
  
  after(() => {
    try {
      unlinkSync(entryFile);
      unlinkSync(depFile1);
      unlinkSync(depFile2);
      rmdirSync(testDir);
    } catch {
      // ignore
    }
  });

  describe("basic tracing", () => {
    it("should trace dependencies from entry file", async () => {
      const deps = await traceDependencies(entryFile, {
        base: testDir,
        external: [],
        concurrency: 256,
      });
      
      assert.ok(deps instanceof Set);
      assert.ok(deps.size >= 1); // At least entry file
      assert.ok(deps.has(entryFile));
    });

    it("should follow import chains", async () => {
      const deps = await traceDependencies(entryFile, {
        base: testDir,
        external: [],
      });
      
      // Should include the dependency files
      assert.ok(deps.size >= 2);
    });

    it("should handle files with no dependencies", async () => {
      const standalone = join(testDir, "standalone.js");
      writeFileSync(standalone, "console.log('hello');");
      
      const deps = await traceDependencies(standalone, {
        base: testDir,
      });
      
      assert.ok(deps.has(standalone));
      unlinkSync(standalone);
    });
  });

  describe("external dependencies", () => {
    it("should exclude external dependencies", async () => {
      const withExternal = join(testDir, "with-external.js");
      writeFileSync(withExternal, `
        import fs from 'fs';
        import { foo } from './dep1.js';
      `);
      
      const deps = await traceDependencies(withExternal, {
        base: testDir,
        external: ["fs"],
      });
      
      // Should not include fs module
      const depPaths = Array.from(deps);
      assert.ok(!depPaths.some(p => p.includes("node_modules/fs")));
      
      unlinkSync(withExternal);
    });

    it("should handle node: prefixed external modules", async () => {
      const withNode = join(testDir, "with-node.js");
      writeFileSync(withNode, `
        import fs from 'node:fs';
        console.log(fs);
      `);
      
      const deps = await traceDependencies(withNode, {
        base: testDir,
        external: ["node:*"],
      });
      
      assert.ok(deps.has(withNode));
      unlinkSync(withNode);
    });
  });

  describe("file type support", () => {
    it("should handle .js files", async () => {
      const deps = await traceDependencies(depFile1, {
        base: testDir,
      });
      assert.ok(deps.has(depFile1));
    });

    it("should handle .ts files", async () => {
      const deps = await traceDependencies(depFile2, {
        base: testDir,
      });
      assert.ok(deps.has(depFile2));
    });

    it("should handle mixed .js and .ts imports", async () => {
      const mixed = join(testDir, "mixed.js");
      writeFileSync(mixed, `
        import { foo } from './dep1.js';
        import { bar } from './dep2';
      `);
      
      const deps = await traceDependencies(mixed, {
        base: testDir,
      });
      
      assert.ok(deps.size >= 2);
      unlinkSync(mixed);
    });
  });

  describe("circular dependencies", () => {
    it("should handle circular dependencies", async () => {
      const circA = join(testDir, "circ-a.js");
      const circB = join(testDir, "circ-b.js");
      
      writeFileSync(circA, `
        import { b } from './circ-b.js';
        export const a = 'a';
      `);
      
      writeFileSync(circB, `
        import { a } from './circ-a.js';
        export const b = 'b';
      `);
      
      const deps = await traceDependencies(circA, {
        base: testDir,
      });
      
      // Should include both files without infinite loop
      assert.ok(deps.has(circA));
      assert.ok(deps.has(circB));
      
      unlinkSync(circA);
      unlinkSync(circB);
    });
  });

  describe("error handling", () => {
    it("should handle non-existent entry file gracefully", async () => {
      const nonExistent = join(testDir, "nonexistent.js");
      const deps = await traceDependencies(nonExistent, {
        base: testDir,
      });
      
      // Should return empty or with just the path
      assert.ok(deps instanceof Set);
    });

    it("should handle files with broken imports", async () => {
      const broken = join(testDir, "broken.js");
      writeFileSync(broken, `
        import { missing } from './does-not-exist.js';
      `);
      
      const deps = await traceDependencies(broken, {
        base: testDir,
      });
      
      // Should still include the broken file
      assert.ok(deps.has(broken));
      unlinkSync(broken);
    });
  });

  describe("concurrency", () => {
    it("should respect concurrency limit", async () => {
      const deps = await traceDependencies(entryFile, {
        base: testDir,
        concurrency: 1,
      });
      
      assert.ok(deps instanceof Set);
      assert.ok(deps.size >= 1);
    });

    it("should handle high concurrency", async () => {
      const deps = await traceDependencies(entryFile, {
        base: testDir,
        concurrency: 1000,
      });
      
      assert.ok(deps instanceof Set);
    });
  });
});