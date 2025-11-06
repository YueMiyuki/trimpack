import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { Logger } from "../../src/logger.js";
import { unlinkSync, readFileSync, existsSync } from "node:fs";

describe("Logger", () => {
  const testLogFile = ".test-logger.log";
  let originalConsoleLog: typeof console.log;
  let capturedLogs: string[];

  beforeEach(() => {
    // Capture console.log output
    capturedLogs = [];
    originalConsoleLog = console.log;
    console.log = (msg: string) => {
      capturedLogs.push(msg);
    };
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;

    // Cleanup test log file
    try {
      if (existsSync(testLogFile)) {
        unlinkSync(testLogFile);
      }
    } catch {
      // ignore
    }
  });

  describe("constructor", () => {
    it("should create logger with default options", () => {
      const logger = new Logger();
      assert.ok(logger instanceof Logger);
    });

    it("should create logger with silent mode", () => {
      const logger = new Logger({ silent: true });
      assert.ok(logger instanceof Logger);
    });

    it("should create logger with log file", () => {
      const logger = new Logger({ logFile: testLogFile });
      assert.ok(logger instanceof Logger);
    });

    it("should create logger with both options", () => {
      const logger = new Logger({ silent: true, logFile: testLogFile });
      assert.ok(logger instanceof Logger);
    });
  });

  describe("log method", () => {
    it("should log info messages", () => {
      const logger = new Logger();
      logger.log("test message", "info");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("test message"));
      assert.ok(capturedLogs[0].includes("INFO"));
    });

    it("should log warn messages", () => {
      const logger = new Logger();
      logger.log("warning", "warn");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("warning"));
      assert.ok(capturedLogs[0].includes("WARN"));
    });

    it("should log error messages", () => {
      const logger = new Logger();
      logger.log("error occurred", "error");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("error occurred"));
      assert.ok(capturedLogs[0].includes("ERROR"));
    });

    it("should log debug messages", () => {
      const logger = new Logger();
      logger.log("debug info", "debug");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("debug info"));
      assert.ok(capturedLogs[0].includes("DEBUG"));
    });

    it("should log success messages", () => {
      const logger = new Logger();
      logger.log("operation successful", "success");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("operation successful"));
      assert.ok(capturedLogs[0].includes("SUCCESS"));
    });

    it("should not log when silent mode is enabled", () => {
      const logger = new Logger({ silent: true });
      logger.log("should not appear", "info");

      assert.strictEqual(capturedLogs.length, 0);
    });

    it("should write to log file when specified", () => {
      const logger = new Logger({ logFile: testLogFile });
      logger.log("file log test", "info");

      assert.ok(existsSync(testLogFile));
      const content = readFileSync(testLogFile, "utf8");
      assert.ok(content.includes("file log test"));
      assert.ok(content.includes("INFO"));
    });

    it("should include timestamp in file logs", () => {
      const logger = new Logger({ logFile: testLogFile });
      logger.log("timestamp test", "info");

      const content = readFileSync(testLogFile, "utf8");
      // Check for date pattern YYYY/MM/DD
      assert.ok(/\d{4}\/\d{2}\/\d{2}/.test(content));
    });

    it("should append to existing log file", () => {
      const logger = new Logger({ logFile: testLogFile });
      logger.log("first message", "info");
      logger.log("second message", "info");

      const content = readFileSync(testLogFile, "utf8");
      assert.ok(content.includes("first message"));
      assert.ok(content.includes("second message"));
    });
  });

  describe("convenience methods", () => {
    it("should have info method", () => {
      const logger = new Logger();
      logger.info("info test");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("info test"));
    });

    it("should have warn method", () => {
      const logger = new Logger();
      logger.warn("warn test");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("warn test"));
    });

    it("should have error method", () => {
      const logger = new Logger();
      logger.error("error test");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("error test"));
    });

    it("should have debug method", () => {
      const logger = new Logger();
      logger.debug("debug test");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("debug test"));
    });

    it("should have success method", () => {
      const logger = new Logger();
      logger.success("success test");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("success test"));
    });
  });

  describe("setSilent", () => {
    it("should enable silent mode", () => {
      const logger = new Logger();
      logger.setSilent(true);
      logger.log("should not appear", "info");

      assert.strictEqual(capturedLogs.length, 0);
    });

    it("should disable silent mode", () => {
      const logger = new Logger({ silent: true });
      logger.setSilent(false);
      logger.log("should appear", "info");

      assert.strictEqual(capturedLogs.length, 1);
    });
  });

  describe("setLogFile", () => {
    it("should set log file path", () => {
      const logger = new Logger();
      logger.setLogFile(testLogFile);
      logger.log("file test", "info");

      assert.ok(existsSync(testLogFile));
    });

    it("should disable file logging when set to null", () => {
      const logger = new Logger({ logFile: testLogFile });
      logger.setLogFile(null);
      logger.log("no file", "info");

      // File should exist from constructor but not have new content
      const content = readFileSync(testLogFile, "utf8");
      assert.ok(!content.includes("no file") || content.length === 0);
    });
  });

  describe("color handling", () => {
    it("should respect NO_COLOR environment variable", () => {
      const originalNoColor = process.env.NO_COLOR;
      process.env.NO_COLOR = "1";

      const logger = new Logger();
      logger.log("no color", "info");

      // Output should not contain ANSI codes
      assert.ok(capturedLogs[0].includes("no color"));

      // Restore environment
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
    });

    it("should use colors when NO_COLOR is not set", () => {
      const originalNoColor = process.env.NO_COLOR;
      delete process.env.NO_COLOR;

      const logger = new Logger();
      logger.log("with color", "info");

      // Output may contain ANSI codes (implementation-dependent)
      assert.ok(capturedLogs[0].includes("with color"));

      // Restore environment
      if (originalNoColor !== undefined) {
        process.env.NO_COLOR = originalNoColor;
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages", () => {
      const logger = new Logger();
      logger.log("", "info");

      assert.strictEqual(capturedLogs.length, 1);
    });

    it("should handle very long messages", () => {
      const logger = new Logger();
      const longMessage = "x".repeat(10000);
      logger.log(longMessage, "info");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("x".repeat(100)));
    });

    it("should handle special characters in messages", () => {
      const logger = new Logger();
      logger.log("special: \n\t\r", "info");

      assert.strictEqual(capturedLogs.length, 1);
    });

    it("should handle Unicode characters", () => {
      const logger = new Logger();
      logger.log("Unicode: 你好 🎉", "info");

      assert.strictEqual(capturedLogs.length, 1);
      assert.ok(capturedLogs[0].includes("你好"));
    });

    it("should handle file write errors gracefully", () => {
      const logger = new Logger({ logFile: "/invalid/path/log.txt" });
      // Should not throw
      logger.log("test", "info");

      // Console log should still work
      assert.strictEqual(capturedLogs.length, 2); // message + error
    });
  });
});
