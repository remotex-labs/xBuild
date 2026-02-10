/**
 * Import will remove at compile time
 */

import type { BuildOptions, BuildResult, Metafile } from 'esbuild';

/**
 * Imports
 */

import { cwd } from 'process';
import { build } from 'esbuild';
import { isBuildResultError, processEsbuildMessages } from '@providers/esbuild-messages.provider';

/**
 * Default ESBuild options used when building or transpiling files.
 *
 * @remarks
 * These defaults bundle, minify, preserve symlinks, and generate external sourcemaps
 * targeting modern browser environments.
 *
 * see BuildOptions
 * @since 2.0.0
 */

export const defaultBuildOptions: BuildOptions = {
    write: false,
    bundle: true,
    minify: true,
    outdir: `${ cwd() }`,
    format: 'esm',
    target: 'esnext',
    platform: 'browser',
    sourcemap: 'external',
    mangleQuoted: true,
    sourcesContent: true,
    preserveSymlinks: true
};

/**
 * Builds multiple files using ESBuild with specified options.
 *
 * @param entryPoints - Array of entry points to build
 * @param buildOptions - Optional override build options
 *
 * @returns A promise resolving to an ESBuild BuildResult including metafile information
 *
 * @throws AggregateError - Thrown if esBuild encounters errors during build
 *
 * @remarks
 * This function merges user-provided options with default options and ensures
 * that a metafile is generated. If any errors occur during the build, they are
 * wrapped in a {@link AggregateError} for consistent error reporting.
 *
 * @example
 * ```ts
 * const result = await buildFiles(['src/index.ts'], { minify: false });
 * console.log(result.outputFiles);
 * ```
 *
 * @see esBuildError
 * @see AggregateError
 *
 * @since 2.0.0
 */

export async function buildFiles(entryPoints: BuildOptions['entryPoints'], buildOptions: BuildOptions = {}): Promise<BuildResult<BuildOptions & Metafile>> {
    try {
        return await build({
            absWorkingDir: cwd(),
            ...defaultBuildOptions,
            ...buildOptions,
            metafile: true,
            entryPoints: entryPoints
        }) as BuildResult<BuildOptions & Metafile>;
    } catch (err) {
        if(isBuildResultError(err)) {
            const aggregateError = new AggregateError([], 'Failed to build entryPoints');
            processEsbuildMessages(err.errors, aggregateError.errors);

            throw aggregateError;
        }

        throw err;
    }
}

/**
 * Transpiles TypeScript source code from a string into bundled JavaScript output without writing to disk.
 *
 * @param source - TypeScript source code as a string to transpile
 * @param path - Source file path used for source map generation and error reporting
 * @param buildOptions - Optional esbuild configuration options to override defaults
 *
 * @returns Promise resolving to a {@link BuildResult} containing transpiled code, source maps, and metadata
 *
 * @remarks
 * This function performs in-memory transpilation of TypeScript code using esbuild's stdin feature.
 * It's particularly useful for:
 * - Runtime code evaluation and transformation
 * - Macro expansion and inline directives
 * - Dynamic code generation during builds
 * - Testing and validation without file system writes
 *
 * The function applies the following configuration:
 * - Uses {@link defaultBuildOptions} as the base configuration
 * - Overrides with provided `buildOptions` parameter
 * - Forces `write: false` to keep output in memory
 * - Enables `metafile: true` for dependency analysis
 * - Sets `logLevel: 'silent'` to suppress build output
 * - Generates external source maps for debugging
 *
 * The source code is treated as TypeScript (`loader: 'ts'`) and resolved relative to the current
 * working directory. The `path` parameter is used for source map generation and error messages
 * but does not need to reference an actual file on disk.
 *
 * @example
 * ```ts
 * // Basic transpilation
 * const result = await buildFromString(
 *   'const x: number = 42; export default x;',
 *   'virtual.ts'
 * );
 * console.log(result.outputFiles[0].text); // Transpiled JS
 * ```
 *
 * @example
 * ```ts
 * // With custom build options
 * const result = await buildFromString(
 *   'export const add = (a: number, b: number) => a + b;',
 *   'math.ts',
 *   {
 *     format: 'cjs',
 *     target: 'node16',
 *     minify: true
 *   }
 * );
 * ```
 *
 * @example
 * ```ts
 * // Used in macro evaluation
 * const code = extractExecutableCode(node, state);
 * const transpiled = await buildFromString(
 *   code.data,
 *   state.sourceFile.fileName,
 *   {
 *     bundle: false,
 *     format: 'cjs',
 *     packages: 'external',
 *     platform: 'node'
 *   }
 * );
 * // Execute transpiled code in VM
 * ```
 *
 * @see {@link BuildResult} for output structure
 * @see {@link defaultBuildOptions} for base configuration
 * @see {@link BuildOptions} for available configuration options
 * @see {@link analyzeDependencies} for dependency analysis without transpilation
 *
 * @since 2.0.0
 */

