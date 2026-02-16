/**
 * Import will remove at compile time
 */

import type { BuildOptions } from 'esbuild';
import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { existsSync } from 'fs';
import { runInThisContext } from 'vm';
import { createRequire } from 'module';
import { inject } from '@symlinks/symlinks.module';
import { resolve } from '@components/path.component';
import { buildFiles } from '@services/transpiler.service';
import { FilesModel } from '@typescript/models/files.model';
import { FrameworkService } from '@services/framework.service';

/**
 * Transpilation options for configuration file compilation.
 *
 * @remarks
 * These esbuild options are used exclusively for transpiling TypeScript configuration
 * files (e.g., `config.xbuild.ts`) into executable JavaScript. The configuration
 * prioritizes correctness and simplicity over output size or performance.
 *
 * **Key settings:**
 * - **No bundling**: Dependencies are external to avoid conflicts
 * - **CommonJS output**: Enables `require()` and `module.exports` execution
 * - **Node.js platform**: Uses Node.js module resolution
 * - **Minimal minification**: Only syntax and whitespace for readability
 * - **Symbol preservation**: Maintains symlinks for monorepo support
 *
 * These options ensure configuration files can safely import types and utilities
 * without bundling their dependencies into the transpiled output.
 *
 * @since 2.0.0
 */

const transpileOptions: BuildOptions = {
    minify: false,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
    packages: 'external',
    minifySyntax: true,
    preserveSymlinks: true,
    minifyWhitespace: true,
    minifyIdentifiers: false
};

/**
 * Loads and executes a TypeScript configuration file, returning its exported configuration.
 *
 * @param path - Absolute or relative path to the configuration file
 * @returns Parsed configuration object, or empty object if file doesn't exist
 *
 * @template T - Configuration interface type (extends {@link xBuildConfigInterface})
 *
 * @remarks
 * This provider enables xBuild to load TypeScript configuration files with full type
 * safety and IDE support. It performs the following steps:
 *
 * 1. **Validation**: Checks if the file exists (returns an empty object if not)
 * 2. **Transpilation**: Compiles TypeScript to JavaScript using esbuild
 * 3. **Source map registration**: Registers the source map for error reporting
 * 4. **Environment setup**: Creates Node.js module context with `require()` support
 * 5. **Execution**: Runs the compiled code in an isolated VM context
 * 6. **Export extraction**: Retrieves the configuration from `module.exports`
 *
 * **Export resolution:**
 * - Prefers named export: `export const config = { ... }`
 * - Falls back to default export: `export default { ... }`
 * - Returns empty object if no valid export found
 *
 * **Module context:**
 * The function creates a temporary module context to execute the configuration file,
 * providing access to Node.js built-ins and the ability to import dependencies. This
 * allows configuration files to use dynamic imports, helper functions, and shared utilities.
 *
 * **Source map support:**
 * Source maps are registered with the framework service to ensure TypeScript error
 * locations are correctly mapped when errors occur in configuration files.
 *
 * @example
 * ```ts
 * // Load default configuration
 * const config = await configFileProvider<BuildConfigInterface>(
 *   'config.xbuild.ts'
 * );
 * ```
 *
 * @example
 * ```ts
 * // Load custom configuration with type safety
 * interface CustomConfig extends xBuildConfigInterface {
 *   customField: string;
 * }
 *
 * const config = await configFileProvider<CustomConfig>(
 *   'custom.config.ts'
 * );
 *
 * console.log(config.customField); // Type-safe access
 * ```
 *
 * @example
 * ```ts
 * // Configuration file structure
 * // config.xbuild.ts
 * import { BuildConfigInterface } from '@xbuild/types';
 *
 * export const config: BuildConfigInterface = {
 *   variants: {
 *     esm: {
 *       esbuild: {
 *         entryPoints: ['src/index.ts'],
 *         format: 'esm'
 *       }
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```ts
 * // Configuration with default export
 * // config.xbuild.ts
 * export default {
 *   common: {
 *     types: true
 *   },
 *   variants: { ... }
 * };
 * ```
 *
 * @see {@link buildFiles}
 * @see {@link xBuildConfigInterface}
 * @see {@link FrameworkService.setSource}
 *
 * @since 2.0.0
 */

export async function configFileProvider<T extends xBuildConfigInterface>(path: string): Promise<T> {
    if (!path || !existsSync(path)) return <T>{};
    inject(FilesModel).touchFile(path);

    const [ map, code ] = (await buildFiles([ path ], { ...transpileOptions, outdir: 'tmp' })).outputFiles!;
    inject(FrameworkService).setSource(map.text, path);

    globalThis.module = { exports: {} };
    globalThis.require = createRequire(resolve(path));

    await runInThisContext(code.text, { filename: path });
    const config = module.exports.config ?? module.exports.default;
    if (!config) return <T> {};

    return <T> config;
}
