#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { DependencyPacker } from "./index.js";
import type { PackerOptions, PackageJson, PackResult } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Color utilities for terminal output
interface Colors {
  reset: string;
  bright: string;
  dim: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  cyan: string;
}

const colors: Colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const color = (text: string, colorName: keyof Colors): string => {
  if (process.env.NO_COLOR) return text;
  return `${colors[colorName]}${text}${colors.reset}`;
};

// Load package version
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8"),
) as PackageJson;

// Define CLI options
interface CLIOption {
  type: "boolean" | "string";
  short?: string;
  default?: string | boolean;
  multiple?: boolean;
  description?: string;
}

const cliOptions: Record<string, CLIOption> = {
  help: {
    type: "boolean",
    short: "h",
    description: "Show help information",
  },
  version: {
    type: "boolean",
    short: "v",
    description: "Show version information",
  },
  output: {
    type: "string",
    short: "o",
    description: "Output file path for generated package.json",
  },
  config: {
    type: "string",
    short: "c",
    description: "Path to configuration file",
  },
  "include-dev": {
    type: "boolean",
    description: "Include dev dependencies",
  },
  "include-peer": {
    type: "boolean",
    description: "Include peer dependencies",
  },
  merge: {
    type: "boolean",
    description: "Merge with existing package.json at output path",
  },
  minimal: {
    type: "boolean",
    description: "Output only dependencies (minimal package.json)",
  },
  json: {
    type: "boolean",
    description: "Output JSON to stdout instead of file",
  },
  verbose: {
    type: "boolean",
    description: "Enable verbose logging",
  },
  "preserve-fields": {
    type: "string",
    multiple: true,
    description: "Fields to preserve from original package.json",
  },
  external: {
    type: "string",
    multiple: true,
    description: "External dependencies to exclude",
  },
  "include-assets": {
    type: "boolean",
    description: "Include runtime asset references",
  },
  "assets-field": {
    type: "string",
    description: "Custom field name for assets (default: externalAssets)",
  },
  engine: {
    type: "string",
    description: "Analysis engine: trace | asset",
  },
};

/**
 * Prints the command-line help text (usage, description, arguments, options, examples, and configuration guidance) to stdout.
 *
 * The help output includes a rendered list of available CLI options, example commands, a sample configuration file, and links to project documentation.
 */
function showHelp(): void {
  console.log(`
${color("📦 trimpack", "cyan")} ${color(`v${packageJson.version}`, "dim")}

${color("USAGE:", "bright")}
  trimpack <entry-file> [options]
  npx trimpack <entry-file> [options]
  pnpm dlx trimpack <entry-file> [options]

${color("DESCRIPTION:", "bright")}
  Analyzes your code and generates a package.json with only the dependencies
  your code actually uses. Perfect for monorepos and dependency optimization.

${color("ARGUMENTS:", "bright")}
  <entry-file>              Entry point file to analyze

${color("OPTIONS:", "bright")}
${Object.entries(cliOptions)
  .map(([name, opt]) => {
    const flag = `--${name}${opt.short ? `, -${opt.short}` : ""}`;
    const desc = opt.description || "";
    const def = opt.default !== undefined ? ` (default: ${opt.default})` : "";
    return `  ${flag.padEnd(25)} ${desc}${def}`;
  })
  .join("\n")}

${color("EXAMPLES:", "bright")}
  # Analyze and output package.json to stdout
  trimpack src/index.js --json

  # Write to specific file
  trimpack src/index.js --output ./packed.json

  # Merge with existing package.json
  trimpack src/index.js --merge --output ./package.json

  # Minimal output (only dependencies)
  trimpack src/index.js --minimal --output deps.json

  # Include dev and peer dependencies
  trimpack src/index.js --include-dev --include-peer

  # Use with npx/pnpm dlx
  npx trimpack src/index.js -o packed.json
  pnpm dlx trimpack src/index.js --json > package.json

${color("CONFIGURATION FILE:", "bright")}
  Create a .deppackrc.json or deppack.config.json:
  {
    "output": "packed.json",
    "includeDevDependencies": true,
    "minimal": false,
    "preserveFields": ["scripts", "author"]
  }

${color("MORE INFO:", "bright")}
  GitHub: https://github.com/YueMiyuki/trimpack
  Docs:   https://github.com/YueMiyuki/trimpack#readme
`);
}

