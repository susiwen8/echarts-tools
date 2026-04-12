import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require('esbuild');
const distDir = path.join(pkgDir, 'dist');
const tslibPath = path.join(path.dirname(require.resolve('tslib')), 'tslib.es6.js');
const tscPath = require.resolve('typescript/bin/tsc');
const typeOnly = process.argv.includes('--types-only');

await fs.mkdir(distDir, { recursive: true });

if (!typeOnly) {
  await esbuild.build({
    entryPoints: [path.join(pkgDir, 'src/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2019',
    outfile: path.join(distDir, 'index.js'),
    external: [
      'echarts',
      'echarts/*',
      'zrender',
      'zrender/*',
      'zrender/lib/*',
      'zrender/src/*'
    ],
    plugins: [{
      name: 'resolve-tslib',
      setup(build) {
        build.onResolve({ filter: /^tslib$/ }, () => ({ path: tslibPath }));
      }
    }],
    sourcemap: false
  });
}

await new Promise((resolve, reject) => {
  const proc = spawn(process.execPath, [tscPath, '-p', path.join(pkgDir, 'tsconfig.json'), '--emitDeclarationOnly'], {
    cwd: pkgDir,
    stdio: 'inherit'
  });
  proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`tsc exited with ${code}`)));
  proc.on('error', reject);
});
