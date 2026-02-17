
/**
 * Main entry point and public API for the xBuild build system.
 *
 * @remarks
 * This module serves as the primary interface for xBuild, providing:
 * - Type definitions for configuration and diagnostics
 * - Core services for building, watching, and serving
 * - Utility functions for configuration management
 * - Global macro function declarations for build-time transforms
 *
 * **Usage patterns**:
 * - **CLI usage**: Imported by {@link bash.ts} for command-line operations
 * - **Programmatic usage**: Imported by custom build scripts and tools
 * - **Configuration files**: Type exports used in `xbuild.config.ts`
 *
 * **Key exports**:
 * - `BuildService`: Main build orchestration service
 * - `WatchService`: File system monitoring for rebuilds
 * - `ServerModule`: Development HTTP server
 * - Configuration helper functions
 * - Global macro type declarations
 *
 * @example Programmatic build
 * ```ts
 * import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';
 *
 * overwriteConfig({
 *   variants: {
 *     production: {
 *       esbuild: { minify: true, outdir: 'dist' }
 *     }
 *   }
 * });
 *
 * const service = new BuildService();
 * await service.build('production');
 * ```
 *
 * @example Configuration file typing
 * ```ts
 * import type { xBuildConfig } from '@remotex-labs/xbuild';
 *
 * export default {
 *   variants: {
 *     dev: { esbuild: { minify: false } }
 *   }
 * } satisfies xBuildConfig;
 * ```
 *
 * @packageDocumentation
 * @since 1.0.0
 */

/**
 * Import will remove at compile time
 */

import type { PartialBuildConfigType } from '@interfaces/configuration.interface';
import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { inject } from '@symlinks/symlinks.module';
import { ConfigurationService } from '@services/configuration.service';

/**
 * Export types
 */

export type { ArgumentsInterface } from '@argv/interfaces/argv-module.interface';
export type { ServerConfigurationInterface } from '@server/interfaces/server.interface';
export type { DiagnosticsInterface } from '@typescript/services/interfaces/typescript-service.interface';

/**
 * Export
 */

export * from '@components/glob.component';
export * from '@providers/esbuild-messages.provider';
export { ServerModule } from '@server/server.module';
export { WatchService } from '@services/watch.service';

/**
 * Type alias for xBuild configuration objects.
 *
 * @remarks
 * Provides a shorter, more conventional name for the configuration interface.
 * Used primarily in configuration files to declare configuration object types
 * with TypeScript's `satisfies` operator or type annotations.
 *
 * **Properties include**:
 * - `variants`: Build variant configurations (dev, prod, etc.)
 * - `common`: Shared settings across all variants
 * - `serve`: Development server configuration
 * - `userArgv`: Custom CLI argument definitions
 * - `verbose`: Detailed logging flag
 *
 * @example Type annotation
 * ```ts
 * const config: xBuildConfig = {
 *   variants: {
 *     production: {
 *       esbuild: { minify: true, outdir: 'dist' }
 *     }
 *   }
 * };
 * ```
 *
 * @example With satisfies operator (recommended)
 * ```ts
 * export default {
 *   common: { esbuild: { platform: 'node' } },
 *   variants: {
 *     dev: { esbuild: { minify: false } },
 *     prod: { esbuild: { minify: true } }
 *   }
 * } satisfies xBuildConfig;
 * ```
 *
 * @see {@link xBuildConfigInterface} for detailed property documentation
 *
 * @since 2.0.0
 */

export type xBuildConfig = xBuildConfigInterface;

