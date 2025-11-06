#!/usr/bin/env node

/**
 * Unit test runner using Node.js built-in test runner
 * Runs all TypeScript test files in test/unit directory
 */

import { execSync } from "child_process";
import { readdirSync, existsSync } from "fs";
import { join } from "path";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
};

function printInfo(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function printSuccess(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function printError(message) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

async function main() {
  printInfo("Running unit tests with Node.js test runner...\n");

  const unitTestDir = join(process.cwd(), "test", "unit");

  if (!existsSync(unitTestDir)) {
    printError("Unit test directory not found: test/unit");
    process.exit(1);
  }

  // Get all test files
  const testFiles = readdirSync(unitTestDir)
    .filter((file) => file.endsWith(".test.ts"))
    .map((file) => join(unitTestDir, file));

  if (testFiles.length === 0) {
    printWarning("No test files found in test/unit");
    process.exit(0);
  }

  printInfo(`Found ${testFiles.length} test file(s)\n`);

  let failedTests = 0;
  let passedTests = 0;

  for (const testFile of testFiles) {
    const testName = testFile.split("/").pop();
    printInfo(`Running: ${testName}`);

    try {
      // Run the test file using Node.js with jiti (current TS runtime)
      execSync(`node --import jiti/register --test ${testFile}`, {
        stdio: "inherit",
        env: { ...process.env, NODE_OPTIONS: "--no-warnings" },
      });
      passedTests++;
    } catch {
      printError(`Failed: ${testName}`);
      failedTests++;
    }
  }

  console.log("\n================================");
  console.log("Test Summary");
  console.log("================================");
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log("================================\n");

  if (failedTests === 0) {
    printSuccess("All unit tests passed!");
    process.exit(0);
  } else {
    printError(`${failedTests} test file(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  printError(`Test runner error: ${error.message}`);
  process.exit(1);
});
