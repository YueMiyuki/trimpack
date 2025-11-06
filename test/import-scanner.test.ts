import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanSpecifiers } from "../src/core/import-scanner.js";

describe("scanSpecifiers", () => {
  describe("ESM imports", () => {
    it("should extract named imports", () => {
      const code = `import { foo, bar } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract default imports", () => {
      const code = `import foo from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract namespace imports", () => {
      const code = `import * as foo from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract side-effect imports", () => {
      const code = `import 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract multiple imports", () => {
      const code = `
        import foo from 'module1';
        import { bar } from 'module2';
        import * as baz from 'module3';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2', 'module3']);
    });

    it("should handle imports with single quotes", () => {
      const code = `import foo from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should handle imports with double quotes", () => {
      const code = `import foo from "module-name";`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract scoped package imports", () => {
      const code = `import foo from '@scope/package';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['@scope/package']);
    });

    it("should extract relative path imports", () => {
      const code = `import foo from './local-module';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['./local-module']);
    });

    it("should extract parent directory imports", () => {
      const code = `import foo from '../parent-module';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['../parent-module']);
    });
  });

  describe("dynamic imports", () => {
    it("should extract dynamic import with string literal", () => {
      const code = `const module = await import('dynamic-module');`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['dynamic-module']);
    });

    it("should extract multiple dynamic imports", () => {
      const code = `
        const m1 = import('module1');
        const m2 = import('module2');
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2']);
    });

    it("should handle dynamic imports with double quotes", () => {
      const code = `import("module-name")`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should handle dynamic imports in expressions", () => {
      const code = `const module = condition ? import('module1') : import('module2');`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2']);
    });
  });

  describe("export from statements", () => {
    it("should extract export from statements", () => {
      const code = `export { foo } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract export all from statements", () => {
      const code = `export * from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract named export from statements", () => {
      const code = `export { foo as bar } from 'module-name';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract multiple export from statements", () => {
      const code = `
        export { foo } from 'module1';
        export * from 'module2';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2']);
    });
  });

  describe("CommonJS requires", () => {
    it("should extract require with single quotes", () => {
      const code = `const module = require('module-name');`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract require with double quotes", () => {
      const code = `const module = require("module-name");`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract multiple requires", () => {
      const code = `
        const m1 = require('module1');
        const m2 = require('module2');
        const m3 = require('module3');
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2', 'module3']);
    });

    it("should extract require in conditional", () => {
      const code = `const module = condition ? require('module1') : require('module2');`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2']);
    });

    it("should handle require with extra whitespace", () => {
      const code = `const module = require(  'module-name'  );`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module-name']);
    });

    it("should extract scoped packages in require", () => {
      const code = `const module = require('@scope/package');`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['@scope/package']);
    });
  });

  describe("mixed module systems", () => {
    it("should extract both ESM and CommonJS", () => {
      const code = `
        import foo from 'esm-module';
        const bar = require('cjs-module');
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['esm-module', 'cjs-module']);
    });

    it("should extract all module types in complex code", () => {
      const code = `
        import { a } from 'module1';
        export { b } from 'module2';
        const c = require('module3');
        const d = await import('module4');
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2', 'module3', 'module4']);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      const specs = scanSpecifiers('');
      assert.deepEqual(specs, []);
    });

    it("should handle code with no imports", () => {
      const code = `
        const x = 5;
        function foo() { return x; }
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, []);
    });

    it("should deduplicate repeated imports", () => {
      const code = `
        import foo from 'same-module';
        import bar from 'same-module';
        const baz = require('same-module');
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['same-module']);
    });

    it("should handle imports in comments", () => {
      const code = `
        // import foo from 'commented';
        /* const bar = require('commented'); */
        import real from 'actual-module';
      `;
      const specs = scanSpecifiers(code);
      // Note: Our scanner doesn't strip comments, so it may pick these up
      // This documents current behavior
      assert.ok(specs.includes('actual-module'));
    });

    it("should handle imports in strings", () => {
      const code = `
        const str = "import foo from 'string-module'";
        import real from 'actual-module';
      `;
      const specs = scanSpecifiers(code);
      assert.ok(specs.includes('actual-module'));
    });

    it("should return empty array for very large files", () => {
      const largeCode = 'x'.repeat(3_000_000);
      const specs = scanSpecifiers(largeCode);
      assert.deepEqual(specs, []);
    });

    it("should handle newlines in module specifiers", () => {
      // Newlines in specifiers should not match
      const code = `import foo from 'module\nname';`;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, []);
    });

    it("should handle special characters in module names", () => {
      const code = `
        import foo from 'module-name_123';
        import bar from '@scope/package.name';
        import baz from './path/to/file.js';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, [
        'module-name_123',
        '@scope/package.name',
        './path/to/file.js'
      ]);
    });

    it("should handle imports with type annotations (TypeScript)", () => {
      const code = `
        import type { Foo } from 'module1';
        import { type Bar } from 'module2';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['module1', 'module2']);
    });

    it("should handle multi-line import statements", () => {
      const code = `
        import {
          foo,
          bar,
          baz
        } from 'multi-line-module';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['multi-line-module']);
    });
  });

  describe("real-world patterns", () => {
    it("should handle typical React component", () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import PropTypes from 'prop-types';
        import './styles.css';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['react', 'prop-types', './styles.css']);
    });

    it("should handle Node.js server code", () => {
      const code = `
        const express = require('express');
        const bodyParser = require('body-parser');
        const routes = require('./routes');
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['express', 'body-parser', './routes']);
    });

    it("should handle mixed ESM/CJS (bundler target)", () => {
      const code = `
        import path from 'path';
        const fs = require('fs');
        export { something } from './utils';
      `;
      const specs = scanSpecifiers(code);
      assert.deepEqual(specs, ['path', 'fs', './utils']);
    });
  });
});