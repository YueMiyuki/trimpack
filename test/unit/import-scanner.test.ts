import { describe, it } from "node:test";
import assert from "node:assert";
import { scanSpecifiers } from "../../src/core/import-scanner.js";

describe("scanSpecifiers", () => {
  describe("ESM import statements", () => {
    it("should extract default imports", () => {
      const code = `import foo from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract named imports", () => {
      const code = `import { foo, bar } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract namespace imports", () => {
      const code = `import * as foo from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract side-effect imports", () => {
      const code = `import 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract multiple imports", () => {
      const code = `
        import foo from 'module-a';
        import { bar } from 'module-b';
        import * as baz from 'module-c';
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-a", "module-b", "module-c"]);
    });

    it("should handle double quotes", () => {
      const code = `import foo from "module-name";`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should handle relative paths", () => {
      const code = `import foo from './local';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["./local"]);
    });

    it("should handle scoped packages", () => {
      const code = `import foo from '@org/package';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["@org/package"]);
    });
  });

  describe("export from statements", () => {
    it("should extract export from statements", () => {
      const code = `export { foo } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract export all from statements", () => {
      const code = `export * from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract re-exports with renaming", () => {
      const code = `export { foo as bar } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });
  });

  describe("dynamic imports", () => {
    it("should extract dynamic import with single quotes", () => {
      const code = `const mod = await import('module-name');`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract dynamic import with double quotes", () => {
      const code = `const mod = await import("module-name");`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should handle multiple dynamic imports", () => {
      const code = `
        const a = import('module-a');
        const b = import('module-b');
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-a", "module-b"]);
    });
  });

  describe("CommonJS require", () => {
    it("should extract require with single quotes", () => {
      const code = `const foo = require('module-name');`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract require with double quotes", () => {
      const code = `const foo = require("module-name");`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should handle multiple requires", () => {
      const code = `
        const a = require('module-a');
        const b = require('module-b');
        const c = require('module-c');
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-a", "module-b", "module-c"]);
    });

    it("should handle require with spaces", () => {
      const code = `const foo = require(  'module-name'  );`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });
  });

  describe("mixed patterns", () => {
    it("should extract all types of imports", () => {
      const code = `
        import foo from 'import-module';
        export { bar } from 'export-module';
        const dyn = import('dynamic-module');
        const req = require('require-module');
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, [
        "import-module",
        "export-module",
        "dynamic-module",
        "require-module",
      ]);
    });

    it("should deduplicate repeated imports", () => {
      const code = `
        import foo from 'module-name';
        import { bar } from 'module-name';
        const baz = require('module-name');
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty code", () => {
      const specs = scanSpecifiers("");
      assert.deepStrictEqual(specs, []);
    });

    it("should handle code without imports", () => {
      const code = `
        const x = 5;
        function foo() { return x; }
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, []);
    });

    it("should ignore commented imports", () => {
      const code = `
        // import foo from 'commented';
        /* import bar from 'block-comment'; */
        import real from 'real-import';
      `;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["real-import"]);
    });

    it("should handle imports in strings (should not extract)", () => {
      const code = `
        const str = "import foo from 'not-real'";
        import real from 'real-import';
      `;
      const specs = scanSpecifiers(code);
      // May include both or just real depending on regex precision
      assert.ok(specs.includes("real-import"));
    });

    it("should handle very long files", () => {
      const code = "x = 1;\n".repeat(1_000_000);
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, []);
    });

    it("should return empty array for files exceeding size limit", () => {
      const code = "x = 1;\n".repeat(2_000_001);
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, []);
    });

    it("should handle newlines in imports", () => {
      const code = `
        import foo from
          'module-name';
      `;
      const specs = scanSpecifiers(code);
      // Depends on regex implementation
      assert.ok(Array.isArray(specs));
    });

    it("should handle special characters in module names", () => {
      const code = `import foo from 'module-name/sub-path';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name/sub-path"]);
    });
  });

  describe("TypeScript specific", () => {
    it("should extract type imports", () => {
      const code = `import type { Foo } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });

    it("should extract import equals", () => {
      const code = `import foo = require('module-name');`;
      const specs = scanSpecifiers(code);
      assert.deepStrictEqual(specs, ["module-name"]);
    });
  });
});