/**
 * Global type declarations for xBuild's build-time macro system.
 *
 * @remarks
 * Declares globally available macro functions that are transformed at build time.
 * These functions provide conditional compilation and inline evaluation capabilities
 * without requiring explicit imports.
 *
 * **Macro functions**:
 * - `$$ifdef`: Include code when definition is truthy
 * - `$$ifndef`: Include code when definition is falsy/undefined
 * - `$$inline`: Evaluate expressions at build time
 *
 * All macro functions are:
 * - Prefixed with `$$` to avoid naming conflicts
 * - Transformed during the build process (not runtime functions)
 * - Available globally without imports
 * - Type-safe with TypeScript
 *
 * **DefineType**: String literal union representing common definition names,
 * extensible with custom strings via `| string`.
 *
 * @example Conditional compilation
 * ```ts
 * const logger = $$ifdef('DEBUG', () => console.log);
 * // In production (DEBUG=false), becomes: const logger = undefined;
 * // In development (DEBUG=true), becomes: function logger() { return console.log; }
 * ```
 *
 * @example Negated conditional
 * ```ts
 * const optimized = $$ifndef('DEBUG', () => fastImplementation());
 * // Included only when DEBUG is not defined or false
 * ```
 *
 * @example Inline evaluation
 * ```ts
 * const version = $$inline(() => process.env.VERSION);
 * // Evaluates at build time, replaces with actual value
 * ```
 *
 * @see {@link transformerDirective} for macro transformation implementation
 *
 * @since 2.0.0
 */

