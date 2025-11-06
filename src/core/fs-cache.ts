import { promises as fsp } from "node:fs";
import { Semaphore } from "./semaphore.js";

interface FsCacheOptions {
  concurrency?: number;
}

export class FsCache {
  private readonly sem: Semaphore;
  private readonly readCache = new Map<string, Promise<string | Buffer>>();
  private readonly statCache = new Map<
    string,
    Promise<import("node:fs").Stats>
  >();
  private readonly readlinkCache = new Map<string, Promise<string | null>>();

  constructor(opts: FsCacheOptions = {}) {
    this.sem = new Semaphore(Math.max(8, opts.concurrency ?? 256));
  }

  async readFile(path: string, encoding: BufferEncoding | null = "utf8") {
    const key = `${path}|${encoding ?? "bin"}`;
    let p = this.readCache.get(key);
    if (!p) {
      p = this.wrap(async () => {
        try {
          return encoding
            ? await fsp.readFile(path, encoding)
            : await fsp.readFile(path);
        } catch (e: unknown) {
          const error = e as Error & { code?: string };
          if (error && (error.code === "EMFILE" || error.code === "ENFILE")) {
            // brief backoff
            await new Promise<void>((r) => setTimeout(r, 5));
            return encoding
              ? await fsp.readFile(path, encoding)
              : await fsp.readFile(path);
          }
          throw e;
        }
      });
      this.readCache.set(key, p);
    }
    return p;
  }

  async stat(path: string) {
    let p = this.statCache.get(path);
    if (!p) {
      p = this.wrap(() => fsp.stat(path));
      this.statCache.set(path, p);
    }
    return p;
  }

  async readlink(path: string) {
    let p = this.readlinkCache.get(path);
    if (!p) {
      p = this.wrap(async () => {
        try {
          return await fsp.readlink(path, { encoding: "utf8" });
        } catch (e: unknown) {
          const error = e as Error & { code?: string };
          if (error && error.code === "EINVAL") return null; // not a symlink
          if (error && error.code === "ENOENT") return null;
          throw e;
        }
      });
      this.readlinkCache.set(path, p);
    }
    return p;
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.sem.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
