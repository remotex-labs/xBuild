/**
 * Import will remove at compile time
 */

import type { Context } from 'vm';

/**
 * Imports
 */

import { Script, createContext } from 'vm';

/**
 * Executes JavaScript code within a sandboxed environment using Node.js's `vm` module.
 *
 * @param code - The JavaScript code to be executed within the sandbox.
 * @param sandbox - An optional context object to be used as the global scope for the executed code.
 *
 * @returns The result of executing the provided code within the sandboxed environment.
 *
 * @remarks
 * The `sandboxExecute` function creates a new `Script` instance with the provided code and
 * runs it within a sandboxed context using the `createContext` function from the `vm` module.
 * This approach ensures that the executed code is isolated from the rest of the application,
 * mitigating potential security risks.
 *
 * The `sandbox` parameter allows you to provide a custom context or global object for the
 * sandboxed code. If not provided, an empty context is used. The function also supports
 * breaking execution on interrupt signals (e.g., Ctrl+C) with the `breakOnSigint` option.
 *
 * @throws Error Throws an error if the code cannot be compiled or executed within the context.
 *
 * @example
 * ```ts
 * const result = sandboxExecute('return 2 + 2;', { myGlobal: 10 });
 * console.log(result); // Output: 4
 * ```
 *
 * In this example, the `sandboxExecute` function runs a simple JavaScript expression and returns
 * the result. The `sandbox` parameter is provided with an empty object in this case.
 *
 * @public
 * @category Services
 */

export function sandboxExecute(code: string, sandbox: Context = {}): unknown {
    /**
     * Why instanceof Fails:
     * The instanceof operator relies on the prototype chain
     * to check whether an object is an instance of a particular constructor.
     * However, in your sandboxed environment, the RegExp object might come from a different execution context (the sandbox),
     * and that context might have its own RegExp constructor,
     * which differs from the RegExp constructor in the main Node.js context.
     *
     * As a result:
     * mangleProps instanceof RegExp fails
     * because the RegExp constructor used in the sandbox might not be the same RegExp constructor
     * that exists in the main context.
     * Thus, the object doesn't match the expected prototype chain.
     *
     * Why Object.prototype.toString Works:
     * On the other hand,
     * Object.prototype.toString.call(mangleProps)
     * is a low-level check that looks at the internal class of the object,
     * not its prototype chain.
     * Since it doesn't depend on the execution context,
     * it will correctly identify the object as a RegExp regardless of which context it was created in.
     */

    sandbox.RegExp = RegExp;
    sandbox.console = console;

    const script = new Script(code);
    const context = createContext(sandbox);

    return script.runInContext(context, { breakOnSigint: true });
}
