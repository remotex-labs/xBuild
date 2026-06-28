/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Argv, Options } from 'yargs';
import type { BaseArgumentsInterface } from '@modules/argv/interfaces/argv-module.interface';
import type { UserExtensionInterface, ArgumentsInterface } from '@modules/argv/interfaces/argv-module.interface';

/**
 * Imports
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Injectable } from '@services/symlinks.service';
import { CLI_DEFAULT_OPTIONS, CLI_USAGE_EXAMPLES } from '@modules/argv/constants/argv.constant';


/**
 * Parses xBuild's command-line arguments across the stages of startup.
 *
 * @remarks
 * Parsing happens in three passes so configuration files can extend the CLI:
 *
 * 1. {@link parseConfigFile} reads only `--config` to locate the configuration file.
 * 2. {@link parseUserArgv} parses the custom options that file declares.
 * 3. {@link enhancedParse} reparses everything with the full option set, help, and validation.
 *
 * Registered as a singleton so parsing is consistent across the application.
 *
 * @example
 * ```ts
 * const argv = inject(ArgvModule);
 * const { config } = argv.parseConfigFile(process.argv);
 * const userOptions = await configFileProvider(config);
 * const args = argv.enhancedParse(process.argv, userOptions.userArgv);
 * ```
 *
 * @see CLI_DEFAULT_OPTIONS
 * @see CLI_USAGE_EXAMPLES
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class ArgvModule {
    /**
     * Parses only the `--config` flag to locate the configuration file.
     *
     * @param argv - Raw command-line arguments.
     * @returns The parsed arguments including the resolved `config` path.
     *
     * @remarks
     * The bootstrap pass, run before the configuration file is loaded. Help and version are disabled so an early
     * `--help` cannot exit the process, and unknown options are ignored. Falls back to the default config path.
     *
     * @example
     * ```ts
     * // xBuild --config build/prod.xbuild.ts src/index.ts
     * const { config } = argv.parseConfigFile(process.argv); // 'build/prod.xbuild.ts'
     * ```
     *
     * @see enhancedParse
     * @since 2.0.0
     */

    parseConfigFile(argv: Array<string>): BaseArgumentsInterface & { config: string } {
        return this.silentParse<BaseArgumentsInterface & { config: string }>(argv, {
            config: CLI_DEFAULT_OPTIONS.config
        });
    }

    /**
     * Parses the custom options declared by a configuration file.
     *
     * @template T - Shape of the parsed user arguments.
     *
     * @param argv - Raw command-line arguments.
     * @param argvOptions - User-defined option definitions, or omitted when none exist.
     * @returns The parsed user option values, or an empty object when no options are given.
     *
     * @remarks
     * Run after the configuration file loads but before {@link enhancedParse}. Only the user-defined options are
     * considered; help and version are disabled to avoid an early exit.
     *
     * @example
     * ```ts
     * const userArgs = argv.parseUserArgv<{ env: string }>(process.argv, config.cliOptions);
     * userArgs.env; // 'prod'
     * ```
     *
     * @see enhancedParse
     * @see parseConfigFile
     *
     * @since 2.0.0
     */

    parseUserArgv<T extends BaseArgumentsInterface>(argv: Array<string>, argvOptions?: Record<string, Options>): T {
        if (!argvOptions) return <T>{};

        return this.silentParse<T>(argv, argvOptions);
    }

    /**
     * Parses all arguments with the full CLI: help, version, examples, grouping, and strict validation.
     *
     * @param argv - Raw command-line arguments.
     * @param userExtensions - User-defined options merged with xBuild's defaults.
     * @returns The fully parsed and validated arguments.
     *
     * @remarks
     * The final pass, run once configuration loading is complete. It overrides yargs' `showHelp` to group xBuild
     * options separately from user options, then registers the usage examples, the documentation epilogue, and strict
     * mode so unknown options are rejected. Positional arguments are collected as `entryPoints`.
     *
     * @example
     * ```ts
     * // xBuild src/app.ts --bundle --minify --env prod
     * const args = argv.enhancedParse(process.argv, userOptions);
     * args.entryPoints; // ['src/app.ts']
     * ```
     *
     * @see parseUserArgv
     * @see parseConfigFile
     * @see CLI_USAGE_EXAMPLES
     * @see CLI_DEFAULT_OPTIONS
     *
     * @since 2.0.0
     */

    enhancedParse(argv: Array<string>, userExtensions: UserExtensionInterface = {}): ArgumentsInterface {
        const parser = yargs(hideBin(argv)).locale('en');
        const originalShowHelp = parser.showHelp;
        parser.showHelp = function (consoleFunction?: string | ((s: string) => void)): Argv<unknown> {
            this.group(Object.keys(CLI_DEFAULT_OPTIONS), 'xBuild Options:');
            this.group(Object.keys(userExtensions), 'User Options:');

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

    /**
     * Parses arguments against a fixed option set without help or version handling.
     *
     * @template T - Shape of the parsed arguments.
     *
     * @param argv - Raw command-line arguments.
     * @param options - Option definitions to recognize.
     * @returns The parsed arguments.
     *
     * @remarks
     * Shared by {@link parseConfigFile} and {@link parseUserArgv}. Help and version are disabled so a partial parse
     * never exits the process, and unrecognized options are ignored.
     *
     * @since 2.6.0
     */

    private silentParse<T>(argv: Array<string>, options: Record<string, Options>): T {
        return yargs(argv)
            .help(false)
            .version(false)
            .options(options)
            .parseSync() as T;
    }
}
