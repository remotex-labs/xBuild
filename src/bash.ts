#!/usr/bin/env node

/**
 * Import will remove at compile time
 */

import type { ServerConfigurationInterface } from './index';
import type { ArgumentsInterface } from '@argv/interfaces/argv-module.interface';
import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { rmSync } from 'fs';
import { cwd } from 'process';
import '@errors/uncaught.error';
import { ArgvModule } from '@argv/argv.module';
import { join } from '@components/path.component';
import { inject } from '@symlinks/symlinks.module';
import { init } from '@components/interactive.component';
import { collectFilesFromGlob } from '@components/glob.component';
import { configFileProvider } from '@providers/config-file.provider';
import { bannerComponent, prefix } from '@components/banner.component';
import { keywordColor, mutedColor, pathColor } from '@components/color.component';
import { logBuildStart, createActionPrefix } from '@components/printer.component';
import { BuildService, overwriteConfig, ServerModule, WatchService } from './index';
import { logError, logTypeDiagnostics, logBuildEnd } from '@components/printer.component';

/**
 * Default glob patterns for excluding common non-source directories from entry point collection.
 *
 * @remarks
 * Applied when `--entryPoints` CLI flag is provided to filter out:
 * - `node_modules`: Third-party dependencies
 * - `dist`: Build output directory
 * - `bundle`: Alternative build output
 * - `**\/*.d.ts`: TypeScript declaration files
 *
 * These patterns are prepended with `!` to indicate exclusion in glob syntax.
 *
 * @example
 * ```ts
 * const patterns = [...args.entryPoints, ...DEFAULT_IGNORE_PATTERNS];
 * // Result: ['src/**\/*.ts', '!node_modules/**', '!dist/**', ...]
 * ```
 *
 * @see {@link configureEntryPoints} for usage context
 *
 * @since 2.0.0
 */

const DEFAULT_IGNORE_PATTERNS = [
    '!node_modules/**',
    '!dist/**',
    '!bundle/**',
    '!**/*.d.ts'
] as const;

/**
 * Glob patterns for directories excluded from watch mode file monitoring.
 *
 * @remarks
 * Prevents unnecessary rebuilds when files change in:
 * - `dist`: Build output (avoids rebuild loops)
 * - `.git`: Version control metadata
 * - `.idea`: IDE configuration files
 * - `node_modules`: Third-party dependencies (rarely change during development)
 *
 * Does not use `!` prefix as these are used directly with the watch service's
 * ignore configuration, not glob pattern matching.
 *
 * @example
 * ```ts
 * const watchService = new WatchService(WATCH_IGNORE_PATTERNS);
 * // Ignores changes in dist/, .git/, .idea/, node_modules/
 * ```
 *
 * @see {@link WatchService} for file monitoring implementation
 * @see {@link collectWatchIgnorePatterns} for dynamic pattern collection
 *
 * @since 2.0.0
 */

const WATCH_IGNORE_PATTERNS = [
    'dist',
    'dist/**',
    '.git/**',
    '.idea/**',
    'node_modules/**'
] as const;

