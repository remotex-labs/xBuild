/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PartialMessage } from 'esbuild';
import type { ParseResult } from 'oxc-parser';
import type { LifecycleContextInterface } from '@interfaces/lifecycle.interface';
import type { LogLevelType } from '@providers/interfaces/log-provider.interface';
import type { NodeVisitorType } from '@directives/interfaces/macros-directive.interface';
import type { ExportNamedDeclaration, ImportDeclaration, Node, Span } from '@oxc-project/types';
import type { SourceEditInterface } from '@components/interfaces/transformer-component.interface';
import type { DeclaredMacroType, MacroCallType } from '@directives/interfaces/macros-directive.interface';
import type { MacroStateInterface, MacroTargetInterface } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import { visitorKeys } from 'oxc-parser';
import { collectLog } from '@providers/log.provider';
import { evaluate } from '@directives/inline.directive';
import { applyEdits } from '@components/transformer.component';
import { defineDeclaration, defineExpression, isDefined } from '@directives/define.directive';
import { MacroNameKeys, MacroPrefix, Macros, MacroScanHint } from '@constants/macros.constant';

/**
 * Whether a value read out of a node is itself a node.
 *
 * @param value - Value read out of a parent node's property
 * @returns `true` when the value is an object carrying a string `type`
 *
 * @remarks
 * The test the walk applies before it steps into a property,
 * since a visitor key can hold a node, an array of them, or a plain value such as a name or a flag.
 *
 * @since 3.0.0
 */

export function isNode(value: unknown): value is Node {
    return typeof value === 'object' && value !== null && typeof (<Node> value).type === 'string';
}

/**
 * Visits a node and everything under it, depth-first.
 *
 * @param node - Node the walk starts from
 * @param visit - Called for each node, returning `true` to leave the subtree unvisited
 * @param parent - Node the current one hangs from, `null` at the root
 * @param key - Property of the parent the current node sits under, empty at the root
 *
 * @remarks
 * Child properties come from oxc's `visitorKeys`, so a node type that the table does not name is treated as a leaf.
 * A visitor returning `true` prunes the subtree,
 * so a rule further down never rewrites a node that an earlier one already replaced.
 *
 * @see NodeVisitorType
 * @since 3.0.0
 */

export function walk(node: Node, visit: NodeVisitorType, parent: Node | null = null, key = ''): void {
    if (visit(node, parent, key)) return;

    const keys: Array<string> | undefined = visitorKeys[node.type];

    for (const childKey of keys ?? []) {
        const value = (<Record<string, unknown>> <unknown> node)[childKey];

        if (Array.isArray(value)) {
            for (const item of value) if (isNode(item)) walk(item, visit, node, childKey);
        } else if (isNode(value)) walk(value, visit, node, childKey);
    }
}

/**
 * Files a message against a position in the file being transformed.
 *
 * @param state - Transform state, read for the source text and the file name
 * @param offset - Offset in the source the message points at
 * @param level - Level the message is filed under, before any override applies
 * @param message - Message to file, whose `location` this fills in
 *
 * @remarks
 * The line and the column are counted by scanning the source up to the offset,
 * since the parser reports spans rather than positions.
 * The message is filled in where it stands rather than copied, and it reaches the log through {@link collectLog},
 * so the overrides the build declared still decide the level it lands at.
 *
 * @see collectLog
 * @since 3.0.0
 */

export function report(state: MacroStateInterface, offset: number, level: LogLevelType, message: PartialMessage): void {
    const { code } = state;
    let line = 1;
    let start = 0;

    for (let index = code.indexOf('\n'); index !== -1 && index < offset; index = code.indexOf('\n', index + 1)) {
        line++;
        start = index + 1;
    }

    message.location = { file: state.target, line, column: offset - start };
    collectLog(state.logs, state.overrides, message, level);
}

/**
 * Queues an edit that replaces a span with text.
 *
 * @param state - Transform state the edit is collected on
 * @param span - Span of the source the edit replaces
 * @param text - Replacement text, empty to delete the span
 * @returns `true`, so a caller can hand it straight back to the walk
 *
 * @remarks
 * Returning `true` is what tells the walk that this node is dealt with and that it should not descend into it.
 * The edit is applied later along with the rest, so the offsets it carries stay valid for the whole walk.
 *
 * @see applyEdits
 * @since 3.0.0
 */

export function record(state: MacroStateInterface, span: Span, text: string): boolean {
    state.edits.push({ start: span.start, end: span.end, text });

    return true;
}

