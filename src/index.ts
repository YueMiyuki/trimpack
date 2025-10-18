import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { build, type BuildOptions } from "esbuild";
import { createRequire } from "node:module";
import { Logger, type LogType } from "./logger.js";
import type {
  PackerOptions,
  PackageJson,
  DependencyMap,
  PackReport,
  PackResult,
  LogLevel,
  ExtractedPackageInfo,
} from "./types.js";

const require = createRequire(import.meta.url);

// Internal options that include esbuild-specific settings
interface InternalOptions extends Required<PackerOptions> {
  platform: "node" | "neutral" | "browser";
  target: string;
  format: "esm" | "cjs" | "iife";
}

export class DependencyPacker {
  private readonly options: InternalOptions;
  private rootPackageJson: PackageJson | null = null;
  private readonly logger: Logger;

  constructor(options: PackerOptions = {}) {
    // Initialize logger
    this.logger = new Logger({ silent: options.json ?? false });

    this.options = {
      output: options.output ?? "deps.json",
      external: options.external ?? ["node:*"],
      includeDevDependencies: options.includeDevDependencies ?? false,
      includePeerDependencies: options.includePeerDependencies ?? false,
      verbose: options.verbose ?? false,
      merge: options.merge ?? false,
      preserveFields: options.preserveFields ?? [],
      minimalOutput: options.minimalOutput ?? false,
      json: options.json ?? false,
      // Internal options for esbuild (not exposed to users)
      platform: "node" as const,
      target: "node18",
      format: "esm" as const,
    };
  }

  private log(message: string, type: LogType = "info"): void {
    // Only show debug messages in verbose mode
    if (!this.options.verbose && type === "debug") return;
    this.logger.log(message, type);
  }

  public async pack(
    entryPoint: string,
    customOptions: PackerOptions = {},
  ): Promise<PackResult> {
    const startTime = Date.now();
    const options = { ...this.options, ...customOptions };

    try {
      // Validate entry point
      const entry = resolve(entryPoint);
      if (!existsSync(entry)) {
        throw new Error(`Entry point not found: ${entry}`);
      }

      this.log(`Analyzing dependencies for: ${relative(process.cwd(), entry)}`);

      // Load root package.json
      this.rootPackageJson = this.loadPackageJson(process.cwd());

      // Analyze dependencies
      const dependencies = await this.analyzeDependencies(entry, options);

      // Generate or merge package.json
      let packageJson: PackageJson;

      if (options.merge && existsSync(options.output)) {
        // Merge with existing package.json
        const existing = JSON.parse(
          readFileSync(options.output, "utf8"),
        ) as PackageJson;
        packageJson = this.mergePackageJson(existing, dependencies, options);
      } else if (options.minimalOutput) {
        // Minimal output - only dependencies
        packageJson = {
          dependencies: Object.fromEntries(dependencies),
        };
      } else {
        // Generate new package.json
        packageJson = this.generatePackageJson(dependencies, options);
      }

      // Output handling
      if (options.json) {
        // Output to stdout as JSON
        console.log(JSON.stringify(packageJson, null, 2));
      } else {
        // Write to file
        writeFileSync(options.output, JSON.stringify(packageJson, null, 2));
        this.log(`Package.json written to: ${options.output}`, "success");
      }

      // Generate report
      const report = this.generateReport(dependencies, startTime);

      if (!options.json) {
        this.log(
          `Successfully analyzed ${dependencies.size} dependencies in ${Date.now() - startTime}ms`,
          "success",
        );
      }

      return {
        dependencies: Array.from(dependencies.entries()),
        packageJson,
        report,
        outputFile: options.output,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(`Analysis failed: ${errorMessage}`, "error");
      throw error;
    }
  }

  private async analyzeDependencies(
    entry: string,
    options: InternalOptions,
  ): Promise<DependencyMap> {
    this.log("Analyzing dependencies...", "debug");

    const buildOptions: BuildOptions = {
      entryPoints: [entry],
      bundle: true,
      platform: options.platform as "node" | "neutral" | "browser",
      target: options.target,
      metafile: true,
      write: false,
      external: options.external,
      format: options.format as "esm" | "cjs" | "iife",
      minify: false,
      treeShaking: true,
      sourcemap: false,
      logLevel: "silent",
    };

    const result = await build(buildOptions);

    if (!result.metafile) {
      throw new Error("Failed to generate metafile during build analysis");
    }

    const dependencies: DependencyMap = new Map();
    const processed = new Set<string>();

    // Extract dependencies from metafile
    for (const path in result.metafile.inputs) {
      if (!path.includes("node_modules")) continue;

      const packageInfo = this.extractPackageInfo(path);
      if (!packageInfo) continue;

      const { name, version } = packageInfo;

      if (processed.has(name)) continue;
      processed.add(name);

      const resolvedVersion = this.resolveVersion(name, version);

      if (resolvedVersion) {
        dependencies.set(name, resolvedVersion);
        this.log(`Found dependency: ${name}@${resolvedVersion}`, "debug");
      }
    }

    return dependencies;
  }

  private extractPackageInfo(modulePath: string): ExtractedPackageInfo | null {
    const patterns = [
      // Scoped packages: @org/package
      /node_modules[/\\](?:\.pnpm[/\\])?(@[^/\\]+[/\\][^@/\\]+)/,
      // Regular packages: package
      /node_modules[/\\](?:\.pnpm[/\\])?([^@/\\]+)/,
    ];

    for (const pattern of patterns) {
      const match = modulePath.match(pattern);
      if (match && match[1]) {
        const fullMatch = match[1];

        // For pnpm, extract version from path if available
        let version: string | null = null;
        if (modulePath.includes(".pnpm")) {
          const versionMatch = modulePath.match(
            new RegExp(`${fullMatch.replace("/", "[/\\\\]")}@([^/\\\\]+)`),
          );
          if (versionMatch) {
            version = versionMatch[1] || null;
          }
        }

        return {
          name: fullMatch,
          version,
        };
      }
    }

    return null;
  }

  private resolveVersion(
    packageName: string,
    extractedVersion: string | null,
  ): string | null {
    // Priority: extracted version > root package.json > package's own package.json

    if (extractedVersion && !extractedVersion.includes("node_modules")) {
      return extractedVersion;
    }

    // Check root package.json
    if (this.rootPackageJson) {
      const version =
        this.rootPackageJson.dependencies?.[packageName] ||
        (this.options.includeDevDependencies &&
          this.rootPackageJson.devDependencies?.[packageName]) ||
        (this.options.includePeerDependencies &&
          this.rootPackageJson.peerDependencies?.[packageName]);

      if (version) return version;
    }

    // Try to read from package's own package.json
    try {
      const packageJsonPath = require.resolve(`${packageName}/package.json`);
      const packageJson: PackageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf8"),
      );
      return packageJson.version ? `^${packageJson.version}` : "latest";
    } catch {
      return "latest";
    }
  }

