/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { MacroCallType, MacroStateInterface } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import { createRequire } from 'module';
import { inject } from '@remotex-labs/xinject';
import { sandboxExecute } from '@services/vm.service';
import { stringify } from '@components/object.component';
import { FrameworkService } from '@services/framework.service';
import { buildFromString } from '@services/transpiler.service';

/**
 * Renders an evaluated value as the source text that stands in for the call.
 *
 * @param value - Value the callback produced
 * @returns Source text for the value, or `'undefined'` where there is nothing to render
 *
 * @remarks
 * `undefined` and `null` both come out as `undefined`, since the call has to leave an expression behind.
 * A function comes out as its own source, and a number or a boolean through `String`.
 * Everything else goes through {@link stringify}, which is JSON,
 * so a `Map` or a `Set` arrives as `{}` and a `bigint` as a quoted string.
 *
 * @since 3.0.0
 */

export function serialize(value: unknown): string {
    if (value === undefined || value === null) return 'undefined';
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    return stringify(value) ?? 'undefined';
}

/**
 * Runs the callback of an `$$inline` call and renders what it produced.
 *
 * @param state - Transform state, read for the source text and for the file the call sits in
 * @param call - The `$$inline` call whose only argument is the callback to run
 * @returns Source text standing for the value the callback produced
 *
 * @throws BuildFailure - Rejected by esbuild when the callback does not build
 * @throws Error - Whatever the callback itself threw while it ran
 *
 * @remarks
 * The callback is taken from the source as written, wrapped in a CommonJS module that calls it,
 * and built through {@link buildFromString}.
 * A relative specifier inside it therefore resolves against the working directory rather than against the file that
 * the call sits in.
 * A package stays external and is required through a `require` bound to that file as the callback runs.
 * The built code runs through {@link sandboxExecute}, and the value is read from what the run returned,
 * falling back to `module.exports`.
 * What comes back is source text rather than a value, since {@link serialize} renders it.
 *
 * @example
 * ```ts
 * // $$inline(() => 2 + 2)
 * await evaluate(state, call); // '4'
 *
 * // $$inline(() => ({ region: 'eu' }))
 * await evaluate(state, call); // '{"region":"eu"}'
 * ```
 *
 * @see serialize
 * @see sandboxExecute
 * @see buildFromString
 *
 * @since 3.0.0
 */

export async function evaluate(state: MacroStateInterface, call: MacroCallType): Promise<string> {
    const target = state.target + '.inline';
    const thunk = state.code.slice(call.arguments[0].start, call.arguments[0].end);
    const [ map, output ] = (await buildFromString(`module.exports = (${ thunk })();`, target, {
        format: 'cjs',
        platform: 'node',
        packages: 'external'
    })).outputFiles!;

    const module = { exports: undefined };
    inject(FrameworkService).addSourceMap(target, map.text);
    const value = await sandboxExecute(output.text, { module, require: createRequire(state.target) }, {
        filename: target
    });

    return serialize(value ?? module.exports);
}
