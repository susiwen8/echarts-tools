import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import ts from 'typescript';

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}

export async function resolve(specifier, context, defaultResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js')) {
        const parentDir = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
        const tsPath = path.resolve(parentDir, specifier.slice(0, -3) + '.ts');
        if (await fileExists(tsPath)) {
            return {
                url: pathToFileURL(tsPath).href,
                shortCircuit: true
            };
        }
    }
    return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
    if (url.endsWith('.ts')) {
        const filename = fileURLToPath(url);
        const source = await fs.readFile(filename, 'utf8');
        const result = ts.transpileModule(source, {
            fileName: filename,
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ES2020,
                importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
                preserveValueImports: false,
                sourceMap: false
            }
        });
        return {
            format: 'module',
            source: result.outputText,
            shortCircuit: true
        };
    }
    return defaultLoad(url, context, defaultLoad);
}
