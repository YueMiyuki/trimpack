import { FsCache } from "./fs-cache.js";
import { realpath } from "./realpath.js";
import { resolveId, isBuiltin } from "./resolver.js";
import { scanSpecifiers } from "./import-scanner.js";
import { resolve as resolvePath, extname } from "node:path";

interface TraceOptions {
  base?: string;
  external?: string[];
  concurrency?: number;
}

/**
 * Trace the module dependency graph from an entry file and collect all visited file paths.
 *
 * @param entry - Path to the entry file to begin tracing from
 * @param opts - Optional tracing options
 * @param opts.base - Base directory used for realpath resolution (defaults to current working directory)
 * @param opts.external - List of module specifiers to treat as external (excluded from tracing)
 * @param opts.concurrency - Maximum concurrent filesystem operations (defaults to 256)
 * @returns A Set of file paths for all modules visited while tracing from `entry`
 */
export async function traceDependencies(
  entry: string,
  opts: TraceOptions = {},
) {
  const base = resolvePath(opts.base || process.cwd());
  const fs = new FsCache({ concurrency: opts.concurrency ?? 256 });
  const visited = new Set<string>();
  const queue: string[] = [resolvePath(entry)];
  const jsLike = new Set([
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".jsx",
    "",
  ]);
  const external = new Set(opts.external || []);

  while (queue.length) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const rp = await realpath(file, fs, base).catch(() => file);
    const ext = extname(rp);
    if (!jsLike.has(ext)) continue;

    let code = "";
    try {
      code = (await fs.readFile(rp, "utf8")) as string;
    } catch {
      continue;
    }

    const specs = scanSpecifiers(code);
    for (const spec of specs) {
      // skip URL-like specifiers (http:, https:, data:, file:)
      if (/^[a-zA-Z]+:/.test(spec)) continue;
      if (isBuiltin(spec)) continue;
      if (external.has(spec) || external.has(spec + "/")) continue;
      const resolved = await resolveId(rp, spec, fs);
      if (resolved) queue.push(resolved);
    }
  }

  return visited;
}