
/**
 * Global type declarations for the xBuild project.
 *
 * @remarks
 * This file augments the global namespace with type definitions for compile-time
 * constants and Node.js runtime globals used throughout the build system.
 *
 * These declarations provide type safety for:
 * - Build-time injected constants (e.g., version information)
 * - CommonJS module system compatibility
 * - Dynamic module loading and exports
 *
 * @since 2.0.0
 */

declare global {
    /**
     * Package version string injected at build time.
     *
     * @remarks
     * This constant is replaced during the build process with the actual version
     * from `package.json`. It allows runtime code to access the build version
     * without requiring file system access or JSON parsing.
     *
     * The value is typically injected using esbuild's `define` option or similar
     * bundler configuration.
     *
     * @example Accessing version information
     * ```ts
     * console.log(`Running xBuild v${__VERSION}`);
     * // Output: Running xBuild v1.5.12
     * ```
     *
     * @example Conditional behavior based on version
     * ```ts
     * if (__VERSION.startsWith('2.')) {
     *   // Use v2 API
     * }
     * ```
     *
     * @readonly
     * @since 2.0.0
     */

    const __VERSION: string;

    /**
     * Node.js `require` function for CommonJS module loading.
     *
     * @remarks
     * Provides type information for the CommonJS module system's `require` function.
     * This allows TypeScript to recognize `require()` calls in mixed module environments
     * where both ESM and CommonJS patterns may coexist.
     *
     * @example Loading a CommonJS module
     * ```ts
     * const fs = require('fs');
     * const customModule = require('./custom-module');
     * ```
     *
     * @see {@link https://nodejs.org/api/modules.html#requireid | Node.js require documentation}
     * @since 2.0.0
     */

    var require: NodeJS.Require;

    /**
     * CommonJS module object for dynamic exports.
     *
     * @remarks
     * Represents the CommonJS module object used to export values from a module.
     * The `module.exports` object can contain named exports, a default export,
     * or a combination of both patterns.
     *
     * This declaration is particularly useful when:
     * - Transpiling ESM to CommonJS
     * - Working with dynamic configuration files (e.g., `xbuild.config.ts`)
     * - Supporting both export patterns in the same codebase
     *
     * **Properties**:
     * - `config`: Optional configuration object (commonly used in config files)
     * - `default`: Optional default export value
     * - Additional named exports indexed by string keys
     *
     * @example Exporting configuration
     * ```ts
     * module.exports = {
     *   config: {
     *     entry: './src/index.ts',
     *     output: './dist'
     *   }
     * };
     * ```
     *
     * @example Mixed exports
     * ```ts
     * module.exports = {
     *   default: mainFunction,
     *   config: buildConfig,
     *   utils: helperFunctions
     * };
     * ```
     *
     * @see {@link https://nodejs.org/api/modules.html#moduleexports | Node.js module.exports documentation}
     * @since 2.0.0
     */

    var module: {
        exports: {
            [key: string]: unknown;
            config?: unknown;
            default?: unknown;
        };
    };
}

export {};
