import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { engine } from './engine-runtime.mjs';
const exports = {};
new Function(
  'require',
  'exports',
  ts.transpileModule(
    readFileSync(
      new URL('../apps/web/src/lib/domain/demo.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)((name) => {
  if (name === '@loma/loan-engine')
    return {
      simulateContract: (v, input) => {
        if (v !== 1) throw new Error('Unsupported engine');
        return engine.simulate(input);
      },
    };
  throw new Error('Unsupported module');
}, exports);
export const demoDataset = exports.demoDataset;
