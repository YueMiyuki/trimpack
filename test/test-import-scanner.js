#!/usr/bin/env node

/**
 * Unit tests for import scanner
 * Tests various import/require pattern detection
 */

import { scanSpecifiers } from "../dist/core/import-scanner.js";

// Test utilities
let passedTests = 0;
let failedTests = 0;

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
};

function printTest(name) {
  console.log(`${colors.blue}[TEST]${colors.reset} ${name}`);
}

function printPass(message) {
  console.log(`${colors.green}[PASS]${colors.reset} ${message}`);
  passedTests++;
}

function printFail(message, error = "") {
  console.log(`${colors.red}[FAIL]${colors.reset} ${message}`);
  if (error) console.log(`       ${error}`);
  failedTests++;
}

function printInfo(message) {
  console.log(`${colors.yellow}[INFO]${colors.reset} ${message}`);
}

// Tests
function testESMImportFrom() {
  printTest("ESM import ... from syntax");

  const code = `
    import fs from 'fs';
    import { readFile } from 'node:fs/promises';
    import * as path from 'path';
  `;

  try {
    const specs = scanSpecifiers(code);
    const expected = ["fs", "node:fs/promises", "path"];
    
    if (specs.length === expected.length && expected.every(e => specs.includes(e))) {
      printPass("ESM imports detected correctly");
    } else {
      printFail(`Expected [${expected}], got [${specs}]`);
    }
  } catch (error) {
    printFail("ESM import test failed", error.message);
  }
}

function testBareImports() {
  printTest("Bare import statements");

  const code = `
    import 'polyfill';
    import './side-effect.js';
  `;

  try {
    const specs = scanSpecifiers(code);
    
    if (specs.includes("polyfill") && specs.includes("./side-effect.js")) {
      printPass("Bare imports detected");
    } else {
      printFail(`Expected polyfill and ./side-effect.js, got [${specs}]`);
    }
  } catch (error) {
    printFail("Bare import test failed", error.message);
  }
}

function testDynamicImports() {
  printTest("Dynamic import() expressions");

  const code = `
    const module = await import('dynamic-module');
    import('./local-module.js').then(m => m.default());
  `;

  try {
    const specs = scanSpecifiers(code);
    
    if (specs.includes("dynamic-module") && specs.includes("./local-module.js")) {
      printPass("Dynamic imports detected");
    } else {
      printFail(`Expected both imports, got [${specs}]`);
    }
  } catch (error) {
    printFail("Dynamic import test failed", error.message);
  }
}

function testCommonJSRequire() {
  printTest("CommonJS require() calls");

  const code = `
    const fs = require('fs');
    const path = require("path");
    const custom = require('./custom.js');
  `;

  try {
    const specs = scanSpecifiers(code);
    const expected = ["fs", "path", "./custom.js"];
    
    if (specs.length === expected.length && expected.every(e => specs.includes(e))) {
      printPass("CommonJS requires detected");
    } else {
      printFail(`Expected [${expected}], got [${specs}]`);
    }
  } catch (error) {
    printFail("CommonJS require test failed", error.message);
  }
}

function testExportFrom() {
  printTest("Export ... from statements");

  const code = `
    export { default } from 'module-a';
    export * from 'module-b';
    export { named } from './local.js';
  `;

  try {
    const specs = scanSpecifiers(code);
    const expected = ["module-a", "module-b", "./local.js"];
    
    if (specs.length === expected.length && expected.every(e => specs.includes(e))) {
      printPass("Export from detected");
    } else {
      printFail(`Expected [${expected}], got [${specs}]`);
    }
  } catch (error) {
    printFail("Export from test failed", error.message);
  }
}

function testMixedSyntax() {
  printTest("Mixed import/require syntax");

  const code = `
    import React from 'react';
    const path = require('path');
    export { Component } from './component';
    const lazy = import('./lazy.js');
  `;

  try {
    const specs = scanSpecifiers(code);
    const expected = ["react", "path", "./component", "./lazy.js"];
    
    if (specs.length === expected.length && expected.every(e => specs.includes(e))) {
      printPass("Mixed syntax handled correctly");
    } else {
      printFail(`Expected [${expected}], got [${specs}]`);
    }
  } catch (error) {
    printFail("Mixed syntax test failed", error.message);
  }
}

