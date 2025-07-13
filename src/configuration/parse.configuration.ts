/**
 * Import will remove at compile time
 */

import type { ErrorType } from '@errors/interfaces/stack.interface';
import type { ConfigurationInterface, ModuleInterface } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import { createRequire } from 'module';
import { SourceService } from '@remotex-labs/xmap';
import { sandboxExecute } from '@services/vm.service';
import { VMRuntimeError } from '@errors/vm-runtime.error';
import { transpileFile } from '@services/transpiler.service';

/**
 * Recursively wraps all functions in an object, including nested objects.
 *
 * @param obj - The object whose functions need to be wrapped.
 * @param sourceMap - The source map service to attach to the error in case of a thrown error.
 * @returns The object with its functions wrapped.
 */

function wrapAllFunctions<T extends object>(obj: T, sourceMap: SourceService): T {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key as keyof T];

            if (typeof value === 'function') {
                // Safely cast and wrap the function
                (obj as Record<string, unknown>)[key] = wrapFunctionWithSourceMap(value as (...args: unknown[]) => unknown, sourceMap);
            } else if (typeof value === 'object' && value !== null) {
                // Recursively wrap functions in nested objects
                wrapAllFunctions(value, sourceMap);
            }
        }
    }

    return obj;
}

/**
 * Wraps a function to catch errors and attach sourcemap information.
 *
 * @param fn - The function to be wrapped.
 * @param sourceMap - The source map service to attach to the error in case of a thrown error.
 * @returns The wrapped function that includes error handling with sourcemap information.
 */

function wrapFunctionWithSourceMap<T extends(...args: unknown[]) => unknown>(
    fn: T,
    sourceMap: SourceService
): T {
    return ((...args: Parameters<T>): ReturnType<T> => {
        try {
            return fn(...args) as ReturnType<T>;
        } catch (error) {
            throw new VMRuntimeError(<Error> error, sourceMap);
        }
    }) as T;
}

/**
 * Wraps functions within a `ConfigurationInterface` object to add sourcemap information to any errors thrown.
 *
 * @param config - The configuration object containing functions that need to be wrapped.
 * @param sourceMap - The source map service used to provide sourcemap information in case of errors.
 * @returns The modified `ConfigurationInterface` object with its functions wrapped.
 */

function wrapConfigFunctionsWithSourcemap(
    config: ConfigurationInterface,
    sourceMap: SourceService
): ConfigurationInterface {
    return wrapAllFunctions(config, sourceMap);
}

/**
 * Parses a configuration file and returns a wrapped `ConfigurationInterface` object.
 *
 * This function reads the specified configuration file, transpiles it to a CommonJS format, and then executes it
 * in a sandbox environment. The exported configuration object is wrapped so that any functions it contains will
 * have sourcemap information attached to errors thrown during their execution.
 *
 * The wrapping of functions helps in debugging by associating errors with their source maps.
 *
 * @param file - The path to the configuration file that needs to be parsed and transpiled.
 *
 * @returns A promise that resolves to the parsed and transpiled `ConfigurationInterface` object.
 * This object has its functions wrapped to attach sourcemap information to any errors thrown.
 *
 * @throws Will throw an error if the transpilation or execution of the configuration file fails.
 * The thrown error will have sourcemap information attached if available.

 * @example
 * ```ts
 * const config = await parseConfigurationFile('./config.jet.ts');
 * console.log(config);
 * ```
 */

export async function parseConfigurationFile(file: string): Promise<ConfigurationInterface> {
    const { code, sourceMap } = await transpileFile(file, {
        banner: { js: '(function(module, exports) {' },
        footer: { js: '})(module, module.exports);' }
    });

    const module: ModuleInterface = { exports: {} };
    const require = createRequire(import.meta.url);
    const source = new SourceService(JSON.parse(atob(sourceMap)));

    try {
        await sandboxExecute(code, {
            require,
            module
        });
    } catch (error: unknown) {
        throw new VMRuntimeError(<ErrorType> error, source);
    }

    return wrapConfigFunctionsWithSourcemap(<ConfigurationInterface> module.exports.default, source);
}
