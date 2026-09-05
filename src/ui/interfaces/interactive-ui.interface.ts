/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { MaybeVoidPromiseType } from '@interfaces/types.interface';

/**
 * What the interactive keys of a watch act on.
 *
 * @remarks
 * Held rather than passed key by key, so the `v` key writes the verbose flag back where the reporter reads it,
 * and the two build keys reach the same run the watcher does.
 *
 * @example
 * ```ts
 * const options: InteractiveOptionsInterface = { verbose: false, url, build, reload };
 * ```
 *
 * @see startInteractive
 * @since 3.0.0
 */

export interface InteractiveOptionsInterface {
    /**
     * Whether a message is reported with its code frame and resolved stack.
     *
     * @remarks
     * Written by the `v` key and read by the reporter on the next build,
     * so toggling it changes what the following build prints rather than what the last one did.
     *
     * @example
     * ```ts
     * options.verbose; // true - the next build reports whole traces
     * ```
     *
     * @since 3.0.0
     */

    verbose: boolean;

    /**
     * Address the server is listening on, absent where the run started none.
     *
     * @remarks
     * What the two URL keys are listed and answered for.
     *
     * @example
     * ```ts
     * options.url; // 'http://localhost:3000'
     * ```
     *
     * @since 3.0.0
     */

    url?: string;

    /**
     * Runs the build the `b` key asks for.
     *
     * @example
     * ```ts
     * await options.build();
     * ```
     *
     * @since 3.0.0
     */

    build(): MaybeVoidPromiseType;

    /**
     * Re-reads what the run caches and builds again, which is what the `r` key asks for.
     *
     * @example
     * ```ts
     * await options.reload();
     * ```
     *
     * @since 3.0.0
     */

    reload(): MaybeVoidPromiseType;
}
