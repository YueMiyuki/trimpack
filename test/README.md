# Unit Tests

This directory contains comprehensive unit tests for the trimpack project using Node.js's built-in test runner.

## Running Tests

```bash
# Run all unit tests
pnpm test:unit

# Run unit tests in watch mode
pnpm test:unit:watch

# Run unit tests with coverage (experimental)
pnpm test:unit:coverage

# Run all tests (integration + unit)
pnpm test:all
```

## Test Structure

### Core Module Tests

- **`semaphore.test.ts`** - Tests for the Semaphore concurrency control class
  - Constructor and initialization
  - Acquire/release mechanisms
  - FIFO queue ordering
  - Concurrency limiting
  - Error handling

- **`fs-cache.test.ts`** - Tests for the FsCache filesystem caching layer
  - File reading (text and binary)
  - Stat operations
  - Symlink resolution
  - Caching behavior
  - Concurrency control
  - Edge cases (empty files, large files, special characters)

- **`import-scanner.test.ts`** - Tests for the import/require specifier scanner
  - ESM imports (named, default, namespace, side-effect)
  - Dynamic imports
  - Export from statements
  - CommonJS require statements
  - Mixed module systems
  - Edge cases (comments, strings, large files)

- **`realpath.test.ts`** - Tests for the realpath resolution utility
  - Regular file resolution
  - Symlink resolution (simple and chained)
  - Recursive symlink detection
  - Directory handling
  - Base directory filtering

- **`resolver.test.ts`** - Tests for the module resolution system
  - Built-in module detection
  - Relative path resolution
  - TypeScript extension support
  - Index file resolution
  - Extension priority
  - Caching behavior

- **`dependency-tracer.test.ts`** - Tests for the dependency tracing engine
  - Basic tracing
  - Transitive dependencies
  - Circular dependencies
  - Different module types (ESM, CJS, TS)
  - External dependency filtering
  - Complex dependency patterns (deep trees, diamond patterns)

- **`asset-analyzer.test.ts`** - Tests for the asset analysis engine
  - Dependency detection (ESM, CJS, dynamic)
  - Asset detection (JSON, CSS, images)
  - __dirname pattern matching
  - File type handling
  - Concurrency control
  - Error handling

- **`logger.test.ts`** - Tests for the logging system
  - Different log levels (info, warn, error, debug, success)
  - File logging
  - Silent mode
  - Verbose mode
  - Color handling (NO_COLOR support)
  - Message formatting
  - Edge cases

## Test Coverage

The test suite provides comprehensive coverage of:

- **Happy paths** - Normal operation with valid inputs
- **Edge cases** - Boundary conditions, empty inputs, large inputs
- **Error handling** - Invalid inputs, missing files, malformed code
- **Concurrency** - Parallel operations, race conditions
- **Integration** - Complex real-world scenarios

## Writing New Tests

When adding new tests:

1. Follow the existing structure with `describe` blocks for logical grouping
2. Use descriptive test names that explain what is being tested
3. Include setup and teardown using `before`, `after`, `beforeEach`, `afterEach`
4. Clean up any created files/directories in teardown
5. Test both success and failure scenarios
6. Consider edge cases and boundary conditions

Example:

```typescript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

describe("MyModule", () => {
  before(() => {
    // Setup
  });

  after(() => {
    // Cleanup
  });

  describe("myFunction", () => {
    it("should handle valid input", () => {
      const result = myFunction("valid");
      assert.equal(result, "expected");
    });

    it("should handle edge cases", () => {
      const result = myFunction("");
      assert.equal(result, "default");
    });

    it("should throw on invalid input", () => {
      assert.throws(() => myFunction(null));
    });
  });
});
```

## Node.js Test Runner Features

The tests use Node.js's built-in test runner which provides:

- **No dependencies** - Built into Node.js 18+
- **Fast execution** - Native implementation
- **Watch mode** - Automatic re-run on file changes
- **Parallel execution** - Tests run concurrently by default
- **Built-in assertions** - From `node:assert/strict`
- **Async/await support** - Native Promise handling
- **Coverage** (experimental) - Code coverage reporting

## Test Isolation

Each test file creates its own temporary directory for test files:

- `.test-semaphore` - Semaphore tests
- `.test-fs-cache` - FsCache tests
- `.test-realpath` - Realpath tests
- `.test-resolver` - Resolver tests
- `.test-dependency-tracer` - Dependency tracer tests
- `.test-asset-analyzer` - Asset analyzer tests
- `.test-logger.log` - Logger test file

These are automatically cleaned up after tests complete.

## CI/CD Integration

The unit tests are designed to run in CI/CD environments:

- No external dependencies required
- Fast execution (< 30 seconds for full suite)
- Deterministic results
- Proper exit codes for pass/fail
- Clean temporary file handling

## Debugging Tests

To debug a specific test:

```bash
# Run a single test file
node --test test/semaphore.test.ts

# Run with debugging output
DEBUG=* node --test test/semaphore.test.ts

# Use Node.js inspector
node --inspect-brk --test test/semaphore.test.ts
```

## Contributing

When contributing tests:

1. Ensure all tests pass locally
2. Add tests for new functionality
3. Update tests when modifying existing code
4. Maintain > 80% code coverage for new code
5. Follow existing naming and structure conventions