/**
 * Configures entry points from CLI glob patterns and injects them as a special "argv" build variant.
 *
 * @param config - The xBuild configuration object to modify
 * @param args - Parsed command-line arguments containing entry point patterns
 *
 * @remarks
 * When the `--entryPoints` CLI flag is provided, this function:
 * 1. Combines user patterns with default exclusion patterns
 * 2. Excludes custom output directories from config (both CLI and config file)
 * 3. Resolves glob patterns to actual file paths
 * 4. Creates an "argv" variant containing the collected entry points
 *
 * The "argv" variant is a special build variant that merges with other configured
 * variants or serves as the sole variant if none are defined in the config file.
 *
 * **Output directory exclusion**:
 * - Checks `args.outdir` (CLI flag)
 * - Checks `config.common.esbuild.outdir` (config file)
 * - Adds both as exclusion patterns to prevent output files from being processed as source
 *
 * @example With entry points CLI flag
 * ```ts
 * const args = { entryPoints: ['src/**\/*.ts'], outdir: 'build' };
 * configureEntryPoints(config, args);
 *
 * // config.variants.argv now contains:
 * // {
 * //   esbuild: {
 * //     entryPoints: ['src/index.ts', 'src/utils.ts', ...]
 * //   }
 * // }
 * ```
 *
 * @example Without entry points (no-op)
 * ```ts
 * const args = {};
 * configureEntryPoints(config, args);
 * // config unchanged
 * ```
 *
 * @see {@link ArgumentsInterface.entryPoints}
 * @see {@link DEFAULT_IGNORE_PATTERNS} for default exclusions
 * @see {@link collectFilesFromGlob} for glob pattern resolution
 *
 * @since 2.0.0
 */

function configureEntryPoints(config: xBuildConfigInterface, args: ArgumentsInterface): void {
    if (!args.entryPoints) return;

    const ignorePatterns = [
        ...args.entryPoints,
        ...DEFAULT_IGNORE_PATTERNS
    ];

    if (args.outdir) {
        ignorePatterns.push(`!${ args.outdir }/**`, `!${ args.outdir }`);
    }

    if (config.common?.esbuild?.outdir) {
        ignorePatterns.push(`!${ config.common.esbuild.outdir }/**`, `!${ config.common.esbuild.outdir }`);
    }

    config.variants = {
        argv: {
            esbuild: {
                entryPoints: collectFilesFromGlob(cwd(), ignorePatterns)
            }
        }
    };
}

/**
 * Applies command-line argument overrides to all build variant configurations.
 *
 * @param config - The xBuild configuration object to modify
 * @param args - Parsed command-line arguments containing override values
 *
 * @remarks
 * Iterates through all configured variants and applies CLI flag overrides for:
 * - `--verbose`: Enable detailed logging
 * - `--types`: Enable/disable TypeScript type generation
 * - `--outdir`: Override output directory
 * - `--bundle`: Enable bundling and minification
 * - `--minify`: Enable code minification
 * - `--tsconfig`: Specify custom TypeScript configuration file
 * - `--platform`: Target platform (node, browser, neutral)
 * - `--declaration`: Enable/disable `.d.ts` generation
 * - `--failOnError`: Fail build on type errors
 *
 * **Precedence**: CLI flags take precedence over config file settings, allowing
 * temporary overrides without modifying the configuration file.
 *
 * **Top-level vs. variant settings**:
 * - `verbose` is set at the top level (affects all variants)
 * - Other settings are applied to each variant's configuration individually
 *
 * **Conditional application**: Only defined CLI arguments are applied, allowing
 * partial overrides while preserving other config file settings.
 *
 * @example Override output directory
 * ```ts
 * const args = { outdir: 'build' };
 * applyCommandLineOverrides(config, args);
 *
 * // All variants now have:
 * // variant.esbuild.outdir = 'build'
 * ```
 *
 * @example Multiple overrides
 * ```ts
 * const args = {
 *   minify: true,
 *   platform: 'node',
 *   declaration: false
 * };
 * applyCommandLineOverrides(config, args);
 *
 * // All variants updated with these settings
 * ```
 *
 * @see {@link ArgumentsInterface} for available CLI flags
 * @see {@link xBuildConfigInterface} for configuration structure
 *
 * @since 2.0.0
 */

