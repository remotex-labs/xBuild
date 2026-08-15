/**
 * Imports
 */

import { cwd } from 'process';
import { sandboxExecute } from '@services/vm.service';
import { buildFromString } from '@services/transpiler.service';

/**
 * Tests
 */

describe('sandboxExecute', () => {
    test('should return the completion value of the last expression', async () => {
        expect(await sandboxExecute('2 + 2')).toBe(4);
    });

    test('should await a promise the code completes with', async () => {
        expect(await sandboxExecute('Promise.resolve(7)')).toBe(7);
    });

    test('should expose the sandbox values as globals', async () => {
        expect(await sandboxExecute('x + y', { x: 41, y: 1 })).toBe(42);
    });

    test('should let a sandbox value override a host global', async () => {
        expect(await sandboxExecute('process.cwd()', { process: { cwd: () => 'D:/fake' } })).toBe('D:/fake');
    });

    test('should keep a host global a run overrode out of the next one', async () => {
        await sandboxExecute('process.cwd()', { process: { cwd: (): string => 'D:/fake' } });

        expect(await sandboxExecute('process.cwd()')).toBe(cwd());
    });

    test('should complete with undefined when the code has no completion value', async () => {
        expect(await sandboxExecute('const a = 1;')).toBeUndefined();
    });

    test('should share the host intrinsics so values cross back out intact', async () => {
        expect(await sandboxExecute('new RegExp("a")')).toBeInstanceOf(RegExp);
        expect(Array.isArray(await sandboxExecute('[ 1, 2 ]'))).toBe(true);
    });

    test('should write back through an injected object', async () => {
        const module = { exports: {} };
        await sandboxExecute('module.exports = { ok: true };', { module });

        expect(module.exports).toEqual({ ok: true });
    });

    test('should reach the host globals, isolating the scope rather than the process', async () => {
        expect(await sandboxExecute('typeof process.cwd')).toBe('function');
        expect(await sandboxExecute('typeof setTimeout')).toBe('function');
    });

    test('should log through the host console by default', async () => {
        const log = xJet.spyOn(console, 'log').mockImplementation(() => undefined);

        try {
            await sandboxExecute('console.log(\'from the code\');');

            expect(log).toHaveBeenCalledWith('from the code');
        } finally {
            log.mockRestore();
        }
    });

    test('should keep the host console out of a run that isolates the logs', async () => {
        const log = xJet.spyOn(console, 'log').mockImplementation(() => undefined);

        try {
            expect(await sandboxExecute('console.log(\'from the code\'); 42', {}, {}, true)).toBe(42);

            expect(log).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
        }
    });

    test('should leave the code a console of the context to write into', async () => {
        expect(await sandboxExecute('typeof console', {}, {}, true)).toBe('object');
    });

    test('should leave every other host global reachable while the logs are isolated', async () => {
        expect(await sandboxExecute('typeof process.cwd', {}, {}, true)).toBe('function');
        expect(await sandboxExecute('typeof setTimeout', {}, {}, true)).toBe('function');
    });

    test('should write to a console the sandbox named of its own', async () => {
        const log = xJet.fn();
        await sandboxExecute('console.log(\'from the sandbox\');', { console: { log } });

        expect(log).toHaveBeenCalledWith('from the sandbox');
    });

    test('should drop a console the sandbox named while the logs are isolated', async () => {
        const log = xJet.fn();

        expect(await sandboxExecute('console.log(\'from the sandbox\'); 42', { console: { log } }, {}, true)).toBe(42);
        expect(log).not.toHaveBeenCalled();
    });

    test('should not leak an implicit global from one run into the next', async () => {
        await sandboxExecute('leaked = 1;');

        expect(await sandboxExecute('typeof leaked')).toBe('undefined');
    });

    test('should write through to the host global when the code goes via globalThis', async () => {
        await sandboxExecute('globalThis.escaped = 1;');

        expect((<any> globalThis).escaped).toBe(1);
        delete (<any> globalThis).escaped;
    });

    test('should report errors against the filename it was given', async () => {
        await expect(sandboxExecute('throw new Error("boom");', {}, { filename: 'virtual.ts' }))
            .rejects.toThrow(expect.objectContaining({ stack: expect.stringContaining('virtual.ts') }));
    });

    test('should reject with a SyntaxError when the code does not compile', async () => {
        await expect(sandboxExecute('const =')).rejects.toThrow(expect.objectContaining({ name: 'SyntaxError' }));
    });

    test('should propagate an error the code throws unchanged', async () => {
        const failure = new Error('boom');

        await expect(sandboxExecute('throw failure;', { failure })).rejects.toBe(failure);
    });

    test('should reject with the reason of a promise the code completes with', async () => {
        const failure = new Error('boom');

        await expect(sandboxExecute('Promise.reject(failure)', { failure })).rejects.toBe(failure);
    });
});

describe('sandboxExecute over built output', () => {
    const source = 'export const config = { pattern: new RegExp(\'[a-z]+\', \'g\'), runtime: process };';

    let module: { exports: any };
    let completion: any;

    beforeAll(async () => {
        const built = await buildFromString(source, 'x.ts', { format: 'cjs' });

        module = { exports: {} };
        completion = await sandboxExecute(built.outputFiles![1].text, { module });
    });

    test('should keep a value the built code constructed satisfying the host instanceof', () => {
        const { pattern } = module.exports.config;

        expect(pattern).toBeInstanceOf(RegExp);
        expect(pattern.flags).toBe('g');
        expect(pattern.test('abc')).toBe(true);
    });

    test('should give the built code the host process', () => {
        expect(module.exports.config.runtime.cwd()).toBe(cwd());
    });

    test('should populate the injected module and complete with its exports', () => {
        expect(Object.keys(module.exports)).toEqual([ 'config' ]);
        expect(completion).toBe(module.exports);
    });
});
