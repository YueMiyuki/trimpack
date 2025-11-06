const importRe =
  /(?:^|[^\w$])import\s*(?:[^'";\n]+?\s+from\s*)?['"]([^'"\n]+)['"]/g;
const importExprRe = /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const exportFromRe = /\bexport\s+[^;\n]*?from\s*['"]([^'"\n]+)['"]/g;
const requireRe = /\brequire\(\s*(['"])\s*([^'"\n)]+)\s*\1\s*\)/g;

/**
 * Extracts unique module specifier strings from the given source code.
 *
 * Scans for specifiers in ES module `import` (including bare imports), `export ... from`, dynamic
 * `import()` with string literals, and CommonJS `require()` calls.
 *
 * Note: very large inputs are skipped. A hard limit of 2,000,000 characters is used as a pragmatic
 * guardrail to avoid excessive regex backtracking and memory usage when scanning arbitrarily large
 * blobs (e.g., generated or bundled files). Legitimate hand-written sources should be well below
 * this threshold; if you routinely analyze generated bundles, consider pre-filtering those files.
 *
 * @returns An array of unique module specifier strings found in `code`, or an empty array if none
 * are found or the input exceeds the length limit.
 */
export function scanSpecifiers(code: string): string[] {
  const specs = new Set<string>();

  if (code.length > 2_000_000) {
    // Skipping very large file to prevent performance degradation
    return [];
  }

  // Best-effort strip of comments to avoid matching commented-out imports.
  // This intentionally does not attempt full JS parsing; it covers the simple
  // cases exercised in our tests (// line comments and /* block comments */).
  const withoutComments = code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");

  let m: RegExpExecArray | null;

  // ESM import ... from 'x' and bare import 'x'
  while ((m = importRe.exec(withoutComments))) {
    if (m[1]) specs.add(m[1]);
  }

  // export ... from 'x'
  while ((m = exportFromRe.exec(withoutComments))) {
    if (m[1]) specs.add(m[1]);
  }

  // dynamic import('x') with literal
  while ((m = importExprRe.exec(withoutComments))) {
    if (m[1]) specs.add(m[1]);
  }

  // CJS require('x')
  while ((m = requireRe.exec(withoutComments))) {
    if (m[2]) specs.add(m[2]);
  }

  return Array.from(specs);
}