function applyCommandLineOverrides(config: xBuildConfigInterface, args: ArgumentsInterface): void {
    if (args.verbose !== undefined) {
        config.verbose = args.verbose;
    }

    const variants = Object.values(config.variants ?? {});

    for (const variant of variants) {
        if (args.types !== undefined) variant.types = args.types;
        if (args.outdir !== undefined) variant.esbuild.outdir = args.outdir;
        if (args.bundle !== undefined) variant.esbuild.minify = args.bundle;
        if (args.minify !== undefined) variant.esbuild.minify = args.minify;
        if (args.tsconfig !== undefined) variant.esbuild.tsconfig = args.tsconfig;
        if (args.platform !== undefined) variant.esbuild.platform = args.platform;
        if (args.declaration !== undefined) variant.declaration = args.declaration;

        if (args.failOnError !== undefined) {
            variant.types = { failOnError: args.failOnError };
        }
    }
}

/**
 * Collects all directories that should be ignored by the file watcher.
 *
 * @param config - The xBuild configuration containing output directory settings
 *
 * @returns Array of directory patterns to exclude from watch monitoring
 *
 * @remarks
 * Combines default ignore patterns with dynamic output directories to create
 * a comprehensive exclusion list for the watch service. This prevents:
 * - Rebuild loops (watching build output directories)
 * - Unnecessary rebuild triggers from IDE/VCS file changes
 * - Performance issues from monitoring large node_modules directories
 *
 * **Dynamic pattern collection**:
 * 1. Starts with {@link WATCH_IGNORE_PATTERNS} (static patterns)
 * 2. Adds `config.common.esbuild.outdir` if present
 * 3. Adds each variant's `esbuild.outdir` if present
 * 4. For each directory, adds both the directory itself and a recursive pattern
 *
 * **Pattern format**:
 * - `dist`: Ignore the directory
 * - `dist/**`: Ignore all files within the directory recursively
 *
 * @example With common and variant output directories
 * ```ts
 * const config = {
 *   common: { esbuild: { outdir: 'dist' } },
 *   variants: {
 *     prod: { esbuild: { outdir: 'build' } },
 *     dev: { esbuild: { outdir: 'tmp' } }
 *   }
 * };
 *
 * const patterns = collectWatchIgnorePatterns(config);
 * // Returns: [
 * //   'dist', '.git/**', 'node_modules/**', ...,
 * //   'dist', 'dist/**',
 * //   'build', 'build/**',
 * //   'tmp', 'tmp/**'
 * // ]
 * ```
 *
 * @example With no custom output directories
 * ```ts
 * const config = { variants: {} };
 * const patterns = collectWatchIgnorePatterns(config);
 * // Returns: ['dist', 'dist/**', '.git/**', '.idea/**', 'node_modules/**']
 * ```
 *
 * @see {@link WATCH_IGNORE_PATTERNS} for default exclusions
 * @see {@link WatchService} for watch service implementation
 *
 * @since 2.0.0
 */

function collectWatchIgnorePatterns(config: xBuildConfigInterface): Array<string> {
    const ignorePatterns: Array<string> = [ ...WATCH_IGNORE_PATTERNS ];

    if (config.common?.esbuild?.outdir) {
        ignorePatterns.push(config.common.esbuild.outdir, `${ config.common.esbuild.outdir }/**`);
    }

    const variants = Object.values(config.variants ?? {});
    for (const variant of variants) {
        if (variant.esbuild.outdir) {
            ignorePatterns.push(variant.esbuild.outdir, `${ variant.esbuild.outdir }/**`);
        }
    }

    return ignorePatterns;
}

