/**
 * The severity a build message is reported under.
 *
 * @remarks
 * `debug` and `info` are for messages that carry no fault, `warning` and `error` for the ones that do,
 * and `silent` drops the message instead of collecting it.
 * The other four name the buckets a collected message is filed under,
 * which is why the log record excludes `silent` from its keys.
 *
 * @example
 * ```ts
 * const level: LogLevelType = 'warning';
 * ```
 *
 * @see LogOverridesType
 * @since 3.0.0
 */

export type LogLevelType = 'debug' | 'info' | 'warning' | 'error' | 'silent'

/**
 * The level a message is reported under, keyed by the id it is reported with.
 *
 * @remarks
 * A key is read as a whole id first, so an id written out verbatim stands for itself and is matched by name alone.
 * A key carrying regular-expression syntax is read as an anchored pattern instead,
 * which is how one entry can claim a family of ids.
 * Verbatim keys win over patterns, and the first pattern a configuration declared wins over the ones after it.
 *
 * @example
 * ```ts
 * const overrides: LogOverridesType = {
 *     'direct-eval': 'silent',   // this id alone
 *     'TS-2\\d{3}': 'warning'    // every TypeScript diagnostic in the 2000 range
 * };
 * ```
 *
 * @see LogLevelType
 * @see resolveLevel
 *
 * @since 3.0.0
 */

export type LogOverridesType = Record<string, LogLevelType>;
