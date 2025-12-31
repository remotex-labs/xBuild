/**
 * Globals
 */

declare global {
    /**
     * Package version
     */

    const __VERSION: string;
    /**
     * Environment variable flag that indicates if color output should be disabled.
     *
     * @default undefined
     *
     * @remarks
     * When set to true, this constant signals that ANSI color codes should not be used
     * in terminal output. This follows the NO_COLOR standard (https://no-color.org/)
     * for respecting user preferences about colored output.
     *
     * Applications should check this value before generating colored terminal output
     * and disable colors when it's set to true.
     *
     * @see https://no-color.org/ - The NO_COLOR standard specification
     *
     * @since 1.0.0
     */

    declare var NO_COLOR: true | undefined;
}

export {};
