/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecycleLogsType } from '@interfaces/lifecycle.interface';
import type { LogOverridesType } from '@providers/interfaces/log-provider.interface';
import type { SourceEditInterface } from '@components/interfaces/transformer-component.interface';
import type { BindingIdentifier, CallExpression, IdentifierReference, Node } from '@oxc-project/types';

/**
 * A call whose callee is a plain identifier.
 *
 * @remarks
 * A macro call is narrowed to this shape,
 * so the code reading the callee's name does not have to check its type again.
 * It remains an ordinary call expression, and its `arguments` carry the flag and the value the macro was given.
 *
 * @example
 * ```ts
 * const call: MacroCallType = node;
 * call.callee.name;       // '$$ifdef'
 * call.arguments.length;  // 2
 * ```
 *
 * @see Macros
 * @see MacroTargetInterface
 *
 * @since 3.0.0
 */

export type MacroCallType = CallExpression & { callee: IdentifierReference };

/**
 * A visitor that the tree walk runs at each node.
 *
 * @remarks
 * Receives the node, the node it hangs from, and the property of that parent it sits under,
 * which is what tells a rewrite whether an identifier names something or reads it.
 * Returning `true` stops the walk from descending, so it never revisits a subtree an earlier rule replaced.
 *
 * @example
 * ```ts
 * const visit: NodeVisitorType = (node, parent, key) => key === 'id'; // prunes a declaration's name
 * ```
 *
 * @see walk
 * @since 3.0.0
 */

export type NodeVisitorType = (node: Node, parent: Node | null, key: string) => boolean;

/**
 * The binding a declaration introduces, paired with the macro that initializes it.
 *
 * @remarks
 * A tuple rather than an object, so a caller destructures both halves in one line.
 * The identifier is the declared name, and the target carries the call along with whatever call text followed it.
 *
 * @example
 * ```ts
 * const [ id, target ] = declared;
 * id.name;       // '$$dev'
 * target.suffix; // '' - the source did not invoke it
 * ```
 *
 * @see MacroTargetInterface
 * @since 3.0.0
 */

export type DeclaredMacroType = [ BindingIdentifier, MacroTargetInterface ];

/**
 * A macro call, with whatever call text followed it in the source.
 *
 * @remarks
 * Keeping the trailing text lets a rewrite put the same call back around the value it substitutes,
 * which is what a macro whose value is a function immediately invoked needs.
 *
 * @example
 * ```ts
 * // const $$now = $$ifdef('DEV', () => 1 + 1)();
 * target.call.callee.name; // '$$ifdef'
 * target.suffix;           // '()'
 * ```
 *
 * @see MacroCallType
 * @since 3.0.0
 */

export interface MacroTargetInterface {
    /**
     * The macro call itself.
     *
     * @remarks
     * Its callee names which macro this is, and its arguments carry the flag and the value that flag guards.
     *
     * @example
     * ```ts
     * target.call.arguments.length; // 2 - a flag and a value
     * ```
     *
     * @see MacroCallType
     * @since 3.0.0
     */

    call: MacroCallType;

    /**
     * The call text that followed the macro in the source.
     *
     * @remarks
     * Empty where the source left the macro's value alone,
     * and otherwise the whole text of the outer call.
     *
     * @example
     * ```ts
     * target.suffix; // '(1)' - the call the source wrote around the value
     * ```
     *
     * @since 3.0.0
     */

    suffix: string;
}

/**
 * Everything the macro transform of one file reads and writes.
 *
 * @remarks
 * Built once per file and handed down through the walk,
 * so a helper deep in the tree reaches the source, the collected edits, and the dropped names
 * without every function above it passing them along.
 *
 * @example
 * ```ts
 * const state: MacroStateInterface = {
 *     target, code, logs, dropped, defines, overrides, edits: [], pending: []
 * };
 * ```
 *
 * @see transformMacros
 * @since 3.0.0
 */

export interface MacroStateInterface {
    /**
     * The source text of the file being transformed.
     *
     * @remarks
     * Every span the parser reported points into this text,
     * so a rewrite slices what it needs from here rather than rebuilding it from the tree.
     *
     * @example
     * ```ts
     * const { code } = state;
     * code; // "export const $$dev = $$ifdef('DEV', fn);"
     * ```
     *
     * @since 3.0.0
     */

    code: string;

    /**
     * The buckets this file's messages are filed into.
     *
     * @remarks
     * The build's own log record, so a warning raised here reaches the same reporter as an esbuild message.
     *
     * @example
     * ```ts
     * state.logs.warning.length; // 1
     * ```
     *
     * @see LifecycleLogsType
     * @since 3.0.0
     */

    logs: LifecycleLogsType;

    /**
     * The rewrites collected for this file.
     *
     * @remarks
     * Applied together once the walk has finished, which is what keeps every offset valid while it runs.
     *
     * @example
     * ```ts
     * state.edits; // [ { start: 0, end: 34, text: '' } ]
     * ```
     *
     * @see SourceEditInterface
     * @since 3.0.0
     */

    edits: Array<SourceEditInterface>;

    /**
     * The absolute path of the file being transformed.
     *
     * @remarks
     * Names the file in every message raised against it,
     * and a deferred `inline` value resolves its own packages against it.
     *
     * @example
     * ```ts
     * state.target; // '/app/src/index.ts'
     * ```
     *
     * @since 3.0.0
     */

    target: string;

    /**
     * The inline evaluations still running.
     *
     * @remarks
     * Each one fills in an edit queued empty,
     * so the caller awaits all of them before the edits are applied.
     *
     * @example
     * ```ts
     * state.pending.length; // 2 - two inline calls still to finish
     * ```
     *
     * @see evaluate
     * @since 3.0.0
     */

    pending: Array<Promise<void>>;

    /**
     * The macro names this build is not keeping.
     *
     * @remarks
     * Shared across the files of a build rather than rebuilt per file,
     * so dropping a name where it was declared also drops it where it is imported.
     *
     * @example
     * ```ts
     * state.dropped.has('$$dev'); // true
     * ```
     *
     * @see analyzeMacros
     * @since 3.0.0
     */

    dropped: Set<string>;

    /**
     * The definition table that holds the text of each flag.
     *
     * @remarks
     * Holds source text rather than values, which is why {@link isDefined} compares each flag with a string.
     *
     * @example
     * ```ts
     * state.defines; // { DEV: 'false' }
     * ```
     *
     * @see isDefined
     * @since 3.0.0
     */

    defines: Record<string, string>;

    /**
     * The levels the build declared for its messages.
     *
     * @remarks
     * Decides the level a message raised here is filed under, and drops the message where that level is `silent`.
     *
     * @example
     * ```ts
     * state.overrides; // [ [ /^macro-/, 'silent' ] ]
     * ```
     *
     * @see LogOverridesType
     * @since 3.0.0
     */

    overrides: LogOverridesType;
}
