import { createRequire, builtinModules } from "node:module";
import { dirname, resolve as resolvePath, join as joinPath } from "node:path";
import type { FsCache } from "./fs-cache.js";

const JS_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

const builtinSet = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

/**
 * Check whether a module identifier refers to a Node.js built-in module.
 *
 * @param id - Module identifier (may be a core name like `fs` or a `node:`-prefixed name)
 * @returns `true` if `id` is a Node built-in (including `node:`-prefixed names), `false` otherwise.
 */
export function isBuiltin(id: string): boolean {
  // Only treat as builtin if it exactly matches a known core module
  // or a known "node:"-prefixed core module. Do not consider bare "node:" as builtin.
  return builtinSet.has(id);
}

const resolveCache = new Map<string, string | null>();
type PackageJson = {
  exports?: unknown;
  main?: unknown;
  module?: unknown;
  [key: string]: unknown;
};
const pjsonCache = new Map<string, PackageJson>();

/**
 * Resolve a module specifier to an absolute filesystem path from the context of a source file.
 *
 * @param fromFile - Absolute path of the file doing the import or require; used as resolution context
 * @param spec - Module specifier (package name, scoped or subpath, relative path, or builtin id)
 * @param fs - Filesystem cache interface used for on-disk checks and package.json reads
 * @returns The resolved absolute filesystem path for `spec`, or `null` if resolution failed or `spec` is a Node builtin
 */
export async function resolveId(
  fromFile: string,
  spec: string,
  fs: FsCache,
): Promise<string | null> {
  if (isBuiltin(spec)) return null;
  const cacheKey = fromFile + "\0" + spec;
  if (resolveCache.has(cacheKey)) return resolveCache.get(cacheKey)!;

  const req = createRequire(fromFile);
  try {
    const r = req.resolve(spec);
    resolveCache.set(cacheKey, r);
    return r;
  } catch (e: unknown) {
    void e;
  }

  if (isRelative(spec)) {
    const rel = await resolveRelativeTs(fromFile, spec, fs);
    resolveCache.set(cacheKey, rel);
    return rel;
  }

  const pkg = await readPackageSpec(req, spec, fs);
  if (pkg) {
    const target = await resolvePackageExports(
      pkg.root,
      pkg.pjson,
      spec,
      /*preferImport*/ true,
      fs,
    );
    if (target) {
      resolveCache.set(cacheKey, target);
      return target;
    }
  }

  resolveCache.set(cacheKey, null);
  return null;
}

/**
 * Resolve a relative or absolute module spec to an existing filesystem path using JS/TS extensions and index fallbacks.
 *
 * @param fromFile - The importer file path used as the base directory for resolving `spec`.
 * @param spec - A relative (./ or ../) or absolute (/) module spec to resolve.
 * @returns The filesystem path of the first candidate file that exists, or `null` if no match is found.
 */
async function resolveRelativeTs(
  fromFile: string,
  spec: string,
  fs: FsCache,
): Promise<string | null> {
  const base = resolvePath(dirname(fromFile), spec);
  const candidates = [
    base,
    ...JS_EXTS.map((e) => base + e),
    ...JS_EXTS.map((e) => resolvePath(base, "index" + e)),
  ];
  for (const c of candidates) {
    try {
      const st = await fs.stat(c);
      if (st.isFile()) return c;
    } catch (e: unknown) {
      // keep trying
      void e;
    }
  }
  return null;
}

/**
 * Determines whether a module specifier is a relative or absolute path.
 *
 * @param spec - The module specifier to check (e.g., "./foo", "../bar", "/baz", "pkg/name")
 * @returns `true` if `spec` starts with "./", "../", or "/", `false` otherwise.
 */
function isRelative(spec: string) {
  return (
    spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")
  );
}

/**
 * Locate, read, and parse the package.json for the given package spec, returning its package root and parsed manifest or `null` if unavailable or invalid.
 *
 * @param req - The Node `require` used to resolve the package.json path for `spec`
 * @param spec - The package specifier (package name or path) to resolve
 * @param fs - Filesystem cache providing `readFile` used to read the resolved package.json
 * @returns An object with `root` (the package directory) and `pjson` (the parsed package.json) if successful, `null` otherwise
 */
