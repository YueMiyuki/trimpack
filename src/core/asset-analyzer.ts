import { extname, dirname, resolve } from "node:path";
import { FsCache } from "./fs-cache.js";
import { Semaphore } from "./semaphore.js";
import { resolveId, isBuiltin } from "./resolver.js";

interface AssetAnalyzeOptions {
  base?: string;
  external?: string[];
  concurrency?: number;
  includeAssets?: boolean;
}

interface AssetAnalyzeResult {
  dependencies: Set<string>;
  assets: Set<string>;
}

export class AssetAnalyzer {
  private fs: FsCache;
  private semaphore: Semaphore;
  private external: Set<string>;
  private includeAssets: boolean;

  // Simple patterns for import/require detection
  private static readonly IMPORT_PATTERNS = [
    // ES6 imports
    /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g,
    // CommonJS requires
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Dynamic imports
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Conditional requires (basic)
    /require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  // Asset patterns (files that might be loaded at runtime)
  private static readonly ASSET_PATTERNS = [
    // Template strings with file paths
    /`[^`]*\$\{[^}]*\}[^`]*\.(json|txt|html|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|pdf)[^`]*`/g,
    // String concatenation with file paths
    /['"][^'"]*['"][^+]*\+[^+]*['"][^'"]*\.(json|txt|html|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|pdf)[^'"]*['"]/g,
    // Direct file references
    /['"]([^'"]*\.(json|txt|html|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|pdf))['"]/g,
  ];

  constructor(options: AssetAnalyzeOptions = {}) {
    this.fs = new FsCache({ concurrency: options.concurrency || 256 });
    this.semaphore = new Semaphore(options.concurrency || 256);
    this.external = new Set(options.external || []);
    this.includeAssets = options.includeAssets ?? true;
  }

  async analyze(entry: string): Promise<AssetAnalyzeResult> {
    const visited = new Set<string>();
    const dependencies = new Set<string>();
    const assets = new Set<string>();
    const queue: string[] = [resolve(entry)];

    while (queue.length > 0) {
      const file = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);

      const release = await this.semaphore.acquire();
      try {
        const result = await this.analyzeFile(file);

        // Process dependencies
        for (const dep of result.deps) {
          if (this.shouldSkipDependency(dep)) continue;

          const resolved = await resolveId(file, dep, this.fs);
          if (resolved && !visited.has(resolved)) {
            queue.push(resolved);
            dependencies.add(resolved);
          }
        }

        // Process assets if enabled
        if (this.includeAssets) {
          for (const asset of result.assets) {
            assets.add(asset);
          }
        }
      } finally {
        release();
      }
    }

    return { dependencies, assets };
  }

  private async analyzeFile(
    filePath: string,
  ): Promise<{ deps: string[]; assets: string[] }> {
    const ext = extname(filePath);
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

    if (!jsLike.has(ext)) {
      return { deps: [], assets: [] };
    }

    let content: string;
    try {
      content = (await this.fs.readFile(filePath, "utf8")) as string;
    } catch {
      return { deps: [], assets: [] };
    }

    return this.extractDependenciesFromCode(content, filePath);
  }

  private extractDependenciesFromCode(
    code: string,
    filePath: string,
  ): { deps: string[]; assets: string[] } {
    const deps = new Set<string>();
    const assets = new Set<string>();

    // Extract imports/requires using regex patterns
    for (const pattern of AssetAnalyzer.IMPORT_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex state
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const specifier = match[1];
        if (specifier && !this.shouldSkipDependency(specifier)) {
          deps.add(specifier);
        }
      }
    }

    // Extract potential assets if enabled
    if (this.includeAssets) {
      for (const pattern of AssetAnalyzer.ASSET_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(code)) !== null) {
          const assetPath = match[1] || match[0];
          if (assetPath && this.looksLikeAssetPath(assetPath)) {
            // Resolve relative to current file
            const resolved = resolve(dirname(filePath), assetPath);
            assets.add(resolved);
          }
        }
      }
    }

    // Enhanced pattern: look for __dirname and __filename usage
    this.extractDirnamePatterns(code, filePath, deps, assets);

    return { deps: Array.from(deps), assets: Array.from(assets) };
  }

  private extractDirnamePatterns(
    code: string,
    filePath: string,
    deps: Set<string>,
    assets: Set<string>,
  ): void {
    // Pattern: require(path.join(__dirname, './module'))
    const dirnamePattern = /__dirname\s*[+,\s]*['"]([^'"]+)['"]/g;
    let match;
    while ((match = dirnamePattern.exec(code)) !== null) {
      const relativePath = match[1];
      if (
        relativePath &&
        (relativePath.startsWith("./") || relativePath.startsWith("../"))
      ) {
        const resolved = resolve(dirname(filePath), relativePath);
        if (this.looksLikeModule(relativePath)) {
          deps.add(relativePath);
        } else if (
          this.includeAssets &&
          this.looksLikeAssetPath(relativePath)
        ) {
          assets.add(resolved);
        }
      }
    }

    // Pattern: fs.readFileSync(path.resolve(__dirname, 'file.json'))
    const resolvePattern =
      /path\.resolve\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = resolvePattern.exec(code)) !== null) {
      const relativePath = match[1];
      if (relativePath) {
        const resolved = resolve(dirname(filePath), relativePath);
        if (this.includeAssets && this.looksLikeAssetPath(relativePath)) {
          assets.add(resolved);
        }
      }
    }
  }

  private shouldSkipDependency(specifier: string): boolean {
    // Skip builtins
    if (isBuiltin(specifier)) return true;

    // Skip external dependencies
    if (this.external.has(specifier) || this.external.has(specifier + "/"))
      return true;

    // Skip URL-like specifiers
    if (/^[a-zA-Z]+:/.test(specifier)) return true;

    // Skip relative paths that don't look like modules
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      return !this.looksLikeModule(specifier);
    }

    return false;
  }

  private looksLikeModule(path: string): boolean {
    const ext = extname(path);
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
    return (
      jsLike.has(ext) ||
      path.endsWith("/index") ||
      (!ext && !path.includes("."))
    );
  }

  private looksLikeAssetPath(path: string): boolean {
    const ext = extname(path);
    const assetExts = new Set([
      ".json",
      ".txt",
      ".html",
      ".css",
      ".svg",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".pdf",
      ".node",
    ]);
    return assetExts.has(ext);
  }
}
