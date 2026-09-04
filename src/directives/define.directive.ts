/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { MacroTargetInterface } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import { MacroFalsyDefines } from '@constants/macros.constant';

/**
 * Whether the definition table sets a flag.
 *
 * @param defines - The definition table the build substitutes, holding the source text each flag stands for
 * @param name - Name of the flag to test
 * @returns `true` when the table names the flag and holds something other than a falsy text for it
 *
 * @remarks
 * A definition holds source text rather than a value, so the text is what decides.
 * A flag that the table does not name is not set, and neither is one whose text is in {@link MacroFalsyDefines}.
 * The text is trimmed before the lookup, so padding around it does not change the answer.
 * Every other text sets the flag, `'0'` and the empty string among them.
 *
 * @example
 * ```ts
 * isDefined({ DEV: 'true' }, 'DEV');    // true
 * isDefined({ DEV: ' false ' }, 'DEV'); // false - trimmed before the lookup
 * isDefined({}, 'DEV');                 // false - the table does not name it
 * ```
 *
 * @see MacroFalsyDefines
 * @since 3.0.0
 */

export function isDefined(defines: Record<string, string>, name: string): boolean {
    const value = defines[name];

    return value !== undefined && !MacroFalsyDefines.has(value.trim());
}

/**
 * Builds the replacement source for a declaration that a macro initializes.
 *
 * @param code - Source text the target's spans point into
 * @param name - Name the declaration binds
 * @param target - The macro call and whatever call text followed it
 * @param prefix - Text placed in front of the result, `'export '` for an exported declaration
 * @returns The source that replaces the whole declaration
 *
 * @remarks
 * The value the macro guards is its second argument, and the way that argument is written decides the form:
 *
 * - **A function the source already invokes** - parenthesized and left invoked, so the binding holds the result.
 * - **A function the source does not invoke** - rewritten as a function declaration under the same name, carrying
 *   its parameters, its return type, and its `async` keyword. An expression body becomes a `return` statement, and
 *   a function without a body becomes an empty one.
 * - **Anything else** - substituted as written, with the trailing call kept.
 *
 * @example
 * ```ts
 * // source: export const $$log = $$ifdef('DEV', (m: string) => console.log(m));
 * defineDeclaration(code, '$$log', target, 'export ');
 * // result: export function $$log(m: string) { return console.log(m); }
 *
 * // source: const $$now = $$ifdef('DEV', () => Date.now())();
 * defineDeclaration(code, '$$now', target, '');
 * // result: const $$now = (() => Date.now())();
 * ```
 *
 * @see defineExpression
 * @see MacroTargetInterface
 *
 * @since 3.0.0
 */

export function defineDeclaration(code: string, name: string, target: MacroTargetInterface, prefix: string): string {
    const { call, suffix } = target;
    const callback = call.arguments[1];
    const text = code.slice(callback.start, callback.end);

    if (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')
        return `${ prefix }const ${ name } = ${ text }${ suffix };`;

    if (suffix) return `${ prefix }const ${ name } = (${ text })${ suffix };`;

    const { body } = callback;
    const params = callback.params.map(param => code.slice(param.start, param.end)).join(', ');
    const returns = callback.returnType ? code.slice(callback.returnType.start, callback.returnType.end) : '';
    const head = `${ prefix }${ callback.async ? 'async ' : '' }function ${ name }(${ params })${ returns }`;

    if (!body) return `${ head } {}`;
    if (body.type === 'BlockStatement') return `${ head } ${ code.slice(body.start, body.end) }`;

    return `${ head } { return ${ code.slice(body.start, body.end) }; }`;
}

/**
 * Builds the replacement source for a macro standing in an expression.
 *
 * @param code - Source text the target's spans point into
 * @param target - The macro call and whatever call text followed it
 * @param statement - Whether the macro stands as a statement of its own
 * @returns The source that replaces the macro call
 *
 * @remarks
 * The value the macro guards is its second argument, and the way that argument is written decides the form:
 *
 * - **A function inside an expression** - parenthesized and invoked, so the expression evaluates to what the
 *   function returns. The call the source wrote is used where there is one, and `()` where there is not.
 * - **A function standing as a statement** - its body is inlined where the call stood, with no wrapper around it.
 *   An expression body becomes that expression, and a function without a body leaves nothing behind.
 * - **Anything else** - substituted as written, with the trailing call kept.
 *
 * @example
 * ```ts
 * // source: $$ifdef('DEV', () => console.log('on'));
 * defineExpression(code, target, true);
 * // result: console.log('on');
 *
 * // source: const x = $$ifdef('DEV', () => 1);
 * defineExpression(code, target, false);
 * // result: (() => 1)()
 * ```
 *
 * @see defineDeclaration
 * @since 3.0.0
 */

export function defineExpression(code: string, target: MacroTargetInterface, statement: boolean): string {
    const { call, suffix } = target;
    const callback = call.arguments[1];
    const text = code.slice(callback.start, callback.end);
    const tail = statement ? ';' : '';

    if (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')
        return `${ text }${ suffix }${ tail }`;

    if (suffix || !statement) return `(${ text })${ suffix || '()' }${ tail }`;

    const { body } = callback;
    if (!body) return '';
    if (body.type !== 'BlockStatement') return `${ code.slice(body.start, body.end) };`;

    return code.slice(body.start + 1, body.end - 1).trim();
}