/**
 * Starts the development HTTP server if requested via CLI or configuration.
 *
 * @param config - The xBuild configuration containing server settings
 * @param args - Parsed command-line arguments containing serve flag
 *
 * @returns Promise resolving to the server URL string if started, otherwise undefined
 *
 * @remarks
 * The server is started when either:
 * - `--serve [dir]` CLI flag is provided (optionally with directory)
 * - `config.serve.start` is set to `true` in configuration file
 *
 * **Server directory resolution**:
 * 1. `config.serve.dir` (config file setting, highest priority)
 * 2. `args.serve` (CLI flag value, if string)
 * 3. `'dist'` (default fallback)
 *
 * **Configuration merging**:
 * - Merges config file server settings with CLI overrides
 * - Wraps the `onStart` callback to capture server URL and log startup message
 * - Preserves user-defined `onStart` callback if present
 *
 * **Startup logging**:
 * Displays formatted startup message:
 * ```
 * [serve] dist http://localhost:3000
 * ```
 *
 * @example Start server with CLI flag
 * ```ts
 * const args = { serve: 'public' };
 * const url = await startServer(config, args);
 * // Server started at http://localhost:3000
 * // Serving: public
 * ```
 *
 * @example Start server from config
 * ```ts
 * const config = {
 *   serve: {
 *     start: true,
 *     dir: 'dist',
 *     port: 8080
 *   }
 * };
 * const url = await startServer(config, {});
 * // Server started at http://localhost:8080
 * ```
 *
 * @example No server (returns undefined)
 * ```ts
 * const config = { serve: { start: false } };
 * const url = await startServer(config, {});
 * // url === undefined
 * ```
 *
 * @see {@link ServerModule} for server implementation
 * @see {@link ServerConfigurationInterface} for configuration options
 *
 * @since 2.0.0
 */

async function startServer(config: xBuildConfigInterface, args: ArgumentsInterface): Promise<string | undefined> {
    const shouldStartServer = (args.serve ?? false) !== false || config.serve?.start;
    if (!shouldStartServer) return;

    let urlString = undefined;
    const serveDir = config.serve?.dir || args.serve || 'dist';
    const serverConfig: ServerConfigurationInterface = {
        ...config.serve,
        onStart({ host, port, url }): void {
            urlString = url;
            console.log(`${ createActionPrefix('serve') } ${ keywordColor(serveDir) } ${ pathColor(url) }\n`);
            config.serve?.onStart?.({ host, port, url });
        }
    };

    const server = new ServerModule(serverConfig, serveDir);
    await server.start();

    return urlString;
}

/**
 * Executes a single build pass, handling clean, type checking, and build operations.
 *
 * @param buildService - The build service instance to execute
 * @param args - Parsed command-line arguments controlling build behavior
 *
 * @returns Promise that resolves when the build completes or fails
 *
 * @remarks
 * Orchestrates a complete build cycle with the following steps:
 * 1. **Clean**: Removes the `dist` directory (forced, recursive)
 * 2. **Type check or build**: Executes type checking if `--typeCheck` flag is set, otherwise performs full build
 * 3. **Error handling**: Catches and logs any build errors
 *
 * **Operational modes**:
 * - **Type check mode** (`--typeCheck`): Runs TypeScript compiler diagnostics without emitting files
 * - **Build mode**: Executes full build with optional build name parameter
 *
 * **Clean behavior**:
 * - Always removes `dist` directory before building
 * - Uses `{ recursive: true, force: true }` for safe deletion
 * - Errors during clean are silently ignored (directory may not exist)
 *
 * **Error handling**:
 * - All errors are caught and logged via {@link logError}
 * - Errors do not throw (suitable for watch mode)
 *
 * @example Standard build
 * ```ts
 * const args = { build: 'production' };
 * await executeBuild(buildService, args);
 * // 1. Removes dist/
 * // 2. Builds with 'production' configuration
 * ```
 *
 * @example Type check only
 * ```ts
 * const args = { typeCheck: true };
 * await executeBuild(buildService, args);
 * // 1. Removes dist/
 * // 2. Runs TypeScript diagnostics
 * // 3. Logs diagnostics (no files emitted)
 * ```
 *
 * @example Error during build
 * ```ts
 * await executeBuild(buildService, args);
 * // If build fails, error is logged but function doesn't throw
 * ```
 *
 * @see {@link logError} for error formatting
 * @see {@link BuildService.typeChack} for type checking
 * @see {@link BuildService.build} for build implementation
 * @see {@link logTypeDiagnostics} for diagnostic output formatting
 *
 * @since 2.0.0
 */

