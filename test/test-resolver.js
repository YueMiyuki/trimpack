#!/usr/bin/env node

/**
 * Unit tests for resolver module
 * Tests module resolution logic
 */

import { isBuiltin } from "../dist/core/resolver.js";

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
function testBuiltinModules() {
  printTest("Builtin module detection");

  try {
    const builtins = ["fs", "path", "http", "crypto", "util"];
    const allDetected = builtins.every(m => isBuiltin(m));
    
    if (allDetected) {
      printPass("Core Node.js modules detected as builtin");
    } else {
      printFail("Some builtin modules not detected");
    }
  } catch (error) {
    printFail("Builtin detection test failed", error.message);
  }
}

function testNodeProtocol() {
  printTest("node: protocol detection");

  try {
    const nodeProtocols = ["node:fs", "node:path", "node:http"];
    const allDetected = nodeProtocols.every(m => isBuiltin(m));
    
    if (allDetected) {
      printPass("node: protocol modules detected as builtin");
    } else {
      printFail("Some node: protocol modules not detected");
    }
  } catch (error) {
    printFail("node: protocol test failed", error.message);
  }
}

function testNonBuiltinModules() {
  printTest("Non-builtin module detection");

  try {
    const nonBuiltins = ["express", "lodash", "react", "./local"];
    const noneDetected = nonBuiltins.every(m => !isBuiltin(m));
    
    if (noneDetected) {
      printPass("Non-builtin modules correctly identified");
    } else {
      printFail("Some non-builtin modules incorrectly detected");
    }
  } catch (error) {
    printFail("Non-builtin detection test failed", error.message);
  }
}

function testScopedPackages() {
  printTest("Scoped packages not detected as builtin");

  try {
    const scoped = ["@babel/core", "@types/node", "@org/package"];
    const noneBuiltin = scoped.every(m => !isBuiltin(m));
    
    if (noneBuiltin) {
      printPass("Scoped packages not detected as builtin");
    } else {
      printFail("Some scoped packages incorrectly detected as builtin");
    }
  } catch (error) {
    printFail("Scoped packages test failed", error.message);
  }
}

function testRelativePaths() {
  printTest("Relative paths not detected as builtin");

  try {
    const relative = ["./module", "../parent", "./deep/nested/path"];
    const noneBuiltin = relative.every(m => !isBuiltin(m));
    
    if (noneBuiltin) {
      printPass("Relative paths not detected as builtin");
    } else {
      printFail("Some relative paths incorrectly detected as builtin");
    }
  } catch (error) {
    printFail("Relative paths test failed", error.message);
  }
}

function testEdgeCases() {
  printTest("Edge cases for builtin detection");

  try {
    // Test empty string
    const emptyNotBuiltin = !isBuiltin("");
    
    // Test modules with similar names
    const similarNotBuiltin = !isBuiltin("filesystem") && !isBuiltin("pathology");
    
    if (emptyNotBuiltin && similarNotBuiltin) {
      printPass("Edge cases handled correctly");
    } else {
      printFail("Edge cases not handled properly");
    }
  } catch (error) {
    printFail("Edge cases test failed", error.message);
  }
}

function testAllNodeBuiltins() {
  printTest("Comprehensive Node.js builtin list");

  try {
    const commonBuiltins = [
      "assert", "buffer", "child_process", "cluster", "console",
      "crypto", "dgram", "dns", "domain", "events", "fs", "http",
      "https", "net", "os", "path", "punycode", "querystring",
      "readline", "repl", "stream", "string_decoder", "timers",
      "tls", "tty", "url", "util", "v8", "vm", "zlib"
    ];
    
    const allDetected = commonBuiltins.every(m => isBuiltin(m));
    
    if (allDetected) {
      printPass("All common Node.js builtins detected");
    } else {
      const missing = commonBuiltins.filter(m => !isBuiltin(m));
      printFail(`Some builtins not detected: ${missing.join(", ")}`);
    }
  } catch (error) {
    printFail("Comprehensive builtin test failed", error.message);
  }
}

function testNodeProtocolVariants() {
  printTest("node: protocol with various modules");

  try {
    const variants = [
      "node:fs/promises",
      "node:stream/web",
      "node:util/types",
      "node:test"
    ];
    
    const allDetected = variants.every(m => isBuiltin(m));
    
    if (allDetected) {
      printPass("node: protocol variants detected");
    } else {
      printFail("Some node: protocol variants not detected");
    }
  } catch (error) {
    printFail("node: protocol variants test failed", error.message);
  }
}

function testCaseSensitivity() {
  printTest("Case sensitivity of builtin detection");

  try {
    // Node.js builtins are lowercase
    const lowercase = isBuiltin("fs");
    const uppercase = isBuiltin("FS");
    const mixedcase = isBuiltin("Fs");
    
    if (lowercase && !uppercase && !mixedcase) {
      printPass("Builtin detection is case-sensitive");
    } else {
      printFail("Case sensitivity not handled correctly");
    }
  } catch (error) {
    printFail("Case sensitivity test failed", error.message);
  }
}

function testSubpathImports() {
  printTest("Module subpath imports");

  try {
    // Subpaths of non-builtin modules
    const subpaths = [
      "lodash/map",
      "express/lib/router",
      "@babel/core/lib/parser"
    ];
    
    const noneBuiltin = subpaths.every(m => !isBuiltin(m));
    
    if (noneBuiltin) {
      printPass("Module subpaths not detected as builtin");
    } else {
      printFail("Some subpaths incorrectly detected as builtin");
    }
  } catch (error) {
    printFail("Subpath imports test failed", error.message);
  }
}

function testNewNodeBuiltins() {
  printTest("Newer Node.js builtin modules");

  try {
    // Test some newer Node.js builtins
    const newer = ["worker_threads", "perf_hooks", "async_hooks"];
    const allDetected = newer.every(m => isBuiltin(m));
    
    if (allDetected) {
      printPass("Newer Node.js builtins detected");
    } else {
      const missing = newer.filter(m => !isBuiltin(m));
      printFail(`Some newer builtins not detected: ${missing.join(", ")}`);
    }
  } catch (error) {
    printFail("Newer builtins test failed", error.message);
  }
}

// Main test runner
function runTests() {
  printInfo("Starting Resolver tests...\n");

  testBuiltinModules();
  testNodeProtocol();
  testNonBuiltinModules();
  testScopedPackages();
  testRelativePaths();
  testEdgeCases();
  testAllNodeBuiltins();
  testNodeProtocolVariants();
  testCaseSensitivity();
  testSubpathImports();
  testNewNodeBuiltins();

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