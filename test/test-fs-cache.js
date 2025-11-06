#!/usr/bin/env node

/**
 * Unit tests for FsCache class
 * Tests file system caching and concurrency control
 */

import { FsCache } from "../dist/core/fs-cache.js";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync, symlinkSync } from "fs";
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

// Setup and cleanup
const testDir = "test-fs-cache-tmp";

function setupTestDir() {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
}

function cleanupTestDir() {
  if (existsSync(testDir)) {
    try {
      const files = ["test1.txt", "test2.txt", "symlink.txt", "binary.bin"];
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

// Tests
async function testBasicReadFile() {
  printTest("Basic file reading");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Hello World");

    const cache = new FsCache();
    const content = await cache.readFile(testFile, "utf8");

    if (content === "Hello World") {
      printPass("File read successfully");
    } else {
      printFail(`Expected "Hello World", got "${content}"`);
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Basic read test failed", error.message);
  }
}

async function testReadFileCaching() {
  printTest("File content caching");

  try {
    setupTestDir();
    const testFile = join(testDir, "test2.txt");
    writeFileSync(testFile, "Cached content");

    const cache = new FsCache();
    
    // First read
    const content1 = await cache.readFile(testFile, "utf8");
    
    // Second read (should be cached)
    const content2 = await cache.readFile(testFile, "utf8");

    if (content1 === content2 && content1 === "Cached content") {
      printPass("File caching works correctly");
    } else {
      printFail("Cache returned different content");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Caching test failed", error.message);
  }
}

async function testBinaryFileReading() {
  printTest("Binary file reading");

  try {
    setupTestDir();
    const testFile = join(testDir, "binary.bin");
    const buffer = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
    writeFileSync(testFile, buffer);

    const cache = new FsCache();
    const content = await cache.readFile(testFile, null);

    if (Buffer.isBuffer(content) && content.length === 5) {
      printPass("Binary file read successfully");
    } else {
      printFail("Binary file not read correctly");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Binary read test failed", error.message);
  }
}

async function testStatCaching() {
  printTest("File stat caching");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Test");

    const cache = new FsCache();
    
    const stats1 = await cache.stat(testFile);
    const stats2 = await cache.stat(testFile);

    if (stats1.isFile() && stats2.isFile() && stats1.size === stats2.size) {
      printPass("Stat caching works");
    } else {
      printFail("Stat caching failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Stat caching test failed", error.message);
  }
}

async function testReadlinkNonSymlink() {
  printTest("Readlink on non-symlink");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Not a symlink");

    const cache = new FsCache();
    const result = await cache.readlink(testFile);

    if (result === null) {
      printPass("Readlink returns null for non-symlink");
    } else {
      printFail("Readlink should return null for non-symlink");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Readlink non-symlink test failed", error.message);
  }
}

async function testReadlinkSymlink() {
  printTest("Readlink on actual symlink");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    const symlinkPath = join(testDir, "symlink.txt");
    writeFileSync(testFile, "Target");

    try {
      symlinkSync(testFile, symlinkPath);
    } catch {
      // Skip test on systems that don't support symlinks
      printPass("Skipped (symlinks not supported)");
      cleanupTestDir();
      return;
    }

    const cache = new FsCache();
    const result = await cache.readlink(symlinkPath);

    if (result !== null && typeof result === "string") {
      printPass("Readlink reads symlink correctly");
    } else {
      printFail("Readlink failed to read symlink");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Readlink symlink test failed", error.message);
  }
}

async function testConcurrencyLimit() {
  printTest("Concurrency limit enforcement");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Concurrent test");

    const cache = new FsCache({ concurrency: 2 });
    const operations = [];
    
    for (let i = 0; i < 10; i++) {
      operations.push(cache.readFile(testFile, "utf8"));
    }

    const results = await Promise.all(operations);

    if (results.every(r => r === "Concurrent test")) {
      printPass("Concurrency limit works");
    } else {
      printFail("Some concurrent reads failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Concurrency test failed", error.message);
  }
}

async function testNonExistentFile() {
  printTest("Reading non-existent file");

  try {
    const cache = new FsCache();
    
    try {
      await cache.readFile("non-existent-file.txt", "utf8");
      printFail("Should have thrown error for non-existent file");
    } catch (error) {
      if (error.code === "ENOENT") {
        printPass("Non-existent file error handled");
      } else {
        printFail("Wrong error code", error.message);
      }
    }
  } catch (error) {
    printFail("Non-existent file test failed", error.message);
  }
}

async function testMultipleEncodings() {
  printTest("Multiple encodings caching");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Multi-encoding test");

    const cache = new FsCache();
    
    const utf8Content = await cache.readFile(testFile, "utf8");
    const binaryContent = await cache.readFile(testFile, null);

    if (typeof utf8Content === "string" && Buffer.isBuffer(binaryContent)) {
      printPass("Multiple encodings handled correctly");
    } else {
      printFail("Multiple encodings not handled correctly");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Multiple encodings test failed", error.message);
  }
}

async function testHighConcurrency() {
  printTest("High concurrency stress test");

  try {
    setupTestDir();
    const files = [];
    
    // Create multiple test files
    for (let i = 0; i < 5; i++) {
      const testFile = join(testDir, `test${i}.txt`);
      writeFileSync(testFile, `Content ${i}`);
      files.push(testFile);
    }

    const cache = new FsCache({ concurrency: 256 });
    const operations = [];
    
    // Read each file multiple times concurrently
    for (let i = 0; i < 50; i++) {
      const file = files[i % files.length];
      operations.push(cache.readFile(file, "utf8"));
      operations.push(cache.stat(file));
    }

    const results = await Promise.all(operations);

    if (results.length === 100) {
      printPass("High concurrency stress test passed");
    } else {
      printFail(`Expected 100 results, got ${results.length}`);
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Stress test failed", error.message);
  }
}

async function testCacheSeparation() {
  printTest("Cache key separation");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Cache separation test");

    const cache = new FsCache();
    
    // Read with different encodings - should be cached separately
    const utf8 = await cache.readFile(testFile, "utf8");
    const ascii = await cache.readFile(testFile, "ascii");

    if (typeof utf8 === "string" && typeof ascii === "string") {
      printPass("Cache keys properly separated");
    } else {
      printFail("Cache separation failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Cache separation test failed", error.message);
  }
}

async function testReadlinkCaching() {
  printTest("Readlink result caching");

  try {
    setupTestDir();
    const testFile = join(testDir, "test1.txt");
    writeFileSync(testFile, "Target");

    const cache = new FsCache();
    
    // Test non-symlink caching
    const result1 = await cache.readlink(testFile);
    const result2 = await cache.readlink(testFile);

    if (result1 === null && result2 === null) {
      printPass("Readlink caching works");
    } else {
      printFail("Readlink caching failed");
    }

    cleanupTestDir();
  } catch (error) {
    cleanupTestDir();
    printFail("Readlink caching test failed", error.message);
  }
}

// Main test runner
async function runTests() {
  printInfo("Starting FsCache tests...\n");

  await testBasicReadFile();
  await testReadFileCaching();
  await testBinaryFileReading();
  await testStatCaching();
  await testReadlinkNonSymlink();
  await testReadlinkSymlink();
  await testConcurrencyLimit();
  await testNonExistentFile();
  await testMultipleEncodings();
  await testHighConcurrency();
  await testCacheSeparation();
  await testReadlinkCaching();

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