  private loadPackageJson(dir: string): PackageJson | null {
    try {
      const packageJsonPath = resolve(dir, "package.json");
      if (existsSync(packageJsonPath)) {
        return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(`Failed to load package.json: ${errorMessage}`, "warn");
    }
    return null;
  }

  private mergePackageJson(
    existing: PackageJson,
    dependencies: DependencyMap,
    options: InternalOptions,
  ): PackageJson {
    const merged: PackageJson = { ...existing };

    // Convert dependencies map to object
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {};
    const peerDeps: Record<string, string> = {};

    for (const [name, version] of dependencies) {
      // Categorize based on original package.json
      if (
        this.rootPackageJson?.devDependencies?.[name] &&
        options.includeDevDependencies
      ) {
        devDeps[name] = version;
      } else if (
        this.rootPackageJson?.peerDependencies?.[name] &&
        options.includePeerDependencies
      ) {
        peerDeps[name] = version;
      } else {
        deps[name] = version;
      }
    }

    // Merge dependencies
    merged.dependencies = {
      ...merged.dependencies,
      ...deps,
    };

    if (Object.keys(devDeps).length > 0) {
      merged.devDependencies = {
        ...merged.devDependencies,
        ...devDeps,
      };
    }

    if (Object.keys(peerDeps).length > 0) {
      merged.peerDependencies = {
        ...merged.peerDependencies,
        ...peerDeps,
      };
    }

    return merged;
  }

  private generatePackageJson(
    dependencies: DependencyMap,
    options: InternalOptions,
  ): PackageJson {
    const base = this.rootPackageJson || {};

    const packageJson: PackageJson = {
      name: base.name || basename(process.cwd()),
      version: base.version || "1.0.0",
      description:
        base.description ||
        "Auto-generated package.json with detected dependencies",
      type: options.format === "esm" ? "module" : "commonjs",
      engines: {
        node: options.target.replace("node", ">="),
      },
    };

    // Add preserved fields
    const pkgJson = packageJson as Record<string, unknown>;
    const baseObj = base as Record<string, unknown>;

    if (options.preserveFields.length > 0 && base) {
      for (const field of options.preserveFields) {
        if (field in base) {
          pkgJson[field] = baseObj[field];
        }
      }
    } else {
      // Default fields to preserve if not specified
      const defaultFields: (keyof PackageJson)[] = [
        "keywords",
        "author",
        "license",
        "repository",
        "bugs",
        "homepage",
        "funding",
        "main",
        "module",
        "types",
        "exports",
        "scripts",
      ];

      for (const field of defaultFields) {
        if (base[field]) {
          pkgJson[field] = base[field];
        }
      }
    }

    // Add dependencies
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {};
    const peerDeps: Record<string, string> = {};

    for (const [name, version] of dependencies) {
      // Categorize based on original package.json
      if (
        this.rootPackageJson?.devDependencies?.[name] &&
        options.includeDevDependencies
      ) {
        devDeps[name] = version;
      } else if (
        this.rootPackageJson?.peerDependencies?.[name] &&
        options.includePeerDependencies
      ) {
        peerDeps[name] = version;
      } else {
        deps[name] = version;
      }
    }

    if (Object.keys(deps).length > 0) {
      packageJson.dependencies = deps;
    }

    if (Object.keys(devDeps).length > 0) {
      packageJson.devDependencies = devDeps;
    }

    if (Object.keys(peerDeps).length > 0) {
      packageJson.peerDependencies = peerDeps;
    }

    return packageJson;
  }

  private generateReport(
    dependencies: DependencyMap,
    startTime: number,
  ): PackReport {
    const report: PackReport = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalDependencies: dependencies.size,
      dependencies: Array.from(dependencies.entries()).map(
        ([name, version]) => ({
          name,
          version,
        }),
      ),
      options: this.options,
    };

    return report;
  }

  public static async packEntry(
    entry: string,
    options: PackerOptions = {},
  ): Promise<PackResult> {
    const packer = new DependencyPacker(options);
    return packer.pack(entry, options);
  }
}

export default DependencyPacker;
export type {
  PackerOptions,
  PackageJson,
  PackResult,
  PackReport,
  DependencyMap,
  LogLevel,
};
