#!/usr/bin/env node

/**
 * Unit tests for Logger class
 * Tests logging functionality and message formatting
 */

import { Logger } from "../dist/logger.js";
import { readFileSync, unlinkSync, existsSync } from "fs";

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

// Capture console output
let consoleOutput = [];
const originalLog = console.log;

function captureConsole() {
  consoleOutput = [];
  console.log = (...args) => {
    consoleOutput.push(args.join(" "));
  };
}

function restoreConsole() {
  console.log = originalLog;
}

// Tests
function testBasicLogging() {
  printTest("Basic logging functionality");

  try {
    const logger = new Logger({ silent: false });
    captureConsole();
    
    logger.log("Test message", "info");
    
    restoreConsole();
    
    if (consoleOutput.length === 1 && consoleOutput[0].includes("Test message")) {
      printPass("Basic logging works");
    } else {
      printFail("Log message not captured correctly");
    }
  } catch (error) {
    restoreConsole();
    printFail("Basic logging failed", error.message);
  }
}

function testSilentMode() {
  printTest("Silent mode suppresses output");

  try {
    const logger = new Logger({ silent: true });
    captureConsole();
    
    logger.log("Should not appear", "info");
    
    restoreConsole();
    
    if (consoleOutput.length === 0) {
      printPass("Silent mode works");
    } else {
      printFail("Silent mode did not suppress output");
    }
  } catch (error) {
    restoreConsole();
    printFail("Silent mode test failed", error.message);
  }
}

function testLogTypes() {
  printTest("Different log types");

  try {
    const logger = new Logger({ silent: false });
    captureConsole();
    
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");
    logger.debug("Debug message");
    logger.success("Success message");
    
    restoreConsole();
    
    if (consoleOutput.length === 5) {
      printPass("All log types work");
    } else {
      printFail(`Expected 5 messages, got ${consoleOutput.length}`);
    }
  } catch (error) {
    restoreConsole();
    printFail("Log types test failed", error.message);
  }
}

