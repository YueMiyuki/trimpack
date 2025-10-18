#!/usr/bin/env tsx

// TypeScript example of using trimpack programmatically

import { DependencyPacker, type PackerOptions } from "../dist/index.js";

async function packWithOptions(
  entry: string,
  options?: PackerOptions,
): Promise<void> {
  try {
    // Configure packer with TypeScript type safety
    const config: PackerOptions = {
      output: options?.output || "packed.json",
      verbose: options?.verbose ?? true,
      includeDevDependencies: options?.includeDevDependencies ?? false,
      includePeerDependencies: options?.includePeerDependencies ?? false,
      minimalOutput: options?.minimalOutput ?? false,
      merge: options?.merge ?? false,
    };

    // Create packer instance
    const packer = new DependencyPacker(config);

    // Analyze dependencies with full type safety
    console.log("📦 Starting dependency analysis...");
    const result = await packer.pack(entry);

    // Process results
    console.log("\n📊 Analysis Complete:");
    console.log(`  Total dependencies: ${result.dependencies.length}`);
    console.log(`  Output file: ${result.outputFile}`);
    console.log(
      `  Include dev deps: ${config.includeDevDependencies ? "Yes" : "No"}`,
    );

    // Display dependency list
    if (result.dependencies.length > 0) {
      console.log("\n📦 Dependencies found:");
      result.dependencies.forEach(([name, version]) => {
        console.log(`  • ${name}@${version}`);
      });
    }

    // Report generation info
    console.log(
      `\n📄 Package.json generated with ${Object.keys(result.packageJson).length} fields`,
    );
    console.log(`⏱️  Analysis completed in ${result.report.duration}ms`);
  } catch (error) {
    console.error(
      "❌ Analysis failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

// Example with multiple entry points
async function packMultipleEntries(entries: string[]): Promise<void> {
  console.log(`🎯 Analyzing ${entries.length} entry points...\n`);

  for (const entry of entries) {
    console.log(`\n--- Processing: ${entry} ---`);
    const outputName = entry.replace(/\.[^/.]+$/, "").replace(/[/\\]/g, "-");
    await packWithOptions(entry, {
      output: `${outputName}-deps.json`,
      includeDevDependencies: false,
      minimalOutput: true, // Only output dependencies
    });
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "❌ Usage: tsx examples/typescript.ts <entry-file> [...more-entries]",
    );
    console.error("   Example: tsx examples/typescript.ts src/index.ts");
    console.error(
      "   Multiple: tsx examples/typescript.ts src/api.ts src/worker.ts",
    );
    process.exit(1);
  }

  if (args.length === 1) {
    await packWithOptions(args[0]!);
  } else {
    await packMultipleEntries(args);
  }

  console.log("\n✨ All analysis operations completed successfully!");
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}

export { packWithOptions, packMultipleEntries };
