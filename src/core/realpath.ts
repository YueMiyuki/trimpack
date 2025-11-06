import { dirname, resolve, sep, join, basename } from "node:path";
import type { FsCache } from "./fs-cache.js";

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

function inPath(path: string, parent: string) {
  const pathWithSep = join(parent, sep);
  return path.startsWith(pathWithSep) && path !== pathWithSep;
}
