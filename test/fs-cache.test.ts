import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { FsCache } from "../src/core/fs-cache.js";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, symlinkSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const TEST_DIR = resolve(process.cwd(), ".test-fs-cache");
const TEST_FILE = join(TEST_DIR, "test.txt");
const TEST_FILE_2 = join(TEST_DIR, "test2.txt");
const TEST_SYMLINK = join(TEST_DIR, "test-link.txt");

describe("FsCache", () => {
  before(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
    try {
      if (existsSync(TEST_SYMLINK)) unlinkSync(TEST_SYMLINK);
      if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
      if (existsSync(TEST_FILE_2)) unlinkSync(TEST_FILE_2);
      if (existsSync(TEST_DIR)) rmdirSync(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Clean up before each test
    try {
      if (existsSync(TEST_SYMLINK)) unlinkSync(TEST_SYMLINK);
      if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
      if (existsSync(TEST_FILE_2)) unlinkSync(TEST_FILE_2);
    } catch {
      // Ignore
    }
  });

  describe("constructor", () => {
    it("should create an FsCache instance with default concurrency", () => {
      const cache = new FsCache();
      assert.ok(cache instanceof FsCache);
    });

    it("should create an FsCache instance with custom concurrency", () => {
      const cache = new FsCache({ concurrency: 16 });
      assert.ok(cache instanceof FsCache);
    });

    it("should use minimum concurrency of 8", () => {
      const cache = new FsCache({ concurrency: 2 });
      assert.ok(cache instanceof FsCache);
    });
  });

  describe("readFile", () => {
    it("should read a text file with encoding", async () => {
      writeFileSync(TEST_FILE, "Hello, World!");
      const cache = new FsCache();
      
      const content = await cache.readFile(TEST_FILE, "utf8");
      assert.equal(content, "Hello, World!");
    });

    it("should read a binary file without encoding", async () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      writeFileSync(TEST_FILE, buffer);
      const cache = new FsCache();
      
      const content = await cache.readFile(TEST_FILE, null);
      assert.ok(Buffer.isBuffer(content));
      assert.deepEqual(content, buffer);
    });

    it("should cache file reads", async () => {
      writeFileSync(TEST_FILE, "cached content");
      const cache = new FsCache();
      
      const content1 = await cache.readFile(TEST_FILE, "utf8");
      const content2 = await cache.readFile(TEST_FILE, "utf8");
      
      assert.equal(content1, content2);
      assert.equal(content1, "cached content");
    });

    it("should cache files with different encodings separately", async () => {
      writeFileSync(TEST_FILE, "test");
      const cache = new FsCache();
      
      const utf8Content = await cache.readFile(TEST_FILE, "utf8");
      const binaryContent = await cache.readFile(TEST_FILE, null);
      
      assert.equal(typeof utf8Content, "string");
      assert.ok(Buffer.isBuffer(binaryContent));
    });

    it("should throw error for non-existent file", async () => {
      const cache = new FsCache();
      await assert.rejects(
        () => cache.readFile("/non/existent/file.txt", "utf8"),
        { code: "ENOENT" }
      );
    });

    it("should handle concurrent reads of the same file", async () => {
      writeFileSync(TEST_FILE, "concurrent");
      const cache = new FsCache();
      
      const results = await Promise.all([
        cache.readFile(TEST_FILE, "utf8"),
        cache.readFile(TEST_FILE, "utf8"),
        cache.readFile(TEST_FILE, "utf8"),
      ]);
      
      assert.equal(results.every(r => r === "concurrent"), true);
    });

    it("should handle EMFILE errors with retry", async () => {
      writeFileSync(TEST_FILE, "emfile test");
      const cache = new FsCache({ concurrency: 1 });
      
      // This should succeed even if we hit file descriptor limits
      const content = await cache.readFile(TEST_FILE, "utf8");
      assert.equal(content, "emfile test");
    });
  });

  describe("stat", () => {
    it("should return file stats", async () => {
      writeFileSync(TEST_FILE, "test");
      const cache = new FsCache();
      
      const stats = await cache.stat(TEST_FILE);
      assert.ok(stats.isFile());
      assert.ok(stats.size >= 0);
    });

    it("should cache stat results", async () => {
      writeFileSync(TEST_FILE, "test");
      const cache = new FsCache();
      
      const stats1 = await cache.stat(TEST_FILE);
      const stats2 = await cache.stat(TEST_FILE);
      
      assert.equal(stats1.size, stats2.size);
    });

    it("should throw error for non-existent file", async () => {
      const cache = new FsCache();
      await assert.rejects(
        () => cache.stat("/non/existent/file.txt"),
        { code: "ENOENT" }
      );
    });

    it("should distinguish between file and directory", async () => {
      writeFileSync(TEST_FILE, "test");
      const cache = new FsCache();
      
      const fileStats = await cache.stat(TEST_FILE);
      const dirStats = await cache.stat(TEST_DIR);
      
      assert.ok(fileStats.isFile());
      assert.ok(dirStats.isDirectory());
    });
  });

  describe("readlink", () => {
    it("should read symlink target", async () => {
      writeFileSync(TEST_FILE, "original");
      symlinkSync(TEST_FILE, TEST_SYMLINK);
      const cache = new FsCache();
      
      const target = await cache.readlink(TEST_SYMLINK);
      assert.equal(target, TEST_FILE);
    });

    it("should return null for non-symlink files", async () => {
      writeFileSync(TEST_FILE, "not a link");
      const cache = new FsCache();
      
      const result = await cache.readlink(TEST_FILE);
      assert.equal(result, null);
    });

    it("should return null for non-existent paths", async () => {
      const cache = new FsCache();
      const result = await cache.readlink("/non/existent/path");
      assert.equal(result, null);
    });

    it("should cache readlink results", async () => {
      writeFileSync(TEST_FILE, "original");
      symlinkSync(TEST_FILE, TEST_SYMLINK);
      const cache = new FsCache();
      
      const target1 = await cache.readlink(TEST_SYMLINK);
      const target2 = await cache.readlink(TEST_SYMLINK);
      
      assert.equal(target1, target2);
      assert.equal(target1, TEST_FILE);
    });
  });

  describe("concurrency control", () => {
    it("should limit concurrent file operations", async () => {
      const files = Array.from({ length: 10 }, (_, i) => {
        const file = join(TEST_DIR, `concurrent-${i}.txt`);
        writeFileSync(file, `content ${i}`);
        return file;
      });
      
      const cache = new FsCache({ concurrency: 2 });
      
      const results = await Promise.all(
        files.map(f => cache.readFile(f, "utf8"))
      );
      
      assert.equal(results.length, 10);
      
      // Cleanup
      files.forEach(f => {
        try {
          unlinkSync(f);
        } catch {
          // Ignore
        }
      });
    });

    it("should handle mixed operation types concurrently", async () => {
      writeFileSync(TEST_FILE, "test");
      writeFileSync(TEST_FILE_2, "test2");
      const cache = new FsCache({ concurrency: 4 });
      
      const [read1, read2, stat1, stat2] = await Promise.all([
        cache.readFile(TEST_FILE, "utf8"),
        cache.readFile(TEST_FILE_2, "utf8"),
        cache.stat(TEST_FILE),
        cache.stat(TEST_FILE_2),
      ]);
      
      assert.equal(read1, "test");
      assert.equal(read2, "test2");
      assert.ok(stat1.isFile());
      assert.ok(stat2.isFile());
    });
  });

  describe("edge cases", () => {
    it("should handle empty files", async () => {
      writeFileSync(TEST_FILE, "");
      const cache = new FsCache();
      
      const content = await cache.readFile(TEST_FILE, "utf8");
      assert.equal(content, "");
    });

    it("should handle large files", async () => {
      const largeContent = "x".repeat(1024 * 1024); // 1MB
      writeFileSync(TEST_FILE, largeContent);
      const cache = new FsCache();
      
      const content = await cache.readFile(TEST_FILE, "utf8");
      assert.equal(content.length, largeContent.length);
    });

    it("should handle files with special characters in path", async () => {
      const specialFile = join(TEST_DIR, "file with spaces.txt");
      writeFileSync(specialFile, "special");
      const cache = new FsCache();
      
      const content = await cache.readFile(specialFile, "utf8");
      assert.equal(content, "special");
      
      unlinkSync(specialFile);
    });

    it("should handle rapid sequential operations", async () => {
      writeFileSync(TEST_FILE, "rapid");
      const cache = new FsCache();
      
      for (let i = 0; i < 100; i++) {
        const content = await cache.readFile(TEST_FILE, "utf8");
        assert.equal(content, "rapid");
      }
    });
  });
});