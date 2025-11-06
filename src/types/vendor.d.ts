declare module "../vendor/es-module-lexer/lexer.js" {
  export function parse(
    source: string,
    name?: string,
  ): [Array<{ s: number; e: number; n?: string }>, Array<unknown>, boolean];
}