async function executeBuild(buildService: BuildService, args: ArgumentsInterface): Promise<void> {
    try {
        const distPath = join(process.cwd(), 'dist');
        rmSync(distPath, { recursive: true, force: true });

        if (args.typeCheck) {
            const diagnostics = await buildService.typeChack();
            logTypeDiagnostics(diagnostics);
        } else {
            await buildService.build(args.build);
        }
    } catch (error) {
        logError(error);
    }
}

/**
 * Enters watch mode for continuous rebuilding on file changes.
 *
 * @param buildService - The build service instance to trigger rebuilds
 * @param config - The xBuild configuration containing watch patterns
 * @param args - Parsed command-line arguments controlling watch behavior
 * @param url - Optional server URL to display in interactive UI
 *
 * @returns Promise that resolves when watch mode is set up (never resolves in watch mode)
 *
 * @remarks
 * Watch mode is enabled when:
 * - `--watch` CLI flag is provided, OR
 * - `--serve` CLI flag is provided (implies watching), OR
 * - `config.serve.start` is `true` (implies watching)
 *
 * **Watch mode flow**:
 * 1. Collects ignore patterns from configuration
 * 2. Initializes watch service with ignore patterns
 * 3. Sets up interactive terminal UI (if applicable)
 * 4. Executes initial build
 * 5. Starts file system watcher
 * 6. On file changes:
 *    - Touches changed files in TypeScript language service
 *    - Reloads configuration if config file changed
 *    - Logs rebuild trigger
 *    - Executes rebuild
 *
 * **Configuration reloading**:
 * If the configuration file itself changes, the config is reloaded and
 * the build service is updated with the new configuration, allowing
 * configuration changes without restarting the process.
 *
 * **Interactive UI**:
 * Initializes an interactive terminal interface displaying:
 * - Server URL (if provided)
 * - Build status
 * - Keyboard shortcuts for manual actions
 *
 * **Early exit**:
 * If watch mode is not requested, the function returns immediately
 * without starting the watcher.
 *
 * @example Watch mode with server
 * ```ts
 * const args = { watch: true, serve: 'dist' };
 * await startWatchMode(buildService, config, args, 'http://localhost:3000');
 * // 1. Executes initial build
 * // 2. Starts watching files
 * // 3. Rebuilds on changes
 * // (Never returns)
 * ```
 *
 * @example Serve mode (implicit watch)
 * ```ts
 * const args = { serve: 'dist' };
 * await startWatchMode(buildService, config, args, url);
 * // Watch mode automatically enabled
 * ```
 *
 * @example No watch mode
 * ```ts
 * const args = {};
 * await startWatchMode(buildService, config, args);
 * // Returns immediately (no watching)
 * ```
 *
 * @see {@link WatchService} for file system monitoring
 * @see {@link BuildService.reload} for configuration reloading
 * @see {@link BuildService.touchFiles} for incremental compilation
 * @see {@link collectWatchIgnorePatterns} for ignore pattern collection
 *
 * @since 2.0.0
 */

async function startWatchMode(
    buildService: BuildService, config: xBuildConfigInterface, args: ArgumentsInterface, url?: string
): Promise<void> {
    const shouldWatch = args.watch || args.serve !== undefined || config.serve?.start;
    if (!shouldWatch) return;

    const ignorePatterns = collectWatchIgnorePatterns(config);
    const watchService = new WatchService(ignorePatterns);

    init(async () => {
        await executeBuild(buildService, args);
    }, url);

    await executeBuild(buildService, args);
    await watchService.start(async (changedFiles: Array<string>): Promise<void> => {
        buildService.touchFiles(changedFiles);

        if(changedFiles.includes(args.config!)) {
            const config = await configFileProvider(args.config!);
            buildService.reload(config);
        }

        console.log(`\n${ prefix() } ${ mutedColor('Rebuilding') }: files (${ changedFiles.length })\n`);
        await executeBuild(buildService, args);
    });

    return;
}

