const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist');

const compilerOptions = {
  target: ts.ScriptTarget.ES2018,
  module: ts.ModuleKind.CommonJS,
  lib: ['es2018', 'esnext.asynciterable'],
  skipLibCheck: true,
  sourceMap: true,
  outDir,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  removeComments: true,
  noImplicitAny: false,
  strictNullChecks: false,
  strictFunctionTypes: false,
  noImplicitThis: false,
  noUnusedLocals: false,
  noUnusedParameters: false,
  noImplicitReturns: false,
  noFallthroughCasesInSwitch: false,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
  emitDecoratorMetadata: true,
  experimentalDecorators: true,
  resolveJsonModule: true,
  baseUrl: projectRoot,
};

const ignoredDirs = new Set(['node_modules', 'dist']);
const copiedExtensions = new Set(['.json']);

const removeDir = (dirPath) => {
  fs.rmSync(dirPath, { recursive: true, force: true });
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const walk = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  entries.forEach((entry) => {
    if (ignoredDirs.has(entry.name)) {
      return;
    }

    const sourcePath = path.join(dirPath, entry.name);
    const relativePath = path.relative(projectRoot, sourcePath);
    const outputPath = path.join(outDir, relativePath);

    if (entry.isDirectory()) {
      walk(sourcePath);
      return;
    }

    const ext = path.extname(entry.name);

    if (ext === '.ts') {
      const source = fs.readFileSync(sourcePath, 'utf8');
      const result = ts.transpileModule(source, {
        compilerOptions,
        fileName: sourcePath,
      });

      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath.replace(/\.ts$/, '.js'), result.outputText);

      if (result.sourceMapText) {
        fs.writeFileSync(outputPath.replace(/\.ts$/, '.js.map'), result.sourceMapText);
      }

      return;
    }

    if (copiedExtensions.has(ext)) {
      ensureDir(path.dirname(outputPath));
      fs.copyFileSync(sourcePath, outputPath);
    }
  });
};

removeDir(outDir);
ensureDir(outDir);
walk(projectRoot);

console.log(`[build-server] Server transpiled to ${outDir}`);
