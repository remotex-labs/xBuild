/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecycleContextInterface } from '@interfaces/lifecycle.interface';

/**
 * Imports
 */

import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { VariantService } from './variant.service';
import { Typescript } from '@typescript/typescript.module';
import { analyzeMacros } from '@directives/analyze.directive';
import { transformMacros } from '@directives/macros.directive';
import { FrameworkService } from '@services/framework.service';
import { resolveSource } from '@components/transformer.component';
import { ConfigurationService } from '@services/configuration.service';
import { extractEntryPoints } from '@components/entry-points.component';
import { buildFiles, analyzeDependencies } from '@services/transpiler.service';

/**
 * Tests
 */

describe('VariantService', () => {
    const cache = inject(FilesModel);

    let events: any;
    let service: any;
    let framework: any;
    let typescript: any;
    let configuration: any;
    let notify: (change: unknown) => void;
    let failSubscription: (error: unknown) => void;
    let selector: (config: unknown) => unknown;
    let unsubscribeMock: any;
    let buildFilesMock: any;
    let resolveMock: any;
    let touchMock: any;
    let macrosMock: any;
    let transformMock: any;
    let resolveSourceMock: any;
    let dependenciesMock: any;

    /**
     * The variant entry a change carries, deep enough for a build to run off it.
     */

    function variant(overrides: any = {}): any {
        return {
            esbuild: { outdir: 'dist', entryPoints: { index: 'src/index.ts' }, ...overrides.esbuild },
            ...overrides
        };
    }

    /**
     * Hands the service a configuration change, which is what gives it a build to run.
     */

    function configure(overrides: any = {}, common: any = {}): void {
        notify({ common, variant: variant(overrides) });
    }

    /**
     * Runs the plugin build registers and hands back what it wired up.
     */

    async function lifecycle(options: any = {}): Promise<any> {
        const handlers: any = {};
        const build = {
            esbuild: <any> { version: '0.28.2' },
            onEnd: (fn: any): void => handlers.end = fn,
            onStart: (fn: any): void => handlers.start = fn,
            onLoad: (_: unknown, fn: any): void => handlers.load = fn,
            onResolve: (_: unknown, fn: any): void => handlers.resolve = fn,
            initialOptions: { outdir: 'dist', entryPoints: { index: 'src/index.ts' }, ...options }
        };

        await service.build();
        handlers.plugin = buildFilesMock.mock.calls[0][0].plugins[0];
        await handlers.plugin.setup(build);

        handlers.build = build;
        handlers.context = <LifecycleContextInterface> events.next.mock.calls[0][0].context;

        return handlers;
    }

    beforeEach(() => {
        xJet.restoreAllMocks();

        events = { next: xJet.fn() };
        unsubscribeMock = xJet.fn();
        framework = { getSourceMap: xJet.fn(() => undefined), isFrameworkFile: xJet.fn(() => false) };
        typescript = {
            check: xJet.fn(() => []),
            emit: xJet.fn(async () => []),
            emitBundle: xJet.fn(async () => []),
            dispose: xJet.fn(),
            config: { options: { rootDir: '/project/src' } }
        };

        configuration = {
            select: xJet.fn((fn: any) => {
                selector = fn;

                return {
                    subscribe: xJet.fn((next: any, error: any) => {
                        notify = next;
                        failSubscription = error;

                        return unsubscribeMock;
                    })
                };
            })
        };

        xJet.mock(inject).mockImplementation(<any> ((token: unknown) => {
            if (token === ConfigurationService) return configuration;
            if (token === FrameworkService) return framework;
            if (token === Typescript) return typescript;

            return cache;
        }));

        resolveMock = xJet.spyOn(cache, 'resolve').mockImplementation(
            (path: string) => path.startsWith('/') ? path : `/project/${ path }`
        );

        touchMock = xJet.spyOn(cache, 'touch').mockReturnValue(<any> {
            version: 1, snapshot: { text: 'export const answer = 42;' }
        });

        macrosMock = xJet.mock(analyzeMacros).mockReturnValue(new Set<string>());
        resolveSourceMock = xJet.mock(resolveSource).mockImplementation(((_: unknown, __: unknown, code: string) => code) as any);
        transformMock = xJet.mock(transformMacros).mockImplementation(((_: unknown, __: unknown, code: string) => code) as any);
        xJet.mock(extractEntryPoints).mockImplementation(((points: unknown) => points) as any);
        dependenciesMock = xJet.mock(analyzeDependencies).mockResolvedValue(<any> {
            metafile: { inputs: { 'src/index.ts': {} } }
        });

        buildFilesMock = xJet.mock(buildFiles).mockResolvedValue(<any> { errors: [], warnings: [], outputFiles: [] });
        service = new VariantService('esm', <any> events, { watch: true });
    });

    afterEach(() => {
        service.dispose();
    });

    describe('the variants it keeps', () => {
        test('should register itself under its name', () => {
            expect(VariantService.has('esm')).toBe(true);
            expect([ ...VariantService.get() ]).toContain(service);
        });

        test('should know nothing of a name it never registered', () => {
            expect(VariantService.has('cjs')).toBe(false);
        });

        test('should drop itself once it is disposed', () => {
            service.dispose();

            expect(VariantService.has('esm')).toBe(false);
        });
    });

    describe('the configuration it watches', () => {
        test('should watch the common block and its own entry alone', () => {
            expect(configuration.select).toHaveBeenCalledTimes(1);
            expect(selector({ common: { types: true }, variants: { esm: { esbuild: {} }, cjs: {} } })).toEqual({
                common: { types: true }, variant: { esbuild: {} }
            });
        });

        test('should read no entry for a variant the configuration does not declare', () => {
            expect(selector({ common: {}, variants: {} })).toEqual({ common: {}, variant: undefined });
            expect(selector({ common: {} })).toEqual({ common: {}, variant: undefined });
        });

        test('should throw what the subscription reports', () => {
            expect(() => failSubscription(new Error('the configuration is gone'))).toThrow('the configuration is gone');
        });

        test('should merge the common block under its own entry', async () => {
            notify({ common: { esbuild: { format: 'cjs', minify: true } }, variant: variant({ esbuild: { format: 'esm' } }) });
            await service.build();

            expect(buildFilesMock).toHaveBeenCalledWith(expect.objectContaining({ format: 'esm', minify: true }));
        });

        test('should read the entry points through the extractor', async () => {
            notify({ common: {}, variant: variant({ esbuild: { entryPoints: [ 'src/**' ] } }) });
            await service.build();

            expect(extractEntryPoints).toHaveBeenCalledWith([ 'src/**' ]);
        });

        test('should build the typescript module the entry names', () => {
            notify({ common: {}, variant: variant({ esbuild: { tsconfig: 'tsconfig.build.json' } }) });

            expect(inject).toHaveBeenCalledWith(Typescript, 'tsconfig.build.json');
        });

        test('should dispose the typescript module a change replaces', () => {
            configure();
            expect(typescript.dispose).not.toHaveBeenCalled();

            configure();
            expect(typescript.dispose).toHaveBeenCalledTimes(1);
        });

        test('should dispose itself once its entry is gone', () => {
            configure();
            notify({ common: {}, variant: undefined });

            expect(VariantService.has('esm')).toBe(false);
            expect(unsubscribeMock).toHaveBeenCalled();
        });
    });

    describe('the build it runs', () => {
        beforeEach(() => configure());

        test('should build under its own options, silenced, with its plugin', async () => {
            await service.build();

            expect(buildFilesMock).toHaveBeenCalledWith(expect.objectContaining({
                outdir: 'dist',
                logLimit: 0,
                logLevel: 'silent',
                plugins: [ expect.objectContaining({ name: 'esm' }) ]
            }));
        });

        test('should hand back the result under the logs it collected', async () => {
            buildFilesMock.mockResolvedValue(<any> { outputFiles: [ 'built' ] });

            expect(await service.build()).toEqual({
                outputFiles: [ 'built' ], info: [], debugs: [], errors: [], warnings: []
            });
        });

        test('should hand back an empty result when the build itself fails', async () => {
            buildFilesMock.mockRejectedValue(new Error('esbuild died'));

            expect(await service.build()).toEqual({ info: [], debugs: [], errors: [], warnings: [] });
        });

        test('should refuse to build once it is disposed', async () => {
            service.dispose();

            await expect(service.build()).rejects.toThrow('Variant esm is disposed');
        });
    });

    describe('the types it checks', () => {
        beforeEach(() => configure());

        test('should hand back the diagnostics its typescript module reported', async () => {
            typescript.check.mockReturnValue([{ category: 1, code: 2304, message: 'Cannot find name' }]);

            expect(await service.check()).toEqual([{ category: 1, code: 2304, message: 'Cannot find name' }]);
        });

        test('should check the sources the build reaches rather than the whole program', async () => {
            dependenciesMock.mockResolvedValue(<any> {
                metafile: { inputs: { 'src/index.ts': {}, 'src/components/glob.component.ts': {} } }
            });

            await service.check();

            expect(typescript.check).toHaveBeenCalledWith(new Set([ 'src/index.ts', 'src/components/glob.component.ts' ]));
        });

        test('should walk the dependencies without its own plugin', async () => {
            await service.check();

            expect(dependenciesMock).toHaveBeenCalledWith(expect.objectContaining({ outdir: 'dist', plugins: undefined }));
        });

        test('should build nothing of its own while checking', async () => {
            await service.check();

            expect(buildFilesMock).not.toHaveBeenCalled();
            expect(typescript.emit).not.toHaveBeenCalled();
            expect(typescript.emitBundle).not.toHaveBeenCalled();
        });

        test('should reject with what the dependency walk threw', async () => {
            dependenciesMock.mockRejectedValue(new Error('could not resolve src/index.ts'));

            await expect(service.check()).rejects.toThrow('could not resolve src/index.ts');
            expect(typescript.check).not.toHaveBeenCalled();
        });
    });

    describe('the plugin it registers', () => {
        beforeEach(() => configure());

        test('should wire the whole lifecycle up and announce the start', async () => {
            const handlers = await lifecycle();

            expect(handlers.end).toEqual(expect.any(Function));
            expect(handlers.load).toEqual(expect.any(Function));
            expect(handlers.start).toEqual(expect.any(Function));
            expect(handlers.resolve).toEqual(expect.any(Function));
            expect(events.next).toHaveBeenCalledWith(expect.objectContaining({
                type: 'start', esbuild: { version: '0.28.2' }
            }));
        });

        test('should hand the hooks a context naming the variant', async () => {
            const { context } = await lifecycle();

            expect(context).toEqual(expect.objectContaining({
                variantName: 'esm',
                argv: { watch: true },
                logs: { info: [], debug: [], error: [], warning: [] }
            }));
        });

        test('should map the dependencies onto the entry points when it does not bundle', async () => {
            dependenciesMock.mockResolvedValue(<any> {
                metafile: { inputs: { 'src/index.ts': {}, 'src/components/glob.component.ts': {} } }
            });

            const { build } = await lifecycle({ bundle: false });

            expect(build.initialOptions.entryPoints).toEqual({
                index: 'src/index.ts',
                'components/glob.component': 'src/components/glob.component.ts'
            });
        });

        test('should leave the entry points alone when it bundles', async () => {
            const { build } = await lifecycle({ bundle: true });

            expect(build.initialOptions.entryPoints).toEqual({ index: 'src/index.ts' });
        });

        test('should walk the dependencies without its own plugin', async () => {
            await lifecycle();

            expect(dependenciesMock).toHaveBeenCalledWith(expect.objectContaining({ outdir: 'dist', plugins: undefined }));
        });

        test('should name the macros the build is to drop', async () => {
            macrosMock.mockReturnValue(new Set([ '$$dev' ]));
            const { context } = await lifecycle({ define: { DEV: 'false' } });

            expect(macrosMock).toHaveBeenCalledWith(new Set([ 'src/index.ts' ]), { DEV: 'false' });
            expect([ ...context.stage.dropped ]).toEqual([ '$$dev' ]);
            expect([ ...context.stage.reachableFiles ]).toEqual([ 'src/index.ts' ]);
        });

        test('should run the setup hooks once the options are settled', async () => {
            const onSetup = xJet.fn();
            configure({ lifecycle: { onSetup } });
            const { context } = await lifecycle();

            expect(onSetup).toHaveBeenCalledWith(context);
        });

        test('should keep the name of a dependency carrying no extension', async () => {
            dependenciesMock.mockResolvedValue(<any> { metafile: { inputs: { 'src/LICENSE': {}, 'src/.npmrc': {} } } });
            const { build } = await lifecycle({ bundle: false });

            expect(build.initialOptions.entryPoints).toEqual({ LICENSE: 'src/LICENSE', '.npmrc': 'src/.npmrc' });
        });

        test('should report a setup it could not finish', async () => {
            dependenciesMock.mockRejectedValue(new Error('could not resolve src/index.ts'));
            const { context } = await lifecycle();

            expect(context.logs.error).toEqual([
                expect.objectContaining({
                    pluginName: '', text: 'could not resolve src/index.ts'
                })
            ]);
        });

        test('should report a failure esbuild had already reported of its own', async () => {
            dependenciesMock.mockRejectedValue(Object.assign(new Error('Could not resolve "./missing"'), {
                warnings: [],
                errors: [{ text: 'Could not resolve "./missing"', detail: undefined }]
            }));

            const { context } = await lifecycle();

            expect(context.logs.error).toEqual([
                expect.objectContaining({
                    pluginName: '', text: 'Could not resolve "./missing"'
                })
            ]);
        });

        test('should report a failure that was thrown as something other than an error', async () => {
            dependenciesMock.mockRejectedValue('the scan fell over');
            const { context } = await lifecycle();

            expect(context.logs.error).toEqual([ expect.objectContaining({ pluginName: '', text: 'the scan fell over' }) ]);
        });

        test('should run the setup hooks even where the stage before them failed', async () => {
            const onSetup = xJet.fn();
            dependenciesMock.mockRejectedValue(new Error('could not resolve src/index.ts'));
            configure({ lifecycle: { onSetup } });
            const { context } = await lifecycle();

            expect(onSetup).toHaveBeenCalledWith(context);
            expect(context.logs.error).toHaveLength(1);
        });
    });

    describe('the text blocks it injects', () => {
        test('should write each block the configuration names', async () => {
            configure({ banner: { js: '// built by xbuild' }, define: { __VERSION: '1.0.0' } });
            const { build } = await lifecycle();

            expect(build.initialOptions.banner).toEqual({ js: '"// built by xbuild"' });
            expect(build.initialOptions.define).toEqual({ __VERSION: '"1.0.0"' });
        });

        test('should call a block the configuration writes as a function', async () => {
            const footer = xJet.fn(() => 'the end');
            configure({ footer: { js: footer } });
            const { build } = await lifecycle();

            expect(footer).toHaveBeenCalledWith('esm', { watch: true });
            expect(build.initialOptions.footer).toEqual({ js: '"the end"' });
        });

        test('should pass over a block that stands for nothing', async () => {
            configure({ define: { PRESENT: 'yes', MISSING: () => undefined, EMPTIED: null } });
            const { build } = await lifecycle();

            expect(build.initialOptions.define).toEqual({ PRESENT: '"yes"' });
        });

        test('should write into the blocks the options already carry', async () => {
            configure({ banner: { js: 'from the configuration' } });
            const { build } = await lifecycle({ banner: { css: '/* kept */' } });

            expect(build.initialOptions.banner).toEqual({ css: '/* kept */', js: '"from the configuration"' });
        });

        test('should leave the options alone when it names no block', async () => {
            configure();
            const { build } = await lifecycle();

            expect(build.initialOptions.banner).toBeUndefined();
            expect(build.initialOptions.define).toBeUndefined();
        });
    });

    describe('the hooks it dispatches', () => {
        test('should run the lifecycle of the configuration under the variant name', async () => {
            const onStart = xJet.fn(() => undefined);
            configure({ lifecycle: { onStart } });
            const { start, context } = await lifecycle();

            await start();

            expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ context }));
        });

        test('should run the plugins of the configuration before its own lifecycle', async () => {
            const order: Array<string> = [];
            configure({
                plugins: [{ name: 'first', onStart: (): void => void order.push('first') }],
                lifecycle: { onStart: (): void => void order.push('own') }
            });

            const { start } = await lifecycle();
            await start();

            expect(order).toEqual([ 'first', 'own' ]);
        });

        test('should file what a hook reports under the plugin that reported it', async () => {
            configure({
                lifecycle: {
                    onStart: () => ({
                        errors: [{ text: 'a hook error' }],
                        warnings: [{ text: 'a hook warning' }]
                    })
                }
            });

            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([ expect.objectContaining({ text: 'a hook error', pluginName: 'esm' }) ]);
            expect(context.logs.warning).toEqual([ expect.objectContaining({ text: 'a hook warning', pluginName: 'esm' }) ]);
        });

        test('should file what a hook threw against that hook', async () => {
            configure({
                plugins: [
                    {
                        name: 'broken',
                        onStart: (): never => {
                            throw new Error('the hook fell over');
                        }
                    }
                ]
            });

            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([
                expect.objectContaining({
                    text: 'the hook fell over', pluginName: 'broken'
                })
            ]);
        });

        test('should file a hook that failed with something other than an error', async () => {
            configure({ plugins: [{ name: 'broken', onStart: () => Promise.reject('a bare string') }] });
            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([
                expect.objectContaining({
                    text: 'a bare string', pluginName: 'broken'
                })
            ]);
        });

        test('should file what a hook reports under the level the overrides name', async () => {
            configure({
                logOverride: { 'macro-prefix': 'silent', 'empty-glob': 'warning' },
                lifecycle: {
                    onStart: () => ({
                        errors: [
                            { id: 'macro-prefix', text: 'silenced' },
                            { id: 'empty-glob', text: 'lowered' },
                            { id: 'other', text: 'kept' }
                        ]
                    })
                }
            });

            const { start, context } = await lifecycle();
            await start();

            expect(context.overrides).toEqual({ 'macro-prefix': 'silent', 'empty-glob': 'warning' });
            expect(context.logs.error).toEqual([ expect.objectContaining({ text: 'kept' }) ]);
            expect(context.logs.warning).toEqual([ expect.objectContaining({ text: 'lowered' }) ]);
        });

        test('should carry on to the hooks after the one that threw', async () => {
            const onStart = xJet.fn(() => undefined);
            configure({
                plugins: [
                    {
                        name: 'broken',
                        onStart: (): never => {
                            throw new Error('the hook fell over');
                        }
                    }
                ],
                lifecycle: { onStart }
            });

            const { start } = await lifecycle();
            await start();

            expect(onStart).toHaveBeenCalled();
        });
    });

    describe('the start it reports', () => {
        test('should hand esbuild the errors it collected', async () => {
            configure({ lifecycle: { onStart: () => ({ errors: [{ text: 'a hook error' }] }) } });
            const { start } = await lifecycle();

            expect(await start()).toEqual({ errors: [ expect.objectContaining({ text: 'a hook error' }) ] });
        });

        test('should leave the types unchecked when the configuration asks for none', async () => {
            configure();
            const { start } = await lifecycle();
            await start();

            expect(typescript.check).not.toHaveBeenCalled();
        });

        test('should check the types when the configuration asks for them', async () => {
            configure({ types: true });
            const { start } = await lifecycle();
            await start();

            expect(typescript.check).toHaveBeenCalled();
        });

        test('should leave the types unchecked once a hook has failed', async () => {
            configure({ types: true, lifecycle: { onStart: () => ({ errors: [{ text: 'a hook error' }] }) } });
            const { start } = await lifecycle();
            await start();

            expect(typescript.check).not.toHaveBeenCalled();
        });
    });

    describe('the diagnostics it files', () => {
        test('should file each diagnostic under the level of its category', async () => {
            typescript.check.mockReturnValue([
                { category: 1, code: 2304, message: 'an error', file: 'src/index.ts', line: 4, column: 2 },
                { category: 0, code: 6133, message: 'a warning' },
                { category: 2, message: 'a note' },
                { category: 3, message: 'a plain message' }
            ]);

            configure({ types: true });
            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([
                {
                    id: 'ts-2304',
                    text: 'an error',
                    pluginName: 'typescript',
                    location: { file: 'src/index.ts', line: 4, column: 2 },
                    detail: { code: 2304, category: 1, message: 'an error' }
                }
            ]);
            expect(context.logs.warning).toEqual([
                {
                    id: 'ts-6133',
                    text: 'a warning',
                    pluginName: 'typescript',
                    detail: { code: 6133, category: 0, message: 'a warning' }
                }
            ]);
            expect(context.logs.info).toEqual([
                {
                    text: 'a note',
                    pluginName: 'typescript',
                    detail: { code: undefined, category: 2, message: 'a note' }
                }
            ]);
            expect(context.logs.debug).toEqual([
                {
                    text: 'a plain message',
                    pluginName: 'typescript',
                    detail: { code: undefined, category: 3, message: 'a plain message' }
                }
            ]);
        });

        test('should name a diagnostic carrying no code by its text alone', async () => {
            typescript.check.mockReturnValue([{ category: 1, message: 'an error' }]);

            configure({ types: true });
            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([
                {
                    text: 'an error',
                    pluginName: 'typescript',
                    detail: { code: undefined, category: 1, message: 'an error' }
                }
            ]);
        });

        test('should carry the diagnostic itself beside the message it files', async () => {
            typescript.check.mockReturnValue([{ category: 1, code: 2304, message: 'an error', file: 'src/index.ts' }]);

            configure({ types: true });
            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error[0].detail).toEqual({ code: 2304, category: 1, message: 'an error' });
        });

        test('should check the files the setup stage reached', async () => {
            dependenciesMock.mockResolvedValue(<any> {
                metafile: { inputs: { 'src/index.ts': {}, 'src/answer.ts': {} } }
            });

            configure({ types: true });
            const { start } = await lifecycle();
            await start();

            expect(typescript.check).toHaveBeenCalledWith(new Set([ 'src/index.ts', 'src/answer.ts' ]));
        });

        test('should file a type error as an error when it is to fail the build', async () => {
            typescript.check.mockReturnValue([{ category: 1, code: 2304, message: 'an error' }]);

            configure({ types: { failOnError: true } });
            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([
                {
                    id: 'ts-2304',
                    text: 'an error',
                    pluginName: 'typescript',
                    detail: { code: 2304, category: 1, message: 'an error' }
                }
            ]);
            expect(context.logs.warning).toEqual([]);
        });

        test('should file a type error as a warning when it is not to fail the build', async () => {
            typescript.check.mockReturnValue([{ category: 1, code: 2304, message: 'an error' }]);

            configure({ types: { failOnError: false } });
            const { start, context } = await lifecycle();
            await start();

            expect(context.logs.error).toEqual([]);
            expect(context.logs.warning).toEqual([
                {
                    id: 'ts-2304',
                    text: 'an error',
                    pluginName: 'typescript',
                    detail: { code: 2304, category: 1, message: 'an error' }
                }
            ]);
        });
    });

    describe('the modules it resolves', () => {
        test('should hand back what the first hook resolved', async () => {
            configure({
                plugins: [{ name: 'first', onResolve: () => ({ path: '/project/src/index.ts' }) }],
                lifecycle: { onResolve: () => ({ path: '/never' }) }
            });

            const { resolve } = await lifecycle();

            expect(await resolve({ path: 'src/index.ts' })).toEqual({ path: '/project/src/index.ts' });
        });

        test('should consult no hook after the one that resolved', async () => {
            const second = xJet.fn(() => ({ path: '/never' }));
            configure({
                plugins: [{ name: 'first', onResolve: () => ({ path: '/project/src/index.ts' }) }],
                lifecycle: { onResolve: second }
            });

            const { resolve } = await lifecycle();
            await resolve({ path: 'src/index.ts' });

            expect(second).not.toHaveBeenCalled();
        });

        test('should hand back the errors it collected when no hook resolved anything', async () => {
            configure();
            const { resolve } = await lifecycle();

            expect(await resolve({ path: 'src/index.ts' })).toEqual({ errors: [] });
        });
    });

    describe('the files it loads', () => {
        test('should read the file through the cache and expand its macros', async () => {
            transformMock.mockResolvedValue('export const answer = 43;');
            configure();
            const { load, context } = await lifecycle();

            expect(await load({ path: 'src/index.ts' })).toEqual({
                contents: 'export const answer = 43;', loader: 'default', errors: [], warnings: []
            });

            expect(resolveMock).toHaveBeenCalledWith('src/index.ts');
            expect(touchMock).toHaveBeenCalledWith('/project/src/index.ts');
            expect(transformMock).toHaveBeenCalledWith(
                expect.anything(), '/project/src/index.ts', 'export const answer = 42;', context
            );
        });

        test('should rewrite the sources of a build that does not bundle', async () => {
            configure();
            const { load } = await lifecycle({ bundle: false });
            await load({ path: 'src/index.ts' });

            expect(resolveSourceMock).toHaveBeenCalledWith(
                expect.anything(), '/project/src/index.ts', 'export const answer = 42;', typescript
            );
        });

        test('should leave the sources of a bundle alone', async () => {
            configure();
            const { load } = await lifecycle({ bundle: true });
            await load({ path: 'src/index.ts' });

            expect(resolveSourceMock).not.toHaveBeenCalled();
        });

        test('should load a file the cache knows nothing about as empty', async () => {
            touchMock.mockReturnValue(<any> { version: 1, snapshot: undefined });
            configure();
            const { load } = await lifecycle();

            expect(await load({ path: 'missing.ts' })).toEqual(expect.objectContaining({ contents: '' }));
        });

        test('should report a transform it could not run', async () => {
            transformMock.mockRejectedValue(new Error('the macro fell over'));
            configure();
            const { load, context } = await lifecycle();

            await load({ path: 'src/index.ts' });

            expect(context.logs.error).toEqual([
                expect.objectContaining({
                    text: 'the macro fell over', pluginName: 'esm'
                })
            ]);
        });

        test('should take the contents and the loader a hook hands back', async () => {
            configure({ lifecycle: { onLoad: () => ({ contents: 'from the hook', loader: 'ts' }) } });
            const { load } = await lifecycle();

            expect(await load({ path: 'src/index.ts' })).toEqual(expect.objectContaining({
                contents: 'from the hook', loader: 'ts'
            }));
        });

        test('should read the contents a hook hands back as bytes', async () => {
            configure({ lifecycle: { onLoad: () => ({ contents: Buffer.from('from the bytes') }) } });
            const { load } = await lifecycle();

            expect(await load({ path: 'src/index.ts' })).toEqual(expect.objectContaining({ contents: 'from the bytes' }));
        });

        test('should hand each hook what the one before it left', async () => {
            const second = xJet.fn(() => undefined);
            configure({
                plugins: [{ name: 'first', onLoad: () => ({ contents: 'from the first' }) }],
                lifecycle: { onLoad: second }
            });

            const { load } = await lifecycle();
            await load({ path: 'src/index.ts' });

            expect(second).toHaveBeenCalledWith(expect.objectContaining({ contents: 'from the first' }));
        });

        test('should merge what every hook handed back', async () => {
            configure({
                plugins: [{ name: 'first', onLoad: () => ({ resolveDir: 'src' }) }],
                lifecycle: { onLoad: () => ({ pluginName: 'own' }) }
            });

            const { load } = await lifecycle();

            expect(await load({ path: 'src/index.ts' })).toEqual(expect.objectContaining({
                resolveDir: 'src', pluginName: 'own'
            }));
        });
    });

    describe('the end it announces', () => {
        test('should file what esbuild reported against no plugin', async () => {
            configure();
            const { end, context } = await lifecycle();

            await end({
                errors: [{ text: 'an esbuild error' }, { text: 'a plugin error', pluginName: 'other' }],
                warnings: [{ text: 'an esbuild warning' }]
            });

            expect(context.logs.error).toEqual([ expect.objectContaining({ text: 'an esbuild error' }) ]);
            expect(context.logs.warning).toEqual([ expect.objectContaining({ text: 'an esbuild warning' }) ]);
        });

        test('should announce the end with the result and how long it took', async () => {
            configure();
            const { end, context } = await lifecycle();

            await end({ errors: [], warnings: [], outputFiles: [ 'built' ] });

            expect(events.next).toHaveBeenCalledWith(expect.objectContaining({
                type: 'end',
                context,
                duration: expect.any(Number),
                buildResult: expect.objectContaining({ outputFiles: [ 'built' ], errors: [], warnings: [] })
            }));
        });

        test('should run the success hook and the end hook of a build that held', async () => {
            const onEnd = xJet.fn();
            const onSuccess = xJet.fn();
            configure({ lifecycle: { onEnd, onSuccess } });
            const { end } = await lifecycle();

            await end({ errors: [], warnings: [] });

            expect(onSuccess).toHaveBeenCalled();
            expect(onEnd).toHaveBeenCalled();
        });

        test('should keep the success hook of a build that failed', async () => {
            const onEnd = xJet.fn();
            const onSuccess = xJet.fn();
            configure({ lifecycle: { onEnd, onSuccess } });
            const { end } = await lifecycle();

            await end({ errors: [{ text: 'an esbuild error' }], warnings: [] });

            expect(onSuccess).not.toHaveBeenCalled();
            expect(onEnd).toHaveBeenCalled();
        });

        test('should emit no declarations when the configuration asks for none', async () => {
            configure();
            const { end } = await lifecycle();

            await end({ errors: [], warnings: [] });

            expect(typescript.emit).not.toHaveBeenCalled();
            expect(typescript.emitBundle).not.toHaveBeenCalled();
        });

        test('should emit the declarations of a build that does not bundle', async () => {
            configure({ declaration: true });
            const { end } = await lifecycle({ bundle: false });

            await end({ errors: [], warnings: [] });

            expect(typescript.emit).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'dist');
        });

        test('should bundle the declarations of a build that bundles', async () => {
            configure({ declaration: true });
            const { end } = await lifecycle({ bundle: true });

            await end({ errors: [], warnings: [] });

            expect(typescript.emitBundle).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'dist');
        });

        test('should emit the declarations where the configuration names', async () => {
            configure({ declaration: { outDir: 'types' } });
            const { end } = await lifecycle();

            await end({ errors: [], warnings: [] });

            expect(typescript.emit).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'types');
        });

        test('should name no directory for the declarations when nothing names one', async () => {
            configure({ declaration: true });
            const { end } = await lifecycle({ outdir: undefined });

            await end({ errors: [], warnings: [] });

            expect(typescript.emit).toHaveBeenCalledWith({ index: 'src/index.ts' }, undefined);
        });

        test('should emit no declarations for a build that failed', async () => {
            configure({ declaration: true });
            const { end } = await lifecycle();

            await end({ errors: [{ text: 'an esbuild error' }], warnings: [] });

            expect(typescript.emit).not.toHaveBeenCalled();
        });
    });

    describe('the way it is disposed', () => {
        test('should stop watching, drop its typescript module, and forget itself', () => {
            configure();
            service.dispose();

            expect(unsubscribeMock).toHaveBeenCalled();
            expect(typescript.dispose).toHaveBeenCalled();
            expect(VariantService.has('esm')).toBe(false);
        });

        test('should dispose itself when it leaves a using block', () => {
            configure();
            service[Symbol.dispose]();

            expect(VariantService.has('esm')).toBe(false);
        });
    });
});
