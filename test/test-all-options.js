#!/usr/bin/env node

/**
 * Comprehensive test script for trimpack CLI
 * Tests all options to ensure they work correctly
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";

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

// Setup test files
function setup() {
  printInfo("Setting up test environment...");

  // Simple test file
  writeFileSync(
    "test-simple.js",
    `import fs from 'fs';
import path from 'path';
const data = fs.readFileSync('./package.json', 'utf8');
console.log('test');`,
  );

  // Test file with external dependency
  writeFileSync(
    "test-with-chalk.js",
    `import chalk from 'chalk';
import fs from 'fs';
console.log(chalk.blue('hello'));
const data = fs.readFileSync('./package.json', 'utf8');`,
  );

  // Config file
  writeFileSync(
    "test-config.json",
    JSON.stringify(
      {
        output: "from-config.json",
        verbose: false,
        minimalOutput: false,
      },
      null,
      2,
    ),
  );
}

// Cleanup
function cleanup() {
  const files = [
    "test-simple.js",
    "test-with-chalk.js",
    "test-config.json",
    "from-config.json",
    "output-*.json",
    "test-*.json",
    "merge-*.json",
    "deps-*.json",
  ];

  files.forEach((pattern) => {
    try {
      if (pattern.includes("*")) {
        // Handle glob patterns manually
        const prefix = pattern.split("*")[0];
        const suffix = pattern.split("*")[1] || "";
        execSync(`rm -f ${prefix}*${suffix}`, { stdio: "ignore" });
      } else if (existsSync(pattern)) {
        unlinkSync(pattern);
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}

// Test runner
function runCommand(cmd) {
  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
    };
  }
}

// Tests
function testHelp() {
  printTest("--help flag");
  const result = runCommand("node dist/cli.js --help");
  if (result.success && result.output.includes("USAGE")) {
    printPass("--help works");
  } else {
    printFail("--help failed", result.output);
  }
}

function testVersion() {
  printTest("--version flag");
  const result = runCommand("node dist/cli.js --version");
  if (result.success && result.output.includes("trimpack")) {
    printPass("--version works");
  } else {
    printFail("--version failed", result.output);
  }
}

function testOutput() {
  printTest("--output flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js --output test-output.json 2>&1",
  );
  if (existsSync("test-output.json")) {
    const content = JSON.parse(readFileSync("test-output.json", "utf8"));
    if (content.name || content.dependencies !== undefined) {
      printPass("--output creates correct file");
    } else {
      printFail("--output created invalid JSON");
    }
  } else {
    printFail("--output failed to create file", result.output);
  }
}

function testShortOutput() {
  printTest("-o short flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js -o test-short.json 2>&1",
  );
  if (existsSync("test-short.json")) {
    printPass("-o short flag works");
  } else {
    printFail("-o failed", result.output);
  }
}

function testJson() {
  printTest("--json flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js --json 2>/dev/null",
  );
  try {
    const json = JSON.parse(result.output);
    if (json.name || json.dependencies !== undefined) {
      printPass("--json outputs valid JSON to stdout");
    } else {
      printFail("--json output invalid");
    }
  } catch (e) {
    printFail("--json failed to output valid JSON", e.message);
  }
}

function testMinimal() {
  printTest("--minimal flag");
  runCommand(
    "node dist/cli.js test-simple.js --minimal -o deps-minimal.json 2>&1",
  );
  if (existsSync("deps-minimal.json")) {
    const content = JSON.parse(readFileSync("deps-minimal.json", "utf8"));
    // Minimal should only have dependencies
    const keys = Object.keys(content);
    if (keys.length === 1 && keys[0] === "dependencies") {
      printPass("--minimal creates minimal output (only dependencies)");
    } else {
      printFail(
        "--minimal output not minimal enough",
        `Keys: ${keys.join(", ")}`,
      );
    }
  } else {
    printFail("--minimal failed to create file");
  }
}

function testVerbose() {
  printTest("--verbose flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js --verbose -o test-verbose.json 2>&1",
  );
  if (result.output.includes("[INFO]") || result.output.includes("Analyzing")) {
    printPass("--verbose shows detailed output");
  } else {
    printFail("--verbose didnt show verbose output");
  }
}

function testConfig() {
  printTest("--config flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js --config test-config.json 2>&1",
  );
  if (existsSync("from-config.json")) {
    printPass("--config loads configuration from file");
  } else {
    printFail("--config failed to use config file", result.output);
  }
}

function testMerge() {
  printTest("--merge flag");
  // Create a base file
  writeFileSync(
    "merge-base.json",
    JSON.stringify(
      {
        name: "merge-test",
        version: "3.0.0",
        description: "test merge",
        scripts: { test: "echo test" },
      },
      null,
      2,
    ),
  );

  runCommand("node dist/cli.js test-simple.js --merge -o merge-base.json 2>&1");
  if (existsSync("merge-base.json")) {
    const content = JSON.parse(readFileSync("merge-base.json", "utf8"));
    if (
      content.name === "merge-test" &&
      content.scripts &&
      content.dependencies !== undefined
    ) {
      printPass("--merge preserves existing fields and adds dependencies");
    } else {
      printFail("--merge didnt preserve fields correctly");
    }
  } else {
    printFail("--merge failed");
  }
}

function testPreserveFields() {
  printTest("--preserve-fields flag");
  runCommand(
    "node dist/cli.js test-simple.js --preserve-fields scripts --preserve-fields keywords -o test-preserve.json 2>&1",
  );
  if (existsSync("test-preserve.json")) {
    printPass("--preserve-fields works");
  } else {
    printFail("--preserve-fields failed");
  }
}

function testExternal() {
  printTest("--external flag");
  const result = runCommand(
    "node dist/cli.js test-with-chalk.js --external chalk -o test-external.json 2>&1",
  );
  if (existsSync("test-external.json")) {
    const content = readFileSync("test-external.json", "utf8");
    if (!content.includes('"chalk"')) {
      printPass("--external excludes specified dependencies");
    } else {
      printFail("--external didnt exclude chalk");
    }
  } else {
    printFail("--external command failed", result.output);
  }
}

function testIncludeDev() {
  printTest("--include-dev flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js --include-dev -o test-dev.json 2>&1",
  );
  if (result.success || existsSync("test-dev.json")) {
    printPass("--include-dev executes successfully");
  } else {
    printFail("--include-dev failed");
  }
}

function testIncludePeer() {
  printTest("--include-peer flag");
  const result = runCommand(
    "node dist/cli.js test-simple.js --include-peer -o test-peer.json 2>&1",
  );
  if (result.success || existsSync("test-peer.json")) {
    printPass("--include-peer executes successfully");
  } else {
    printFail("--include-peer failed");
  }
}

function testCombinedFlags() {
  printTest("Combined flags (--verbose --minimal)");
  const result = runCommand(
    "node dist/cli.js test-simple.js --verbose --minimal -o test-combo.json 2>&1",
  );
  if (existsSync("test-combo.json")) {
    const content = JSON.parse(readFileSync("test-combo.json", "utf8"));
    if (Object.keys(content).length === 1 && result.output.includes("[INFO]")) {
      printPass("Multiple flags work together correctly");
    } else {
      printFail("Combined flags interaction issue");
    }
  } else {
    printFail("Combined flags failed");
  }
}

function testJsonSuppressesVerbose() {
  printTest("--json suppresses verbose output");
  const result = runCommand(
    "node dist/cli.js test-simple.js --json --verbose 2>&1",
  );
  try {
    const json = JSON.parse(result.output);
    // Should be valid JSON without log messages
    if (json && !result.output.includes("[INFO]")) {
      printPass("--json correctly suppresses verbose logs");
    } else {
      printFail("--json didnt suppress logs");
    }
  } catch (e) {
    printFail("--json with --verbose failed", e.message);
  }
}

function testErrorHandling() {
  printTest("Error handling for non-existent file");
  const result = runCommand(
    "node dist/cli.js non-existent-file.js -o error-test.json 2>&1",
  );
  if (!result.success && result.output.includes("not found")) {
    printPass("Error handling works correctly");
  } else {
    printFail("Should error for non-existent file");
  }
}

// Main test runner
async function main() {
  console.log("");
  printInfo("Starting comprehensive CLI tests...");
  console.log("");

  setup();

  // Run all tests
  testHelp();
  testVersion();
  testOutput();
  testShortOutput();
  testJson();
  testMinimal();
  testVerbose();
  testConfig();
  testMerge();
  testPreserveFields();
  testExternal();
  testIncludeDev();
  testIncludePeer();
  testCombinedFlags();
  testJsonSuppressesVerbose();
  testErrorHandling();

  // Cleanup
  printInfo("Cleaning up...");
  cleanup();

  // Summary
  console.log("");
  console.log("================================");
  console.log("Test Summary");
  console.log("================================");
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log("================================");

  if (failedTests === 0) {
    console.log(`${colors.green}✨ All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}Some tests failed.${colors.reset}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test script error:", error);
  cleanup();
  process.exit(1);
});
