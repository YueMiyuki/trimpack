#!/usr/bin/env node

/**
 * Master test runner for new features
 * Runs all unit tests for the dev branch
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function printHeader(message) {
  console.log(`\n${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${message}${colors.reset}`);
  console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);
}

function printInfo(message) {
  console.log(`${colors.yellow}[INFO]${colors.reset} ${message}`);
}

function printSuccess(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function printError(message) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

// Test suites to run
const testSuites = [
  { name: "Semaphore", script: "test/test-semaphore.js" },
  { name: "Import Scanner", script: "test/test-import-scanner.js" },
  { name: "Logger", script: "test/test-logger.js" },
  { name: "Resolver", script: "test/test-resolver.js" },
  { name: "FsCache", script: "test/test-fs-cache.js" },
  { name: "Core Engines", script: "test/test-core-engines.js" },
];

async function runTestSuite(suite) {
  printHeader(`Running ${suite.name} Tests`);

  if (!existsSync(suite.script)) {
    printError(`Test script not found: ${suite.script}`);
    return false;
  }

  try {
    execSync(`node ${suite.script}`, {
      stdio: "inherit",
      encoding: "utf8",
    });
    printSuccess(`${suite.name} tests passed`);
    return true;
  } catch {
    printError(`${suite.name} tests failed`);
    return false;
  }
}

async function main() {
  printHeader("Running All New Feature Unit Tests");
  printInfo("Building project before running tests...");

  // Build the project first
  try {
    execSync("pnpm run build", { stdio: "inherit" });
    printSuccess("Build completed successfully");
  } catch {
    printError("Build failed. Cannot run tests.");
    process.exit(1);
  }

  console.log();
  printInfo("Starting test execution...\n");

  const results = [];
  
  for (const suite of testSuites) {
    const passed = await runTestSuite(suite);
    results.push({ name: suite.name, passed });
  }

  // Summary
  printHeader("Test Summary");
  
  const passedSuites = results.filter(r => r.passed);
  const failedSuites = results.filter(r => !r.passed);

  console.log(`${colors.green}Passed Suites: ${passedSuites.length}/${results.length}${colors.reset}`);
  
  if (passedSuites.length > 0) {
    passedSuites.forEach(s => {
      console.log(`  ${colors.green}✓${colors.reset} ${s.name}`);
    });
  }

  if (failedSuites.length > 0) {
    console.log(`\n${colors.red}Failed Suites: ${failedSuites.length}/${results.length}${colors.reset}`);
    failedSuites.forEach(s => {
      console.log(`  ${colors.red}✗${colors.reset} ${s.name}`);
    });
  }

  console.log(`\n${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);

  if (failedSuites.length > 0) {
    process.exit(1);
  } else {
    printSuccess("All test suites passed!");
    process.exit(0);
  }
}

// Run the tests
main().catch(error => {
  printError(`Fatal error: ${error.message}`);
  process.exit(1);
});