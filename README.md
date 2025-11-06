# 📦 trimpack

> Trim the fat from your dependencies - Pack only what your code actually uses

## Features

- 🎯 **Smart Dependency Detection** - Automatically analyzes your code to find only the dependencies you actually use
- ⚡ **Engines** - `trace` (default) for code-only analysis; optional `asset`-style detection can be enabled via a flag to record runtime assets
- 🔧 **Flexible Configuration** - Use via CLI, programmatic API, or configuration files
- 📊 **Detailed Reports** - Get insights into what dependencies are being packed and why

## Installation

```bash
# Global installation
npm install -g trimpack

# Local installation
npm install --save-dev trimpack

# Using npx (no installation)
npx trimpack src/index.js

# Using pnpm dlx (no installation)
pnpm dlx trimpack src/index.js
```

## Quick Start

### CLI Usage

```bash
# Basic usage - analyze and generate deps.json
trimpack src/index.js

# Output to specific file
trimpack src/index.js --output ./packed_package.json

# Output JSON to stdout (for piping)
trimpack src/index.js --json

# Include dev dependencies
trimpack src/index.js --include-dev

# Minimal output (only dependencies)
trimpack src/index.js --minimal --output deps.json

# Use configuration file
trimpack src/index.js -c .deppackrc.json
```

### Programmatic API

```typescript
import { DependencyPacker } from "trimpack";

// Create a packer instance with options
const packer = new DependencyPacker({
  output: "packed.json",
  includeDevDependencies: false,
  minimalOutput: false,
  // Programmatic-only: do not write a file, just return the JSON
  noWrite: true,
  // Opt-in asset recording
  includeAssets: true,
  // Optional: customize the field name for asset list
  assetsField: "externalAssets",
});

// Analyze dependencies
const result = await packer.pack("src/index.js");

console.log(`Found ${result.dependencies.length} dependencies`);
// Access the generated package.json directly from the result
console.log(result.packageJson);
```

Example programmatic result (truncated):

```json
{
  "name": "trimpack",
  "version": "1.0.0",
  "dependencies": {},
  "externalAssets": []
}
```

## Configuration

### Configuration File

Create a `.deppackrc.json` or `deppack.config.json` file in your project root:

```json
{
  "output": "packed.json",
  "includeDevDependencies": true,
  "includePeerDependencies": false,
  "minimalOutput": false,
  "preserveFields": ["scripts", "author", "license"]
}
```

### Package.json Configuration

You can also configure trimpack in your `package.json`:

```json
{
  "deppack": {
    "output": "packed.json",
    "minimalOutput": false,
    "preserveFields": ["scripts"]
  }
}
```

### CLI Options

| Option              | Short | Description                                               | Default          |
| ------------------- | ----- | --------------------------------------------------------- | ---------------- |
| `--help`            | `-h`  | Show help information                                     | -                |
| `--version`         | `-v`  | Show version information                                  | -                |
| `--output`          | `-o`  | Output file path for generated package.json               | `deps.json`      |
| `--config`          | `-c`  | Path to configuration file                                | -                |
| `--include-dev`     | -     | Include dev dependencies in analysis                      | `false`          |
| `--include-peer`    | -     | Include peer dependencies in analysis                     | `false`          |
| `--merge`           | -     | Merge with existing package.json at output path           | `false`          |
| `--minimal`         | -     | Output only dependencies (minimal package.json)           | `false`          |
| `--json`            | -     | Output JSON to stdout instead of file                     | `false`          |
| `--verbose`         | -     | Enable verbose logging                                    | `false`          |
| `--preserve-fields` | -     | Fields to preserve from original package.json             | `[]`             |
| `--external`        | -     | External dependencies to exclude from analysis            | `["node:*"]`     |
| `--engine`          | -     | Analysis engine: `trace` or `asset`                       | `trace`          |
| `--include-assets`  | -     | Include runtime asset references; writes `externalAssets` | `false`          |
| `--assets-field`    | -     | Custom field name to write assets                         | `externalAssets` |

### Example Outputs

Basic JSON output:

```bash
trimpack src/index.js --json
```

Output (truncated):

```json
{
  "name": "trimpack",
  "version": "1.0.1",
  "dependencies": {},
  "externalAssets": []
}
```

Minimal dependencies only:

```bash
trimpack src/index.js --minimal --json
```

Output:

```json
{
  "dependencies": {},
  "externalAssets": []
}
```

## API Reference

### `DependencyPacker`

Main class for analyzing and packing dependencies.

#### Constructor

```typescript
new DependencyPacker(options?: PackerOptions)
```

#### Methods

##### `pack(entryPoint: string): Promise<PackResult>`

Analyzes dependencies for the given entry point and generates a package.json.

**Parameters:**

- `entryPoint`: Path to the entry file to analyze

**Returns:**

- Promise resolving to a `PackResult` object containing:
  - `dependencies`: Array of `[name, version]` tuples
  - `packageJson`: Generated package.json object
  - `outputFile`: Path to the output file
  - `report`: Analysis report with duration and statistics

## Use Cases

### Monorepo Dependency Extraction

Extract only the dependencies used by a specific package:

```bash
# From monorepo root
trimpack packages/api/src/index.js -o packages/api/package.json
```

### Serverless Deployment

Create minimal dependency lists for serverless functions:

```bash
trimpack src/handler.js --minimal --external aws-sdk -o lambda-deps.json
```

### Docker Image Optimization

Generate minimal package.json for Docker containers:

```dockerfile
# Build stage
FROM node:18 AS builder
WORKDIR /app
COPY . .
RUN npx trimpack src/server.js -o docker-package.json
RUN npm ci --production --package-lock-only=false

# Production stage
FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
CMD ["node", "src/server.js"]
```

### Library Publishing

Analyze dependencies before publishing:

```bash
trimpack src/index.js --verbose
```

## Examples

See the `examples/` directory for more usage examples:

- `examples/basic.js` - Basic programmatic usage
- `examples/typescript.ts` - TypeScript usage with multiple entry points

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request <3

## License

MIT © [YueMiyuki](https://github.com/YueMiyuki)

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/YueMiyuki/trimpack/issues)

---

Made with ❤️ by YueMiyuki
