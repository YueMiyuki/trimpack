const importRe =
  /(?:^|[^\w$])import\s*(?:[^'";\n]+?\s+from\s*)?['"]([^'"\n]+)['"]/g;
const importExprRe = /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const exportFromRe = /\bexport\s+[^;\n]*?from\s*['"]([^'"\n]+)['"]/g;
const requireRe = /\brequire\(\s*(['"])\s*([^'"\n)]+)\s*\1\s*\)/g;

export function scanSpecifiers(code: string): string[] {
  const specs = new Set<string>();

  if (code.length > 2_000_000) return [];

  let m: RegExpExecArray | null;

  // ESM import ... from 'x' and bare import 'x'
  while ((m = importRe.exec(code))) {
    if (m[1]) specs.add(m[1]);
  }

  // export ... from 'x'
  while ((m = exportFromRe.exec(code))) {
    if (m[1]) specs.add(m[1]);
  }

  // dynamic import('x') with literal
  while ((m = importExprRe.exec(code))) {
    if (m[1]) specs.add(m[1]);
  }

  // CJS require('x')
  while ((m = requireRe.exec(code))) {
    if (m[2]) specs.add(m[2]);
  }

  return Array.from(specs);
}