async function readPackageSpec(
  req: NodeJS.Require,
  spec: string,
  fs: FsCache,
): Promise<{ root: string; pjson: PackageJson } | null> {
  // Extract the package root from a subpath spec (e.g., "pkg/foo" -> "pkg", "@scope/pkg/x" -> "@scope/pkg").
  // This ensures we resolve "<package>/package.json" rather than "<package>/<subpath>/package.json".
  const subpath = getSubpathFromSpec(spec);
  const packageName =
    !isRelative(spec) && !spec.startsWith("node:")
      ? subpath && subpath.length
        ? spec.slice(0, spec.length - subpath.length)
        : spec
      : null;

  // Try to resolve the spec to a concrete file first; from there walk up to the nearest package.json
  let resolved: string | null = null;
  try {
    resolved = req.resolve(spec);
  } catch {
    resolved = null;
  }

  const findNearestPkgJson = async (
    startDir: string,
  ): Promise<string | null> => {
    let dir = startDir;
    const seen = new Set<string>();
    while (!seen.has(dir)) {
      seen.add(dir);
      const candidate = joinPath(dir, "package.json");
      try {
        const st = await fs.stat(candidate);
        if (st.isFile()) {
          // If we know the package name, prefer a matching package.json
          if (packageName) {
            let cached = pjsonCache.get(candidate);
            if (!cached) {
              try {
                const content = await fs.readFile(candidate, "utf8");
                const parsed = JSON.parse(String(content)) as PackageJson & {
                  name?: unknown;
                };
                cached = parsed;
                pjsonCache.set(candidate, parsed);
              } catch {
                // ignore parse errors, continue upward
              }
            }
            const name = (cached?.name as string | undefined) ?? undefined;
            if (
              !packageName ||
              (typeof name === "string" && name === packageName)
            ) {
              return candidate;
            }
            // If name doesn't match, continue walking up in case of nested packages
          } else {
            // No base available; use the first package.json encountered
            return candidate;
          }
        }
      } catch {
        // ignore missing file, continue upward
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  };

  // If we resolved to a file, prefer the nearest package.json from that location
  let pkgJsonPath: string | null = null;
  if (resolved) {
    pkgJsonPath = await findNearestPkgJson(dirname(resolved));
  }

  // Fallback: try resolving the package's package.json directly (may fail if exports hides it)
  if (!pkgJsonPath && packageName) {
    try {
      const p = req.resolve(`${packageName}/package.json`);
      pkgJsonPath = p;
    } catch {
      // ignore
    }
  }

  if (!pkgJsonPath) return null;

  const root = dirname(pkgJsonPath);
  let pjson = pjsonCache.get(pkgJsonPath);
  if (!pjson) {
    try {
      const json = await fs.readFile(pkgJsonPath, "utf8");
      const parsed: unknown = JSON.parse(String(json));
      if (!parsed || typeof parsed !== "object") return null;
      pjson = parsed as PackageJson;
      pjsonCache.set(pkgJsonPath, pjson);
    } catch {
      return null;
    }
  }

  return { root, pjson };
}

/**
 * Resolve a package export target for a given spec using package.json `exports`/`module`/`main` fields and filesystem fallbacks.
 *
 * @param pkgRoot - Absolute path to the package root directory containing the package.json
 * @param pjson - Parsed package.json object for the package at pkgRoot
 * @param spec - The original import/require specifier (used to derive subpath keys for `exports`)
 * @param preferImport - When `true`, prefer `import` then `default` then `require` entries from an `exports` object; when `false`, prefer `require` then `default` then `import`
 * @returns The resolved file path inside the package that exists on disk, or `null` if no candidate file was found
 */
async function resolvePackageExports(
  pkgRoot: string,
  pjson: PackageJson,
  spec: string,
  preferImport: boolean,
  fs: FsCache,
): Promise<string | null> {
  const exportsField = pjson?.exports;
  const mainField =
    (typeof pjson?.module === "string" ? pjson.module : undefined) ??
    (typeof pjson?.main === "string" ? pjson.main : undefined);

  const subpath = getSubpathFromSpec(spec);
  const key = subpath ? "." + subpath : ".";

  // 1) Try to derive a mapping from exports
  let target = deriveExportTarget(exportsField, key, preferImport);

  // 2) Fall back to main/index only for the root (no subpath)
  if (!target && subpath === "" && mainField) target = mainField;
  if (!target && subpath === "") target = "index.js";

  // 3) If no mapping still, give up
  if (!target) return null;

  // 4) Normalize and attempt to resolve to an on-disk file
  if (target.startsWith("./")) target = target.slice(2);
  const full = joinPath(pkgRoot, target);
  return await tryResolveWithExtensions(full, fs);
}

// Prefer import/default/require (or the inverse) and handle wildcard keys
function deriveExportTarget(
  exportsField: unknown,
  key: string,
  preferImport: boolean,
): string | null {
  if (!exportsField) return null;

  if (typeof exportsField === "string") {
    return exportsField;
  }

  if (typeof exportsField !== "object" || exportsField === null) {
    return null;
  }

  const exportsObj = exportsField as Record<string, unknown>;
  const entryVal = exportsObj[key] ?? exportsObj["."];
  const order = preferImport
    ? ["import", "default", "require"]
    : ["require", "default", "import"];

  // Exact key match
  const fromEntry = pickStringFromEntry(entryVal, order);
  if (fromEntry) return fromEntry;

  // Wildcard match like "./*"
  return matchWildcard(exportsObj, key, order);
}

function pickStringFromEntry(
  entryVal: unknown,
  order: string[],
): string | null {
  if (typeof entryVal === "string") return entryVal;
  if (entryVal && typeof entryVal === "object" && !Array.isArray(entryVal)) {
    const entryObj = entryVal as Record<string, unknown>;
    for (const cond of order) {
      const val = entryObj[cond];
      if (typeof val === "string") return val;
    }
    for (const k of Object.keys(entryObj)) {
      const val = entryObj[k];
      if (typeof val === "string") return val;
    }
  }
  return null;
}

function matchWildcard(
  exportsObj: Record<string, unknown>,
  key: string,
  order: string[],
): string | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tryWildcard = (patKey: string, val: unknown): string | null => {
    if (!patKey.includes("*")) return null;
    const re = new RegExp("^" + esc(patKey).replace(/\\\*/g, "(.+)") + "$");
    const m = re.exec(key);
    if (!m || typeof m[1] !== "string") return null;
    const star: string = m[1];
    const replaceStar = (t: string) => t.replace(/\*/g, star);
    if (typeof val === "string") return replaceStar(val);
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      for (const cond of order) {
        const v = obj[cond];
        if (typeof v === "string") return replaceStar(v);
      }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string") return replaceStar(v);
      }
    }
    return null;
  };

  for (const [k, v] of Object.entries(exportsObj)) {
    const mapped = tryWildcard(k, v);
    if (mapped) return mapped;
  }
  return null;
}

