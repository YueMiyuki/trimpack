# Unit Tests

This directory contains comprehensive unit tests for the trimpack core modules.

## Test Structure

Tests are organized by module:

- `semaphore.test.ts` - Tests for the Semaphore concurrency primitive
- `fs-cache.test.ts` - Tests for the filesystem cache
- `import-scanner.test.ts` - Tests for the import/require scanner
- `realpath.test.ts` - Tests for symlink resolution
- `resolver.test.ts` - Tests for module resolution
- `dependency-tracer.test.ts` - Tests for dependency tracing
- `asset-analyzer.test.ts` - Tests for asset analysis
- `logger.test.ts` - Tests for the logging utility

## Running Tests

### Run all unit tests:
```bash
npm run test:unit
```

### Run with Node.js test runner directly:
```bash
node --import tsx --test test/unit/*.test.ts
```

### Run a specific test file:
```bash
node --import tsx --test test/unit/semaphore.test.ts
```

## Test Framework

These tests use Node.js's built-in test runner (available in Node.js 18+) with the following features:

- `describe()` - Test suite grouping
- `it()` - Individual test cases
- `before()` / `after()` - Setup and teardown hooks
- `beforeEach()` / `afterEach()` - Per-test setup and teardown
- `assert` - Node.js built-in assertion library

## Test Coverage

The tests cover:

- ✅ Happy path scenarios
- ✅ Edge cases and boundary conditions
- ✅ Error handling and recovery
- ✅ Concurrent operations
- ✅ Resource cleanup
- ✅ Performance characteristics (where applicable)

## Writing New Tests

When adding new tests:

1. Follow the existing naming convention: `<module-name>.test.ts`
2. Use descriptive test names that explain what is being tested
3. Group related tests using `describe()` blocks
4. Clean up resources in `after()` / `afterEach()` hooks
5. Test both success and failure scenarios
6. Consider edge cases and boundary conditions