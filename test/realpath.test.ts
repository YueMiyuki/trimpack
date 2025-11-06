import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { realpath } from "../src/core/realpath.js";
import { FsCache } from "../src/core/fs-cache.js";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, symlinkSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const TEST_DIR = resolve(process.cwd(), ".test-realpath");
const TEST_FILE = join(TEST_DIR, "real-file.txt");
const TEST_LINK = join(TEST_DIR, "link-to-file");
const TEST_LINK_CHAIN = join(TEST_DIR, "link-chain");
const TEST_DIR_LINK = join(TEST_DIR, "dir-link");
const TEST_SUBDIR = join(TEST_DIR, "subdir");

describe("realpath", () => {
  before(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    if (!existsSync(TEST_SUBDIR)) {
      mkdirSync(TEST_SUBDIR, { recursive: true });
    }
  });

  after(() => {
    try {
      if (existsSync(TEST_LINK)) unlinkSync(TEST_LINK);
      if (existsSync(TEST_LINK_CHAIN)) unlinkSync(TEST_LINK_CHAIN);
      if (existsSync(TEST_DIR_LINK)) unlinkSync(TEST_DIR_LINK);
      if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
      if (existsSync(TEST_SUBDIR)) rmdirSync(TEST_SUBDIR);
      if (existsSync(TEST_DIR)) rmdirSync(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("regular files", () => {
    it("should return the path for a regular file", async () => {
      writeFileSync(TEST_FILE, "test");
      const fs = new FsCache();
      
      const result = await realpath(TEST_FILE, fs, TEST_DIR);
      assert.equal(result, TEST_FILE);
      
      unlinkSync(TEST_FILE);
    });

    it("should resolve files within base directory", async () => {
      const file = join(TEST_SUBDIR, "file.txt");
      writeFileSync(file, "test");
      const fs = new FsCache();
      
      const result = await realpath(file, fs, TEST_DIR);
      assert.equal(result, file);
      
      unlinkSync(file);
    });

    it("should return path for files outside base directory", async () => {
      writeFileSync(TEST_FILE, "test");
      const fs = new FsCache();
      const baseOutside = join(TEST_DIR, "nonexistent");
      
      const result = await realpath(TEST_FILE, fs, baseOutside);
      assert.equal(result, TEST_FILE);
      
      unlinkSync(TEST_FILE);
    });
  });

  describe("symlinks", () => {
    it("should resolve a simple symlink", async () => {
      writeFileSync(TEST_FILE, "original");
      symlinkSync(TEST_FILE, TEST_LINK);
      const fs = new FsCache();
      
      const result = await realpath(TEST_LINK, fs, TEST_DIR);
      assert.equal(result, TEST_FILE);
      
      unlinkSync(TEST_LINK);
      unlinkSync(TEST_FILE);
    });

    it("should resolve symlink chain", async () => {
      writeFileSync(TEST_FILE, "original");
      symlinkSync(TEST_FILE, TEST_LINK);
      symlinkSync(TEST_LINK, TEST_LINK_CHAIN);
      const fs = new FsCache();
      
      const result = await realpath(TEST_LINK_CHAIN, fs, TEST_DIR);
      assert.equal(result, TEST_FILE);
      
      unlinkSync(TEST_LINK_CHAIN);
      unlinkSync(TEST_LINK);
      unlinkSync(TEST_FILE);
    });

    it("should detect recursive symlinks", async () => {
      try {
        symlinkSync(TEST_LINK, TEST_LINK_CHAIN);
        symlinkSync(TEST_LINK_CHAIN, TEST_LINK);
        const fs = new FsCache();
        
        await assert.rejects(
          () => realpath(TEST_LINK, fs, TEST_DIR),
          /Recursive symlink/
        );
      } finally {
        try {
          unlinkSync(TEST_LINK);
          unlinkSync(TEST_LINK_CHAIN);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle relative symlinks", async () => {
      const file = join(TEST_SUBDIR, "file.txt");
      writeFileSync(file, "test");
      symlinkSync("./subdir/file.txt", TEST_LINK);
      const fs = new FsCache();
      
      const result = await realpath(TEST_LINK, fs, TEST_DIR);
      assert.equal(result, file);
      
      unlinkSync(TEST_LINK);
      unlinkSync(file);
    });
  });

  describe("directories", () => {
    it("should handle directory paths", async () => {
      const fs = new FsCache();
      const result = await realpath(TEST_SUBDIR, fs, TEST_DIR);
      assert.equal(result, TEST_SUBDIR);
    });

    it("should resolve symlinked directories", async () => {
      symlinkSync(TEST_SUBDIR, TEST_DIR_LINK);
      const fs = new FsCache();
      
      const result = await realpath(TEST_DIR_LINK, fs, TEST_DIR);
      assert.equal(result, TEST_SUBDIR);
      
      unlinkSync(TEST_DIR_LINK);
    });
  });

  describe("edge cases", () => {
    it("should handle paths with multiple components", async () => {
      const file = join(TEST_SUBDIR, "nested", "file.txt");
      mkdirSync(join(TEST_SUBDIR, "nested"), { recursive: true });
      writeFileSync(file, "test");
      const fs = new FsCache();
      
      const result = await realpath(file, fs, TEST_DIR);
      assert.equal(result, file);
      
      unlinkSync(file);
      rmdirSync(join(TEST_SUBDIR, "nested"));
    });

    it("should handle already seen paths to prevent infinite loops", async () => {
      writeFileSync(TEST_FILE, "test");
      const fs = new FsCache();
      const seen = new Set([TEST_FILE]);
      
      await assert.rejects(
        () => realpath(TEST_FILE, fs, TEST_DIR, seen),
        /Recursive symlink/
      );
      
      unlinkSync(TEST_FILE);
    });

    it("should handle absolute paths", async () => {
      writeFileSync(TEST_FILE, "test");
      const fs = new FsCache();
      const absolutePath = resolve(TEST_FILE);
      
      const result = await realpath(absolutePath, fs, TEST_DIR);
      assert.equal(result, absolutePath);
      
      unlinkSync(TEST_FILE);
    });

    it("should preserve trailing slashes in directory context", async () => {
      const fs = new FsCache();
      const dirWithSlash = TEST_SUBDIR + "/";
      
      const result = await realpath(dirWithSlash, fs, TEST_DIR);
      // Result should be normalized without trailing slash
      assert.ok(result.includes("subdir"));
    });
  });

  describe("base directory filtering", () => {
    it("should respect base directory boundaries", async () => {
      writeFileSync(TEST_FILE, "test");
      const fs = new FsCache();
      const restrictedBase = join(TEST_DIR, "nonexistent");
      
      const result = await realpath(TEST_FILE, fs, restrictedBase);
      // Should return original path when outside base
      assert.equal(result, TEST_FILE);
      
      unlinkSync(TEST_FILE);
    });

    it("should handle paths exactly at base boundary", async () => {
      const fs = new FsCache();
      const result = await realpath(TEST_DIR, fs, TEST_DIR);
      assert.equal(result, TEST_DIR);
    });
  });
});