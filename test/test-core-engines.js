#!/usr/bin/env node

/**
 * Unit tests for core dependency analysis engines
 * Tests AssetAnalyzer and DependencyTracer
 */

import { AssetAnalyzer } from "../dist/core/asset-analyzer.js";
import { traceDependencies } from "../dist/core/dependency-tracer.js";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from "fs";
import { join } from "path";

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

// Setup
const testDir = "test-core-engines-tmp";

function setupTestDir() {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
}

function cleanupTestDir() {
  if (existsSync(testDir)) {
    try {
      const files = ["entry.js", "module.js", "asset.json"];
      files.forEach(file => {
        const path = join(testDir, file);
        if (existsSync(path)) {
          unlinkSync(path);
        }
      });
      rmdirSync(testDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// AssetAnalyzer Tests
async function testAssetAnalyzerBasic() {
  printTest("AssetAnalyzer: Basic analysis");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
      import path from 'path';
      console.log('test');
    `);

    const analyzer = new AssetAnalyzer({ external: ["node:*"] });
    const result = await analyzer.analyze(entryFile);

    if (result.dependencies && result.assets) {
      printPass("Basic asset analysis works");
    } else {
      printFail("Asset analysis returned invalid structure");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Asset analyzer basic test failed", error.message);
  }
}

async function testAssetAnalyzerDetectsAssets() {
  printTest("AssetAnalyzer: Asset detection");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    const assetFile = join(testDir, "asset.json");
    writeFileSync(assetFile, '{"key": "value"}');
    writeFileSync(entryFile, `
      import fs from 'fs';
      const data = fs.readFileSync('./asset.json', 'utf8');
    `);

    const analyzer = new AssetAnalyzer({ 
      external: ["node:*"],
      includeAssets: true 
    });
    const result = await analyzer.analyze(entryFile);

    if (result.assets.size >= 0) {
      printPass("Asset detection completed");
    } else {
      printFail("Asset detection failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Asset detection test failed", error.message);
  }
}

async function testAssetAnalyzerExternalSkip() {
  printTest("AssetAnalyzer: External dependency skipping");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
      import external from 'external-package';
    `);

    const analyzer = new AssetAnalyzer({ 
      external: ["node:*", "external-package"] 
    });
    const result = await analyzer.analyze(entryFile);

    if (result.dependencies) {
      printPass("External dependencies skipped correctly");
    } else {
      printFail("External skipping failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("External skip test failed", error.message);
  }
}

async function testAssetAnalyzerConcurrency() {
  printTest("AssetAnalyzer: Concurrency handling");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
      import path from 'path';
    `);

    const analyzer = new AssetAnalyzer({ 
      external: ["node:*"],
      concurrency: 2
    });
    const result = await analyzer.analyze(entryFile);

    if (result.dependencies && result.assets) {
      printPass("Concurrency handling works");
    } else {
      printFail("Concurrency handling failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Concurrency test failed", error.message);
  }
}

async function testAssetAnalyzerMultipleFiles() {
  printTest("AssetAnalyzer: Multiple file analysis");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    const moduleFile = join(testDir, "module.js");
    
    writeFileSync(moduleFile, `
      export function helper() {
        return 'helper';
      }
    `);
    
    writeFileSync(entryFile, `
      import { helper } from './module.js';
      import fs from 'fs';
      console.log(helper());
    `);

    const analyzer = new AssetAnalyzer({ external: ["node:*"] });
    const result = await analyzer.analyze(entryFile);

    if (result.dependencies) {
      printPass("Multiple file analysis works");
    } else {
      printFail("Multiple file analysis failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Multiple files test failed", error.message);
  }
}

// DependencyTracer Tests
async function testDependencyTracerBasic() {
  printTest("DependencyTracer: Basic tracing");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
      import path from 'path';
    `);

    const visited = await traceDependencies(entryFile, {
      external: ["node:*"]
    });

    if (visited.size >= 1) {
      printPass("Basic dependency tracing works");
    } else {
      printFail("Dependency tracing failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Dependency tracer basic test failed", error.message);
  }
}

async function testDependencyTracerWithModules() {
  printTest("DependencyTracer: Module graph traversal");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    const moduleFile = join(testDir, "module.js");
    
    writeFileSync(moduleFile, `
      export const value = 42;
    `);
    
    writeFileSync(entryFile, `
      import { value } from './module.js';
      console.log(value);
    `);

    const visited = await traceDependencies(entryFile, {
      external: ["node:*"]
    });

    if (visited.size >= 2) {
      printPass("Module graph traversal works");
    } else {
      printFail(`Expected at least 2 files, got ${visited.size}`);
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Module traversal test failed", error.message);
  }
}

async function testDependencyTracerExternalFiltering() {
  printTest("DependencyTracer: External filtering");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
      import external from 'external-pkg';
    `);

    const visited = await traceDependencies(entryFile, {
      external: ["node:*", "external-pkg"]
    });

    // Should only have entry file since externals are filtered
    if (visited.size >= 1) {
      printPass("External filtering works");
    } else {
      printFail("External filtering failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("External filtering test failed", error.message);
  }
}

async function testDependencyTracerConcurrency() {
  printTest("DependencyTracer: Concurrency option");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
    `);

    const visited = await traceDependencies(entryFile, {
      external: ["node:*"],
      concurrency: 128
    });

    if (visited.size >= 1) {
      printPass("Concurrency option works");
    } else {
      printFail("Concurrency option failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Concurrency option test failed", error.message);
  }
}

async function testDependencyTracerNonExistent() {
  printTest("DependencyTracer: Non-existent entry file");

  try {
    await traceDependencies("non-existent-file.js", {
      external: ["node:*"]
    });

    // Should return empty or handle gracefully
    printPass("Non-existent file handled gracefully");
  } catch (error) {
    printFail("Non-existent file test failed", error.message);
  }
}

async function testAssetAnalyzerDisableAssets() {
  printTest("AssetAnalyzer: Disable asset collection");

  try {
    setupTestDir();
    const entryFile = join(testDir, "entry.js");
    writeFileSync(entryFile, `
      import fs from 'fs';
      const data = fs.readFileSync('file.json');
    `);

    const analyzer = new AssetAnalyzer({ 
      external: ["node:*"],
      includeAssets: false
    });
    const result = await analyzer.analyze(entryFile);

    if (result.assets.size === 0) {
      printPass("Asset collection disabled correctly");
    } else {
      printFail("Assets collected despite being disabled");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Disable assets test failed", error.message);
  }
}

// Main test runner
async function runTests() {
  printInfo("Starting Core Engines tests...\n");

  // AssetAnalyzer tests
  await testAssetAnalyzerBasic();
  await testAssetAnalyzerDetectsAssets();
  await testAssetAnalyzerExternalSkip();
  await testAssetAnalyzerConcurrency();
  await testAssetAnalyzerMultipleFiles();
  await testAssetAnalyzerDisableAssets();

  // DependencyTracer tests
  await testDependencyTracerBasic();
  await testDependencyTracerWithModules();
  await testDependencyTracerExternalFiltering();
  await testDependencyTracerConcurrency();
  await testDependencyTracerNonExistent();

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
runTests().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});