declare global {
    /**
     * Type representing valid definition names for conditional macros.
     *
     * @remarks
     * Provides autocomplete for common definition names while allowing
     * custom strings. Definitions are typically set via:
     * - `config.variants[name].define` in configuration
     * - `--define` CLI flag
     * - Environment variables
     *
     * **Common definitions**:
     * - `DEBUG`: Development/debugging features
     * - `PRODUCTION`: Production-only optimizations
     * - `TEST`: Test environment features
     * - `DEV`: Development mode
     * - `CI`: Continuous integration environment
     * - `LOCAL`: Local development
     *
     * @example
     * ```ts
     * // With type checking
     * const fn = $$ifdef('DEBUG', log); // 'DEBUG' autocompletes
     * const custom = $$ifdef('MY_FEATURE', impl); // Custom string also allowed
     * ```
     *
     * @since 2.0.0
     */

    type DefineType = 'DEBUG' | 'PRODUCTION' | 'TEST' | 'DEV' | 'CI' | 'LOCAL' | string;

    /**
     * Conditional inclusion macro that includes code when a definition is truthy.
     *
     * @template T - The type of the callback return value
     * @param define - The definition name to check
     * @param callback - The code to include when definition is truthy
     *
     * @returns The callback value when condition is true, `undefined` when false
     *
     * @remarks
     * Transformed at build time based on the variant's `define` configuration.
     * When the specified definition is truthy, the callback is included in the
     * output; otherwise, the entire expression is replaced with `undefined`.
     *
     * **Transformation behavior**:
     * - Definition is truthy → Callback is included as-is
     * - Definition is falsy/undefined → Replaced with `undefined`
     * - Works with functions, objects, primitives, or any expression
     *
     * **Variable declarations**:
     * ```ts
     * const $$debug = $$ifdef('DEBUG', () => console.log);
     * // DEBUG=true → function $$debug() { return console.log; }
     * // DEBUG=false → undefined (entire declaration removed)
     * ```
     *
     * **Expression statements**:
     * ```ts
     * $$ifdef('DEBUG', () => initDebugTools());
     * // DEBUG=true → (() => initDebugTools())()
     * // DEBUG=false → (removed)
     * ```
     *
     * @example Function inclusion
     * ```ts
     * const logger = $$ifdef('DEBUG', () => console.log);
     *
     * // With DEBUG=true
     * logger('test'); // Works: logs 'test'
     *
     * // With DEBUG=false
     * logger('test'); // TypeError: logger is undefined
     * ```
     *
     * @example Object inclusion
     * ```ts
     * const config = {
     *   apiUrl: 'https://api.example.com',
     *   debug: $$ifdef('DEBUG', { verbose: true, logLevel: 'trace' })
     * };
     *
     * // With DEBUG=true
     * // config.debug = { verbose: true, logLevel: 'trace' }
     *
     * // With DEBUG=false
     * // config.debug = undefined
     * ```
     *
     * @example Guards in code
     * ```ts
     * if ($$ifdef('DEBUG', true)) {
     *   console.log('Debug mode active');
     * }
     * // DEBUG=false → if (undefined) { ... } (block never executes)
     * ```
     *
     * @see {@link DefineType} for valid definition names
     * @since 2.0.0
     */

    function $$ifdef<T>(define: DefineType, callback: T):
        T extends (...args: infer A) => infer R ? (...args: A) => R | undefined : T | undefined;

    /**
     * Conditional inclusion macro that includes code when a definition is falsy or undefined.
     *
     * @template T - The type of the callback return value
     * @param define - The definition name to check
     * @param callback - The code to include when definition is falsy/undefined
     *
     * @returns The callback value when condition is false, `undefined` when true
     *
     * @remarks
     * The inverse of `$$ifdef`. Transformed at build time based on the
     * variant's `define` configuration. When the specified definition is falsy
     * or undefined, the callback is included; otherwise, replaced with `undefined`.
     *
     * **Transformation behavior**:
     * - Definition is falsy/undefined → Callback is included as-is
     * - Definition is truthy → Replaced with `undefined`
     * - Works with functions, objects, primitives, or any expression
     *
     * **Use cases**:
     * - Development-only features (disabled in production)
     * - Fallback implementations (when optimized version unavailable)
     * - Debugging tools (removed in release builds)
     *
     * @example Development-only features
     * ```ts
     * const devTools = $$ifndef('PRODUCTION', () => initDevTools());
     *
     * // With PRODUCTION=false (dev mode)
     * devTools(); // Works: initializes dev tools
     *
     * // With PRODUCTION=true (production)
     * devTools(); // TypeError: devTools is undefined
     * ```
     *
     * @example Fallback implementation
     * ```ts
     * const optimizer = $$ifndef('NATIVE_OPTIMIZER', () => jsOptimizer());
     *
     * // With NATIVE_OPTIMIZER undefined
     * // Uses JavaScript fallback implementation
     *
     * // With NATIVE_OPTIMIZER=true
     * // optimizer is undefined, use native implementation elsewhere
     * ```
     *
     * @example Conditional exports
     * ```ts
     * export const debug = $$ifndef('PRODUCTION', {
     *   log: console.log,
     *   trace: console.trace
     * });
     *
     * // In development: exports debug object
     * // In production: export const debug = undefined;
     * ```
     *
     * @see {@link DefineType} for valid definition names
     * @since 2.0.0
     */

    function $$ifndef<T>(define: DefineType, callback: T):
        T extends (...args: infer A) => infer R ? (...args: A) => R | undefined : T | undefined;

    /**
     * Inline evaluation macro that executes code at build time and replaces it with the result.
     *
     * @param callback - Expression to evaluate at build time
     *
     * @returns String representation of the evaluated result
     *
     * @remarks
     * Executes the provided callback during the build process (not at runtime) and
     * replaces the macro call with the stringified result. This enables:
     * - Injecting build-time environment variables
     * - Computing values during compilation
     * - Generating code from external sources
     * - Eliminating runtime overhead for static values
     *
     * **Execution context**:
     * - Runs in the Node.js build environment
     * - Has access to process.env and Node.js APIs
     * - Executes once per build, not per file or variant
     * - Errors during evaluation cause build failure
     *
     * **Return value handling**:
     * - Primitives are stringified directly
     * - Objects/arrays are JSON.stringified
     * - Functions are toString()'d (use carefully)
     * - `undefined` becomes the string `'undefined'`
     *
     * **Common use cases**:
     * - Environment variable injection
     * - Build timestamp generation
     * - Package version embedding
     * - Configuration value computation
     *
     * @example Environment variable injection
     * ```ts
     * const apiUrl = $$inline(() => process.env.API_URL);
     * // Becomes: const apiUrl = "https://api.example.com";
     * ```
     *
     * @example Build metadata
     * ```ts
     * const buildInfo = {
     *   version: $$inline(() => require('./package.json').version),
     *   timestamp: $$inline(() => new Date().toISOString()),
     *   commit: $$inline(() => process.env.GIT_COMMIT)
     * };
     * // Values computed once at build time
     * ```
     *
     * @example Computed configuration
     * ```ts
     * const maxWorkers = $$inline(() => {
     *   const cpus = require('os').cpus().length;
     *   return Math.max(1, cpus - 1);
     * });
     * // Computes optimal worker count during build
     * ```
     *
     * @example Feature flags from environment
     * ```ts
     * const features = {
     *   betaFeatures: $$inline(() => process.env.ENABLE_BETA === 'true'),
     *   debugMode: $$inline(() => process.env.NODE_ENV !== 'production')
     * };
     * // Boolean values computed at build time
     * ```
     *
     * @see {@link astInlineCallExpression} for evaluation implementation
     *
     * @since 2.0.0
     */

    function $$inline(callback: unknown): string | undefined;

    /**
     * Pre-configuration CLI arguments snapshot (bootstrap argv).
     *
     * @remarks
     * A globally accessible object used during early CLI bootstrap to store the result of
     * the *minimal* argument parse (typically just enough to locate the config file).
     *
     * This is useful when later stages need access to the initial argv values before the
     * full, enhanced parse (with user extensions) is performed.
     *
     * **Intended usage:**
     * - Set once at startup (e.g., right after parsing `--config`)
     * - Read later by services/modules that need bootstrap context
     *
     * **Shape:**
     * Uses `Record<string, unknown>` because the exact keys depend on the CLI parser and
     * configuration-defined options.
     *
     * @example
     * ```ts
     * // After minimal parsing
     * globalThis.$argv = { config: 'xbuild.config.ts', _: [], $0: 'xbuild' };
     *
     * // Later
     * const configPath = String($argv.config);
     * ```
     *
     * @since 2.0.0
     */

    var $argv: Record<string, unknown>;
}