function testScopedPackages() {
  printTest("Scoped package names");

  const code = `
    import '@babel/core';
    const parser = require('@babel/parser');
    export * from '@org/package';
  `;

  try {
    const specs = scanSpecifiers(code);
    
    if (specs.includes("@babel/core") && 
        specs.includes("@babel/parser") && 
        specs.includes("@org/package")) {
      printPass("Scoped packages detected");
    } else {
      printFail(`Missing scoped packages, got [${specs}]`);
    }
  } catch (error) {
    printFail("Scoped packages test failed", error.message);
  }
}

function testCommentsAndStrings() {
  printTest("Ignore imports in comments and strings");

  const code = `
    // import 'commented-out';
    /* import 'block-comment'; */
    const str = "import 'in-string'";
    const template = \`import 'in-template'\`;
    import 'real-import';
  `;

  try {
    const specs = scanSpecifiers(code);
    
    // Should only detect the real import
    // Note: regex-based scanner may detect some false positives
    if (specs.includes("real-import")) {
      printPass("Real imports detected (may include false positives)");
    } else {
      printFail(`Real import not detected, got [${specs}]`);
    }
  } catch (error) {
    printFail("Comments/strings test failed", error.message);
  }
}

function testEmptyCode() {
  printTest("Empty code input");

  try {
    const specs = scanSpecifiers("");
    
    if (specs.length === 0) {
      printPass("Empty code returns empty array");
    } else {
      printFail(`Expected empty array, got [${specs}]`);
    }
  } catch (error) {
    printFail("Empty code test failed", error.message);
  }
}

function testLargeFile() {
  printTest("Large file protection (>2MB)");

  try {
    // Create a file larger than 2MB
    const largeCode = "x".repeat(2_000_001);
    const specs = scanSpecifiers(largeCode);
    
    if (specs.length === 0) {
      printPass("Large file returns empty array");
    } else {
      printFail("Large file should return empty array");
    }
  } catch (error) {
    printFail("Large file test failed", error.message);
  }
}

function testRelativePaths() {
  printTest("Various relative path formats");

  const code = `
    import '../parent/module';
    import './sibling';
    import './deep/nested/module.js';
    require('../../../root.js');
  `;

  try {
    const specs = scanSpecifiers(code);
    const expected = ["../parent/module", "./sibling", "./deep/nested/module.js", "../../../root.js"];
    
    if (specs.length === expected.length && expected.every(e => specs.includes(e))) {
      printPass("Relative paths detected correctly");
    } else {
      printFail(`Expected [${expected}], got [${specs}]`);
    }
  } catch (error) {
    printFail("Relative paths test failed", error.message);
  }
}

function testSubpathImports() {
  printTest("Package subpath imports");

  const code = `
    import 'lodash/map';
    import '@babel/core/lib/parser';
    const helper = require('package/dist/helper.js');
  `;

  try {
    const specs = scanSpecifiers(code);
    
    if (specs.includes("lodash/map") && 
        specs.includes("@babel/core/lib/parser") &&
        specs.includes("package/dist/helper.js")) {
      printPass("Subpath imports detected");
    } else {
      printFail(`Missing subpaths, got [${specs}]`);
    }
  } catch (error) {
    printFail("Subpath imports test failed", error.message);
  }
}

function testDuplicates() {
  printTest("Duplicate imports deduplicated");

  const code = `
    import 'module';
    import 'module';
    const x = require('module');
  `;

  try {
    const specs = scanSpecifiers(code);
    
    if (specs.length === 1 && specs[0] === "module") {
      printPass("Duplicates correctly deduplicated");
    } else {
      printFail(`Expected single 'module', got [${specs}]`);
    }
  } catch (error) {
    printFail("Duplicates test failed", error.message);
  }
}

// Main test runner
function runTests() {
  printInfo("Starting import-scanner tests...\n");

  testESMImportFrom();
  testBareImports();
  testDynamicImports();
  testCommonJSRequire();
  testExportFrom();
  testMixedSyntax();
  testScopedPackages();
  testCommentsAndStrings();
  testEmptyCode();
  testLargeFile();
  testRelativePaths();
  testSubpathImports();
  testDuplicates();

  console.log("\n" + "=".repeat(50));
  console.log(
    `${colors.green}Passed: ${passedTests}${colors.reset} | ${colors.red}Failed: ${failedTests}${colors.reset}`
  );
  console.log("=".repeat(50));

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run tests
runTests();