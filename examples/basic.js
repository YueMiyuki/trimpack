#!/usr/bin/env node

// Basic example of using trimpack programmatically

import { DependencyPacker } from "../dist/index.js";

async function main() {
  const entry = process.argv[2];
  const output = process.argv[3] || "packed.json";

  if (!entry) {
    console.error(
      "❌ Usage: node examples/basic.js <entry-file> [output-file]",
    );
    console.error(
      "   Example: node examples/basic.js src/index.js packed.json",
    );
    process.exit(1);
  }

  try {
    // Create a packer instance with options
    const packer = new DependencyPacker({
      output,
      verbose: true,
      includeDevDependencies: false,
      minimalOutput: false, // Set to true for only dependencies
    });

    // Analyze dependencies
    console.log("📦 Analyzing dependencies...");
    const result = await packer.pack(entry);

    // Display results
    console.log("\n✅ Successfully analyzed!");
    console.log(`📊 Total dependencies: ${result.dependencies.length}`);
    console.log(`📄 Output written to: ${result.outputFile}`);

    // Show found dependencies
    console.log("\n📦 Dependencies found:");
    result.dependencies.forEach(([name, version]) => {
      console.log(`  - ${name}@${version}`);
    });

    console.log("\n💡 Tip: Use --json flag to output to stdout for piping");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