/**
 * Core build orchestration service for managing multi-variant builds with lifecycle hooks.
 *
 * @remarks
 * The `BuildService` is the primary entry point for programmatic xBuild usage,
 * providing comprehensive build orchestration across multiple variants (e.g.,
 * production, development, staging) with reactive configuration management.
 *
 * **Key capabilities**:
 * - Multi-variant build execution with parallel processing
 * - Reactive configuration updates via subscription pattern
 * - TypeScript type checking across all variants
 * - Incremental builds with file touch notifications
 * - Lifecycle hooks (onStart, onEnd) for custom build logic
 * - Macro transformation and conditional compilation
 * - Hot-reloading configuration in watch mode
 *
 * **Variant management**:
 * Each variant is an isolated build configuration with its own:
 * - esbuild settings (minification, sourcemaps, platform, etc.)
 * - TypeScript compiler options and language service
 * - Output directory and entry points
 * - Define constants for conditional compilation
 * - Custom lifecycle hooks and plugins
 *
 * **Usage patterns**:
 * - **CLI mode**: Instantiated by {@link bash.ts} with command-line arguments
 * - **Programmatic mode**: Created in custom build scripts for automation
 * - **Watch mode**: Responds to file changes with incremental rebuilds
 * - **Testing**: Type-check only mode for CI/CD pipelines
 *
 * @example Programmatic build with single variant
 * ```ts
 * import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';
 *
 * // Configure build
 * overwriteConfig({
 *   variants: {
 *     production: {
 *       esbuild: {
 *         minify: true,
 *         sourcemap: false,
 *         outdir: 'dist',
 *         platform: 'node'
 *       }
 *     }
 *   }
 * });
 *
 * // Execute build
 * const service = new BuildService();
 * await service.build('production');
 * console.log('Build complete!');
 * ```
 *
 * @example Multi-variant build with lifecycle hooks
 * ```ts
 * import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';
 *
 * overwriteConfig({
 *   variants: {
 *     cjs: {
 *       esbuild: { format: 'cjs', outdir: 'dist/cjs' }
 *     },
 *     esm: {
 *       esbuild: { format: 'esm', outdir: 'dist/esm' }
 *     }
 *   }
 * });
 *
 * const service = new BuildService();
 *
 * // Track build progress
 * service.onStart = (context) => {
 *   console.log(`Building ${context.variantName}...`);
 * };
 *
 * service.onEnd = (context) => {
 *   const { variantName, buildResult, duration } = context;
 *   if (buildResult.errors.length === 0) {
 *     console.log(`✓ ${variantName} completed in ${duration}ms`);
 *   } else {
 *     console.error(`✗ ${variantName} failed with ${buildResult.errors.length} errors`);
 *   }
 * };
 *
 * // Build all variants in parallel
 * await service.build();
 * ```
 *
 * @example Type checking without building
 * ```ts
 * import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';
 *
 * overwriteConfig({
 *   variants: {
 *     main: {
 *       esbuild: { entryPoints: ['src/**\/*.ts'] },
 *       types: { failOnError: true }
 *     }
 *   }
 * });
 *
 * const service = new BuildService();
 * const diagnostics = await service.typeChack();
 *
 * for (const [variant, errors] of Object.entries(diagnostics)) {
 *   if (errors.length > 0) {
 *     console.error(`${variant}: ${errors.length} type errors`);
 *     process.exit(1);
 *   }
 * }
 * ```
 *
 * @example Configuration hot-reloading in watch mode
 * ```ts
 * import { BuildService } from '@remotex-labs/xbuild';
 * import { watch } from 'chokidar';
 *
 * const service = new BuildService();
 *
 * // Watch for configuration changes
 * watch('xbuild.config.ts').on('change', async () => {
 *   const newConfig = await import('./xbuild.config.ts');
 *   service.reload(newConfig.default);
 *   console.log('Configuration reloaded, rebuilding...');
 * });
 *
 * // Watch for source file changes
 * watch('src/**\/*.ts').on('change', (paths) => {
 *   service.touchFiles([paths]);
 * });
 * ```
 *
 * @example Conditional compilation with defines
 * ```ts
 * import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';
 *
 * overwriteConfig({
 *   variants: {
 *     development: {
 *       esbuild: { outdir: 'dev' },
 *       define: {
 *         DEBUG: true,
 *         PRODUCTION: false
 *       }
 *     },
 *     production: {
 *       esbuild: { minify: true, outdir: 'dist' },
 *       define: {
 *         DEBUG: false,
 *         PRODUCTION: true
 *       }
 *     }
 *   }
 * });
 *
 * // Source code can use conditional macros:
 * // const logger = $$ifdef('DEBUG', () => console.log);
 * // logger?.('Debug message'); // Only included in development
 *
 * const service = new BuildService();
 * await service.build();
 * ```
 *
 * @example Custom arguments and metadata
 * ```ts
 * import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';
 *
 * overwriteConfig({
 *   userArgv: {
 *     deploy: { type: 'boolean', description: 'Deploy after build' },
 *     environment: { type: 'string', default: 'staging' }
 *   },
 *   variants: {
 *     main: { esbuild: { outdir: 'dist' } }
 *   }
 * });
 *
 * const service = new BuildService({
 *   deploy: true,
 *   environment: 'production'
 * });
 *
 * service.onEnd = async (context) => {
 *   if (context.argv.deploy && context.buildResult.errors.length === 0) {
 *     await deployToCDN(context.argv.environment);
 *   }
 * };
 *
 * await service.build();
 * ```
 *
 * @see {@link OnEndType} for end hook signature
 * @see {@link OnStartType} for start hook signature
 * @see {@link WatchService} for file watching capabilities
 * @see {@link VariantService} for individual variant management
 * @see {@link patchConfig} for incremental configuration updates
 * @see {@link overwriteConfig} for full configuration replacement
 *
 * @since 2.0.0
 */

