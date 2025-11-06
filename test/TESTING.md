# Testing Guide for trimpack

This project includes comprehensive testing at multiple levels.

## Test Types

### 1. Unit Tests (New!)
Located in `test/unit/`, these tests cover individual modules in isolation using Node.js's built-in test runner.

**Run unit tests:**
```bash
npm run test:unit
```

**What's tested:**
- Core modules (semaphore, fs-cache, resolver, etc.)
- Pure functions and utilities
- Error handling and edge cases
- Concurrent operations

### 2. Integration Tests (Existing)
Located in `test/`, these tests verify end-to-end functionality.

**Run integration tests:**
```bash
npm run test:cli      # CLI option tests
npm run test:api      # Programmatic API tests  
npm run test:config   # Configuration file tests
npm run test:all      # All integration tests + type checking
```

### 3. Example Tests
```bash
npm run test:example  # Run basic example
```

## Complete Test Suite

To run everything:
```bash
npm run test:all
```

This runs:
1. Type checking with TypeScript
2. CLI tests
3. Programmatic API tests
4. Configuration file tests

## Continuous Integration

The test suite runs automatically on:
- Pull requests
- Pushes to main branch
- Before publishing to npm (via `prepublishOnly`)

## Test Development

### Adding Unit Tests

1. Create a new test file in `test/unit/`:
   ```typescript
   import { describe, it } from "node:test";
   import assert from "node:assert";
   
   describe("MyModule", () => {
     it("should do something", () => {
       assert.strictEqual(1 + 1, 2);
     });
   });
   ```

2. Run your new test:
   ```bash
   node --import tsx --test test/unit/your-test.test.ts
   ```

### Adding Integration Tests

1. Create a new test file in `test/`:
   ```javascript
   #!/usr/bin/env node
   // Your integration test code
   ```

2. Add a script to `package.json`:
   ```json
   "test:your-feature": "node test/test-your-feature.js"
   ```

## Debugging Tests

### Enable verbose output:
```bash
DEBUG=1 npm run test:cli
```

### Run a single unit test file:
```bash
node --import tsx --test test/unit/semaphore.test.ts
```

### Use Node.js inspector:
```bash
node --inspect-brk --import tsx --test test/unit/your-test.test.ts
```

## Code Coverage

To generate coverage reports (requires additional setup):
```bash
node --experimental-test-coverage --import tsx --test test/unit/*.test.ts
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clean Up**: Always clean up resources (files, connections)
3. **Descriptive Names**: Use clear, descriptive test names
4. **Fast Tests**: Keep unit tests fast (<100ms per test)
5. **Edge Cases**: Test boundary conditions and error paths
6. **Documentation**: Comment complex test setups

## Troubleshooting

### Tests timeout
- Increase timeout with `--test-timeout=30000` (30 seconds)
- Check for hanging promises or unclosed resources

### Import errors
- Ensure TypeScript files are compiled: `npm run build`
- Check that tsx is available for running .ts tests

### File system errors
- Ensure proper cleanup in `after()` hooks
- Check file permissions
- Use unique temp directories per test

## Resources

- [Node.js Test Runner Docs](https://nodejs.org/api/test.html)
- [Node.js Assert Docs](https://nodejs.org/api/assert.html)
- Project README: [README.md](../README.md)