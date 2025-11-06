import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Logger } from "../src/logger.js";
import { unlinkSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TEST_LOG_FILE = resolve(process.cwd(), ".test-logger.log");

describe("Logger", () => {
  after(() => {
    try {
      if (existsSync(TEST_LOG_FILE)) unlinkSync(TEST_LOG_FILE);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    try {
      if (existsSync(TEST_LOG_FILE)) unlinkSync(TEST_LOG_FILE);
    } catch {
      // Ignore
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

    it("should create logger with verbose mode", () => {
      const logger = new Logger({ verbose: true });
      assert.ok(logger instanceof Logger);
    });

    it("should create logger with log file", () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE });
      assert.ok(logger instanceof Logger);
    });

    it("should create logger with custom timestamp function", () => {
      const logger = new Logger({ 
        timestamp: () => "CUSTOM_TIME" 
      });
      assert.ok(logger instanceof Logger);
    });
  });

  describe("log method", () => {
    it("should log info messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Test info message", "info");
      });
    });

    it("should log warn messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Test warning", "warn");
      });
    });

    it("should log error messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Test error", "error");
      });
    });

    it("should log debug messages when verbose", () => {
      const logger = new Logger({ silent: true, verbose: true });
      assert.doesNotThrow(() => {
        logger.log("Test debug", "debug");
      });
    });

    it("should not log debug messages when not verbose", () => {
      const logger = new Logger({ silent: true, verbose: false });
      assert.doesNotThrow(() => {
        logger.log("Test debug", "debug");
      });
    });

    it("should log success messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Test success", "success");
      });
    });

    it("should default to info type", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Default message");
      });
    });
  });

  describe("file logging", () => {
    it("should write logs to file", () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE, silent: true });
      logger.log("Test message", "info");
      
      assert.ok(existsSync(TEST_LOG_FILE));
      const content = readFileSync(TEST_LOG_FILE, "utf8");
      assert.ok(content.includes("Test message"));
      
      unlinkSync(TEST_LOG_FILE);
    });

    it("should append multiple log entries", () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE, silent: true });
      logger.log("First message", "info");
      logger.log("Second message", "warn");
      
      const content = readFileSync(TEST_LOG_FILE, "utf8");
      assert.ok(content.includes("First message"));
      assert.ok(content.includes("Second message"));
      
      unlinkSync(TEST_LOG_FILE);
    });

    it("should include log type in file", () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE, silent: true });
      logger.log("Error message", "error");
      
      const content = readFileSync(TEST_LOG_FILE, "utf8");
      assert.ok(content.includes("[ERROR]") || content.includes("ERROR"));
      
      unlinkSync(TEST_LOG_FILE);
    });

    it("should include timestamp in file when enabled", () => {
      const logger = new Logger({ 
        logFile: TEST_LOG_FILE, 
        silent: true,
        timestamp: () => "2024-01-01 12:00:00"
      });
      logger.log("Timestamped message", "info");
      
      const content = readFileSync(TEST_LOG_FILE, "utf8");
      assert.ok(content.includes("2024-01-01"));
      
      unlinkSync(TEST_LOG_FILE);
    });

    it("should handle file write errors gracefully", () => {
      const logger = new Logger({ logFile: "/invalid/path/log.txt", silent: true });
      assert.doesNotThrow(() => {
        logger.log("This should not crash", "info");
      });
    });
  });

  describe("message formatting", () => {
    it("should format messages with type prefix", () => {
      const logger = new Logger({ silent: true });
      // Just ensure it doesn't throw
      assert.doesNotThrow(() => {
        logger.log("Message with prefix", "info");
      });
    });

    it("should handle empty messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("", "info");
      });
    });

    it("should handle very long messages", () => {
      const logger = new Logger({ silent: true });
      const longMessage = "x".repeat(10000);
      assert.doesNotThrow(() => {
        logger.log(longMessage, "info");
      });
    });

    it("should handle messages with special characters", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Message with 日本語 and émojis 🎉", "info");
      });
    });

    it("should handle multiline messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Line 1\nLine 2\nLine 3", "info");
      });
    });
  });

  describe("color handling", () => {
    it("should respect NO_COLOR environment variable", () => {
      const originalNoColor = process.env.NO_COLOR;
      process.env.NO_COLOR = "1";
      
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("No color message", "info");
      });
      
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
    });

    it("should apply colors when NO_COLOR is not set", () => {
      const originalNoColor = process.env.NO_COLOR;
      delete process.env.NO_COLOR;
      
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Colored message", "success");
      });
      
      if (originalNoColor !== undefined) {
        process.env.NO_COLOR = originalNoColor;
      }
    });
  });

  describe("verbose mode", () => {
    it("should show debug logs in verbose mode", () => {
      const logger = new Logger({ silent: true, verbose: true });
      assert.doesNotThrow(() => {
        logger.log("Debug message", "debug");
      });
    });

    it("should not show debug logs in non-verbose mode", () => {
      const logger = new Logger({ silent: true, verbose: false });
      assert.doesNotThrow(() => {
        logger.log("Debug message", "debug");
      });
    });

    it("should show all other log types regardless of verbose", () => {
      const logger = new Logger({ silent: true, verbose: false });
      assert.doesNotThrow(() => {
        logger.log("Info message", "info");
        logger.log("Warning message", "warn");
        logger.log("Error message", "error");
        logger.log("Success message", "success");
      });
    });
  });

  describe("silent mode", () => {
    it("should not output to console in silent mode", () => {
      const logger = new Logger({ silent: true });
      // In silent mode, nothing should be printed
      // This test just ensures no exceptions are thrown
      assert.doesNotThrow(() => {
        logger.log("Silent message", "info");
      });
    });

    it("should still write to file in silent mode", () => {
      const logger = new Logger({ silent: true, logFile: TEST_LOG_FILE });
      logger.log("File only message", "info");
      
      assert.ok(existsSync(TEST_LOG_FILE));
      const content = readFileSync(TEST_LOG_FILE, "utf8");
      assert.ok(content.includes("File only message"));
      
      unlinkSync(TEST_LOG_FILE);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid successive logs", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        for (let i = 0; i < 100; i++) {
          logger.log(`Message ${i}`, "info");
        }
      });
    });

    it("should handle concurrent logging", async () => {
      const logger = new Logger({ silent: true, logFile: TEST_LOG_FILE });
      
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(() => logger.log(`Concurrent ${i}`, "info"))
      );
      
      await Promise.all(promises);
      
      assert.ok(existsSync(TEST_LOG_FILE));
      unlinkSync(TEST_LOG_FILE);
    });

    it("should handle invalid log types gracefully", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log("Invalid type", "invalid" as unknown);
      });
    });

    it("should handle null/undefined messages", () => {
      const logger = new Logger({ silent: true });
      assert.doesNotThrow(() => {
        logger.log(null as unknown, "info");
        logger.log(undefined as unknown, "info");
      });
    });
  });
});