export async function buildFromString(source: string, path: string, buildOptions: BuildOptions = {}): Promise<BuildResult> {
    return await build({
        absWorkingDir: cwd(),
        ...defaultBuildOptions,
        ...buildOptions,
        stdin: {
            loader: 'js',
            contents: source,
            resolveDir: cwd(),
            sourcefile: path
        },
        write: false,
        metafile: true,
        logLevel: 'silent',
        sourcemap: 'external'
    });
}

/**
 * Analyzes dependencies of entry point files without writing output.
 *
 * @param entryPoint - Entry point file path(s) for dependency analysis.
 * @param buildOptions - Optional esbuild configuration options to customize the analysis.
 * @returns A promise that resolves to a {@link BuildResult} with metafile metadata containing dependency information.
 *
 * @remarks
 * This function performs a lightweight dependency analysis by:
 *
 * 1. Running esbuild in bundling mode to resolve all imports and dependencies
 * 2. Generating a metafile containing detailed dependency graph information
 * 3. Marking external packages to avoid bundling node_modules
 * 4. Disabling file output to keep the analysis fast and non-destructive
 * 5. Suppressing log output for cleaner execution
 *
 * The resulting metafile contains:
 * - All resolved imports and their relationships
 * - Module dependencies and their sizes
 * - Entry point analysis
 * - Import/export structure information
 *
 * This is useful for:
 * - Understanding project dependency graphs
 * - Identifying circular dependencies
 * - Analyzing import chains
 * - Profiling bundle composition
 * - Validating module resolution
 *
 * @example
 * ```ts
 * // Basic dependency analysis
 * const result = await analyzeDependencies('src/index.ts');
 * console.log('Dependencies:', Object.keys(result.metafile.inputs));
 *
 * // With custom build options
 * const result = await analyzeDependencies('src/main.ts', {
 *   external: ['lodash', 'react'],
 *   alias: { '@utils': './src/utils' }
 * });
 *
 * // Analyze multiple entry points
 * const result = await analyzeDependencies(
 *   ['src/index.ts', 'src/cli.ts']
 * );
 *
 * for (const [input, data] of Object.entries(result.metafile.inputs)) {
 *   console.log(`File: ${input}`);
 *   console.log(`Imports: ${data.imports.map(i => i.path).join(', ')}`);
 * }
 * ```
 *
 * @see Metafile
 * @see BuildResult
 * @see BuildOptions
 *
 * @since 1.0.0
 */

export async function analyzeDependencies(entryPoint: BuildOptions['entryPoints'], buildOptions: BuildOptions = {}): Promise<
    BuildResult & { metafile: Metafile }
> {
    try {
        return await build({
            ...buildOptions,
            outdir: 'tmp',
            write: false, // Prevent writing output files
            bundle: true, // Bundle to analyze imports
            metafile: true, // Generate a metafile to analyze dependencies
            packages: 'external',
            logLevel: 'silent',
            entryPoints: entryPoint
        });
    } catch(err) {
        if(isBuildResultError(err)) {
            const aggregateError = new AggregateError([], 'Failed to analyze entryPoint');
            processEsbuildMessages(err.errors, aggregateError.errors);

            throw aggregateError;
        }

        throw err;
    }
}
