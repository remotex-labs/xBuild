/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Message, PartialMessage } from 'esbuild';
import type { LifecycleLogsType } from '@interfaces/lifecycle.interface';
import type { LogLevelType, LogOverridesType } from '@providers/interfaces/log-provider.interface';

/**
 * Resolves the level a message is reported under.
 *
 * @param overrides - The configured levels, keyed by message id or by a pattern matching one
 * @param id - ID the message was reported with, absent on a message that carries none
 * @param level - Level the message takes when no override claims it
 * @returns The level the message is reported under
 *
 * @remarks
 * An id is looked up as a key first and read against the pattern keys only when that misses,
 * so a table naming its ids outright is answered without a match being run at all.
 * A pattern is anchored with `^(?:...)$` to make it match a whole id rather than a part of one,
 * which is what lets a set of ids be written as a single alternation, and the first the table declared wins.
 * A key whose syntax does not parse is passed over rather than thrown on.
 *
 * @example
 * ```ts
 * const overrides: LogOverridesType = { 'direct-eval': 'silent', 'TS-2\\d{3}': 'warning' };
 *
 * resolveLevel(overrides, 'direct-eval', 'warning'); // 'silent'  - claimed by name
 * resolveLevel(overrides, 'TS-2304', 'error');       // 'warning' - claimed by pattern
 * resolveLevel(overrides, 'empty-glob', 'warning');  // 'warning' - claimed by neither
 * ```
 *
 * @see collectLog
 * @see LogOverridesType
 *
 * @since 3.0.0
 */

export function resolveLevel(overrides: LogOverridesType, id: string | undefined, level: LogLevelType): LogLevelType {
    if (id === undefined) return level;
    if (Object.hasOwn(overrides, id)) return overrides[id];

    for (const key in overrides) {
        try {
            if (new RegExp(`^(?:${ key })$`).test(id)) return overrides[key];
        } catch {
            if(id === key) return overrides[key];
        }
    }

    return level;
}

/**
 * Files a message under the level it resolves to.
 *
 * @param logs - Buckets the message is appended to, keyed by level
 * @param overrides - The configured levels, consulted for the message id
 * @param message - Message to file
 * @param level - Level the message takes when no override claims it
 *
 * @remarks
 * A message that resolves to `silent` is dropped rather than filed,
 * which is what keeps the log record free of a bucket for it.
 *
 * @example
 * ```ts
 * const logs = { debug: [], info: [], warning: [], error: [] };
 *
 * collectLog(logs, { 'direct-eval': 'silent' }, { id: 'direct-eval', text: 'Using eval' }, 'warning');
 * logs.warning; // [] - the override silenced it
 * ```
 *
 * @see collectLogs
 * @see resolveLevel
 *
 * @since 3.0.0
 */

export function collectLog(
    logs: LifecycleLogsType, overrides: LogOverridesType, message: PartialMessage, level: LogLevelType
): void {
    const resolved = resolveLevel(overrides, message.id, level);
    if (resolved !== 'silent') logs[resolved].push(<Message> message);
}

/**
 * Files a batch of messages, each under the level it resolves to.
 *
 * @param logs - Buckets the messages are appended to, keyed by level
 * @param overrides - The configured levels, consulted for each message id
 * @param messages - Messages to file, in the order they were reported
 * @param level - Level a message takes when no override claims it
 * @param name - Plugin to credit each message to, left as reported when omitted or empty
 *
 * @remarks
 * Every message is resolved on its own, so one batch can end up spread across several buckets.
 * A name replaces whatever `pluginName` a message already carried,
 * so a batch coming out of one plugin reads as that plugin's even where esbuild credited another.
 * It writes onto the messages themselves rather than onto copies,
 * so a caller holding the same objects sees the credit as well.
 * The credit lands before the level resolves, so a message an override silences still carries it.
 *
 * @example
 * ```ts
 * const logs = { debug: [], info: [], warning: [], error: [] };
 *
 * collectLogs(logs, {}, [ { text: 'first' } ], 'error');
 * logs.error; // [ { text: 'first' } ] - left uncredited
 *
 * collectLogs(logs, {}, [ { text: 'second' } ], 'error', 'timing');
 * logs.error; // [ { text: 'first' }, { text: 'second', pluginName: 'timing' } ]
 * ```
 *
 * @see collectLog
 * @since 3.0.0
 */

export function collectLogs(
    logs: LifecycleLogsType, overrides: LogOverridesType, messages: Array<PartialMessage>, level: LogLevelType, name?: string
): void {
    for (const message of messages) {
        if(name) message.pluginName = name;
        collectLog(logs, overrides, message, level);
    }
}