export { BuildService } from '@services/build.service';

/**
 * Replaces the entire xBuild configuration with a new configuration.
 *
 * @param config - New configuration to apply
 *
 * @remarks
 * Completely overwrites the current configuration with the provided configuration.
 * This is a destructive operation that discards all existing settings, including:
 * - All variant configurations
 * - Common settings
 * - Server configuration
 * - User-defined CLI arguments
 *
 * **Use cases**:
 * - Programmatic build scripts that fully control configuration
 * - Testing scenarios requiring isolated configuration
 * - Dynamic configuration generation
 * - Configuration hot-reloading in watch mode
 *
 * **Timing considerations**:
 * - Must be called before creating `BuildService` instances
 * - In watch mode, triggers rebuild with new configuration
 * - Settings take effect immediately for subsequent builds
 *
 * **Difference from {@link patchConfig}**:
 * - `overwriteConfig`: Replaces entire configuration (destructive)
 * - `patchConfig`: Merges with existing configuration (additive)
 *
 * @example Programmatic configuration
 * ```ts
 * import { overwriteConfig, BuildService } from '@remotex-labs/xbuild';
 *
 * overwriteConfig({
 *   variants: {
 *     production: {
 *       esbuild: {
 *         minify: true,
 *         outdir: 'dist',
 *         platform: 'node'
 *       }
 *     }
 *   }
 * });
 *
 * const service = new BuildService();
 * await service.build('production');
 * ```
 *
 * @example Dynamic configuration
 * ```ts
 * const isProd = process.env.NODE_ENV === 'production';
 *
 * overwriteConfig({
 *   variants: {
 *     main: {
 *       esbuild: {
 *         minify: isProd,
 *         sourcemap: !isProd,
 *         outdir: isProd ? 'dist' : 'dev'
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * @example Configuration reload in watch mode
 * ```ts
 * // In file change handler
 * if (changedFile === 'xbuild.config.ts') {
 *   const newConfig = await loadConfig();
 *   overwriteConfig(newConfig);
 *   // Next build uses new configuration
 * }
 * ```
 *
 * @see {@link PartialBuildConfigType} for configuration structure
 * @see {@link patchConfig} for non-destructive configuration updates
 * @see {@link ConfigurationService.reload} for implementation details
 *
 * @since 2.0.0
 */

