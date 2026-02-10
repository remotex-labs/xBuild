/**
 * Import will remove at compile time
 */

import type { Argv, Options } from 'yargs';
import type { BaseArgumentsInterface } from '@argv/interfaces/argv-module.interface';
import type { UserExtensionInterface, ArgumentsInterface } from '@argv/interfaces/argv-module.interface';

/**
 * Imports
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Injectable } from '@symlinks/symlinks.module';
import { bannerComponent } from '@components/banner.component';
import { CLI_DEFAULT_OPTIONS, CLI_USAGE_EXAMPLES } from '@argv/constants/argv.constant';

/**
 * Command-line argument parser and processor for xBuild.
 *
 * @remarks
 * This module provides three levels of argument parsing to support different stages
 * of the build tool's initialization and execution:
 *
 * - **Configuration file parsing**: Early-stage parsing to locate custom config files
 * - **User extension parsing**: Parses custom options defined in configuration files
 * - **Enhanced parsing**: Full-featured CLI with help, version, examples, and validation
 *
 * The module is designed as a singleton service, ensuring consistent argument parsing
 * across the entire application lifecycle. It integrates with yargs to provide a
 * comprehensive command-line interface with:
 * - Automatic help generation with custom branding
 * - Usage examples and documentation links
 * - Type-safe argument validation
 * - Support for custom user-defined options
 * - Strict mode to catch typos and invalid options
 *
 * **Parsing Strategy:**
 *
 * The three-stage parsing approach allows xBuild to:
 * 1. First, parse just the `--config` flag to locate a configuration file
 * 2. Load configuration and discover user-defined CLI options
 * 3. Reparse all arguments with a complete option set for full validation
 *
 * This strategy enables configuration files to extend the CLI dynamically while
 * maintaining type safety and proper error handling.
 *
 * @example
 * ```ts
 * const argvModule = inject(ArgvModule);
 *
 * // Parse config path only
 * const { config } = parseConfigFile(process.argv);
 *
 * // Load config and get user extensions
 * const userOptions = await configFileProvider(config);
 *
 * // Full parse with all options
 * const args = argvModule.enhancedParse(process.argv, userOptions.userArgv);
 *
 * // User argv
 * const userArgs = argvService.parseUserArgv(process.argv, userOptions.userArgv);
 * ```
 *
 * @see {@link bannerComponent}
 * @see {@link CLI_USAGE_EXAMPLES}
 * @see {@link CLI_DEFAULT_OPTIONS}
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class ArgvModule {
    /**
     * Parses command-line arguments to extract the configuration file path.
     *
     * @param argv - Raw command-line arguments array
     * @returns Parsed arguments containing the config file path
     *
     * @remarks
     * This method performs minimal parsing focused solely on extracting the `--config`
     * option. It's used during the initial bootstrap phase before the configuration
     * file is loaded, enabling xBuild to locate and load custom configuration files.
     *
     * **Parsing behavior:**
     * - Only processes the `config` option
     * - Disables help and version flags to prevent premature exit
     * - Returns a default config path if not specified
     * - Ignores all other arguments for performance
     *
     * The returned config path is used to load the build configuration file,
     * which may define additional CLI options that require reparsing with
     * the complete option set.
     *
     * This is the first step in a multi-stage parsing strategy that allows
     * configuration files to extend the CLI dynamically.
     *
     * @example
     * ```ts
     * const argvModule = inject(ArgvModule);
     * const result = argvModule.parseConfigFile(process.argv);
     *
     * console.log(result.config);
     * // Output: 'config.xbuild.ts' (default)
     * // Or: 'custom.xbuild.ts' (if --config custom.xbuild.ts was passed)
     * ```
     *
     * @example
     * ```ts
     * // Command: xBuild --config build/prod.xbuild.ts src/index.ts
     * const { config } = argvModule.parseConfigFile(process.argv);
     * // Result: { config: 'build/prod.xbuild.ts', _: [...], $0: '...' }
     * ```
     *
     * @see {@link enhancedParse}
     * @see {@link CLI_DEFAULT_OPTIONS}
     *
     * @since 2.0.0
     */

    parseConfigFile(argv: Array<string>): BaseArgumentsInterface & { config: string } {
        return yargs(argv)
            .help(false)
            .version(false)
            .options({
                config: CLI_DEFAULT_OPTIONS.config
            }).parseSync() as BaseArgumentsInterface & { config: string };
    }

    /**
     * Parses user-defined command-line options from configuration files.
     *
     * @param argv - Raw command-line arguments array
     * @param argvOptions - Optional user-defined CLI options from configuration
     * @returns Parsed arguments containing user-defined option values
     *
     * @remarks
     * This method parses custom CLI options defined in the build configuration file,
     * allowing users to extend xBuild's command-line interface with project-specific
     * arguments. It's used after loading the configuration file but before the final
     * enhanced parse.
     *
     * **Parsing behavior:**
     * - Only processes user-defined options (not xBuild defaults)
     * - Returns an empty object if no user options are provided
     * - Disables help and version to prevent premature exit
     * - Maintains type safety with generic return type
     *
     * User-defined options can include custom flags for:
     * - Build environment selection (staging, production)
     * - Feature flags and conditional compilation
     * - Custom output paths or naming schemes
     * - Integration with other build tools
     *
     * The parsed values are available in lifecycle hooks and configuration functions,
     * enabling dynamic build behavior based on CLI arguments.
     *
     * @example
     * ```ts
     * // In config.xbuild.ts
     * export default {
     *   cliOptions: {
     *     env: {
     *       describe: 'Build environment',
     *       type: 'string',
     *       choices: ['dev', 'staging', 'prod']
     *     }
     *   }
     * };
     * ```
     *
     * @example
     * ```ts
     * const argvModule = inject(ArgvModule);
     * const userArgs = argvModule.parseUserArgv<{ env: string }>(
     *   process.argv,
     *   config.cliOptions
     * );
     *
     * console.log(userArgs.env);
     * // Output: 'prod' (if --env prod was passed)
     * ```
     *
     * @example
     * ```ts
     * // No user options defined
     * const userArgs = argvModule.parseUserArgv(process.argv);
     * // Returns: {}
     * ```
     *
     * @see {@link enhancedParse}
     * @see {@link parseConfigFile}
     *
     * @since 2.0.0
     */

    parseUserArgv<T extends BaseArgumentsInterface>(argv: Array<string>, argvOptions?: Record<string, Options>): T {
        if (!argvOptions) return <T>{};

        return yargs(argv)
            .help(false)
            .version(false)
            .options(argvOptions).parseSync() as T;
    }

    /**
     * Performs comprehensive argument parsing with full CLI features and validation.
     *
     * @param argv - Raw command-line arguments array
     * @param userExtensions - Optional user-defined CLI options from configuration
     * @returns Fully parsed and validated arguments with all xBuild and user options
     *
     * @remarks
     * This method provides the complete command-line interface experience with all
     * features enabled. It combines xBuild's default options with user-defined extensions
     * to create a unified, fully validated CLI.
     *
     * **Enhanced features:**
     * - **Custom help formatting**: Displays xBuild banner and grouped options
     * - **Usage examples**: Shows common command patterns with descriptions
     * - **Strict validation**: Catches unknown options and invalid values
     * - **Help and version**: Standard `--help` and `--version` flags
     * - **Documentation links**: Provides epilogue with documentation URL
     * - **Positional arguments**: Supports file paths as positional parameters
     *
     * **Help output structure:**
     * 1. xBuild ASCII banner
     * 2. Usage syntax
     * 3. Commands section
     * 4. xBuild Options (grouped)
     * 5. User Options (grouped, if any)
     * 6. Examples
     * 7. Documentation link
     *
     * **Option grouping:**
     * - Separates xBuild core options from user-defined options
     * - Improves help readability for complex configurations
     * - Makes custom options clearly identifiable
     *
     * The method overrides yargs' `showHelp` to inject custom branding and option
     * grouping, providing a polished CLI experience consistent with xBuild's design.
     *
     * This is the final parsing stage and should be called after configuration loading
     * is complete and all user extensions have been discovered.
     *
     * @example
     * ```ts
     * const argvModule = inject(ArgvModule);
     * const args = argvModule.enhancedParse(process.argv, {
     *   env: {
     *     describe: 'Build environment',
     *     type: 'string',
     *     choices: ['dev', 'prod']
     *   }
     * });
     *
     * console.log(args.entryPoints); // ['src/index.ts']
     * console.log(args.minify);      // true
     * console.log(args.env);         // 'prod'
     * ```
     *
     * @example
     * ```ts
     * // Command: xBuild src/app.ts --bundle --minify --env prod
     * const args = argvModule.enhancedParse(process.argv, userOptions);
     * // Result: {
     * //   entryPoints: ['src/app.ts'],
     * //   bundle: true,
     * //   minify: true,
     * //   ...
     * // }
     * ```
     *
     * @example
     * ```ts
     * // Displaying help
     * // Command: xBuild --help
     * // Shows:
     * // - ASCII banner
     * // - Usage: xBuild [files..] [options]
     * // - xBuild Options: (--bundle, --minify, etc.)
     * // - User Options: (--env, custom options)
     * // - Examples: Common usage patterns
     * // - Documentation link
     * ```
     *
     * @see {@link parseUserArgv}
     * @see {@link parseConfigFile}
     * @see {@link bannerComponent}
     * @see {@link CLI_USAGE_EXAMPLES}
     * @see {@link CLI_DEFAULT_OPTIONS}
     *
     * @since 2.0.0
     */

    enhancedParse(argv: Array<string>, userExtensions: UserExtensionInterface = {}): ArgumentsInterface {
        const parser = yargs(hideBin(argv)).locale('en');
        const originalShowHelp = parser.showHelp;
        parser.showHelp = function (consoleFunction?: string | ((s: string) => void)): Argv<unknown> {
            console.log(bannerComponent());
            this.group(Object.keys(CLI_DEFAULT_OPTIONS), 'xBuild Options:');
            this.group(Object.keys(userExtensions), 'user Options:');

            return originalShowHelp.call(this, consoleFunction as (s: string) => void);
        };

        parser
            .usage('Usage: xBuild [files..] [options]')
            .command('* [entryPoints..]', 'Specific files to build (supports glob patterns)', (yargs) => {
                return yargs.positional('entryPoints', {
                    describe: 'Specific files to build (supports glob patterns)',
                    type: 'string',
                    array: true
                });
            })
            .options(userExtensions)
            .options(CLI_DEFAULT_OPTIONS)
            .epilogue('For more information, check the documentation https://remotex-labs.github.io/xBuild/')
            .help()
            .alias('help', 'h')
            .strict()
            .version();

        CLI_USAGE_EXAMPLES.forEach(([ command, description ]) => {
            parser.example(command, description);
        });

        return parser.parseSync();
    }
}