function showVersion(): void {
  console.log(`trimpack v${packageJson.version}`);
}

/**
 * Load and parse a JSON packer configuration file from the given path.
 *
 * If the file does not exist or cannot be parsed, an error is printed and the process exits with code 1.
 *
 * @param configPath - Filesystem path to a JSON configuration file
 * @returns The parsed PackerOptions object
 */
function loadConfig(configPath: string): PackerOptions {
  try {
    const fullPath = resolve(configPath);
    if (!existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const content = readFileSync(fullPath, "utf8");
    return JSON.parse(content) as PackerOptions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(color(`❌ Failed to load config: ${errorMessage}`, "red"));
    process.exit(1);
  }
}

/**
 * Run the CLI: parse arguments, load configuration, execute dependency packing, and report results.
 *
 * Parses command-line options and the positional entry file, merges configuration from files and CLI flags,
 * constructs final PackerOptions, runs the packer for the entry file, and prints either human-readable or JSON-formatted results.
 *
 * Side effects: reads configuration files (including package.json when present), writes to stdout/stderr, and terminates the process with an exit code (0 on success, non-zero on error).
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const { values, positionals } = parseArgs({
      options: cliOptions as Record<
        string,
        { type: "boolean" | "string"; short?: string; multiple?: boolean }
      >,
      allowPositionals: true,
      strict: false,
    });

    // Show help
    if (values.help) {
      showHelp();
      process.exit(0);
    }

    // Show version
    if (values.version) {
      showVersion();
      process.exit(0);
    }

    // Check for entry file
    if (positionals.length === 0) {
      console.error(color("❌ Error: No entry file specified", "red"));
      console.log(color('Run "trimpack --help" for usage information', "dim"));
      process.exit(1);
    }

    const entryFile = positionals[0];

    // Load configuration (defaults + explicit)
    const config: PackerOptions = loadMergedConfig(values);

    // Map CLI arguments to options
    // Parse argv for flags whose presence matters (e.g., include-assets)
    const argvFlags = process.argv.slice(2);

    const options: PackerOptions = buildOptionsFromArgs(
      values,
      config,
      argvFlags,
    );
    validateEngineOption(values, config, options);

    // Don't show verbose output in JSON mode
    if (!options.json) {
      // Show configuration in verbose mode
      if (options.verbose) {
        console.error(color("📋 Configuration:", "cyan"));
        console.error(JSON.stringify(options, null, 2));
        console.error();
      }

      // Show header
      console.error(color(`\n📦 trimpack v${packageJson.version}`, "cyan"));
      console.error(`${color("Entry:", "bright")} ${entryFile}`);
      if (!options.json) {
        console.error(`${color("Output:", "bright")} ${options.output}`);
      }
      console.error();
    }

    // Create packer instance and run
    const result = await runPacker(entryFile!, options);

    // Display results (only if not in JSON mode)
    if (!options.json) {
      printResults(result, options);
    }

    // Exit successfully
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error();
    console.error(color(`❌ ${errorMessage}`, "red"));

    if (process.env.DEBUG) {
      console.error();
      console.error(color("Stack trace:", "dim"));
      console.error(error instanceof Error ? error.stack : error);
    } else {
      console.error(color("Run with DEBUG=1 for more details", "dim"));
    }

    process.exit(1);
  }
}

// --------------------
// Helper functions
/**
 * Load and merge configuration from standard files and an optional CLI-provided config path.
 *
 * Searches for configuration in this order: `.deppackrc.json`, `deppack.config.json`, then `package.json` (using its `deppack` field if present). If `values.config` is provided, that file is loaded and merged over the discovered config.
 *
 * @param values - Parsed CLI option values; if `values.config` is set it is treated as a path to an additional config file to merge.
 * @returns The resulting PackerOptions after applying discovered and explicit configuration sources.
 */

function loadMergedConfig(values: Record<string, unknown>): PackerOptions {
  let config: PackerOptions = {};

  const defaultConfigs = [
    ".deppackrc.json",
    "deppack.config.json",
    "package.json",
  ];
  for (const configFile of defaultConfigs) {
    if (!existsSync(configFile)) continue;
    try {
      const content = JSON.parse(readFileSync(configFile, "utf8"));
      if (configFile === "package.json" && content.deppack) {
        config = content.deppack as PackerOptions;
        if (values.verbose) {
          console.error(color(`📄 Loaded config from package.json`, "dim"));
        }
        break;
      } else if (configFile !== "package.json") {
        config = content as PackerOptions;
        if (values.verbose) {
          console.error(color(`📄 Loaded config from ${configFile}`, "dim"));
        }
        break;
      }
    } catch {
      // ignore auto-detected parse errors
    }
  }

  if (values.config) {
    config = { ...config, ...loadConfig(values.config as string) };
  }
  return config;
}

/**
 * Construct the final PackerOptions by overlaying CLI-provided values and explicit argv flags onto a base config.
 *
 * This resolves option precedence (CLI flags override config when explicitly provided), applies defaults
 * for unset values, and merges list fields (`preserveFields`, `external`) from both sources (always appending
 * the default external entry `"node:*"`).
 *
 * @param values - Parsed CLI option values keyed by option name
 * @param config - Loaded configuration to serve as the base options
 * @param argvFlags - Raw argv tokens used to detect which flags were explicitly provided
 * @returns The merged PackerOptions ready to be passed to the packer
 */
function buildOptionsFromArgs(
  values: Record<string, unknown>,
  config: PackerOptions,
  argvFlags: string[],
): PackerOptions {
  const flagProvided = (long: string, short?: string) =>
    argvFlags.some(
      (arg) =>
        arg === `--${long}` ||
        arg === `--no-${long}` ||
        arg.startsWith(`--${long}=`) ||
        (short && arg === `-${short}`),
    );
  return {
    ...config,
    output: (values.output as string) || config.output || "deps.json",
    includeDevDependencies: flagProvided("include-dev")
      ? Boolean(values["include-dev"])
      : (config.includeDevDependencies ?? false),
    includePeerDependencies: flagProvided("include-peer")
      ? Boolean(values["include-peer"])
      : (config.includePeerDependencies ?? false),
    merge: flagProvided("merge")
      ? Boolean(values.merge)
      : (config.merge ?? false),
    minimalOutput: flagProvided("minimal")
      ? Boolean(values.minimal)
      : (config.minimalOutput ?? false),
    json: flagProvided("json") ? Boolean(values.json) : (config.json ?? false),
    verbose: flagProvided("verbose")
      ? Boolean(values.verbose)
      : (config.verbose ?? false),
    includeAssets: (() => {
      const hasCliFlag = process.argv
        .slice(2)
        .some(
          (arg) =>
            arg === "--include-assets" ||
            arg === "--no-include-assets" ||
            arg.startsWith("--include-assets="),
        );
      if (hasCliFlag) return Boolean(values["include-assets"]);
      return config.includeAssets ?? false;
    })(),
    assetsField: (() => {
      const hasCliFlag = argvFlags.some(
        (arg) => arg === "--assets-field" || arg.startsWith("--assets-field="),
      );
      if (hasCliFlag) return values["assets-field"] as string;
      return (config.assetsField ?? "externalAssets") as string;
    })(),
    engine: (Object.prototype.hasOwnProperty.call(values, "engine")
      ? (values.engine as string)
      : (config.engine ?? "trace")) as unknown as "trace" | "asset",
    preserveFields: [
      ...((values["preserve-fields"] as string[]) || []),
      ...(config.preserveFields || []),
    ],
    external: [
      ...((values.external as string[]) || []),
      ...(config.external || []),
      "node:*",
    ],
  };
}

/**
 * Validate and set the effective engine option for the packer.
 *
 * Checks for an explicit `engine` value in the provided CLI `values`, falls back to `config.engine` or `"trace"`, verifies it is one of `"trace"` or `"asset"`, and assigns the validated value to `options.engine`.
 *
 * @param values - Parsed CLI values used to detect an explicitly provided `engine`
 * @param config - Merged configuration providing a fallback `engine`
 * @param options - Final options object that will receive the validated `engine`
 * @throws Error if the resolved engine value is not `"trace"` or `"asset"`
 */
function validateEngineOption(
  values: Record<string, unknown>,
  config: PackerOptions,
  options: PackerOptions,
): void {
  const rawEngine = Object.prototype.hasOwnProperty.call(values, "engine")
    ? String(values.engine)
    : String(config.engine ?? "trace");
  const allowed = new Set(["trace", "asset"]);
  if (!allowed.has(rawEngine)) {
    throw new Error(
      `Invalid value for --engine: "${rawEngine}". Allowed values: trace | asset`,
    );
  }
  options.engine = rawEngine as "trace" | "asset";
}

/**
 * Run the dependency packer for a given entry file.
 *
 * @param entryFile - Path to the module entry file to pack
 * @param options - Packer configuration options
 * @returns The pack result containing discovered dependencies and related metadata
 */
async function runPacker(entryFile: string, options: PackerOptions) {
  const packer = new DependencyPacker(options);
  return packer.pack(entryFile);
}

/**
 * Writes a human-readable summary of the pack result to stderr.
 *
 * Prints the number of dependencies, the output file path, and—when enabled—the number of external assets.
 * When `options.verbose` is true, also prints a detailed list of dependencies and, if present, the assets list.
 *
 * @param result - The packing result containing `dependencies`, `outputFile`, and `packageJson` used to report counts and lists.
 * @param options - Display controls; respects `includeAssets`, `assetsField`, and `verbose`.
 */
function printResults(result: PackResult, options: PackerOptions): void {
  console.error();
  console.error(color("📊 Results:", "bright"));
  console.error(`  Dependencies found: ${result.dependencies.length}`);
  console.error(`  Output written to: ${result.outputFile}`);

  if (options.includeAssets) {
    const field = options.assetsField || "externalAssets";
    const assets = (result.packageJson as Record<string, unknown>)[field] as
      | string[]
      | undefined;
    const count = Array.isArray(assets) ? assets.length : 0;
    console.error(`  Assets found: ${count}`);
  }

  if (options.verbose) {
    console.error();
    console.error(color("📦 Dependencies:", "dim"));
    result.dependencies.forEach(([name, version]) => {
      console.error(`  - ${name}@${version}`);
    });

    if (options.includeAssets) {
      const field = options.assetsField || "externalAssets";
      const assets = (result.packageJson as Record<string, unknown>)[field] as
        | string[]
        | undefined;
      if (assets && assets.length) {
        console.error();
        console.error(color("🗂 Assets:", "dim"));
        assets.forEach((a) => console.error(`  - ${a}`));
      }
    }
  }

  console.error();
  console.error(color("✨ Analysis completed successfully!", "green"));
}

// (no helper types required)

// Handle uncaught errors
process.on("uncaughtException", (error: Error) => {
  console.error(color(`\n❌ Unexpected error: ${error.message}`, "red"));
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(
    color(`\n❌ Unhandled promise rejection: ${errorMessage}`, "red"),
  );
  if (process.env.DEBUG && error instanceof Error) {
    console.error(error.stack);
  }
  process.exit(1);
});

// Run the CLI
main();