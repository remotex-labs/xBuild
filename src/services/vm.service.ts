/**
 * Import will remove at compile time
 */

import type { Context, ScriptOptions } from 'vm';

/**
 * Imports
 */

import { Script, createContext } from 'vm';

/**
 * Executes arbitrary code inside a Node.js VM sandbox.
 *
 * @param code - The JavaScript source code to execute
 * @param sandbox - Optional {@link Context} object to inject into the VM environment
 * @param options - Optional {@link ScriptOptions} used when compiling the script
 *
 * @returns A promise resolving to the result of the executed code
 *
 * @throws Error - If the provided code fails to compile or runtime execution throws
 *
 * @remarks
 * This function uses Node.js's {@link Script} and {@link createContext} APIs to safely run code in
 * an isolated environment. Execution is configured with `breakOnSigint` enabled and `displayErrors` disabled.
 *
 * @example
 * ```ts
 * const result = await sandboxExecute("2 + 2");
 * console.log(result); // 4
 * ```
 *
 * @example
 * ```ts
 * const result = await sandboxExecute("user.name", { user: { name: "Alice" } });
 * console.log(result); // "Alice"
 * ```
 *
 * @see Context
 * @see ScriptOptions
 *
 * @since 1.0.0
 */

export async function sandboxExecute(code: string, sandbox: Context = {}, options: ScriptOptions = {}): Promise<unknown> {
    const script = new Script(code, options);
    const context = createContext(sandbox);

    return await script.runInContext(context, { breakOnSigint: true, displayErrors: false });
}
