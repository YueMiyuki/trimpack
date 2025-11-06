import { createRequire, builtinModules } from "node:module";
import { dirname, resolve as resolvePath, join as joinPath } from "node:path";
import type { FsCache } from "./fs-cache.js";

const JS_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

const builtinSet = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

export function isBuiltin(id: string): boolean {
  return builtinSet.has(id) || id.startsWith("node:");
}

const resolveCache = new Map<string, string | null>();
type PackageJson = {
  exports?: unknown;
  main?: unknown;
  module?: unknown;
  [key: string]: unknown;
};
const pjsonCache = new Map<string, PackageJson>();

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

function isRelative(spec: string) {
  return (
    spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")
  );
}

async function readPackageSpec(
  req: NodeJS.Require,
  spec: string,
  fs: FsCache,
): Promise<{ root: string; pjson: PackageJson } | null> {
  try {
    const pkgJsonPath = req.resolve(spec + "/package.json");
    const root = dirname(pkgJsonPath);
    const json = await fs.readFile(pkgJsonPath, "utf8");
    const parsed: unknown = JSON.parse(String(json));
    if (!parsed || typeof parsed !== "object") return null;
    const pjson = parsed as PackageJson;
    pjsonCache.set(pkgJsonPath, pjson);
    return { root, pjson };
  } catch {
    return null;
  }
}

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

  let target: string | null = null;

  if (exportsField) {
    if (typeof exportsField === "string") {
      target = exportsField;
    } else if (
      typeof exportsField === "object" &&
      exportsField !== null &&
      !Array.isArray(exportsField)
    ) {
      const exportsObj = exportsField as Record<string, unknown>;
      const entryVal = exportsObj[key] ?? (subpath ? null : exportsObj["."]);
      if (typeof entryVal === "string") target = entryVal;
      else if (
        entryVal &&
        typeof entryVal === "object" &&
        !Array.isArray(entryVal)
      ) {
        const entryObj = entryVal as Record<string, unknown>;
        // choose condition
        const order = preferImport
          ? ["import", "default", "require"]
          : ["require", "default", "import"];
        for (const cond of order) {
          const val = entryObj[cond];
          if (typeof val === "string") {
            target = val;
            break;
          }
        }
        if (!target) {
          // fall back to first string value
          for (const k of Object.keys(entryObj)) {
            const val = entryObj[k];
            if (typeof val === "string") {
              target = val;
              break;
            }
          }
        }
      }
    }
  }

  if (!target && mainField) target = mainField;
  if (!target) target = "index.js";

  // Join with pkg root
  if (target.startsWith("./")) target = target.slice(2);
  const full = joinPath(pkgRoot, target);

  // Try as-is then add extension/index fallbacks
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
