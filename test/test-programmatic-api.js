#!/usr/bin/env node

/**
 * Test script for programmatic API usage
 * Tests DependencyPacker class methods directly
 */

import { DependencyPacker } from "../dist/index.js";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";
import { execSync } from "child_process";

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
function setup() {
  printInfo("Setting up test environment...");

  // Create test entry file
  writeFileSync(
    "test-api-entry.js",
    `import fs from 'fs';
import path from 'path';
console.log('test');`,
  );
}

// Cleanup
function cleanup() {
  const files = [
    "test-api-entry.js",
    "api-test-*.json",
    "programmatic-output.json",
  ];

  files.forEach((pattern) => {
    try {
      if (pattern.includes("*")) {
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

// Tests
async function testBasicProgrammaticUsage() {
  printTest("Basic programmatic API usage");

  try {
    const packer = new DependencyPacker({
      output: "api-test-basic.json",
      verbose: false,
    });

    const result = await packer.pack("test-api-entry.js");

    if (result.dependencies && Array.isArray(result.dependencies)) {
      printPass("Basic API usage works");
    } else {
      printFail("Invalid result structure");
    }
  } catch (error) {
    printFail("Basic API usage failed", error.message);
  }
}

async function testStaticMethod() {
  printTest("Static packEntry method");

  try {
    const result = await DependencyPacker.packEntry("test-api-entry.js", {
      output: "api-test-static.json",
      verbose: false,
    });

    if (
      result &&
      result.dependencies &&
      result.outputFile === "api-test-static.json"
    ) {
      printPass("Static method works correctly");
    } else {
      printFail("Static method returned invalid result");
    }
  } catch (error) {
    printFail("Static method failed", error.message);
  }
}

async function testMinimalOutputProgrammatic() {
  printTest("Programmatic minimal output option");

  try {
    const packer = new DependencyPacker({
      output: "api-test-minimal.json",
      minimalOutput: true,
      verbose: false,
    });

    await packer.pack("test-api-entry.js");
    const content = JSON.parse(readFileSync("api-test-minimal.json", "utf8"));

    const keys = Object.keys(content);
    if (keys.length === 1 && keys[0] === "dependencies") {
      printPass("Minimal output option works programmatically");
    } else {
      printFail("Minimal output incorrect", `Keys: ${keys.join(", ")}`);
    }
  } catch (error) {
    printFail("Minimal output test failed", error.message);
  }
}

async function testJsonOutputProgrammatic() {
  printTest("Programmatic JSON output to stdout");

  try {
    // Capture console.log output
    let capturedOutput = "";
    const originalLog = console.log;
    console.log = (msg) => {
      capturedOutput += msg;
    };

    const packer = new DependencyPacker({
      json: true,
      verbose: false,
    });

    await packer.pack("test-api-entry.js");

    console.log = originalLog;

    const parsed = JSON.parse(capturedOutput);
    if (parsed && (parsed.dependencies !== undefined || parsed.name)) {
      printPass("JSON output works programmatically");
    } else {
      printFail("JSON output invalid");
    }
  } catch (error) {
    printFail("JSON output test failed", error.message);
  }
}

async function testExternalOptionProgrammatic() {
  printTest("Programmatic external dependencies option");

  try {
    // Create file with chalk dependency
    writeFileSync(
      "test-api-chalk.js",
      `import chalk from 'chalk';
import fs from 'fs';
console.log(chalk.blue('test'));`,
    );

    const packer = new DependencyPacker({
      output: "api-test-external.json",
      external: ["chalk", "node:*"],
      verbose: false,
    });

    await packer.pack("test-api-chalk.js");

    const content = readFileSync("api-test-external.json", "utf8");

    if (!content.includes('"chalk"')) {
      printPass("External option works programmatically");
    } else {
      printFail("External option did not exclude chalk");
    }

    unlinkSync("test-api-chalk.js");
  } catch (error) {
    printFail("External option test failed", error.message);
  }
}

async function testMergeOptionProgrammatic() {
  printTest("Programmatic merge option");

  try {
    // Create base file
    writeFileSync(
      "api-test-merge.json",
      JSON.stringify(
        {
          name: "merge-test-api",
          version: "2.0.0",
          scripts: { build: "echo build" },
        },
        null,
        2,
      ),
    );

    const packer = new DependencyPacker({
      output: "api-test-merge.json",
      merge: true,
      verbose: false,
    });

    await packer.pack("test-api-entry.js");

    const merged = JSON.parse(readFileSync("api-test-merge.json", "utf8"));

    if (
      merged.name === "merge-test-api" &&
      merged.version === "2.0.0" &&
      merged.scripts &&
      merged.dependencies !== undefined
    ) {
      printPass("Merge option works programmatically");
    } else {
      printFail("Merge option did not preserve fields");
    }
  } catch (error) {
    printFail("Merge option test failed", error.message);
  }
}

async function testPreserveFieldsProgrammatic() {
  printTest("Programmatic preserveFields option");

  try {
    const packer = new DependencyPacker({
      output: "api-test-preserve.json",
      preserveFields: ["scripts", "keywords"],
      verbose: false,
    });

    await packer.pack("test-api-entry.js");

    const content = JSON.parse(readFileSync("api-test-preserve.json", "utf8"));

    // Check if scripts were preserved from root package.json
    if (content.scripts || content.keywords !== undefined) {
      printPass("PreserveFields option works programmatically");
    } else {
      printFail("PreserveFields option did not work");
    }
  } catch (error) {
    printFail("PreserveFields test failed", error.message);
  }
}

async function testReturnValue() {
  printTest("Return value structure validation");

  try {
    const result = await DependencyPacker.packEntry("test-api-entry.js", {
      output: "api-test-return.json",
      verbose: false,
    });

    const hasRequiredFields =
      result.dependencies &&
      result.packageJson &&
      result.report &&
      result.outputFile &&
      result.report.timestamp &&
      result.report.duration !== undefined &&
      result.report.totalDependencies !== undefined;

    if (hasRequiredFields) {
      printPass("Return value has correct structure");
    } else {
      printFail("Return value missing required fields");
    }
  } catch (error) {
    printFail("Return value test failed", error.message);
  }
}

// Main test runner
async function main() {
  console.log("");
  printInfo("Starting programmatic API tests...");
  console.log("");

  setup();

  // Run all tests sequentially
  await testBasicProgrammaticUsage();
  await testStaticMethod();
  await testMinimalOutputProgrammatic();
  await testJsonOutputProgrammatic();
  await testExternalOptionProgrammatic();
  await testMergeOptionProgrammatic();
  await testPreserveFieldsProgrammatic();
  await testReturnValue();

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
    console.log(
      `${colors.green}✨ All programmatic API tests passed!${colors.reset}`,
    );
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