/**
 * Queues an edit whose text is known only once an inline call has run.
 *
 * @param state - Transform state the edit and the promise are collected on
 * @param span - Span of the source the edit replaces
 * @param call - The `$$inline` call to evaluate
 * @param wrap - Turns the value that comes back into the text that replaces the span
 * @returns `true`, so a caller can hand it straight back to the walk
 *
 * @remarks
 * The edit is queued empty and filled in when the call finishes, so the walk carries on while it runs.
 * The promise is collected on `state.pending` for the caller to await before the edits are applied.
 * A failure fills the edit with `wrap('undefined')` and reports a `macro-inline` error,
 * so a macro that cannot be evaluated still leaves the file parsable.
 *
 * @see evaluate
 * @since 3.0.0
 */

export function defer(state: MacroStateInterface, span: Span, call: MacroCallType, wrap: (value: string) => string): boolean {
    const edit: SourceEditInterface = { start: span.start, end: span.end, text: '' };

    state.edits.push(edit);
    state.pending.push(evaluate(state, call).then(value => {
        edit.text = wrap(value);
    }, (error: unknown) => {
        edit.text = wrap('undefined');
        report(state, call.start, 'error', {
            detail: error,
            id: 'macro-inline',
            text: `${ Macros.inline } failed: ${ (<Error> error)?.message ?? String(error) }`
        });
    }));

    return true;
}

/**
 * Whether a node is a macro call this transform handles.
 *
 * @param value - Node to test
 * @returns `true` when the callee names a macro and the arguments match that name
 *
 * @remarks
 * The callee has to be a plain identifier naming one of {@link Macros}, and the arguments have to match the name:
 * one for `inline`, and two for the conditional pair, the first of which is a string literal naming the flag.
 * Anything else is an ordinary call and is left alone.
 *
 * @see MacroCallType
 * @since 3.0.0
 */

export function isMacroCall(value: Node): value is MacroCallType {
    if (value.type !== 'CallExpression' || value.callee.type !== 'Identifier') return false;

    const { name } = value.callee;
    if (name === Macros.inline) return value.arguments.length === 1;
    if (name !== Macros.ifdef && name !== Macros.ifndef || value.arguments.length !== 2) return false;

    const flag = value.arguments[0];

    return flag.type === 'Literal' && typeof flag.value === 'string';
}

/**
 * Whether a conditional macro keeps its value.
 *
 * @param state - Transform state, read for the definition table
 * @param call - The `$$ifdef` or `$$ifndef` call to weigh
 * @returns `true` when the macro's condition holds
 *
 * @remarks
 * `$$ifdef` holds while its flag is set and `$$ifndef` while it is not, which {@link isDefined} answers.
 * A flag that is not a string literal is read as the empty name, which no table sets.
 *
 * @see isDefined
 * @since 3.0.0
 */

export function isActive(state: MacroStateInterface, call: MacroCallType): boolean {
    const flag = call.arguments[0];
    const name = flag.type === 'Literal' ? String(flag.value) : '';

    return (call.callee.name === Macros.ifdef) === isDefined(state.defines, name);
}

/**
 * Whether a node calls a macro that the build dropped.
 *
 * @param state - Transform state, read for the dropped names
 * @param node - Node to test
 * @returns `true` when the node calls an identifier that the build dropped
 *
 * @remarks
 * How a use of a disabled macro is recognized once its own declaration is gone,
 * which is what lets the transform replace the call rather than leave it to fail while the output runs.
 *
 * @since 3.0.0
 */

export function isDropped(state: MacroStateInterface, node: Node): boolean {
    return node.type === 'CallExpression' && node.callee.type === 'Identifier' && state.dropped.has(node.callee.name);
}

/**
 * The macro call a node holds, with whatever call followed it.
 *
 * @param state - Transform state, read for the source text
 * @param node - Node to look in, which may be absent
 * @returns The macro call and its trailing text, or `undefined` where the node holds none
 *
 * @remarks
 * Three shapes reach here.
 * A macro call on its own yields an empty suffix, a call whose callee is the macro yields the text of the outer
 * call as the suffix, and a TypeScript `as` expression is unwrapped and retried.
 *
 * @see MacroTargetInterface
 * @since 3.0.0
 */

export function macroTarget(state: MacroStateInterface, node?: Node | null): MacroTargetInterface | undefined {
    if (!node) return;
    if (isMacroCall(node)) return { call: node, suffix: '' };
    if (node.type === 'TSAsExpression') return macroTarget(state, node.expression);
    if (node.type !== 'CallExpression' || !isMacroCall(node.callee)) return;

    return { call: node.callee, suffix: state.code.slice(node.callee.end, node.end) };
}

/**
 * The name a declaration binds, together with the macro that initializes it.
 *
 * @param state - Transform state, read for the source text
 * @param node - Declaration to look at, exported or bare
 * @returns The declared name and its macro target, or `undefined` where the node declares no macro
 *
 * @remarks
 * An `export` wrapper is stepped through first, so one test serves the exported form and the bare one alike.
 * A single declarator alone qualifies, which leaves `const a = $$ifdef('DEV', 1), b = 2` untouched.
 *
 * @see DeclaredMacroType
 * @since 3.0.0
 */

