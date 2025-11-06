#!/usr/bin/env node

/**
 * Unit tests for Semaphore class
 * Tests concurrency control and queue management
 */

import { Semaphore } from "../dist/core/semaphore.js";

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
async function testBasicAcquireRelease() {
  printTest("Basic acquire and release");

  try {
    const sem = new Semaphore(1);
    const release = await sem.acquire();
    
    if (typeof release === "function") {
      release();
      printPass("Basic acquire/release works");
    } else {
      printFail("Release is not a function");
    }
  } catch (error) {
    printFail("Basic acquire/release failed", error.message);
  }
}

async function testConcurrencyLimit() {
  printTest("Concurrency limit enforcement");

  try {
    const sem = new Semaphore(2);
    const releases = [];
    
    // Acquire up to limit
    releases.push(await sem.acquire());
    releases.push(await sem.acquire());
    
    // Third acquire should wait
    let thirdResolved = false;
    const thirdPromise = sem.acquire().then((release) => {
      thirdResolved = true;
      return release;
    });
    
    // Wait a bit to ensure it's queued
    await new Promise((r) => setTimeout(r, 10));
    
    if (!thirdResolved) {
      // Release one slot
      releases[0]();
      
      // Now third should resolve
      const thirdRelease = await thirdPromise;
      if (thirdResolved && typeof thirdRelease === "function") {
        thirdRelease();
        releases[1]();
        printPass("Concurrency limit enforced correctly");
      } else {
        printFail("Third acquire did not resolve properly");
      }
    } else {
      printFail("Third acquire resolved too early");
    }
  } catch (error) {
    printFail("Concurrency limit test failed", error.message);
  }
}

async function testMultipleReleases() {
  printTest("Multiple concurrent operations");

  try {
    const sem = new Semaphore(3);
    const operations = [];
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      operations.push(
        (async () => {
          const release = await sem.acquire();
          results.push(i);
          await new Promise((r) => setTimeout(r, 5));
          release();
        })()
      );
    }
    
    await Promise.all(operations);
    
    if (results.length === 10) {
      printPass("Multiple operations completed successfully");
    } else {
      printFail(`Expected 10 operations, got ${results.length}`);
    }
  } catch (error) {
    printFail("Multiple operations test failed", error.message);
  }
}

async function testZeroLimit() {
  printTest("Edge case: zero limit");

  try {
    const sem = new Semaphore(0);
    let acquired = false;
    
    // This should never resolve
    const promise = sem.acquire().then(() => {
      acquired = true;
    });
    
    await Promise.race([
      promise,
      new Promise((r) => setTimeout(r, 50))
    ]);
    
    if (!acquired) {
      printPass("Zero limit prevents acquisition");
    } else {
      printFail("Zero limit allowed acquisition");
    }
  } catch (error) {
    printFail("Zero limit test failed", error.message);
  }
}

async function testQueueOrdering() {
  printTest("Queue maintains FIFO order");

  try {
    const sem = new Semaphore(1);
    const order = [];
    
    const release1 = await sem.acquire();
    
    // Queue multiple waiters
    const promise2 = sem.acquire().then((r) => { order.push(2); return r; });
    const promise3 = sem.acquire().then((r) => { order.push(3); return r; });
    const promise4 = sem.acquire().then((r) => { order.push(4); return r; });
    
    await new Promise((r) => setTimeout(r, 10));
    
    // Release in sequence
    release1();
    const r2 = await promise2;
    r2();
    const r3 = await promise3;
    r3();
    const r4 = await promise4;
    r4();
    
    if (order[0] === 2 && order[1] === 3 && order[2] === 4) {
      printPass("Queue maintains FIFO order");
    } else {
      printFail(`Expected [2,3,4], got [${order.join(",")}]`);
    }
  } catch (error) {
    printFail("Queue ordering test failed", error.message);
  }
}

async function testHighConcurrency() {
  printTest("High concurrency stress test");

  try {
    const sem = new Semaphore(10);
    const operations = [];
    let activeCount = 0;
    let maxActive = 0;
    
    for (let i = 0; i < 100; i++) {
      operations.push(
        (async () => {
          const release = await sem.acquire();
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          await new Promise((r) => setTimeout(r, 1));
          activeCount--;
          release();
        })()
      );
    }
    
    await Promise.all(operations);
    
    if (maxActive <= 10 && activeCount === 0) {
      printPass(`Stress test passed (max active: ${maxActive})`);
    } else {
      printFail(`Max active: ${maxActive}, final active: ${activeCount}`);
    }
  } catch (error) {
    printFail("Stress test failed", error.message);
  }
}

async function testReleaseWithoutAcquire() {
  printTest("Release behavior without matching acquire");

  try {
    const sem = new Semaphore(2);
    const release1 = await sem.acquire();
    const release2 = await sem.acquire();
    
    // Normal releases
    release1();
    release2();
    
    // Extra release (should not break anything)
    release1();
    
    // Should still be able to acquire
    const release3 = await sem.acquire();
    if (typeof release3 === "function") {
      release3();
      printPass("Extra release handled gracefully");
    } else {
      printFail("Failed to acquire after extra release");
    }
  } catch (error) {
    printFail("Release without acquire test failed", error.message);
  }
}

// Main test runner
async function runTests() {
  printInfo("Starting Semaphore tests...\n");

  await testBasicAcquireRelease();
  await testConcurrencyLimit();
  await testMultipleReleases();
  await testZeroLimit();
  await testQueueOrdering();
  await testHighConcurrency();
  await testReleaseWithoutAcquire();

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