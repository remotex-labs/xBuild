/**
 * Imports
 */

import { readFile } from 'fs/promises';
import { join, resolve } from '@components/path.component';
import { LifecycleProvider } from '@providers/lifecycle.provider';

/**
 * Tests
 */

describe('LifecycleProvider', () => {
    let provider: LifecycleProvider;
    let build: any;
    let filesModel: any;

    const variantName = 'test-variant';
    const argv = { watch: true, minify: false };

    beforeEach(() => {
        xJet.resetAllMocks();

        filesModel = {
            getSnapshot: xJet.fn().mockReturnValue(null)
        };

        provider = new LifecycleProvider(variantName, argv);
        (provider as any).filesModel = filesModel;

        build = {
            initialOptions: {},
            onStart: xJet.fn(),
            onEnd: xJet.fn(),
            onResolve: xJet.fn(),
            onLoad: xJet.fn()
        };

        xJet.mock(resolve).mockImplementation((path: string): string => {
            if (path.includes('/project/root')) return path;

            return join('/project/root', path);
        });

        xJet.mock(readFile).mockResolvedValue('file content');
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    /**
     * Retrieves the bound callback registered on an esbuild mock at the given argument index
     * and invokes it with the provided args.
     */
    async function callRegistered(mock: any, argIndex: number, ...args: any[]): Promise<any> {
        return mock.mock.calls[0][argIndex](...args);
    }

    describe('constructor & plugin creation', () => {
        test('creates esbuild plugin with correct name', () => {
            const plugin = provider.create();

            expect(plugin.name).toBe(variantName);
            expect(plugin.setup).toBeDefined();
        });

        test('enables metafile in initialOptions', () => {
            provider.create().setup(build);

            expect(build.initialOptions.metafile).toBe(true);
        });
    });

    describe('hook registration', () => {
        test('registers start hook', () => {
            const handler = xJet.fn<any, any, any>();

            provider.onStart(handler, 'custom-start');

            expect((provider as any).startHooks.size).toBe(1);
            expect((provider as any).startHooks.get('custom-start')).toBe(handler);
        });

        test('registers end, success, resolve, load hooks', () => {
            provider.onEnd(xJet.fn());
            provider.onSuccess(xJet.fn());
            provider.onResolve(xJet.fn());
            provider.onLoad(xJet.fn());

            expect((provider as any).endHooks.size).toBe(1);
            expect((provider as any).successHooks.size).toBe(1);
            expect((provider as any).resolveHooks.size).toBe(1);
            expect((provider as any).loadHooks.size).toBe(1);
        });

        test('ignores undefined handlers', () => {
            provider.onStart(undefined);
            provider.onEnd(undefined);
            provider.onSuccess(undefined);
            provider.onResolve(undefined);
            provider.onLoad(undefined);

            expect((provider as any).startHooks.size).toBe(0);
            expect((provider as any).endHooks.size).toBe(0);
            expect((provider as any).successHooks.size).toBe(0);
            expect((provider as any).resolveHooks.size).toBe(0);
            expect((provider as any).loadHooks.size).toBe(0);
        });

        test('clearAll removes all registered hooks', () => {
            provider.onStart(xJet.fn());
            provider.onEnd(xJet.fn());
            provider.onSuccess(xJet.fn());
            provider.onResolve(xJet.fn());
            provider.onLoad(xJet.fn());

            provider.clearAll();

            expect((provider as any).startHooks.size).toBe(0);
            expect((provider as any).endHooks.size).toBe(0);
            expect((provider as any).successHooks.size).toBe(0);
            expect((provider as any).resolveHooks.size).toBe(0);
            expect((provider as any).loadHooks.size).toBe(0);
        });
    });

    describe('onStart execution', () => {
        test('does not register esbuild onStart when no hooks', () => {
            provider.create().setup(build);

            expect(build.onStart).not.toHaveBeenCalled();
        });

        test('executes registered start hooks and aggregates errors/warnings', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue({ errors: [ 'err1' ], warnings: [ 'warn1' ] });
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ errors: [ 'err2' ] });
            const expectedContext = expect.objectContaining({
                build,
                argv,
                variantName,
                stage: expect.objectContaining({ startTime: expect.any(Date) })
            });

            provider.onStart(hook1, 'a');
            provider.onStart(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onStart, 0);

            expect(hook1).toHaveBeenCalledWith(expectedContext);
            expect(hook2).toHaveBeenCalledWith(expectedContext);
            expect(result.errors).toEqual([ 'err1', 'err2' ]);
            expect(result.warnings).toEqual([ 'warn1' ]);
        });

        test('captures thrown errors from start hooks and continues to next hook', async () => {
            const error = new Error('start hook failed');
            const hook1 = xJet.fn<any, any, any>().mockRejectedValue(error);
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ warnings: [ 'warn1' ] });

            provider.onStart(hook1, 'a');
            provider.onStart(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onStart, 0);

            expect(hook2).toHaveBeenCalled();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].detail).toBe(error);
            expect(result.warnings).toEqual([ 'warn1' ]);
        });

        test('resets startTime on each invocation', async () => {
            const hook = xJet.fn<any, any, any>().mockResolvedValue({});

            provider.onStart(hook);
            provider.create().setup(build);

            const startCallback = build.onStart.mock.calls[0][0];

            await startCallback();
            const firstTime: Date = hook.mock.calls[0][0].stage.startTime;

            await new Promise(r => setTimeout(r, 5));
            await startCallback();
            const secondTime: Date = hook.mock.calls[1][0].stage.startTime;

            expect(hook).toHaveBeenCalledTimes(2);
            expect(secondTime.getTime()).toBeGreaterThan(firstTime.getTime());
        });
    });

    describe('onEnd & onSuccess execution', () => {
        test('does not register esbuild onEnd when no end or success hooks', () => {
            provider.create().setup(build);

            expect(build.onEnd).not.toHaveBeenCalled();
        });

        test('executes end hooks and success hooks only on success', async () => {
            const endHook = xJet.fn<any, any, any>().mockResolvedValue({ errors: [ 'end-err' ] });
            const successHook = xJet.fn<any, any, any>();
            const buildResult = { errors: [] };
            const expectedContext = expect.objectContaining({
                buildResult,
                duration: expect.any(Number),
                argv,
                variantName,
                stage: expect.any(Object)
            });

            provider.onEnd(endHook);
            provider.onSuccess(successHook);
            provider.create().setup(build);

            const result = await callRegistered(build.onEnd, 0, buildResult);

            expect(endHook).toHaveBeenCalledWith(expectedContext);
            expect(successHook).toHaveBeenCalledWith(expectedContext);
            expect(result.errors).toEqual([ 'end-err' ]);
        });

        test('skips success hooks on build failure', async () => {
            const successHook = xJet.fn<any, any, any>();

            provider.onSuccess(successHook);
            provider.create().setup(build);

            await callRegistered(build.onEnd, 0, { errors: [ 'build failed' ] });

            expect(successHook).not.toHaveBeenCalled();
        });

        test('success hook return value is ignored', async () => {
            const endHook = xJet.fn<any, any, any>().mockResolvedValue({ warnings: [ 'end-warn' ] });
            const successHook = xJet.fn<any, any, any>().mockResolvedValue({ warnings: [ 'success-warn' ] });

            provider.onEnd(endHook);
            provider.onSuccess(successHook);
            provider.create().setup(build);

            const result = await callRegistered(build.onEnd, 0, { errors: [] });

            expect(result.warnings).toEqual([ 'end-warn' ]);
        });

        test('captures thrown errors from end hooks and continues to next hook', async () => {
            const error = new Error('end hook failed');
            const hook1 = xJet.fn<any, any, any>().mockRejectedValue(error);
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ warnings: [ 'warn1' ] });

            provider.onEnd(hook1, 'a');
            provider.onEnd(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onEnd, 0, { errors: [] });

            expect(hook2).toHaveBeenCalled();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].detail).toBe(error);
            expect(result.warnings).toEqual([ 'warn1' ]);
        });

        test('captures thrown errors from success hooks into result errors', async () => {
            const error = new Error('success hook failed');
            const successHook = xJet.fn<any, any, any>().mockRejectedValue(error);

            provider.onSuccess(successHook);
            provider.create().setup(build);

            const result = await callRegistered(build.onEnd, 0, { errors: [] });

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].detail).toBe(error);
        });

        test('calculates duration correctly', async () => {
            const startHook = xJet.fn<any, any, any>();
            const endHook = xJet.fn<any, any, any>();

            provider.onStart(startHook);
            provider.onEnd(endHook);
            provider.create().setup(build);

            await callRegistered(build.onStart, 0);
            await new Promise(r => setTimeout(r, 10));
            await callRegistered(build.onEnd, 0, { errors: [] });

            expect(endHook).toHaveBeenCalledWith(expect.objectContaining({ duration: expect.any(Number) }));

            const { duration } = endHook.mock.calls[0][0];
            expect(duration).toBeGreaterThanOrEqual(10);
        });
    });

    describe('onResolve execution', () => {
        test('does not register esbuild onResolve when no hooks', () => {
            provider.create().setup(build);

            expect(build.onResolve).not.toHaveBeenCalled();
        });

        test('registers onResolve with catch-all filter', () => {
            provider.onResolve(xJet.fn());
            provider.create().setup(build);

            expect(build.onResolve).toHaveBeenCalledWith({ filter: /.*/ }, expect.any(Function));
        });

        test('executes resolve hooks and merges results', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue({ namespace: 'ns1' });
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ external: true });
            const args = { path: './file.ts' } as any;
            const expectedContext = expect.objectContaining({ args, argv, variantName, stage: expect.any(Object) });

            provider.onResolve(hook1, 'a');
            provider.onResolve(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onResolve, 1, args);

            expect(hook1).toHaveBeenCalledWith(expectedContext);
            expect(hook2).toHaveBeenCalledWith(expectedContext);
            expect(result).toEqual({ namespace: 'ns1', external: true });
        });

        test('later resolve hook properties override earlier ones', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue({ namespace: 'ns1', external: false });
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ external: true });

            provider.onResolve(hook1, 'a');
            provider.onResolve(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onResolve, 1, { path: './file.ts' } as any);

            expect(result).toEqual({ namespace: 'ns1', external: true });
        });

        test('returns null when all hooks return undefined or null', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue(undefined);
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue(null);

            provider.onResolve(hook1, 'a');
            provider.onResolve(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onResolve, 1, { path: './file.ts' } as any);

            expect(result).toBeNull();
        });
    });

    describe('onLoad execution', () => {
        test('does not register esbuild onLoad when no hooks', () => {
            provider.create().setup(build);

            expect(build.onLoad).not.toHaveBeenCalled();
        });

        test('registers onLoad with catch-all filter', () => {
            provider.onLoad(xJet.fn());
            provider.create().setup(build);

            expect(build.onLoad).toHaveBeenCalledWith({ filter: /.*/ }, expect.any(Function));
        });

        test('loads from filesModel snapshot when available', async () => {
            filesModel.getSnapshot.mockReturnValue({ contentSnapshot: { text: 'snapshot content' } });

            const hook = xJet.fn<any, any, any>()
                .mockImplementation((context) => ({ contents: context.contents + ' modified' }));

            provider.onLoad(hook);
            provider.create().setup(build);

            const args = { path: '/project/root/src/file.ts' } as any;
            const result = await callRegistered(build.onLoad, 1, args);

            expect(filesModel.getSnapshot).toHaveBeenCalledWith('/project/root/src/file.ts');
            expect(hook).toHaveBeenCalledWith(expect.objectContaining({
                contents: 'snapshot content',
                loader: 'default',
                args,
                argv,
                variantName,
                stage: expect.any(Object)
            }));
            expect(result.contents).toBe('snapshot content modified');
        });

        test('falls back to readFile when snapshot has no contentSnapshot', async () => {
            filesModel.getSnapshot.mockReturnValue({ contentSnapshot: null });
            xJet.mock(readFile).mockResolvedValue('disk content');

            const hook = xJet.fn<any, any, any>().mockReturnValue({ loader: 'ts' });

            provider.onLoad(hook);
            provider.create().setup(build);

            const args = { path: '/project/root/src/file.ts' } as any;
            const result = await callRegistered(build.onLoad, 1, args);

            expect(readFile).toHaveBeenCalledWith('/project/root/src/file.ts', 'utf8');
            expect(hook).toHaveBeenCalledWith(expect.objectContaining({ contents: 'disk content', loader: 'default', args }));
            expect(result.loader).toBe('ts');
        });

        test('falls back to readFile when no snapshot', async () => {
            xJet.mock(readFile).mockResolvedValue('disk content');

            const hook = xJet.fn<any, any, any>().mockReturnValue({ loader: 'ts' });

            provider.onLoad(hook);
            provider.create().setup(build);

            const args = { path: '/project/root/src/file.ts' } as any;
            const result = await callRegistered(build.onLoad, 1, args);

            expect(readFile).toHaveBeenCalledWith('/project/root/src/file.ts', 'utf8');
            expect(hook).toHaveBeenCalledWith(expect.objectContaining({ contents: 'disk content', loader: 'default', args }));
            expect(result.loader).toBe('ts');
        });

        test('applies multiple load hooks sequentially in pipeline', async () => {
            xJet.mock(readFile).mockResolvedValue('original');

            const hook1 = xJet.fn<any, any, any>()
                .mockImplementation((context) => ({ contents: context.contents + '1' }));

            const hook2 = xJet.fn<any, any, any>()
                .mockImplementation((context) => ({ contents: context.contents + '2', loader: 'js' }));

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);

            expect(hook1).toHaveBeenCalledWith(expect.objectContaining({ contents: 'original', loader: 'default' }));
            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({ contents: 'original1', loader: 'default' }));
            expect(result.contents).toBe('original12');
            expect(result.loader).toBe('js');
        });

        test('propagates loader changes through pipeline', async () => {
            xJet.mock(readFile).mockResolvedValue('content');

            const hook1 = xJet.fn<any, any, any>().mockReturnValue({ loader: 'ts' });
            const hook2 = xJet.fn<any, any, any>().mockReturnValue({ contents: 'modified' });

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);

            expect(hook2).toHaveBeenLastCalledWith(expect.objectContaining({ loader: 'ts' }));
        });

        test('handles hooks returning undefined without breaking pipeline', async () => {
            xJet.mock(readFile).mockResolvedValue('content');

            const hook1 = xJet.fn<any, any, any>().mockReturnValue(undefined);
            const hook2 = xJet.fn<any, any, any>().mockReturnValue({ loader: 'js' });

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);

            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({ contents: 'content', loader: 'default' }));
            expect(result.contents).toBe('content');
            expect(result.loader).toBe('js');
        });

        test('captures thrown errors from load hooks and continues pipeline', async () => {
            xJet.mock(readFile).mockResolvedValue('content');

            const error = new Error('load hook failed');
            const hook1 = xJet.fn<any, any, any>().mockRejectedValue(error);
            const hook2 = xJet.fn<any, any, any>().mockReturnValue({ loader: 'ts' });

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);

            expect(hook2).toHaveBeenCalled();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].detail).toBe(error);
            expect(result.loader).toBe('ts');
        });

        test('aggregates errors and warnings from load hooks', async () => {
            xJet.mock(readFile).mockResolvedValue('content');

            const hook1 = xJet.fn<any, any, any>().mockReturnValue({ errors: [ 'e1' ], warnings: [ 'w1' ] });
            const hook2 = xJet.fn<any, any, any>().mockReturnValue({ errors: [ 'e2' ], warnings: [ 'w2' ] });

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const result = await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);

            expect(result.errors).toEqual([ 'e1', 'e2' ]);
            expect(result.warnings).toEqual([ 'w1', 'w2' ]);
        });
    });

    describe('context sharing', () => {
        test('shares stage object across all hooks', async () => {
            const startHook = xJet.fn<any, any, any>().mockImplementation((context) => {
                context.stage.customData = 'test-data';

                return {};
            });

            const loadHook = xJet.fn<any, any, any>();
            const endHook = xJet.fn<any, any, any>();

            provider.onStart(startHook);
            provider.onLoad(loadHook);
            provider.onEnd(endHook);
            provider.create().setup(build);

            await callRegistered(build.onStart, 0);
            await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);
            await callRegistered(build.onEnd, 0, { errors: [] });

            const sharedStage = expect.objectContaining({ customData: 'test-data' });
            expect(loadHook).toHaveBeenCalledWith(expect.objectContaining({ stage: sharedStage }));
            expect(endHook).toHaveBeenCalledWith(expect.objectContaining({ stage: sharedStage }));

            // Verify it's the exact same object reference, not just equal shape
            const startStage = startHook.mock.calls[0][0].stage;
            expect(loadHook.mock.calls[0][0].stage).toBe(startStage);
            expect(endHook.mock.calls[0][0].stage).toBe(startStage);
        });

        test('all hooks receive same argv reference', async () => {
            const startHook = xJet.fn<any, any, any>();
            const loadHook = xJet.fn<any, any, any>();
            const endHook = xJet.fn<any, any, any>();

            provider.onStart(startHook);
            provider.onLoad(loadHook);
            provider.onEnd(endHook);
            provider.create().setup(build);

            await callRegistered(build.onStart, 0);
            await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);
            await callRegistered(build.onEnd, 0, { errors: [] });

            const expectedContext = expect.objectContaining({ argv });
            expect(startHook).toHaveBeenCalledWith(expectedContext);
            expect(loadHook).toHaveBeenCalledWith(expectedContext);
            expect(endHook).toHaveBeenCalledWith(expectedContext);
        });

        test('all hooks receive same variantName', async () => {
            const startHook = xJet.fn<any, any, any>();
            const resolveHook = xJet.fn<any, any, any>();
            const loadHook = xJet.fn<any, any, any>();
            const endHook = xJet.fn<any, any, any>();

            provider.onStart(startHook);
            provider.onResolve(resolveHook);
            provider.onLoad(loadHook);
            provider.onEnd(endHook);
            provider.create().setup(build);

            await callRegistered(build.onStart, 0);
            await callRegistered(build.onResolve, 1, { path: './file.ts' } as any);
            await callRegistered(build.onLoad, 1, { path: '/file.ts' } as any);
            await callRegistered(build.onEnd, 0, { errors: [] });

            const expectedContext = expect.objectContaining({ variantName });
            expect(startHook).toHaveBeenCalledWith(expectedContext);
            expect(resolveHook).toHaveBeenCalledWith(expectedContext);
            expect(loadHook).toHaveBeenCalledWith(expectedContext);
            expect(endHook).toHaveBeenCalledWith(expectedContext);
        });
    });
});