export function declaredMacro(state: MacroStateInterface, node: Node): DeclaredMacroType | undefined {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (declaration?.type !== 'VariableDeclaration' || declaration.declarations.length !== 1) return;

    const { id, init } = declaration.declarations[0];
    if (id.type !== 'Identifier') return;

    const target = macroTarget(state, init);

    return target && [ id, target ];
}

/**
 * Rewrites an import that names a dropped macro.
 *
 * @param state - Transform state the edit is collected on
 * @param node - Import declaration to prune
 * @returns `true` when the statement was rewritten
 *
 * @remarks
 * A named specifier bound to a dropped macro is removed, while a default or a namespace import is kept as written.
 * An import left with no specifiers at all becomes a bare `import 'source';`,
 * so a module imported for its side effect still runs.
 *
 * @since 3.0.0
 */

export function pruneImport(state: MacroStateInterface, node: ImportDeclaration): boolean {
    const named: Array<string> = [];
    const parts: Array<string> = [];
    let dropped = false;

    for (const specifier of node.specifiers) {
        const text = state.code.slice(specifier.start, specifier.end);

        if (specifier.type !== 'ImportSpecifier') parts.push(text);
        else if (state.dropped.has(specifier.local.name)) dropped = true;
        else named.push(text);
    }

    if (!dropped) return false;
    const source = state.code.slice(node.source.start, node.source.end);
    if (named.length > 0) parts.push(`{ ${ named.join(', ') } }`);

    if (parts.length < 1) return record(state, node, `import ${ source };`);

    return record(state, node, `import ${ parts.join(', ') } from ${ source };`);
}

/**
 * Rewrites an export list that names a dropped macro.
 *
 * @param state - Transform state the edit is collected on
 * @param node - Export declaration to prune
 * @returns `true` when the statement was rewritten
 *
 * @remarks
 * The specifiers that survive are re-emitted as they were written, and a list left with none is deleted outright.
 * A list that names nothing dropped is reported untouched, so the walk descends into it as usual.
 *
 * @since 3.0.0
 */

export function pruneExport(state: MacroStateInterface, node: ExportNamedDeclaration): boolean {
    const { specifiers } = node;
    const kept = specifiers.filter(
        ({ local }) => !state.dropped.has(local.type === 'Literal' ? local.value : local.name)
    );

    if (kept.length === specifiers.length) return false;
    if (kept.length < 1) return record(state, node, '');

    return record(state, node, `export { ${ kept.map(item => state.code.slice(item.start, item.end)).join(', ') } };`);
}

/**
 * Replaces a declaration whose value comes from a macro.
 *
 * @param state - Transform state the edit is collected on
 * @param node - Declaration to expand, exported or bare
 * @returns `true` when the declaration was rewritten
 *
 * @remarks
 * A name that does not open with {@link MacroPrefix} draws a `macro-prefix` warning and expands either way.
 * An `inline` declaration is deferred until its value has run.
 * A conditional declaration becomes what {@link defineDeclaration} builds while it is active
 * and is deleted where it is not.
 *
 * @since 3.0.0
 */

export function expandDeclaration(state: MacroStateInterface, node: Node): boolean {
    const declared = declaredMacro(state, node);
    if (!declared) return false;

    const [ id, target ] = declared;
    const { call, suffix } = target;
    const prefix = node.type === 'ExportNamedDeclaration' ? 'export ' : '';

    if (!id.name.startsWith(MacroPrefix)) report(state, id.start, 'warning', {
        id: 'macro-prefix',
        text: `Macro '${ id.name }' does not start with the '${ MacroPrefix }' prefix to avoid conflicts`
    });

    if (call.callee.name === Macros.inline)
        return defer(state, node, call, value => `${ prefix }const ${ id.name } = ${ value }${ suffix };`);

    return record(state, node, isActive(state, call) ? defineDeclaration(state.code, id.name, target, prefix) : '');
}

/**
 * Replaces a macro used as a value.
 *
 * @param state - Transform state the edit is collected on
 * @param node - Node the replacement stands in for
 * @param target - The macro call and whatever call followed it
 * @param statement - Whether the macro stands as a statement of its own
 * @returns `true`, since every call that reaches here rewrites something
 *
 * @remarks
 * An `inline` call is deferred until its value has run.
 * A conditional call becomes what {@link defineExpression} builds while it is active.
 * An inactive one leaves nothing behind as a statement, and `undefined` where a value is expected.
 *
 * @since 3.0.0
 */

