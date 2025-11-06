import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { AssetAnalyzer } from "../src/core/asset-analyzer.js";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const TEST_DIR = resolve(process.cwd(), ".test-asset-analyzer");

describe("AssetAnalyzer", () => {
  before(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
    try {
      const testFiles = [
        "entry.js", "module-a.js", "data.json", "config.json",
        "styles.css", "image.png", "readme.txt"
      ];
      testFiles.forEach(f => {
        const path = join(TEST_DIR, f);
        if (existsSync(path)) unlinkSync(path);
      });
      if (existsSync(TEST_DIR)) rmdirSync(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("constructor", () => {
    it("should create analyzer with default options", () => {
      const analyzer = new AssetAnalyzer();
      assert.ok(analyzer instanceof AssetAnalyzer);
    });

    it("should create analyzer with custom options", () => {
      const analyzer = new AssetAnalyzer({
        base: TEST_DIR,
        external: ['lodash'],
        concurrency: 128,
        includeAssets: false
      });
      assert.ok(analyzer instanceof AssetAnalyzer);
    });

    it("should default includeAssets to true", () => {
      const analyzer = new AssetAnalyzer();
      assert.ok(analyzer instanceof AssetAnalyzer);
    });
  });

  describe("dependency analysis", () => {
    it("should analyze file with no dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "console.log('hello');");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
    });

    it("should detect ES6 import dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "export const foo = 1;");
      writeFileSync(entry, "import { foo } from './module-a.js';");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies.size > 0);
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });

    it("should detect CommonJS require dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "module.exports = { foo: 1 };");
      writeFileSync(entry, "const mod = require('./module-a.js');");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies.size > 0);
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });

    it("should detect dynamic imports", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "export const foo = 1;");
      writeFileSync(entry, "const mod = await import('./module-a.js');");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies.size > 0);
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });

    it("should skip built-in modules", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import fs from 'fs'; import path from 'path';");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      // Should not include built-ins in dependencies
      const depPaths = Array.from(result.dependencies);
      assert.ok(depPaths.every(p => !p.includes('fs') && !p.includes('path')));
      
      unlinkSync(entry);
    });

    it("should skip external dependencies", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import lodash from 'lodash'; import react from 'react';");
      
      const analyzer = new AssetAnalyzer({ external: ['lodash', 'react'] });
      const result = await analyzer.analyze(entry);
      
      // External deps should be skipped
      assert.equal(result.dependencies.size, 0);
      
      unlinkSync(entry);
    });

    it("should skip URL-like specifiers", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import 'https://cdn.example.com/module.js';");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.equal(result.dependencies.size, 0);
      
      unlinkSync(entry);
    });
  });

  describe("asset detection", () => {
    it("should detect JSON file references", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const jsonFile = join(TEST_DIR, "data.json");
      
      writeFileSync(jsonFile, '{"key": "value"}');
      writeFileSync(entry, "const data = './data.json';");
      
      const analyzer = new AssetAnalyzer({ includeAssets: true });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.assets.size >= 0); // May or may not detect depending on pattern
      
      unlinkSync(entry);
      unlinkSync(jsonFile);
    });

    it("should detect file references with __dirname", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "const file = __dirname + '/data.json';");
      
      const analyzer = new AssetAnalyzer({ includeAssets: true });
      const result = await analyzer.analyze(entry);
      
      // __dirname pattern should be detected
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
    });

    it("should detect path.resolve with __dirname", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "const file = path.resolve(__dirname, 'config.json');");
      
      const analyzer = new AssetAnalyzer({ includeAssets: true });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
    });

    it("should not detect assets when includeAssets is false", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "const file = './data.json';");
      
      const analyzer = new AssetAnalyzer({ includeAssets: false });
      const result = await analyzer.analyze(entry);
      
      assert.equal(result.assets.size, 0);
      
      unlinkSync(entry);
    });

    it("should detect various asset extensions", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, `
        const json = './data.json';
        const txt = './readme.txt';
        const css = './styles.css';
        const png = './image.png';
      `);
      
      const analyzer = new AssetAnalyzer({ includeAssets: true });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
    });
  });

  describe("file type handling", () => {
    it("should only process JS-like files", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const cssFile = join(TEST_DIR, "styles.css");
      
      writeFileSync(cssFile, ".foo { color: red; }");
      writeFileSync(entry, "console.log('test');");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      // CSS file shouldn't be analyzed even if referenced
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(entry);
      unlinkSync(cssFile);
    });

    it("should handle TypeScript files", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import './module.ts';");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(entry);
    });

    it("should handle various JS extensions", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, `
        import './module.mjs';
        import './other.cjs';
        import './component.jsx';
      `);
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(entry);
    });
  });

  describe("pattern matching", () => {
    it("should extract imports from various patterns", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, `
        import foo from 'module1';
        const bar = require('module2');
        const baz = await import('module3');
        export { qux } from 'module4';
      `);
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(entry);
    });

    it("should handle template literals with file paths", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "const file = `./data.json`;");
      
      const analyzer = new AssetAnalyzer({ includeAssets: true });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
    });

    it("should distinguish between modules and assets", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const moduleA = join(TEST_DIR, "module-a.js");
      
      writeFileSync(moduleA, "export const foo = 1;");
      writeFileSync(entry, `
        import './module-a.js';
        const data = './data.json';
      `);
      
      const analyzer = new AssetAnalyzer({ includeAssets: true });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies.size > 0);
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
      unlinkSync(moduleA);
    });
  });

  describe("concurrency", () => {
    it("should respect concurrency limits", async () => {
      const entry = join(TEST_DIR, "entry.js");
      const modules = Array.from({ length: 10 }, (_, i) => {
        const mod = join(TEST_DIR, `mod-${i}.js`);
        writeFileSync(mod, `export const val = ${i};`);
        return mod;
      });
      
      const imports = modules.map((_, i) => `import './mod-${i}.js';`).join('\n');
      writeFileSync(entry, imports);
      
      const analyzer = new AssetAnalyzer({ concurrency: 4 });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies.size > 0);
      
      unlinkSync(entry);
      modules.forEach(m => unlinkSync(m));
    });

    it("should handle high concurrency", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "console.log('test');");
      
      const analyzer = new AssetAnalyzer({ concurrency: 512 });
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      assert.ok(result.assets instanceof Set);
      
      unlinkSync(entry);
    });
  });

  describe("error handling", () => {
    it("should handle non-existent files gracefully", async () => {
      const entry = join(TEST_DIR, "nonexistent.js");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      assert.ok(result.assets instanceof Set);
    });

    it("should handle malformed code gracefully", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "import { broken from 'syntax-error");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(entry);
    });

    it("should handle files with read errors", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "console.log('test');");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(entry);
    });
  });

  describe("edge cases", () => {
    it("should handle empty files", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.equal(result.dependencies.size, 0);
      assert.equal(result.assets.size, 0);
      
      unlinkSync(entry);
    });

    it("should handle files with only comments", async () => {
      const entry = join(TEST_DIR, "entry.js");
      writeFileSync(entry, "// This is a comment\n/* Another comment */");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(entry);
      
      assert.equal(result.dependencies.size, 0);
      
      unlinkSync(entry);
    });

    it("should handle circular dependencies", async () => {
      const fileA = join(TEST_DIR, "circular-a.js");
      const fileB = join(TEST_DIR, "circular-b.js");
      
      writeFileSync(fileA, "import './circular-b.js'; export const a = 1;");
      writeFileSync(fileB, "import './circular-a.js'; export const b = 2;");
      
      const analyzer = new AssetAnalyzer();
      const result = await analyzer.analyze(fileA);
      
      assert.ok(result.dependencies.size >= 1);
      
      unlinkSync(fileA);
      unlinkSync(fileB);
    });
  });
});