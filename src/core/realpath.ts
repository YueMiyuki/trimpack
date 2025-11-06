import { dirname, resolve, sep, join, basename } from "node:path";
import type { FsCache } from "./fs-cache.js";

/**
 * Resolve a filesystem path by recursively following symlinks, constrained to a base directory.
 *
 * @param path - The path to resolve.
 * @param fs - Filesystem cache providing `readlink` used to detect symlinks.
 * @param base - Base directory used to determine whether a path should be resolved; paths outside `base` are returned unchanged.
 * @param seen - Internal set of already-visited paths to detect cycles (optional).
 * @returns The resolved real path when resolution occurs inside `base`, otherwise the original `path`.
 * @throws Error if a recursive symlink cycle is detected while resolving `path`.
 */
export async function realpath(
  path: string,
  fs: FsCache,
  base: string,
  seen = new Set<string>(),
): Promise<string> {
  if (seen.has(path))
    throw new Error("Recursive symlink detected resolving " + path);
  seen.add(path);
  const symlink = await fs.readlink(path);
  if (symlink) {
    const parent = dirname(path);
    const resolved = resolve(parent, symlink);
    const realParent = await realpath(parent, fs, base, seen);
    if (inPath(path, realParent)) {
      // noop – we only emit within base in the caller
    }
    return realpath(resolved, fs, base, seen);
  }
  if (!inPath(path, base)) return path;
  return join(await realpath(dirname(path), fs, base, seen), basename(path));
}

/**
 * Determines whether `path` resides under the given `parent` directory.
 *
 * @param path - The path to test.
 * @param parent - The parent directory to check against.
 * @returns `true` if `path` is inside `parent` (not equal to `parent` itself), `false` otherwise.
 */
function inPath(path: string, parent: string) {
  const pathWithSep = join(parent, sep);
  return path.startsWith(pathWithSep) && path !== pathWithSep;
}