function testFileLogging() {
  printTest("File logging functionality");

  const logFile = "test-logger-output.log";

  try {
    // Clean up any existing file
    if (existsSync(logFile)) {
      unlinkSync(logFile);
    }

    const logger = new Logger({ silent: true, logFile });
    
    logger.log("First message", "info");
    logger.log("Second message", "warn");
    
    // Check file contents
    const content = readFileSync(logFile, "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    
    if (lines.length === 2 && 
        lines[0].includes("First message") && 
        lines[1].includes("Second message")) {
      printPass("File logging works");
    } else {
      printFail(`Expected 2 log lines, got ${lines.length}`);
    }
    
    // Cleanup
    unlinkSync(logFile);
  } catch (error) {
    if (existsSync(logFile)) unlinkSync(logFile);
    printFail("File logging test failed", error.message);
  }
}

function testSetSilent() {
  printTest("Dynamic silent mode toggle");

  try {
    const logger = new Logger({ silent: false });
    
    captureConsole();
    logger.log("Before silent", "info");
    
    logger.setSilent(true);
    logger.log("During silent", "info");
    
    logger.setSilent(false);
    logger.log("After silent", "info");
    
    restoreConsole();
    
    if (consoleOutput.length === 2 && 
        consoleOutput[0].includes("Before silent") &&
        consoleOutput[1].includes("After silent")) {
      printPass("Dynamic silent mode works");
    } else {
      printFail("Silent toggle did not work correctly");
    }
  } catch (error) {
    restoreConsole();
    printFail("Set silent test failed", error.message);
  }
}

function testSetLogFile() {
  printTest("Dynamic log file setting");

  const logFile = "test-dynamic-log.log";

  try {
    if (existsSync(logFile)) {
      unlinkSync(logFile);
    }

    const logger = new Logger({ silent: true });
    
    logger.log("Without file", "info");
    
    logger.setLogFile(logFile);
    logger.log("With file", "info");
    
    const content = readFileSync(logFile, "utf8");
    
    if (content.includes("With file") && !content.includes("Without file")) {
      printPass("Dynamic log file setting works");
    } else {
      printFail("Log file content incorrect");
    }
    
    unlinkSync(logFile);
  } catch (error) {
    if (existsSync(logFile)) unlinkSync(logFile);
    printFail("Set log file test failed", error.message);
  }
}

function testColoredOutput() {
  printTest("Colored output formatting");

  try {
    // Test with colors enabled
    delete process.env.NO_COLOR;
    const logger = new Logger({ silent: false });
    
    captureConsole();
    logger.log("Colored message", "info");
    restoreConsole();
    
    // Check for ANSI color codes
    const hasColors = consoleOutput[0].includes("\x1b[");
    
    if (hasColors) {
      printPass("Colored output works");
    } else {
      printFail("No color codes found in output");
    }
  } catch (error) {
    restoreConsole();
    printFail("Colored output test failed", error.message);
  }
}

function testNoColorEnvironment() {
  printTest("NO_COLOR environment variable");

  try {
    process.env.NO_COLOR = "1";
    const logger = new Logger({ silent: false });
    
    captureConsole();
    logger.log("No color message", "info");
    restoreConsole();
    
    // Should not have ANSI codes
    const hasColors = consoleOutput[0].includes("\x1b[");
    
    delete process.env.NO_COLOR;
    
    if (!hasColors) {
      printPass("NO_COLOR respected");
    } else {
      printFail("Color codes found despite NO_COLOR");
    }
  } catch (error) {
    delete process.env.NO_COLOR;
    restoreConsole();
    printFail("NO_COLOR test failed", error.message);
  }
}

function testTimestampFormat() {
  printTest("Timestamp format in file logs");

  const logFile = "test-timestamp.log";

  try {
    if (existsSync(logFile)) {
      unlinkSync(logFile);
    }

    const logger = new Logger({ silent: true, logFile });
    logger.log("Timestamp test", "info");
    
    const content = readFileSync(logFile, "utf8");
    
    // Check for timestamp format: YYYY/MM/DD HH:MM:SS
    const timestampPattern = /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/;
    
    if (timestampPattern.test(content)) {
      printPass("Timestamp format correct");
    } else {
      printFail("Timestamp format incorrect");
    }
    
    unlinkSync(logFile);
  } catch (error) {
    if (existsSync(logFile)) unlinkSync(logFile);
    printFail("Timestamp test failed", error.message);
  }
}

function testLogLevelInFile() {
  printTest("Log level included in file output");

  const logFile = "test-loglevel.log";

  try {
    if (existsSync(logFile)) {
      unlinkSync(logFile);
    }

    const logger = new Logger({ silent: true, logFile });
    
    logger.info("Info test");
    logger.warn("Warn test");
    logger.error("Error test");
    
    const content = readFileSync(logFile, "utf8");
    
    if (content.includes("[INFO]") && 
        content.includes("[WARN]") && 
        content.includes("[ERROR]")) {
      printPass("Log levels included in file output");
    } else {
      printFail("Log levels missing from file output");
    }
    
    unlinkSync(logFile);
  } catch (error) {
    if (existsSync(logFile)) unlinkSync(logFile);
    printFail("Log level test failed", error.message);
  }
}

function testMultipleMessages() {
  printTest("Multiple sequential messages");

  try {
    const logger = new Logger({ silent: false });
    captureConsole();
    
    for (let i = 0; i < 5; i++) {
      logger.log(`Message ${i}`, "info");
    }
    
    restoreConsole();
    
    if (consoleOutput.length === 5) {
      printPass("Multiple messages handled correctly");
    } else {
      printFail(`Expected 5 messages, got ${consoleOutput.length}`);
    }
  } catch (error) {
    restoreConsole();
    printFail("Multiple messages test failed", error.message);
  }
}

function testFileWriteError() {
  printTest("Graceful handling of file write errors");

  try {
    // Try to write to an invalid path
    const logger = new Logger({ silent: true, logFile: "/invalid/path/log.txt" });
    
    captureConsole();
    logger.log("This should fail to write to file", "info");
    restoreConsole();
    
    // Should not throw, just print error
    printPass("File write error handled gracefully");
  } catch (error) {
    restoreConsole();
    printFail("File write error not handled", error.message);
  }
}

// Main test runner
function runTests() {
  printInfo("Starting Logger tests...\n");

  testBasicLogging();
  testSilentMode();
  testLogTypes();
  testFileLogging();
  testSetSilent();
  testSetLogFile();
  testColoredOutput();
  testNoColorEnvironment();
  testTimestampFormat();
  testLogLevelInFile();
  testMultipleMessages();
  testFileWriteError();

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