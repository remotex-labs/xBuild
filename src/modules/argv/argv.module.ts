/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Argv } from 'yargs';
import type { BaseArgumentsInterface } from '@argv/interfaces/argv-module.interface';
import type { UserExtensionInterface, ArgumentsInterface } from '@argv/interfaces/argv-module.interface';

/**
 * Imports
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Injectable } from '@remotex-labs/xinject';
import { ArgsDefaultOptions, ArgsUsageExamples } from '@argv/constants/argv.constant';

/**
 * Parses the command line in the two passes startup needs.
 *
 * @remarks
 * A configuration file may add options of its own, so the full option set is not known when the process starts.
 * The passes resolve that: {@link parseConfigFile} reads the `--config` path alone, the file it names is loaded and
 * its options collected, and {@link enhancedParse} then parses the line again knowing everything.
 * The first pass leaves `--help` and `--version` switched off so a run cannot exit on a half-built option set,
 * showing help that omits the configuration's own flags.
 * Only the second turns them on, along with the strict mode that rejects what none of the options account for.
 * Registered as a singleton, so every stage parses against one instance.
 *
 * @example
 * ```ts
 * const argv = inject(ArgvModule);
 *
 * const { config } = argv.parseConfigFile(process.argv);       // 'config.xbuild.ts'
 * const userOptions = (await loadConfig(config)).userArgv;     // options the file adds
 * argv.enhancedParse(process.argv, userOptions).entryPoints;   // [ 'src/index.ts' ]
 * ```
 *
 * @see ArgsDefaultOptions
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class ArgvModule {
    /**
     * Reads the configuration file path before the rest of the options are known.
     *
     * @param argv - Command-line arguments to read
     * @returns The parsed arguments, always carrying a `config` path
     *
     * @remarks
     * Only `config` is declared, so everything else on the line falls through into the positional list rather than
     * failing - strict mode belongs to {@link enhancedParse}, which is the pass that knows the whole option set.
     * The path is never missing, the option carrying its own default, so a caller has nothing to fall back to.
     * The arguments are passed to yargs as given rather than through `hideBin`,
     * so the executable and script land in the positions and are ignored here, `config` being the only thing read.
     *
     * @example
     * ```ts
     * argv.parseConfigFile(process.argv).config; // 'config.xbuild.ts' - the default
     *
     * // xBuild --config build/prod.xbuild.ts src/index.ts
     * argv.parseConfigFile(process.argv).config; // 'build/prod.xbuild.ts'
     * ```
     *
     * @see enhancedParse
     * @since 2.0.0
     */

    parseConfigFile(argv: Array<string>): BaseArgumentsInterface & { config: string } {
        return yargs(argv)
            .help(false)
            .version(false)
            .options({
                config: ArgsDefaultOptions.config
            }).parseSync() as BaseArgumentsInterface & { config: string };
    }

    /**
     * Parses the whole command line, xBuild's options, and the configuration together.
     *
     * @param argv - Command-line arguments to parse, executable and script included
     * @param userExtensions - Options the configuration file adds to xBuild's own
     * @returns Every option the line carried, validated against the complete set
     *
     * @throws Error - Thrown by yargs on an unknown flag, a missing value, or a value outside an option's choices
     *
     * @remarks
     * The pass that can afford to be strict, both option sets being known by now: a misspelled flag fails here rather
     * than being collected and silently ignored.
     * Files named without a flag are taken as `entryPoints` through the default command, so the usual invocation
     * needs no flag at all.
     * Help lists the two sets under headings of their own, which is done inside an overridden `showHelp` rather than
     * up front - grouping costs nothing on a run that never asks for help.
     * `hideBin` drops the executable and script here, unlike the first pass, so the positions hold only what
     * the user typed.
     *
     * @example
     * ```ts
     * // xBuild src/app.ts --bundle --minify --env prod
     * const args = argv.enhancedParse(process.argv, { env: { type: 'string' } });
     *
     * args.entryPoints; // [ 'src/app.ts' ]
     * args.bundle;      // true
     * args.env;         // 'prod' - the configuration's own option
     * ```
     *
     * @see ArgsUsageExamples
     * @since 2.0.0
     */

    enhancedParse(argv: Array<string>, userExtensions: UserExtensionInterface = {}): ArgumentsInterface {
        const parser = yargs(hideBin(argv)).locale('en');
        const originalShowHelp = parser.showHelp;
        parser.showHelp = function (consoleFunction?: string | ((s: string) => void)): Argv<unknown> {
            this.group(Object.keys(ArgsDefaultOptions), 'xBuild Options:');
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
            .options(ArgsDefaultOptions)
            .epilogue('For more information, check the documentation https://remotex-labs.github.io/xBuild/')
            .help()
            .alias('help', 'h')
            .strict()
            .version();

        ArgsUsageExamples.forEach(([ command, description ]) => {
            parser.example(command, description);
        });

        return parser.parseSync();
    }
}