export function overwriteConfig(config: PartialBuildConfigType): void {
    inject(ConfigurationService).reload(config);
}

/**
 * Merges the provided configuration with the existing xBuild configuration.
 *
 * @param config - Partial configuration to merge
 *
 * @remarks
 * Performs a deep merge of the provided configuration with the current configuration,
 * preserving existing settings not specified in the patch. This is a non-destructive
 * operation that allows incremental configuration updates.
 *
 * **Merge behavior**:
 * - Object properties are deeply merged (not replaced)
 * - Array properties are replaced (not concatenated)
 * - Undefined values in patch are ignored (don't remove existing values)
 * - Null values in patch replace existing values
 *
 * **Use cases**:
 * - Adding new variants without affecting existing ones
 * - Updating specific settings while preserving others
 * - Applying conditional configuration overlays
 * - Plugin-based configuration extension
 *
 * **Timing considerations**:
 * - Can be called before or after creating `BuildService` instances
 * - Settings take effect immediately for subsequent builds
 * - Useful for progressive configuration in build scripts
 *
 * **Difference from {@link overwriteConfig}**:
 * - `patchConfig`: Merges with existing configuration (additive)
 * - `overwriteConfig`: Replaces entire configuration (destructive)
 *
 * @example Adding a new variant
 * ```ts
 * import { patchConfig } from '@remotex-labs/xbuild';
 *
 * // Existing config has 'dev' and 'prod' variants
 * patchConfig({
 *   variants: {
 *     staging: {
 *       esbuild: {
 *         minify: true,
 *         outdir: 'staging'
 *       }
 *     }
 *   }
 * });
 * // Now has 'dev', 'prod', and 'staging' variants
 * ```
 *
 * @example Updating specific settings
 * ```ts
 * // Update only output directory, preserve other settings
 * patchConfig({
 *   variants: {
 *     production: {
 *       esbuild: {
 *         outdir: 'build'
 *       }
 *     }
 *   }
 * });
 * // Other production settings (minify, platform, etc.) unchanged
 * ```
 *
 * @example Conditional configuration
 * ```ts
 * if (process.env.ENABLE_SOURCE_MAPS === 'true') {
 *   patchConfig({
 *     common: {
 *       esbuild: {
 *         sourcemap: 'linked'
 *       }
 *     }
 *   });
 * }
 * ```
 *
 * @example Plugin pattern
 * ```ts
 * function addTypeScriptPaths(paths: Record<string, string[]>) {
 *   patchConfig({
 *     common: {
 *       esbuild: {
 *         tsconfig: './tsconfig.json'
 *       }
 *     }
 *   });
 * }
 *
 * addTypeScriptPaths({ '@/*': ['src/*'] });
 * ```
 *
 * @see {@link overwriteConfig} for full configuration replacement
 * @see {@link PartialBuildConfigType} for configuration structure
 * @see {@link ConfigurationService.patch} for implementation details
 *
 * @since 2.0.0
 */

export function patchConfig(config: PartialBuildConfigType): void {
    inject(ConfigurationService).patch(config);
}