/**
 * Main CLI entry point that orchestrates the complete xBuild execution lifecycle.
 *
 * @returns Promise that resolves when execution completes (or never in watch mode)
 *
 * @throws Errors are caught and logged internally, function does not throw
 *
 * @remarks
 * This is the primary entry point executed when the xBuild CLI is invoked.
 * It orchestrates the complete build lifecycle from configuration loading to
 * build execution, with support for watch mode, development server, and various
 * build configurations.
 *
 * **Execution flow**:
 * 1. **Banner**: Display xBuild version and branding
 * 2. **Configuration parsing**:
 *    - Parse config file path from CLI args
 *    - Load configuration file (if exists)
 *    - Parse full CLI arguments with config context
 *    - Extract user-defined arguments
 * 3. **Configuration setup**:
 *    - Configure entry points from glob patterns
 *    - Apply CLI overrides to variant configurations
 *    - Finalize and validate configuration
 * 4. **Build service initialization**:
 *    - Create build service instance with user args
 *    - Register lifecycle callbacks (onStart, onEnd)
 * 5. **Server startup** (if requested):
 *    - Start development HTTP server
 *    - Capture server URL for UI display
 * 6. **Execution mode**:
 *    - Enter watch mode if `--watch` or `--serve` flags present
 *    - Otherwise, execute single build pass
 *
 * **Configuration precedence**:
 * 1. CLI flags (highest priority)
 * 2. Configuration file settings
 * 3. Built-in defaults (lowest priority)
 *
 * **User arguments**:
 * Custom CLI arguments defined in `config.userArgv` are parsed separately
 * and passed to the build service, allowing custom build scripts to extend
 * the CLI with additional flags.
 *
 * **Lifecycle callbacks**:
 * - `onStart`: Logs build start with timing information
 * - `onEnd`: Logs build completion with duration and status
 *
 * @example Standard build invocation
 * ```bash
 * xbuild
 * # 1. Displays banner
 * # 2. Loads xbuild.config.ts
 * # 3. Executes build
 * # 4. Exits
 * ```
 *
 * @example Watch mode with server
 * ```bash
 * xbuild --watch --serve dist --port 8080
 * # 1. Displays banner
 * # 2. Loads configuration
 * # 3. Starts server on port 8080
 * # 4. Executes initial build
 * # 5. Watches for changes
 * # (Runs indefinitely)
 * ```
 *
 * @example Custom configuration file
 * ```bash
 * xbuild --config custom.config.ts --minify
 * # Loads custom.config.ts instead of default
 * ```
 *
 * @see {@link startWatchMode} for watch mode
 * @see {@link executeBuild} for build execution
 * @see {@link startServer} for development server
 * @see {@link ArgvModule} for CLI argument parsing
 * @see {@link BuildService} for build orchestration
 * @see {@link configFileProvider} for configuration loading
 *
 * @since 2.0.0
 */

async function main(): Promise<void> {
    // Display banner
    console.log(bannerComponent());

    // Parse configuration
    const argvService = inject(ArgvModule);
    const preConfig = argvService.parseConfigFile(process.argv);
    const config = await configFileProvider(preConfig.config);
    const args = argvService.enhancedParse(process.argv, config.userArgv);
    const userArgs = argvService.parseUserArgv(process.argv, config.userArgv);

    // Configure build
    configureEntryPoints(config, args);
    applyCommandLineOverrides(config, args);
    overwriteConfig(config);

    // Initialize build service
    const buildService = new BuildService(userArgs);
    buildService.onEnd = logBuildEnd;
    buildService.onStart = logBuildStart;

    // Execute build pipeline
    const url = await startServer(config, args);
    await startWatchMode(buildService, config, args, url);
    await executeBuild(buildService, args);
}

main();
