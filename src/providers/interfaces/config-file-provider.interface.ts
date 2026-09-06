/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Options } from 'yargs';
import type { LogLevelType } from '@providers/interfaces/log-provider.interface';
import type { PartialConfigurationType } from '@interfaces/configuration.interface';
import type { ServerConfigurationInterface } from '@server/interfaces/server.interface';
import type { WatchOptionsInterface } from '@services/interfaces/watch-service.interface';

/**
 * The shape a configuration file exports.
 *
 * @remarks
 * Every field of a whole configuration, each one optional,
 * so a file may state one setting and leave the rest to the defaults.
 * The four fields beside them are the ones only a file carries:
 * the reporting level, the command line options it declares, the server it asks for, and the watcher it tunes.
 *
 * @example
 * ```ts
 * const config: xBuildConfigInterface = {
 *     common: { types: true },
 *     watch: { debounce: 50 },
 *     userArgv: { release: { type: 'boolean' } }
 * };
 * ```
 *
 * @see configFileProvider
 * @see PartialConfigurationType
 *
 * @since 3.0.0
 */

export interface xBuildConfigInterface extends PartialConfigurationType  {
    /**
     * The reporting level for the whole run.
     *
     * @remarks
     * It sits on the file itself rather than inside `common` or a variant,
     * so one level covers every variant the file declares.
     * The esbuild options a file passes through do not accept a `logLevel`, which is why the setting lives here.
     * `silent` drops a message rather than filing it under a bucket.
     *
     * @example
     * ```ts
     * { logLevel: 'warning' } // warnings and errors alone
     * ```
     *
     * @see LogLevelType
     * @since 3.0.0
     */

    logLevel?: LogLevelType;

    /**
     * The command line options this configuration declares.
     *
     * @remarks
     * Each entry is a yargs option keyed by the flag it defines,
     * so a project can take a flag of its own and read the parsed value back through the `argv` of a lifecycle hook.
     *
     * @example
     * ```ts
     * { userArgv: { release: { type: 'boolean', describe: 'build for release' } } }
     * ```
     *
     * @see LifecycleContextInterface
     * @since 2.0.0
     */

    userArgv?: Record<string, Options>;

    /**
     * The static server this configuration asks for.
     *
     * @remarks
     * `dir` names the directory served, and it is required rather than inferred from the build output.
     * `start` asks for the server to come up with the build rather than wait to be started.
     *
     * @example
     * ```ts
     * { serve: { dir: 'dist', start: true } }
     * ```
     *
     * @since 2.0.0
     */

    serve?: ServerConfigurationInterface & { dir: string, start?: boolean }

    /**
     * The watcher settings configuration tunes.
     *
     * @remarks
     * Every setting of the watcher is optional, so a file names only what it changes - the debounce window, the
     * recursion, the dotfiles, or the filters - and whatever it leaves out keeps its default.
     * A `filter` named here joins the two globs {@link configFileProvider} supplies rather than replacing them.
     *
     * @example
     * ```ts
     * { watch: { debounce: 50, recursive: true } }
     * ```
     *
     * @see configFileProvider
     * @see WatchOptionsInterface
     *
     * @since 3.0.0
     */

    watch?: WatchOptionsInterface
}
