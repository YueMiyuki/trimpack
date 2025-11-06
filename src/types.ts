export interface PackerOptions {
  output?: string; // Output file path for package.json
  external?: string[]; // Dependencies to exclude from analysis
  includeDevDependencies?: boolean; // Include dev dependencies in output
  includePeerDependencies?: boolean; // Include peer dependencies in output
  verbose?: boolean; // Enable verbose logging
  merge?: boolean; // Merge with existing package.json at output path
  preserveFields?: string[]; // Fields to preserve from original package.json
  minimalOutput?: boolean; // Only output dependencies, nothing else
  json?: boolean; // Output raw JSON to stdout instead of file (CLI-oriented)
  noWrite?: boolean; // Programmatic: do not write file or print; return JSON in result only
  includeAssets?: boolean; // Include runtime assets
  assetsField?: string; // Field name to write assets into (default: "externalAssets")
  engine?: "trace" | "asset"; // Internal analysis engine
}

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  type?: "module" | "commonjs";
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, unknown>;
  engines?: Record<string, string>;
  keywords?: string[];
  author?: string | { name?: string; email?: string; url?: string };
  license?: string;
  repository?: string | { type?: string; url?: string };
  bugs?: string | { url?: string; email?: string };
  homepage?: string;
  funding?: string | { type?: string; url?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  packer?: PackerOptions;
}

// Removed unused PackageInfo type

export type DependencyMap = Map<string, string>;

export interface PackReport {
  timestamp: string;
  duration: number;
  totalDependencies: number;
  dependencies: Array<{
    name: string;
    version: string;
  }>;
  options: PackerOptions;
}

export interface PackResult {
  dependencies: Array<[string, string]>;
  packageJson: PackageJson;
  report: PackReport;
  outputFile: string;
}

export type LogLevel = "info" | "success" | "warning" | "error" | "debug";

// Logger interface removed; use Logger class from src/logger.ts when needed

export interface ExtractedPackageInfo {
  name: string;
  version: string | null;
}

// AnalysisResult removed; current engines do not expose metafiles
