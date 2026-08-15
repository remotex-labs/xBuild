/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Context, ScriptOptions } from 'vm';

/**
 * Imports
 */

import { Script, createContext } from 'vm';

/**
 * Runs code in a VM context that shares the host's globals.
 *
 * @param code - Source to compile and run
 * @param sandbox - Values to expose as globals, each shadowing the host value of the same name
 * @param options - Compile-time options, such as the filename errors are reported against
 * @param isolateLogs - Whether to keep the code's console output from reaching the host
 * @returns The completion value of the last expression, awaited when it is a promise
 *
 * @throws SyntaxError - Thrown when the code does not compile
 * @throws Error - Whatever the code itself throws, propagated unchanged
 *
 * @remarks
 * The host's own globals are copied into the context before the sandbox is applied,
 * so the code inside sees the same intrinsics the caller does.
 * A value the code builds crosses back out intact - a `RegExp` made inside satisfies `instanceof RegExp` outside,
 * which a fresh context's own intrinsics would not.
 * This isolates the global scope, not the process.
 * `process` and the timers are reachable from the code being run,
 * so it is a scoping tool for code you trust rather than a boundary against code you do not.
 * Only compilation is configurable - the run is fixed to break on `SIGINT` and to leave errors undecorated.
 * It carries no timeout, so code that never finishes blocks the caller.
 *
 * `isolateLogs` drops the host `console` rather than replacing it,
 * so the code falls back to the console a fresh context is given and its output reaches nothing the caller sees.
 * A call still succeeds, since `console.log` is a function either way,
 * so quieting the output does not break code that logs.
 * The drop happens after the sandbox is applied, so it takes a `console` the caller injected as well.
 * It covers the console alone - code writing to `process.stdout` reaches the host whatever this is set to.
 *
 * @example
 * ```ts
 * await sandboxExecute('2 + 2');                              // 4
 * (await sandboxExecute('new RegExp("a")')) instanceof RegExp; // true - the host's RegExp
 *
 * const module = { exports: {} };
 * await sandboxExecute('module.exports = process.cwd();', { module });
 * module.exports; // 'D:/app' - read back through the injected object
 *
 * await sandboxExecute('console.log("noisy"); 1', {}, {}, true); // 1 - nothing printed
 * ```
 *
 * @see Context
 * @see ScriptOptions
 *
 * @since 3.0.0
 */

export async function sandboxExecute(code: string, sandbox: Context = {}, options: ScriptOptions = {}, isolateLogs = false): Promise<unknown> {
    const base: Record<string, unknown> = {};
    Object.defineProperties(base, Object.getOwnPropertyDescriptors(globalThis));
    Object.assign(base, sandbox);

    if(isolateLogs) {
        delete base['console'];
    }

    const context = createContext(base);
    const script = new Script(code, options);

    return await script.runInContext(context, { breakOnSigint: true, displayErrors: false });
}
