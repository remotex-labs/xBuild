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
        test('executes registered start hooks and aggregates errors/warnings', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue({ errors: [ 'err1' ], warnings: [ 'warn1' ] });
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ errors: [ 'err2' ] });

            provider.onStart(hook1, 'a');
            provider.onStart(hook2, 'b');
            provider.create().setup(build);

            const startCallback = build.onStart.mock.calls[0][0];
            const startResult = await startCallback();

            expect(hook1).toHaveBeenCalledWith(expect.objectContaining({
                build,
                argv,
                variantName,
                stage: expect.objectContaining({ startTime: expect.any(Date) })
            }));

            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({
                build,
                argv,
                variantName,
                stage: expect.objectContaining({ startTime: expect.any(Date) })
            }));

            expect(startResult.errors).toEqual([ 'err1', 'err2' ]);
            expect(startResult.warnings).toEqual([ 'warn1' ]);
        });

        test('returns empty result when no hooks registered', async () => {
            provider.create().setup(build);

            // No onStart callback registered
            expect(build.onStart).not.toHaveBeenCalled();
        });
    });

    describe('onEnd & onSuccess execution', () => {
        test('executes end hooks and success hooks only on success', async () => {
            const endHook = xJet.fn<any, any, any>().mockResolvedValue({ errors: [ 'end-err' ] });
            const successHook = xJet.fn<any, any, any>();

            provider.onEnd(endHook);
            provider.onSuccess(successHook);
            provider.create().setup(build);

            const endCallback = build.onEnd.mock.calls[0][0];
            const buildResult = { errors: [] };
            const result = await endCallback(buildResult);

            expect(endHook).toHaveBeenCalledWith(expect.objectContaining({
                buildResult,
                duration: expect.any(Number),
                argv,
                variantName,
                stage: expect.any(Object)
            }));

            expect(successHook).toHaveBeenCalledWith(expect.objectContaining({
                buildResult,
                duration: expect.any(Number),
                argv,
                variantName,
                stage: expect.any(Object)
            }));

            expect(result.errors).toEqual([ 'end-err' ]);
        });

        test('skips success hooks on build failure', async () => {
            const successHook = xJet.fn<any, any, any>();

            provider.onSuccess(successHook);

            provider.create().setup(build);

            const endCallback = build.onEnd.mock.calls[0][0];
            await endCallback({ errors: [ 'build failed' ] });

            expect(successHook).not.toHaveBeenCalled();
        });

        test('calculates duration correctly', async () => {
            const endHook = xJet.fn<any, any, any>();
            const startHook = xJet.fn<any, any, any>();
            provider.onStart(startHook);
            provider.onEnd(endHook);
            provider.create().setup(build);

            // Trigger start to set startTime
            const startCallback = build.onStart.mock.calls[0][0];
            await startCallback();

            // Wait a bit to get measurable duration
            await new Promise(resolve => setTimeout(resolve, 10));

            const endCallback = build.onEnd.mock.calls[0][0];
            await endCallback({ errors: [] });

            expect(endHook).toHaveBeenCalledWith(expect.objectContaining({
                duration: expect.any(Number)
            }));

            const duration = endHook.mock.calls[0][0].duration;
            expect(duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('onResolve execution', () => {
        test('executes resolve hooks and merges results', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue({ namespace: 'ns1' });
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue({ external: true });

            provider.onResolve(hook1, 'a');
            provider.onResolve(hook2, 'b');

            provider.create().setup(build);

            const resolveCallback = build.onResolve.mock.calls[0][1];
            const args = { path: './file.ts' } as any;
            const result = await resolveCallback(args);

            expect(hook1).toHaveBeenCalledWith(expect.objectContaining({
                args,
                argv,
                variantName,
                stage: expect.any(Object)
            }));

            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({
                args,
                argv,
                variantName,
                stage: expect.any(Object)
            }));

            expect(result).toEqual({ namespace: 'ns1', external: true });
        });

        test('returns null when no hooks registered', async () => {
            provider.create().setup(build);

            expect(build.onResolve).not.toHaveBeenCalled();
        });

        test('returns null when all hooks return undefined', async () => {
            const hook1 = xJet.fn<any, any, any>().mockResolvedValue(undefined);
            const hook2 = xJet.fn<any, any, any>().mockResolvedValue(null);

            provider.onResolve(hook1, 'a');
            provider.onResolve(hook2, 'b');

            provider.create().setup(build);

            const resolveCallback = build.onResolve.mock.calls[0][1];
            const args = { path: './file.ts' } as any;
            const result = await resolveCallback(args);

            expect(result).toBeNull();
        });
    });

    describe('onLoad execution', () => {
        test('loads from filesModel snapshot when available', async () => {
            const snapshot = {
                contentSnapshot: {
                    text: 'snapshot content'
                }
            };

            filesModel.getSnapshot.mockReturnValue(snapshot);

            const hook = xJet.fn<any, any, any>()
                .mockImplementation((context) => ({ contents: context.contents + ' modified' }));

            provider.onLoad(hook);

            provider.create().setup(build);

            const loadCallback = build.onLoad.mock.calls[0][1];
            const args = { path: '/project/root/src/file.ts' } as any;
            const result = await loadCallback(args);

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

        test('falls back to readFile when no snapshot', async () => {
            filesModel.getSnapshot.mockReturnValue(null);

            xJet.mock(readFile).mockResolvedValue('disk content');

            const hook = xJet.fn<any, any, any>().mockReturnValue({ loader: 'ts' });

            provider.onLoad(hook);

            provider.create().setup(build);

            const loadCallback = build.onLoad.mock.calls[0][1];
            const args = { path: '/project/root/src/file.ts' } as any;
            const result = await loadCallback(args);

            expect(readFile).toHaveBeenCalledWith('/project/root/src/file.ts', 'utf8');
            expect(hook).toHaveBeenCalledWith(expect.objectContaining({
                contents: 'disk content',
                loader: 'default',
                args
            }));
            expect(result.loader).toBe('ts');
        });

        test('applies multiple load hooks sequentially in pipeline', async () => {
            filesModel.getSnapshot.mockReturnValue(null);
            xJet.mock(readFile).mockResolvedValue('original');

            const hook1 = xJet.fn<any, any, any>()
                .mockImplementation((context) => ({ contents: context.contents + '1' }));

            const hook2 = xJet.fn<any, any, any>()
                .mockImplementation((context) => ({ contents: context.contents + '2', loader: 'js' }));

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const loadCallback = build.onLoad.mock.calls[0][1];
            const result = await loadCallback({ path: '/file.ts' } as any);

            // Verify hook1 receives original content
            expect(hook1).toHaveBeenCalledWith(expect.objectContaining({
                contents: 'original',
                loader: 'default'
            }));

            // Verify hook2 receives hook1's output
            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({
                contents: 'original1',
                loader: 'default'
            }));

            expect(result.contents).toBe('original12');
            expect(result.loader).toBe('js');
        });

        test('propagates loader changes through pipeline', async () => {
            filesModel.getSnapshot.mockReturnValue(null);
            xJet.mock(readFile).mockResolvedValue('content');

            const hook1 = xJet.fn<any, any, any>().mockReturnValue({ loader: 'ts' });
            const hook2 = xJet.fn<any, any, any>().mockReturnValue({ contents: 'modified' });

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const loadCallback = build.onLoad.mock.calls[0][1];
            await loadCallback({ path: '/file.ts' } as any);

            // Verify hook2 receives the loader from hook1
            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({
                loader: 'ts'
            }));
        });

        test('handles hooks returning undefined', async () => {
            filesModel.getSnapshot.mockReturnValue(null);
            xJet.mock(readFile).mockResolvedValue('content');

            const hook1 = xJet.fn<any, any, any>().mockReturnValue(undefined);
            const hook2 = xJet.fn<any, any, any>().mockReturnValue({ loader: 'js' });

            provider.onLoad(hook1, 'a');
            provider.onLoad(hook2, 'b');
            provider.create().setup(build);

            const loadCallback = build.onLoad.mock.calls[0][1];
            const result = await loadCallback({ path: '/file.ts' } as any);

            // Content should remain unchanged by hook1
            expect(hook2).toHaveBeenCalledWith(expect.objectContaining({
                contents: 'content',
                loader: 'default'
            }));

            expect(result.contents).toBe('content');
            expect(result.loader).toBe('js');
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

            // Execute start hook
            const startCallback = build.onStart.mock.calls[0][0];
            await startCallback();

            // Execute load hook
            const loadCallback = build.onLoad.mock.calls[0][1];
            await loadCallback({ path: '/file.ts' } as any);

            // Execute end hook
            const endCallback = build.onEnd.mock.calls[0][0];
            await endCallback({ errors: [] });

            // Verify all hooks received the same stage object
            const startStage = startHook.mock.calls[0][0].stage;
            const loadStage = loadHook.mock.calls[0][0].stage;
            const endStage = endHook.mock.calls[0][0].stage;

            expect(loadStage.customData).toBe('test-data');
            expect(endStage.customData).toBe('test-data');
            expect(loadStage).toBe(startStage);
            expect(endStage).toBe(startStage);
        });

        test('all hooks receive same argv reference', async () => {
            const startHook = xJet.fn<any, any, any>();
            const loadHook = xJet.fn<any, any, any>();
            const endHook = xJet.fn<any, any, any>();

            provider.onStart(startHook);
            provider.onLoad(loadHook);
            provider.onEnd(endHook);

            provider.create().setup(build);

            const startCallback = build.onStart.mock.calls[0][0];
            await startCallback();

            const loadCallback = build.onLoad.mock.calls[0][1];
            await loadCallback({ path: '/file.ts' } as any);

            const endCallback = build.onEnd.mock.calls[0][0];
            await endCallback({ errors: [] });

            expect(startHook.mock.calls[0][0].argv).toBe(argv);
            expect(loadHook.mock.calls[0][0].argv).toBe(argv);
            expect(endHook.mock.calls[0][0].argv).toBe(argv);
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

            const startCallback = build.onStart.mock.calls[0][0];
            await startCallback();

            const resolveCallback = build.onResolve.mock.calls[0][1];
            await resolveCallback({ path: './file.ts' } as any);

            const loadCallback = build.onLoad.mock.calls[0][1];
            await loadCallback({ path: '/file.ts' } as any);

            const endCallback = build.onEnd.mock.calls[0][0];
            await endCallback({ errors: [] });

            expect(startHook.mock.calls[0][0].variantName).toBe(variantName);
            expect(resolveHook.mock.calls[0][0].variantName).toBe(variantName);
            expect(loadHook.mock.calls[0][0].variantName).toBe(variantName);
            expect(endHook.mock.calls[0][0].variantName).toBe(variantName);
        });
    });
});
