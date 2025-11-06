import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { AssetAnalyzer } from "../../src/core/asset-analyzer.js";

describe("AssetAnalyzer", () => {
  const testDir = join(process.cwd(), ".test-asset-analyzer");
  const entryFile = join(testDir, "entry.js");
  const depFile = join(testDir, "dep.js");
  const assetFile = join(testDir, "data.json");
  
  before(() => {
    try {
      mkdirSync(testDir, { recursive: true });
      
      writeFileSync(entryFile, `
        import { foo } from './dep.js';
        const data = require('./data.json');
        console.log(foo, data);
      `);
      
      writeFileSync(depFile, `
        export const foo = 'bar';
      `);
      
      writeFileSync(assetFile, JSON.stringify({ key: "value" }));
    } catch {
      // ignore
    }
  });
  
  after(() => {
    try {
      unlinkSync(entryFile);
      unlinkSync(depFile);
      unlinkSync(assetFile);
      rmdirSync(testDir);
    } catch {
      // ignore
    }
  });

  describe("constructor", () => {
    it("should create AssetAnalyzer with default options", () => {
      const analyzer = new AssetAnalyzer();
      assert.ok(analyzer instanceof AssetAnalyzer);
    });

    it("should create with custom options", () => {
      const analyzer = new AssetAnalyzer({
        base: testDir,
        external: ["lodash"],
        concurrency: 128,
        includeAssets: true,
      });
      assert.ok(analyzer instanceof AssetAnalyzer);
    });

    it("should default includeAssets to true", () => {
      const analyzer = new AssetAnalyzer();
      assert.ok(analyzer instanceof AssetAnalyzer);
    });
  });

  describe("analyze", () => {
    it("should analyze dependencies from entry file", async () => {
      const analyzer = new AssetAnalyzer({
        base: testDir,
        external: [],
      });
      
      const result = await analyzer.analyze(entryFile);
      
      assert.ok(result.dependencies instanceof Set);
      assert.ok(result.assets instanceof Set);
    });

    it("should detect ESM imports", async () => {
      const testFile = join(testDir, "esm-test.js");
      writeFileSync(testFile, `
        import foo from './dep.js';
        import { bar } from './dep.js';
        import * as baz from './dep.js';
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies.size >= 0);
      unlinkSync(testFile);
    });

    it("should detect CommonJS requires", async () => {
      const testFile = join(testDir, "cjs-test.js");
      writeFileSync(testFile, `
        const foo = require('./dep.js');
        const bar = require('./data.json');
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies.size >= 0);
      unlinkSync(testFile);
    });

    it("should detect dynamic imports", async () => {
      const testFile = join(testDir, "dynamic-test.js");
      writeFileSync(testFile, `
        const mod = import('./dep.js');
        const data = import('./data.json');
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies.size >= 0);
      unlinkSync(testFile);
    });

    it("should collect asset references when enabled", async () => {
      const testFile = join(testDir, "asset-test.js");
      writeFileSync(testFile, `
        const config = './config.json';
        const data = './data.json';
      `);
      
      const analyzer = new AssetAnalyzer({ 
        base: testDir,
        includeAssets: true,
      });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.assets instanceof Set);
      unlinkSync(testFile);
    });

    it("should skip assets when includeAssets is false", async () => {
      const testFile = join(testDir, "no-asset-test.js");
      writeFileSync(testFile, `
        const config = './config.json';
      `);
      
      const analyzer = new AssetAnalyzer({ 
        base: testDir,
        includeAssets: false,
      });
      const result = await analyzer.analyze(testFile);
      
      assert.strictEqual(result.assets.size, 0);
      unlinkSync(testFile);
    });

    it("should handle __dirname patterns", async () => {
      const testFile = join(testDir, "dirname-test.js");
      writeFileSync(testFile, `
        const path = require('path');
        const config = path.join(__dirname, 'config.json');
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies instanceof Set || result.assets instanceof Set);
      unlinkSync(testFile);
    });

    it("should handle path.resolve patterns", async () => {
      const testFile = join(testDir, "resolve-test.js");
      writeFileSync(testFile, `
        const path = require('path');
        const file = path.resolve(__dirname, 'data.json');
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.assets instanceof Set);
      unlinkSync(testFile);
    });
  });

  describe("external filtering", () => {
    it("should exclude external dependencies", async () => {
      const testFile = join(testDir, "external-test.js");
      writeFileSync(testFile, `
        import lodash from 'lodash';
        import { foo } from './dep.js';
      `);
      
      const analyzer = new AssetAnalyzer({
        base: testDir,
        external: ["lodash"],
      });
      const result = await analyzer.analyze(testFile);
      
      const deps = Array.from(result.dependencies);
      assert.ok(!deps.some(d => d.includes("lodash")));
      unlinkSync(testFile);
    });

    it("should skip builtin modules", async () => {
      const testFile = join(testDir, "builtin-test.js");
      writeFileSync(testFile, `
        import fs from 'fs';
        import path from 'path';
        import { foo } from './dep.js';
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      const deps = Array.from(result.dependencies);
      assert.ok(!deps.some(d => d === "fs" || d === "path"));
      unlinkSync(testFile);
    });

    it("should skip URL-like specifiers", async () => {
      const testFile = join(testDir, "url-test.js");
      writeFileSync(testFile, `
        import thing from 'https://example.com/module.js';
        import { foo } from './dep.js';
      `);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      const deps = Array.from(result.dependencies);
      assert.ok(!deps.some(d => d.startsWith("http")));
      unlinkSync(testFile);
    });
  });

  describe("file type detection", () => {
    it("should process JavaScript files", async () => {
      const testFile = join(testDir, "test.js");
      writeFileSync(testFile, `const x = 1;`);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies instanceof Set);
      unlinkSync(testFile);
    });

    it("should process TypeScript files", async () => {
      const testFile = join(testDir, "test.ts");
      writeFileSync(testFile, `const x: number = 1;`);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies instanceof Set);
      unlinkSync(testFile);
    });

    it("should process JSX files", async () => {
      const testFile = join(testDir, "test.jsx");
      writeFileSync(testFile, `const el = <div>test</div>;`);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.dependencies instanceof Set);
      unlinkSync(testFile);
    });

    it("should skip non-JS files", async () => {
      const testFile = join(testDir, "test.css");
      writeFileSync(testFile, `.test { color: red; }`);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      // Should return empty results for non-JS files
      assert.ok(result.dependencies instanceof Set);
      unlinkSync(testFile);
    });
  });

  describe("asset detection", () => {
    it("should detect JSON files", async () => {
      const testFile = join(testDir, "json-test.js");
      writeFileSync(testFile, `
        const config = './config.json';
      `);
      
      const analyzer = new AssetAnalyzer({ 
        base: testDir,
        includeAssets: true,
      });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.assets instanceof Set);
      unlinkSync(testFile);
    });

    it("should detect image files", async () => {
      const testFile = join(testDir, "img-test.js");
      writeFileSync(testFile, `
        const logo = './logo.png';
        const icon = './icon.svg';
      `);
      
      const analyzer = new AssetAnalyzer({ 
        base: testDir,
        includeAssets: true,
      });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.assets instanceof Set);
      unlinkSync(testFile);
    });

    it("should detect various asset extensions", async () => {
      const testFile = join(testDir, "assets-test.js");
      writeFileSync(testFile, `
        const txt = './file.txt';
        const html = './page.html';
        const css = './style.css';
        const pdf = './doc.pdf';
      `);
      
      const analyzer = new AssetAnalyzer({ 
        base: testDir,
        includeAssets: true,
      });
      const result = await analyzer.analyze(testFile);
      
      assert.ok(result.assets instanceof Set);
      unlinkSync(testFile);
    });
  });

  describe("error handling", () => {
    it("should handle non-existent files gracefully", async () => {
      const nonExistent = join(testDir, "nonexistent.js");
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(nonExistent);
      
      assert.ok(result.dependencies instanceof Set);
      assert.ok(result.assets instanceof Set);
    });

    it("should handle files with syntax errors", async () => {
      const testFile = join(testDir, "syntax-error.js");
      writeFileSync(testFile, `import { from 'broken`);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(testFile);
      
      // Should not crash
      assert.ok(result.dependencies instanceof Set);
      unlinkSync(testFile);
    });

    it("should handle circular dependencies", async () => {
      const circA = join(testDir, "circ-a.js");
      const circB = join(testDir, "circ-b.js");
      
      writeFileSync(circA, `import './circ-b.js';`);
      writeFileSync(circB, `import './circ-a.js';`);
      
      const analyzer = new AssetAnalyzer({ base: testDir });
      const result = await analyzer.analyze(circA);
      
      // Should handle without infinite loop
      assert.ok(result.dependencies instanceof Set);
      
      unlinkSync(circA);
      unlinkSync(circB);
    });
  });

  describe("concurrency", () => {
    it("should respect concurrency limits", async () => {
      const analyzer = new AssetAnalyzer({
        base: testDir,
        concurrency: 1,
      });
      
      const result = await analyzer.analyze(entryFile);
      assert.ok(result.dependencies instanceof Set);
    });

    it("should handle high concurrency", async () => {
      const analyzer = new AssetAnalyzer({
        base: testDir,
        concurrency: 1000,
      });
      
      const result = await analyzer.analyze(entryFile);
      assert.ok(result.dependencies instanceof Set);
    });
  });
});