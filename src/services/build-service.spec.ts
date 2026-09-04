/**
 * Imports
 */

import { BuildService } from './build.service';
import { inject } from '@remotex-labs/xinject';
import { VariantService } from '@services/variant.service';
import { FrameworkService } from '@services/framework.service';
import { ConfigurationService } from '@services/configuration.service';
import { TypescriptService } from '@typescript/services/typescript.service';

/**
 * Tests
 */

describe('BuildService', () => {
    let order: Array<string>;
    let config: any;
    let files: any;
    let service: any;
    let framework: any;
    let configuration: any;
    let notify: (config: unknown) => void;
    let buildMock: any;
    let checkMock: any;
    let reloadMock: any;

    /**
     * Hands the service a configuration, which is what gives it its variants.
     */

    function declareVariants(variants: Record<string, unknown>): void {
        config = { variants };
        notify(config);
    }

    /**
     * The result a variant that wrote something hands back.
     */

    function built(name: string): any {
        return { variant: name, errors: [], metafile: { outputs: { [`dist/${ name }.js`]: {} } } };
    }

    /**
     * Leaves the named variants writing nothing, the way a build that fell over comes back.
     */

    function failing(...names: Array<string>): void {
        buildMock.mockImplementation(async function (this: any) {
            order.push(this.name);
            if (names.includes(this.name)) return <any> { variant: this.name, errors: [{ text: 'broken' }] };

            return <any> built(this.name);
        });
    }

    beforeEach(() => {
        xJet.restoreAllMocks();
        (<any> VariantService).instances.clear();

        order = [];
        config = { variants: {} };
        files = { touch: xJet.fn(() => ({ snapshot: undefined })), resolve: xJet.fn((path: string) => path) };
        framework = { getSourceMap: xJet.fn(() => undefined), isFrameworkFile: xJet.fn(() => false) };

        configuration = {
            patch: xJet.fn(),
            reload: xJet.fn(),
            getValue: xJet.fn(() => config),
            subscribe: xJet.fn((next: any) => {
                notify = next;

                return xJet.fn();
            }),
            select: xJet.fn(() => ({ subscribe: xJet.fn(() => xJet.fn()) }))
        };

        xJet.mock(inject).mockImplementation(<any> ((token: unknown) => {
            if (token === ConfigurationService) return configuration;
            if (token === FrameworkService) return framework;

            return files;
        }));

        buildMock = xJet.spyOn(VariantService.prototype, 'build').mockImplementation(async function (this: any) {
            order.push(this.name);

            return <any> built(this.name);
        });

        checkMock = xJet.spyOn(VariantService.prototype, 'check').mockResolvedValue([]);
        reloadMock = xJet.spyOn(TypescriptService, 'reload').mockReturnValue([]);
        service = new BuildService({ variants: {} } as any, { watch: true });
    });

    afterEach(() => {
        for (const variant of [ ...VariantService.get() ]) variant.dispose();
    });

    describe('the configuration it holds', () => {
        test('should write the configuration it was given', () => {
            expect(configuration.patch).toHaveBeenCalledWith({ variants: {} });
        });

        test('should follow the configuration from then on', () => {
            expect(configuration.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });

        test('should reload the configuration it is handed a new one', () => {
            service.configuration = { verbose: true };

            expect(configuration.reload).toHaveBeenCalledWith({ verbose: true });
        });
    });

    describe('the variants it declares', () => {
        test('should raise a variant for every name the configuration declares', () => {
            declareVariants({ esm: {}, cjs: {} });

            expect([ ...VariantService.get() ].map(variant => variant.name)).toEqual([ 'esm', 'cjs' ]);
        });

        test('should hand each variant the arguments the build was started with', () => {
            declareVariants({ esm: {} });
            const [ variant ] = [ ...VariantService.get() ];

            expect((<any> variant).argv).toEqual({ watch: true });
        });

        test('should leave a variant it already raised alone', () => {
            declareVariants({ esm: {} });
            const [ first ] = [ ...VariantService.get() ];

            declareVariants({ esm: {}, cjs: {} });
            const raised = [ ...VariantService.get() ];

            expect(raised[0]).toBe(first);
            expect(raised.map(variant => variant.name)).toEqual([ 'esm', 'cjs' ]);
        });

        test('should raise nothing for a configuration declaring no variant', () => {
            declareVariants({});

            expect([ ...VariantService.get() ]).toEqual([]);
        });

        test('should hand each variant nothing where the caller named no arguments', () => {
            (<any> VariantService).instances.clear();
            new BuildService(<any> { variants: {} });
            declareVariants({ esm: {} });
            const [ variant ] = [ ...VariantService.get() ];

            expect((<any> variant).argv).toEqual({});
        });

        test('should report a configuration that is not there at all', () => {
            expect(() => notify(undefined)).toThrow('Variants are not defined in the configuration');
        });
    });

    describe('the events it hands out', () => {
        test('should hand out the stream its variants report on', () => {
            declareVariants({ esm: {} });
            const [ variant ] = [ ...VariantService.get() ];

            expect(service.pipe()).toBe((<any> variant).events$);
        });

        test('should hand a listener what a variant reported', () => {
            declareVariants({ esm: {} });
            const [ variant ] = [ ...VariantService.get() ];
            const listener = xJet.fn();

            service.subscribe(listener);
            (<any> variant).events$.next({ type: 'end' });

            expect(listener).toHaveBeenCalledWith({ type: 'end' });
        });
    });

    describe('the builds it runs', () => {
        test('should build every variant it holds', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.build()).toEqual([ built('esm'), built('cjs') ]);
            expect(order).toEqual([ 'esm', 'cjs' ]);
        });

        test('should build nothing when it holds no variant', async () => {
            expect(await service.build()).toEqual([]);
            expect(buildMock).not.toHaveBeenCalled();
        });

        test('should build what a variant depends on before the variant itself', async () => {
            declareVariants({ app: { dependOn: [ 'types' ] }, types: {} });

            await service.build();

            expect(order).toEqual([ 'types', 'app' ]);
        });

        test('should read a single dependency named on its own', async () => {
            declareVariants({ app: { dependOn: 'types' }, types: {} });

            await service.build();

            expect(order).toEqual([ 'types', 'app' ]);
        });

        test('should walk a chain of dependencies from its far end', async () => {
            declareVariants({ app: { dependOn: 'lib' }, lib: { dependOn: 'types' }, types: {} });

            await service.build();

            expect(order).toEqual([ 'types', 'lib', 'app' ]);
        });

        test('should build a shared dependency once', async () => {
            declareVariants({ esm: { dependOn: 'types' }, cjs: { dependOn: 'types' }, types: {} });

            const results = await service.build();

            expect(order).toEqual([ 'types', 'esm', 'cjs' ]);
            expect(results).toEqual([ built('esm'), built('cjs'), built('types') ]);
        });

        test('should hand the same result to everything depending on one variant', async () => {
            declareVariants({ esm: { dependOn: 'types' }, cjs: { dependOn: 'types' }, types: {} });
            const [ , , types ] = await service.build();

            expect(buildMock).toHaveBeenCalledTimes(3);
            expect(types).toEqual(built('types'));
        });

        test('should report a dependency that is no variant of its own', async () => {
            declareVariants({ app: { dependOn: 'missing' } });

            await expect(service.build()).rejects
                .toThrow('Variant "app" depends on "missing", which is not a variant');
        });

        test('should report a circle of dependencies by the way round it', async () => {
            declareVariants({ app: { dependOn: 'lib' }, lib: { dependOn: 'app' } });

            await expect(service.build()).rejects.toThrow('Circular dependency detected: app → lib → app');
        });

        test('should report a variant depending on itself', async () => {
            declareVariants({ app: { dependOn: 'app' } });

            await expect(service.build()).rejects.toThrow('Circular dependency detected: app → app');
        });

        test('should build nothing at all when the graph does not hold', async () => {
            declareVariants({ esm: {}, app: { dependOn: 'missing' } });

            await expect(service.build()).rejects.toThrow('which is not a variant');
            expect(buildMock).not.toHaveBeenCalled();
        });

        test('should not build a variant whose dependency wrote nothing', async () => {
            failing('types');
            declareVariants({ app: { dependOn: 'types' }, types: {} });
            const [ app ] = await service.build();

            expect(order).toEqual([ 'types' ]);
            expect(app.errors).toEqual([
                expect.objectContaining({
                    id: 'dependency-failed',
                    text: 'Variant "app" was not built, because "types" failed'
                })
            ]);
        });

        test('should report an end for a variant it skipped', async () => {
            failing('types');
            const listener = xJet.fn();
            declareVariants({ app: { dependOn: 'types', esbuild: { format: 'esm' } }, types: {} });
            service.subscribe(listener);

            const [ app ] = await service.build();

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                type: 'end',
                duration: 0,
                buildResult: app,
                context: expect.objectContaining({
                    variantName: 'app',
                    options: { format: 'esm' },
                    logs: expect.objectContaining({ error: app.errors })
                })
            }));
        });

        test('should name every dependency that failed on the variant it skipped', async () => {
            failing('types', 'lib');
            declareVariants({ app: { dependOn: [ 'types', 'lib' ] }, types: {}, lib: {} });
            const [ app ] = await service.build();

            expect(app.errors[0].text).toBe('Variant "app" was not built, because "types", "lib" failed');
        });

        test('should skip what depends on a variant that was skipped itself', async () => {
            failing('types');
            declareVariants({ app: { dependOn: 'lib' }, lib: { dependOn: 'types' }, types: {} });
            const [ app, lib ] = await service.build();

            expect(order).toEqual([ 'types' ]);
            expect(lib.errors[0].text).toBe('Variant "lib" was not built, because "types" failed');
            expect(app.errors[0].text).toBe('Variant "app" was not built, because "lib" failed');
        });

        test('should build a variant whose dependency only reported warnings', async () => {
            buildMock.mockImplementation(async function (this: any) {
                order.push(this.name);

                return <any> { ...built(this.name), warnings: [{ text: 'careful' }] };
            });

            declareVariants({ app: { dependOn: 'types' }, types: {} });

            await service.build();

            expect(order).toEqual([ 'types', 'app' ]);
        });

        test('should build a variant whose dependency reported errors and still wrote something', async () => {
            buildMock.mockImplementation(async function (this: any) {
                order.push(this.name);

                return <any> { ...built(this.name), errors: this.name === 'types' ? [{ text: 'broken' }] : [] };
            });

            declareVariants({ app: { dependOn: 'types' }, types: {} });

            await service.build();

            expect(order).toEqual([ 'types', 'app' ]);
        });

        test('should read the dependencies as the configuration stands when it builds', async () => {
            declareVariants({ app: {}, types: {} });
            config.variants.app.dependOn = 'types';

            await service.build();

            expect(order).toEqual([ 'types', 'app' ]);
        });

        test('should leave a skipped variant carrying no output and nothing at any other level', async () => {
            failing('types');
            declareVariants({ app: { dependOn: 'types' }, types: {} });
            const [ app ] = await service.build();

            expect(app.metafile).toBeUndefined();
            expect(app.info).toEqual([]);
            expect(app.debugs).toEqual([]);
            expect(app.warnings).toEqual([]);
        });

        test('should shape a skipped variant\'s context from the configuration entry it holds', async () => {
            failing('types');
            const listener = xJet.fn();
            declareVariants({
                app: { dependOn: 'types', logOverride: { 'ts-2304': 'silent' } },
                types: {}
            });
            service.subscribe(listener);

            await service.build();

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                context: expect.objectContaining({
                    argv: { watch: true },
                    options: {},
                    overrides: { 'ts-2304': 'silent' },
                    stage: expect.objectContaining({ dropped: new Set(), reachableFiles: new Set() })
                })
            }));
        });

        test('should shape a skipped variant\'s context from nothing where the configuration dropped its entry', async () => {
            failing('types');
            const listener = xJet.fn();
            declareVariants({ app: { dependOn: 'types', esbuild: { format: 'esm' } }, types: {} });
            service.subscribe(listener);

            const building = service.build();
            delete config.variants.app;
            await building;

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                context: expect.objectContaining({ variantName: 'app', options: {}, overrides: {} })
            }));
        });
    });

    describe('the variants it is asked to build', () => {
        test('should build the variants named and leave the rest alone', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.build([ 'esm' ])).toEqual([ built('esm') ]);
            expect(order).toEqual([ 'esm' ]);
        });

        test('should hand the results back in the order they were named', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.build([ 'cjs', 'esm' ])).toEqual([ built('cjs'), built('esm') ]);
        });

        test('should build what a named variant waits for while leaving it out of the results', async () => {
            declareVariants({ app: { dependOn: 'types' }, types: {} });

            expect(await service.build([ 'app' ])).toEqual([ built('app') ]);
            expect(order).toEqual([ 'types', 'app' ]);
        });

        test('should pass over a name no variant answers to', async () => {
            declareVariants({ esm: {} });

            expect(await service.build([ 'umd' ])).toEqual([]);
            expect(buildMock).not.toHaveBeenCalled();
        });

        test('should build the names it knows beside the ones it does not', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.build([ 'umd', 'cjs' ])).toEqual([ built('cjs') ]);
            expect(order).toEqual([ 'cjs' ]);
        });

        test('should build nothing when the list names nothing at all', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.build([])).toEqual([]);
            expect(buildMock).not.toHaveBeenCalled();
        });

        test('should skip a named variant whose dependency wrote nothing', async () => {
            failing('types');
            declareVariants({ app: { dependOn: 'types' }, types: {} });
            const [ app ] = await service.build([ 'app' ]);

            expect(order).toEqual([ 'types' ]);
            expect(app.errors[0].text).toBe('Variant "app" was not built, because "types" failed');
        });

        test('should report a broken graph it reached through a name', async () => {
            declareVariants({ esm: {}, app: { dependOn: 'missing' } });

            await expect(service.build([ 'app' ])).rejects.toThrow('which is not a variant');
            expect(buildMock).not.toHaveBeenCalled();
        });

        test('should leave a graph it was not asked to walk unread', async () => {
            declareVariants({ esm: {}, app: { dependOn: 'missing' } });

            expect(await service.build([ 'esm' ])).toEqual([ built('esm') ]);
        });
    });

    describe('the types it checks', () => {
        test('should check every variant and key the diagnostics by name', async () => {
            checkMock.mockImplementation(async function (this: any) {
                return <any> [{ message: `${ this.name } diagnostic` }];
            });

            declareVariants({ esm: {}, cjs: {} });

            expect(await service.typeChack()).toEqual({
                esm: [{ message: 'esm diagnostic' }],
                cjs: [{ message: 'cjs diagnostic' }]
            });
        });

        test('should check nothing when it holds no variant', async () => {
            expect(await service.typeChack()).toEqual({});
            expect(checkMock).not.toHaveBeenCalled();
        });

        test('should check the variants named and leave the rest alone', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.typeChack([ 'esm' ])).toEqual({ esm: [] });
            expect(checkMock).toHaveBeenCalledTimes(1);
        });

        test('should leave what a named variant waits for unchecked', async () => {
            declareVariants({ app: { dependOn: 'types' }, types: {} });

            expect(await service.typeChack([ 'app' ])).toEqual({ app: [] });
        });

        test('should pass over a name no variant answers to', async () => {
            declareVariants({ esm: {} });

            expect(await service.typeChack([ 'umd' ])).toEqual({});
            expect(checkMock).not.toHaveBeenCalled();
        });

        test('should check nothing when the list names nothing at all', async () => {
            declareVariants({ esm: {}, cjs: {} });

            expect(await service.typeChack([])).toEqual({});
            expect(checkMock).not.toHaveBeenCalled();
        });
    });

    describe('the sources it reloads', () => {
        test('should reload the typescript projects', async () => {
            await service.reload();

            expect(reloadMock).toHaveBeenCalled();
        });

        test('should hand back nothing of what it reparsed', async () => {
            reloadMock.mockReturnValue(<any> [ 'src/index.ts' ]);

            await expect(service.reload()).resolves.toBeUndefined();
        });
    });
});