export function expand(state: MacroStateInterface, node: Node, target: MacroTargetInterface, statement: boolean): boolean {
    const { call, suffix } = target;

    if (call.callee.name === Macros.inline)
        return defer(state, node, call, value => statement ? '' : `${ value }${ suffix }`);

    if (!isActive(state, call)) return record(state, node, statement ? '' : 'undefined');

    return record(state, node, defineExpression(state.code, target, statement));
}

/**
 * Rewrites one node and reports whether the walk should stop there.
 *
 * @param state - Transform state the edits are collected on
 * @param node - Node the walk arrived at
 * @param parent - Node it hangs from, `null` at the root
 * @param key - Property of the parent it sits under
 * @returns `true` when the node was rewritten and the walk should not descend into it
 *
 * @remarks
 * The visitor the rewriting walk runs, dispatching on the type of the node:
 *
 * - **An identifier** - a dropped name becomes `undefined` where it is read, and is left alone where it only names
 *   something, which {@link MacroNameKeys} and the parent's `computed` flag decide between.
 * - **An import or an export list** - pruned of the names the build dropped.
 * - **A declaration** - expanded, or pruned where it re-exports rather than declares.
 * - **An expression statement or a call** - expanded, or replaced where it calls something dropped.
 *
 * Any other node is reported untouched, so the walk descends into it.
 *
 * @since 3.0.0
 */

export function expandNode(state: MacroStateInterface, node: Node, parent: Node | null, key: string): boolean {
    switch (node.type) {
        case 'Identifier': {
            if (!state.dropped.has(node.name) || !parent) return false;

            const keyed = key === 'key' || key === 'property';
            const named = keyed ? !('computed' in parent) || !parent.computed : MacroNameKeys.has(key);

            return !named && record(state, node, 'undefined');
        }

        case 'ImportDeclaration':
            return pruneImport(state, node);

        case 'ExportNamedDeclaration':
            if (expandDeclaration(state, node)) return true;
            if (node.source || node.specifiers.length < 1) return false;

            return pruneExport(state, node);

        case 'VariableDeclaration':
            return expandDeclaration(state, node);

        case 'ExpressionStatement': {
            if (isDropped(state, node.expression)) return record(state, node, '');
            const target = macroTarget(state, node.expression);

            return target !== undefined && expand(state, node, target, true);
        }

        case 'CallExpression':
        case 'TSAsExpression': {
            if (isDropped(state, node)) return record(state, node, 'undefined');
            const target = macroTarget(state, node);

            return target !== undefined && expand(state, node, target, false);
        }
    }

    return false;
}

/**
 * Expands every macro in a file and returns the rewritten source.
 *
 * @param parse - The file's parse result, walked rather than parsed again
 * @param target - Absolute path of the file, named in messages and used to resolve an inline value's packages
 * @param content - Source text of the file
 * @param context - Lifecycle context, read for the logs, the flags, and the names the build has dropped
 * @returns The rewritten source, or `content` itself where there was nothing to expand
 *
 * @remarks
 * An empty file comes back untouched, and so does any file under `node_modules`.
 * So does a file that carries no {@link MacroPrefix}, unless an earlier file dropped a name this one may still use.
 * A first walk over a file carrying {@link MacroScanHint} collects the conditional macros that are not active and
 * adds their names to the set the build shares, so dropping a name where it was declared.
 * also drops it where it is imported.
 * The rewriting walk follows, and any deferred `inline` value is awaited before the edits are applied.
 *
 * @example
 * ```ts
 * // source: export const $$dev = $$ifdef('DEV', () => log());
 * await transformMacros(parse, '/src/a.ts', content, context);
 * // result: export function $$dev() { return log(); } - while DEV is set
 * ```
 *
 * @see analyzeMacros
 * @see MacroStateInterface
 *
 * @since 3.0.0
 */

export async function transformMacros(
    parse: ParseResult, target: string, content: string, context: LifecycleContextInterface
): Promise<string> {
    if (content.length < 1 || target.includes('node_modules')) return content;

    const { dropped } = context.stage;
    if (dropped.size < 1 && !content.includes(MacroPrefix)) return content;

    const state: MacroStateInterface = {
        target,
        dropped,
        code: content,
        logs: context.logs,
        edits: [],
        pending: [],
        defines: context.options.define ?? {},
        overrides: context.overrides
    };

    if (content.includes(MacroScanHint)) walk(parse.program, node => {
        const declared = declaredMacro(state, node);
        if (!declared) return false;

        const [ id, { call }] = declared;
        if (call.callee.name !== Macros.inline && !isActive(state, call)) dropped.add(id.name);

        return false;
    });

    walk(parse.program, expandNode.bind(null, state));
    if (state.pending.length > 0) await Promise.all(state.pending);

    return applyEdits(content, state.edits);
}
