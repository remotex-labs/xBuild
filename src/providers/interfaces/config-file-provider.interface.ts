/**
 * Import will remove at compile time
 */

import type { Options } from 'yargs';
import type { PartialBuildConfigType } from '@interfaces/configuration.interface';
import type { ServerConfigurationInterface } from '@server/interfaces/server.interface';

/**
 * Extended build configuration interface with user-defined CLI arguments and server settings.
 *
 * @remarks
 * This interface extends the base build configuration with xBuild-specific features
 * that aren't part of the core build system but provide additional development and
 * deployment capabilities.
 *
 * **Additional features:**
 * - **User-defined CLI arguments**: Extend the command-line interface with custom options
 * - **Development server**: Configure and control the built-in HTTP server
 *
 * This is the top-level configuration interface used by configuration files and represents
 * the complete set of options available in `config.xbuild.ts` files.
 *
 * The interface combines:
 * - Build variant definitions from {@link PartialBuildConfigType}
 * - Common build settings
 * - Custom CLI arguments via `userArgv`
 * - Development server configuration via `serve`
 *
 * @example
 * ```ts
 * // Complete configuration file
 * const config: xBuildConfigInterface = {
 *   verbose: true,
 *   common: {
 *     types: true,
 *     declaration: { bundle: true }
 *   },
 *   variants: {
 *     esm: {
 *       esbuild: {
 *         entryPoints: ['src/index.ts'],
 *         format: 'esm',
 *         outdir: 'dist'
 *       }
 *     }
 *   },
 *   userArgv: {
 *     env: {
 *       type: 'string',
 *       choices: ['dev', 'prod'],
 *       default: 'dev'
 *     }
 *   },
 *   serve: {
 *     dir: 'dist',
 *     port: 3000,
 *     start: true
 *   }
 * };
 * ```
 *
 * @see {@link configFileProvider}
 * @see {@link PartialBuildConfigType}
 * @see {@link ServerConfigurationInterface}
 *
 * @since 2.0.0
 */

export interface xBuildConfigInterface extends PartialBuildConfigType {
    /**
     * Custom command-line argument definitions for the build system.
     *
     * @remarks
     * Defines additional CLI flags and options beyond xBuild's defaults using the yargs
     * options format. These arguments are parsed from the command line and made available
     * throughout the build system via the `argv` context parameter.
     *
     * **Use cases:**
     * - Project-specific build modes (e.g., `--env`, `--target`)
     * - Feature flags for conditional compilation
     * - Custom output configurations
     * - Integration parameters for external tools
     * - Deployment targets and options
     *
     * Each option can specify:
     * - `type`: Data type (string, number, boolean, array)
     * - `description`: Help text displayed in `--help` output
     * - `alias`: Short flag alternatives
     * - `default`: Default value when not provided
     * - `choices`: Valid values for validation
     * - `demandOption`: Whether the option is required
     *
     * Parsed values are accessible in lifecycle hooks via `context.argv`, enabling
     * dynamic build behavior based on command-line input.
     *
     * These options appear in the CLI help output under a dedicated "User Options"
     * section, separate from xBuild's core options.
     *
     * @example
     * ```ts
     * userArgv: {
     *   watch: {
     *     type: 'boolean',
     *     description: 'Enable watch mode',
     *     default: false,
     *     alias: 'w'
     *   },
     *   env: {
     *     type: 'string',
     *     description: 'Target environment',
     *     choices: ['development', 'staging', 'production'],
     *     default: 'development'
     *   },
     *   deploy: {
     *     type: 'boolean',
     *     description: 'Deploy after successful build',
     *     default: false
     *   }
     * }
     * ```
     *
     * @example
     * ```ts
     * // Access in lifecycle hooks
     * {
     *   lifecycle: {
     *     onSuccess: async (context) => {
     *       if (context.argv.deploy) {
     *         await deployToEnvironment(context.argv.env);
     *       }
     *     }
     *   },
     *   userArgv: {
     *     deploy: { type: 'boolean' },
     *     env: { type: 'string', choices: ['dev', 'prod'] }
     *   }
     * }
     * ```
     *
     * @example
     * ```ts
     * // Command line usage
     * // xBuild --env production --deploy
     * // Parsed as: { env: 'production', deploy: true }
     * ```
     *
     * @see {@link Options}
     * @see {@link UserExtensionInterface}
     * @see {@link ArgvModule.enhancedParse}
     *
     * @since 2.0.0
     */

    userArgv?: Record<string, Options>;

    /**
     * Development server configuration and control.
     *
     * @remarks
     * Configures the built-in HTTP development server for serving build output during
     * development. The server supports live reloading, static file serving, and can be
     * integrated with watch mode for an efficient development workflow.
     *
     * **Configuration options:**
     * - `dir`: Directory to serve files from (required)
     * - `start`: Whether to automatically start the server (optional)
     * - Additional server options from {@link ServerConfigurationInterface}:
     *   - Port number
     *   - Host address
     *   - HTTPS configuration
     *   - CORS settings
     *   - Custom middleware
     *
     * The server is particularly useful when combined with watch mode, automatically
     * serving updated builds as files change.
     *
     * When `start` is true, the server starts automatically after the initial build.
     * When false or omitted, the server configuration is available but must be started
     * manually or via CLI flags.
     *
     * @example
     * ```ts
     * // Basic server configuration
     * serve: {
     *   dir: 'dist',
     *   port: 3000,
     *   start: true
     * }
     * ```
     *
     * @example
     * ```ts
     * // Advanced server with HTTPS
     * serve: {
     *   dir: 'public',
     *   port: 8080,
     *   host: '0.0.0.0',
     *   start: true,
     *   https: {
     *     key: './certs/key.pem',
     *     cert: './certs/cert.pem'
     *   }
     * }
     * ```
     *
     * @example
     * ```ts
     * // Combined with watch mode
     * {
     *   variants: {
     *     dev: {
     *       esbuild: {
     *         entryPoints: ['src/app.ts'],
     *         outdir: 'dist'
     *       }
     *     }
     *   },
     *   serve: {
     *     dir: 'dist',
     *     port: 3000,
     *     start: true
     *   }
     * }
     * // Command: xBuild --watch
     * // Serves from dist/ with auto-reload on file changes
     * ```
     *
     * @see {@link ServerConfigurationInterface}
     *
     * @since 2.0.0
     */

    serve?: ServerConfigurationInterface & { dir: string, start?: boolean }
}
