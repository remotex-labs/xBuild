/**
 * Import will remove at compile time
 */

import type { BuildOptions, BuildResult, Metafile } from 'esbuild';
import type { TranspileFileInterface } from '@services/interfaces/transpiler.interface';
import type { EntryPointsType } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import { cwd } from 'process';
import { build } from 'esbuild';
import { xBuildError } from '@errors/xbuild.error';

/**
 * Default build options for esbuild bundler in RemoteX framework.
 *
 * These options are used to configure how esbuild processes and bundles the TypeScript
 * files for the RemoteX testing framework.
 *
 * @public
 * @category Configuration
 */

export const defaultBuildOptions: BuildOptions = {
    write: false,
    bundle: true,
    minify: true,
    format: 'cjs',
    target: 'esnext',
    platform: 'node',
    sourcemap: true,
    sourcesContent: true,
    preserveSymlinks: true
};

/**
 * Extracts the source map from the provided data string and returns the modified code and source map separately.
 *
 * This function searches for the inline source map in the data string using a regular expression, removes the
 * source map comment from the data string, and returns an object containing the code without the source map
 * comment and the extracted source map.
 *
 * @param dataString - The string containing the transpiled code with an inline source map.
 * @returns An object containing the modified code without the source map comment and the extracted source map.
 * @throws Error -Throws an error if the source map URL is not found in the data string.
 *
 * @public
 */

export function extractSourceMap(dataString: string): TranspileFileInterface {
    const sourceMapRegex = /\/\/# sourceMappingURL=data:application\/json;base64,([^'"\s]+)/;
    const match = dataString.match(sourceMapRegex);

    if (!match || !match[1]) {
        throw new xBuildError('Source map URL not found in the output.');
    }

    const sourceMap = match[1];
    const codeWithoutSourceMap = dataString.replace(sourceMapRegex, '');

    return { code: codeWithoutSourceMap, sourceMap };
}

/**
 * Transpiles a TypeScript file and extracts the source map.
 *
 * This function uses esbuild to transpile the specified TypeScript file based on provided build options,
 * and then extracts the source map from the transpiled code.
 *
 * @param filePath - The path to the TypeScript file to be transpiled.
 * @param buildOptions - Optional build options to override the default build options.
 * @returns A promise that resolves to an object containing the transpiled code and the extracted source map.
 * @throws Error - Throws an error if the build process fails or the source map extraction fails.
 *
 * @public
 * @category Services
 */

export async function transpileFile(filePath: string, buildOptions: BuildOptions = {}): Promise<TranspileFileInterface> {
    const options: BuildOptions = {
        absWorkingDir: cwd(),
        ...defaultBuildOptions,
        ...buildOptions,
        entryPoints: [ filePath ]
    };

    const result = await build(options);
    const fileContent = result.outputFiles?.pop()?.text ?? '';

    // Retrieve the transpiled code from the build output.
    return extractSourceMap(fileContent);
}

/**
 * The `analyzeDependencies` function analyzes the dependencies of a given entry point for a specified platform.
 * It performs a bundling operation and generates a metafile that contains detailed information about the
 * dependencies involved in the build process.
 * This is typically used to inspect the external packages and modules
 * that the entry point depends on.
 *
 * - **Input**:
 *   - `entryPoint`: A string or array of strings representing the entry points for the build.
 *   This defines the starting point(s) for the bundling process.
 *   - `platform`: An optional parameter that specifies the platform to target for the build.
 *   Default is `'browser'`.
 *
 * - **Output**: A `Promise` that resolves to an object containing:
 *   - The `BuildResult` from the bundling process.
 *   - A `metafile`, which contains detailed metadata about the build, including the dependencies analyzed.
 *
 * ## Example:
 *
 * ```ts
 * const result = await analyzeDependencies(['src/index.ts']);
 * console.log(result.metafile); // { inputs: { 'src/index.ts': { ... } }, outputs: { ... } }
 *
 * const nodeResult = await analyzeDependencies(['src/server.ts'], 'node');
 * console.log(nodeResult.metafile); // { inputs: { 'src/server.ts': { ... } }, outputs: { ... } }
 * ```
 *
 * @param entryPoint - The entry point(s) to be analyzed.
 * @param platform - The target platform for the build.
 * @returns A `Promise` that resolves to a `BuildResult` object along with a `metafile` containing dependency details.
 * @throws Error If the build process fails for any reason.
 */

export async function analyzeDependencies(entryPoint: EntryPointsType, platform: BuildOptions['platform'] = 'browser'): Promise<
    BuildResult & { metafile: Metafile }
> {
    return await build({
        outdir: 'tmp',
        write: false, // Prevent writing output files
        bundle: true, // Bundle to analyze imports
        metafile: true, // Generate a metafile to analyze dependencies
        platform: platform,
        packages: 'external',
        logLevel: 'silent',
        entryPoints: entryPoint,
        loader: {
            '.html': 'text'
        }
    });
}