async function tryResolveWithExtensions(
  full: string,
  fs: FsCache,
): Promise<string | null> {
  const tried = new Set<string>();
  const tryList = [
    full,
    ...JS_EXTS.map((e) => full + e),
    ...JS_EXTS.map((e) => joinPath(full, "index" + e)),
  ];
  for (const cand of tryList) {
    if (tried.has(cand)) continue;
    tried.add(cand);
    try {
      const st = await fs.stat(cand);
      if (st.isFile()) return cand;
    } catch (e: unknown) {
      void e;
    }
  }
  return null;
}

/**
 * Extracts the package subpath portion from a module specifier.
 *
 * @param spec - The module specifier (e.g., package name, scoped package, relative path, or `node:`-prefixed id)
 * @returns The subpath including a leading `/` (for example, `/sub/path` or `/x`), or an empty string if the spec has no package subpath or is relative/`node:`-prefixed
 */
function getSubpathFromSpec(spec: string): string {
  // from 'pkg/sub/path' -> '/sub/path'; from '@scope/pkg/x' -> '/x'
  if (isRelative(spec) || spec.startsWith("node:")) return "";
  // handle scoped
  if (spec.startsWith("@")) {
    const second = spec.indexOf("/");
    if (second === -1) return "";
    const third = spec.indexOf("/", second + 1);
    return third === -1 ? "" : spec.slice(third);
  }
  const first = spec.indexOf("/");
  return first === -1 ? "" : spec.slice(first);
}
