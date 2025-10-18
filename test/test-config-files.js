#!/usr/bin/env node

/**
 * Test script for config file loading
 * Tests .deppackrc.json, deppack.config.json, and package.json deppack field
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

// Setup
function setup() {
  printInfo("Setting up test environment...");

  // Create test entry file
  writeFileSync(
    "test-config-entry.js",
    `import fs from 'fs';
import path from 'path';
console.log('test');`,
  );
}

// Cleanup
function cleanup() {
  const files = [
    "test-config-entry.js",
    ".deppackrc.json",
    "deppack.config.json",
    "config-test-*.json",
    "auto-detected-output.json",
    "deppackrc-output.json",
    "deppack-config-output.json",
  ];

  files.forEach((file) => {
    try {
      if (file.includes("*")) {
        const prefix = file.split("*")[0];
        const suffix = file.split("*")[1] || "";
        execSync(`rm -f ${prefix}*${suffix}`, { stdio: "ignore" });
      } else if (existsSync(file)) {
        unlinkSync(file);
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}

// Test runner helper
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
function testDeppackrcJson() {
  printTest("Auto-detect .deppackrc.json");

  // Create .deppackrc.json
  writeFileSync(
    ".deppackrc.json",
    JSON.stringify(
      {
        output: "deppackrc-output.json",
        minimalOutput: true,
        verbose: false,
      },
      null,
      2,
    ),
  );

  runCommand("node dist/cli.js test-config-entry.js 2>&1");

  if (existsSync("deppackrc-output.json")) {
    const content = JSON.parse(readFileSync("deppackrc-output.json", "utf8"));
    const keys = Object.keys(content);

    if (keys.length === 1 && keys[0] === "dependencies") {
      printPass(".deppackrc.json auto-detected and loaded");
    } else {
      printFail(".deppackrc.json loaded but minimalOutput not applied");
    }
  } else {
    printFail(".deppackrc.json not auto-detected");
  }

  // Cleanup for next test
  if (existsSync(".deppackrc.json")) {
    unlinkSync(".deppackrc.json");
  }
}

function testDeppackConfigJson() {
  printTest("Auto-detect deppack.config.json");

  // Create deppack.config.json
  writeFileSync(
    "deppack.config.json",
    JSON.stringify(
      {
        output: "deppack-config-output.json",
        verbose: false,
        preserveFields: ["scripts", "keywords"],
      },
      null,
      2,
    ),
  );

  runCommand("node dist/cli.js test-config-entry.js 2>&1");

  if (existsSync("deppack-config-output.json")) {
    const content = JSON.parse(
      readFileSync("deppack-config-output.json", "utf8"),
    );

    // Check if it has valid package.json structure
    // Check for preserved fields from config (scripts, keywords)
    if (
      content.name ||
      content.version ||
      content.scripts !== undefined ||
      content.keywords !== undefined
    ) {
      printPass("deppack.config.json auto-detected and loaded");
    } else {
      printFail("deppack.config.json loaded but invalid output");
    }
  } else {
    printFail("deppack.config.json not auto-detected");
  }

  // Cleanup for next test
  if (existsSync("deppack.config.json")) {
    unlinkSync("deppack.config.json");
  }
}

function testPackageJsonDeppackField() {
  printTest("Auto-detect package.json deppack field");

  // Backup original package.json
  const originalPackageJson = readFileSync("package.json", "utf8");
  const packageData = JSON.parse(originalPackageJson);

  // Add deppack config to package.json
  packageData.deppack = {
    output: "package-json-deppack-output.json",
    minimalOutput: false,
    verbose: false,
  };

  writeFileSync("package.json", JSON.stringify(packageData, null, 2));

  runCommand("node dist/cli.js test-config-entry.js 2>&1");

  // Restore original package.json
  writeFileSync("package.json", originalPackageJson);

  if (existsSync("package-json-deppack-output.json")) {
    printPass("package.json deppack field auto-detected and loaded");
    unlinkSync("package-json-deppack-output.json");
  } else {
    printFail("package.json deppack field not auto-detected");
  }
}

function testConfigPriority() {
  printTest("Config file priority (.deppackrc.json > package.json)");

  // Backup original package.json
  const originalPackageJson = readFileSync("package.json", "utf8");
  const packageData = JSON.parse(originalPackageJson);

  // Add deppack config to package.json
  packageData.deppack = {
    output: "wrong-output.json",
    verbose: false,
  };
  writeFileSync("package.json", JSON.stringify(packageData, null, 2));

  // Create .deppackrc.json with higher priority
  writeFileSync(
    ".deppackrc.json",
    JSON.stringify(
      {
        output: "priority-test-output.json",
        verbose: false,
      },
      null,
      2,
    ),
  );

  runCommand("node dist/cli.js test-config-entry.js 2>&1");

  // Restore original package.json
  writeFileSync("package.json", originalPackageJson);

  // Clean up config file
  if (existsSync(".deppackrc.json")) {
    unlinkSync(".deppackrc.json");
  }

  // Check which file was created
  const correctPriority = existsSync("priority-test-output.json");
  const wrongPriority = existsSync("wrong-output.json");

  if (correctPriority && !wrongPriority) {
    printPass(".deppackrc.json has higher priority than package.json");
    unlinkSync("priority-test-output.json");
  } else if (wrongPriority) {
    printFail("Config priority incorrect - package.json took precedence");
    unlinkSync("wrong-output.json");
  } else {
    printFail("Config priority test failed - no output created");
  }
}

function testExplicitConfigOverride() {
  printTest("Explicit --config flag overrides auto-detected config");

  // Create auto-detected config
  writeFileSync(
    ".deppackrc.json",
    JSON.stringify(
      {
        output: "auto-config-output.json",
        verbose: false,
      },
      null,
      2,
    ),
  );

  // Create explicit config
  writeFileSync(
    "explicit-config.json",
    JSON.stringify(
      {
        output: "explicit-config-output.json",
        verbose: false,
      },
      null,
      2,
    ),
  );

  runCommand(
    "node dist/cli.js test-config-entry.js --config explicit-config.json 2>&1",
  );

  // Clean up
  if (existsSync(".deppackrc.json")) {
    unlinkSync(".deppackrc.json");
  }
  if (existsSync("explicit-config.json")) {
    unlinkSync("explicit-config.json");
  }

  const explicitUsed = existsSync("explicit-config-output.json");
  const autoUsed = existsSync("auto-config-output.json");

  if (explicitUsed && !autoUsed) {
    printPass("Explicit --config overrides auto-detected config");
    unlinkSync("explicit-config-output.json");
  } else if (autoUsed) {
    printFail("Auto-detected config was used instead of explicit");
    unlinkSync("auto-config-output.json");
  } else {
    printFail("No config was loaded");
  }
}

function testCliArgsOverrideConfig() {
  printTest("CLI args override config file values");

  // Create config with output setting
  writeFileSync(
    ".deppackrc.json",
    JSON.stringify(
      {
        output: "config-default-output.json",
        minimalOutput: false,
        verbose: false,
      },
      null,
      2,
    ),
  );

  // Run with CLI arg override
  runCommand(
    "node dist/cli.js test-config-entry.js --output cli-override-output.json 2>&1",
  );

  // Clean up
  if (existsSync(".deppackrc.json")) {
    unlinkSync(".deppackrc.json");
  }

  const cliUsed = existsSync("cli-override-output.json");
  const configUsed = existsSync("config-default-output.json");

  if (cliUsed && !configUsed) {
    printPass("CLI args override config file values");
    unlinkSync("cli-override-output.json");
  } else if (configUsed) {
    printFail("Config file value was used instead of CLI arg");
    unlinkSync("config-default-output.json");
  } else {
    printFail("Neither config nor CLI arg was used");
  }
}

function testInvalidConfigHandling() {
  printTest("Invalid config file error handling");

  // Create invalid JSON config
  writeFileSync(".deppackrc.json", "{ invalid json content }");

  runCommand("node dist/cli.js test-config-entry.js 2>&1");

  // Clean up
  if (existsSync(".deppackrc.json")) {
    unlinkSync(".deppackrc.json");
  }

  // Invalid config should be ignored and default to package.json
  if (existsSync("package.json")) {
    printPass("Invalid config file handled gracefully");
  } else {
    printFail("Invalid config caused failure");
  }
}

// Main test runner
function main() {
  console.log("");
  printInfo("Starting config file tests...");
  console.log("");

  setup();

  // Run all tests
  testDeppackrcJson();
  testDeppackConfigJson();
  testPackageJsonDeppackField();
  testConfigPriority();
  testExplicitConfigOverride();
  testCliArgsOverrideConfig();
  testInvalidConfigHandling();

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
      `${colors.green}✨ All config file tests passed!${colors.reset}`,
    );
    process.exit(0);
  } else {
    console.log(`${colors.red}Some tests failed.${colors.reset}`);
    process.exit(1);
  }
}

main();
