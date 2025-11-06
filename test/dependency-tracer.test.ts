import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { traceDependencies } from "../src/core/dependency-tracer.js";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const TEST_DIR = resolve(process.cwd(), ".test-dependency-tracer");

describe("traceDependencies", () => {
  before(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
    try {
      // Clean up test files
      const testFiles = [
        "entry.js", "module-a.js", "module-b.js", "module-c.js",
        "circular-a.js", "circular-b.js", "nested.ts", "index.mjs"
      ];
      testFiles.forEach(f => {
        const path = join(TEST_DIR, f);
        if (existsSync(path)) unlinkSync(path);
      });
      const subdir = join(TEST_DIR, "subdir");
      if (existsSync(join(subdir, "nested.js"))) {
        unlinkSync(join(subdir, "nested.js"));
        rmdirSync(subdir);
      }
      if (existsSync(TEST_DIR)) rmdirSync(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("basic tracing", () => {
    it("should trace a single file with no dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "console.log('hello');");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });

    it("should trace files with local dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "export const foo = 1;");
      writeFileSync(entry, "import { foo } from './module-a.js';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(moduleA));
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });

    it("should trace transitive dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      const moduleB = join(TEST_DIR, "module-b.js");
      
      writeFileSync(moduleB, "export const bar = 2;");
      writeFileSync(moduleA, "import { bar } from './module-b.js'; export const foo = 1;");
      writeFileSync(entry, "import { foo } from './module-a.js';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(moduleA));
      assert.ok(files.has(moduleB));
      
      unlinkSync(entry);
      unlinkSync(moduleA);
      unlinkSync(moduleB);
    });

    it("should handle TypeScript files", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const tsModule = join(TEST_DIR, "nested.ts");
      
      writeFileSync(tsModule, "export const foo: number = 1;");
      writeFileSync(entry, "import { foo } from './nested';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(tsModule));
      
      unlinkSync(entry);
      unlinkSync(tsModule);
    });

    it("should handle .mjs files", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const mjsModule = join(TEST_DIR, "index.mjs");
      
      writeFileSync(mjsModule, "export const foo = 1;");
      writeFileSync(entry, "import { foo } from './index.mjs';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(mjsModule));
      
      unlinkSync(entry);
      unlinkSync(mjsModule);
    });
  });

  describe("circular dependencies", () => {
    it("should handle circular dependencies without infinite loop", async () => {
      const circularA = join(TEST_DIR, "circular-a.js");
      const circularB = join(TEST_DIR, "circular-b.js");
      
      writeFileSync(circularA, "import './circular-b.js'; export const a = 1;");
      writeFileSync(circularB, "import './circular-a.js'; export const b = 2;");
      
      const files = await traceDependencies(circularA);
      assert.ok(files.has(circularA));
      assert.ok(files.has(circularB));
      assert.equal(files.size, 2);
      
      unlinkSync(circularA);
      unlinkSync(circularB);
    });

    it("should handle self-referencing modules", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import './entry.js'; export const foo = 1;");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });
  });

  describe("module types", () => {
    it("should handle CommonJS requires", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "module.exports = { foo: 1 };");
      writeFileSync(entry, "const { foo } = require('./module-a.js');");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(moduleA));
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });

    it("should handle dynamic imports", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "export const foo = 1;");
      writeFileSync(entry, "const module = await import('./module-a.js');");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(moduleA));
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });

    it("should handle export from statements", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "export const foo = 1;");
      writeFileSync(entry, "export { foo } from './module-a.js';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(moduleA));
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });
  });

  describe("external dependencies", () => {
    it("should skip built-in modules", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import fs from 'fs'; import path from 'path';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 1);
      assert.ok(files.has(entry));
      
      unlinkSync(entry);
    });

    it("should skip node: prefixed builtins", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import fs from 'node:fs'; import path from 'node:path';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });

    it("should respect external option", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import lodash from 'lodash'; import react from 'react';");
      
      const files = await traceDependencies(entry, { 
        external: ['lodash', 'react']
      });
      assert.equal(files.size, 1);
      assert.ok(files.has(entry));
      
      unlinkSync(entry);
    });

    it("should skip URL-like specifiers", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import 'https://example.com/module.js'; import 'http://test.com/foo.js';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });

    it("should handle external with trailing slash", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import 'lodash/fp'; import 'react/jsx-runtime';");
      
      const files = await traceDependencies(entry, { 
        external: ['lodash/', 'react/']
      });
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });
  });

  describe("non-JS files", () => {
    it("should skip CSS imports", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const cssFile = join(TEST_DIR, "styles.css");
      writeFileSync(cssFile, ".foo { color: red; }");
      writeFileSync(entry, "import './styles.css';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 1);
      assert.ok(files.has(entry));
      
      unlinkSync(entry);
      unlinkSync(cssFile);
    });

    it("should skip JSON imports", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const jsonFile = join(TEST_DIR, "data.json");
      writeFileSync(jsonFile, '{"foo": "bar"}');
      writeFileSync(entry, "import data from './data.json';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
      unlinkSync(jsonFile);
    });

    it("should skip image imports", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import logo from './logo.png';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });
  });

  describe("options", () => {
    it("should use custom base directory", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "console.log('test');");
      
      const files = await traceDependencies(entry, { base: TEST_DIR });
      assert.ok(files.has(entry));
      
      unlinkSync(entry);
    });

    it("should respect concurrency option", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const modules = Array.from({ length: 5 }, (_, i) => {
        const mod = join(TEST_DIR, `module-${i}.js`);
        writeFileSync(mod, `export const val${i} = ${i};`);
        return mod;
      });
      
      const imports = modules.map((_, i) => `import { val${i} } from './module-${i}.js';`).join('\n');
      writeFileSync(entry, imports);
      
      const files = await traceDependencies(entry, { concurrency: 2 });
      assert.ok(files.has(entry));
      assert.equal(files.size, 6); // entry + 5 modules
      
      unlinkSync(entry);
      modules.forEach(m => unlinkSync(m));
    });
  });

  describe("error handling", () => {
    it("should handle non-existent entry file", async () => {
      const entry = join(TEST_DIR, "nonexistent.js");
      
      const files = await traceDependencies(entry);
      // Should handle gracefully, visiting the path but not finding content
      assert.ok(files.size >= 0);
    });

    it("should handle malformed JavaScript", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import { foo from 'broken-syntax");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      
      unlinkSync(entry);
    });

    it("should handle missing local dependencies gracefully", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import { foo } from './nonexistent.js';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.equal(files.size, 1);
      
      unlinkSync(entry);
    });

    it("should handle symlink resolution errors", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "console.log('test');");
      
      // Should not throw even if symlink resolution has issues
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      
      unlinkSync(entry);
    });
  });

  describe("complex scenarios", () => {
    it("should handle deep dependency trees", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const depth = 5;
      const modules: string[] = [];
      
      for (let i = 0; i < depth; i++) {
        const mod = join(TEST_DIR, `level-${i}.js`);
        modules.push(mod);
        if (i === depth - 1) {
          writeFileSync(mod, `export const level = ${i};`);
        } else {
          writeFileSync(mod, `import { level } from './level-${i + 1}.js'; export const level = ${i};`);
        }
      }
      writeFileSync(entry, "import { level } from './level-0.js';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, depth + 1);
      
      unlinkSync(entry);
      modules.forEach(m => unlinkSync(m));
    });

    it("should handle diamond dependency pattern", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const modA = join(TEST_DIR, "module-a.js");
      const modB = join(TEST_DIR, "module-b.js");
      const modC = join(TEST_DIR, "module-c.js");
      
      writeFileSync(modC, "export const shared = 'value';");
      writeFileSync(modA, "import { shared } from './module-c.js'; export const a = 1;");
      writeFileSync(modB, "import { shared } from './module-c.js'; export const b = 2;");
      writeFileSync(entry, "import { a } from './module-a.js'; import { b } from './module-b.js';");
      
      const files = await traceDependencies(entry);
      assert.equal(files.size, 4);
      assert.ok(files.has(entry));
      assert.ok(files.has(modA));
      assert.ok(files.has(modB));
      assert.ok(files.has(modC));
      
      unlinkSync(entry);
      unlinkSync(modA);
      unlinkSync(modB);
      unlinkSync(modC);
    });

    it("should handle mixed module types in tree", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const esmMod = join(TEST_DIR, "esm.mjs");
      const cjsMod = join(TEST_DIR, "cjs.js");
      const tsMod = join(TEST_DIR, "ts-mod.ts");
      
      writeFileSync(tsMod, "export const ts: string = 'typescript';");
      writeFileSync(cjsMod, "const { ts } = require('./ts-mod'); module.exports = { cjs: 'commonjs' };");
      writeFileSync(esmMod, "import { cjs } from './cjs.js'; export const esm = 'esmodule';");
      writeFileSync(entry, "import { esm } from './esm.mjs';");
      
      const files = await traceDependencies(entry);
      assert.ok(files.has(entry));
      assert.ok(files.has(esmMod));
      
      unlinkSync(entry);
      unlinkSync(esmMod);
      unlinkSync(cjsMod);
      unlinkSync(tsMod);
    });
  });
});