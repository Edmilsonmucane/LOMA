// Execute the checked-in v1 for database verification/backfill without rewriting historical code.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const exports = {};
const compiled = ts.transpileModule(
  readFileSync(
    new URL('../packages/loan-engine/src/v1.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
new Function('require', 'exports', compiled.outputText)(
  createRequire(
    new URL('../packages/loan-engine/package.json', import.meta.url),
  ),
  exports,
);
export const engine = exports;
