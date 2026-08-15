/**
 * Imports
 */

import { existsSync } from 'fs';
import { inject } from '@remotex-labs/xinject';
import { mkdir, writeFile } from 'fs/promises';
import { FilesModel } from '@models/files.model';
import { DeclarationModel } from './declaration.model';

/**
 * Tests
 */

describe('DeclarationModel', () => {
    const cache = inject(FilesModel);
    const sources: Record<string, string> = {};
    const versions: Record<string, number> = {};

    let model: DeclarationModel;
    let service: any;
    let mkdirMock: any;
    let writeFileMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();
        for (const key of Object.keys(sources)) delete sources[key];
        for (const key of Object.keys(versions)) delete versions[key];

        xJet.spyOn(cache, 'resolve').mockImplementation(
            (path: string) => path.startsWith('/') ? path : `/project/${ path }`
        );

        xJet.spyOn(cache, 'touch').mockImplementation((path: string) => <any> {
            version: versions[path] ?? 1,
            snapshot: sources[path] === undefined ? undefined : { text: sources[path] }
        });

        xJet.mock(existsSync).mockReturnValue(true);
        mkdirMock = xJet.mock(mkdir).mockResolvedValue(<any> undefined);
        writeFileMock = xJet.mock(writeFile).mockResolvedValue(<any> undefined);

        service = {
            config: { options: { rootDir: '/project/src', outDir: 'dist' } },
            resolve: (specifier: string) => {
                if (!specifier.startsWith('.'))
                    return { isExternalLibraryImport: true, extension: '.d.ts', relativeFileName: '', resolvedFileName: '' };

                const name = specifier.replace(/^\.\//, '');
                const extension = /\.[cm]?tsx?$/.exec(name)?.[0] ?? '.ts';
                const file = name.endsWith(extension) ? name : `${ name }${ extension }`;

                return {
                    extension,
                    isExternalLibraryImport: false,
                    relativeFileName: `./${ file }`,
                    resolvedFileName: `/project/src/${ file }`
                };
            }
        };

        model = new DeclarationModel(service);
    });

    describe('touch', () => {
        test('should build an entry from the declarations the file emits', () => {
            sources['/project/src/index.ts'] = 'export const version: string = "1";';

            const entry = model.touch('src/index.ts');

            expect(entry.version).toBe(1);
            expect(entry.content).toContain('declare const version: string;');
            expect(entry.content).not.toContain('export declare');
            expect(entry.declaration).toContain('export declare const version: string;');
            expect(entry.projectExports.exports).toEqual([{ name: 'version' }]);
        });

        test('should serve the cached entry while the file version stands still', () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            const entry = model.touch('src/index.ts');

            expect(model.touch('/project/src/index.ts')).toBe(entry);
            expect(model.cache.size).toBe(1);
        });

        test('should rebuild the entry once the file version advances', () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            const entry = model.touch('src/index.ts');

            versions['/project/src/index.ts'] = 2;
            sources['/project/src/index.ts'] = 'export const b: string = "2";';

            const rebuilt = model.touch('src/index.ts');

            expect(rebuilt).not.toBe(entry);
            expect(rebuilt.content).toContain('declare const b: string;');
        });

        test('should build from empty content when the file holds nothing readable', () => {
            const entry = model.touch('src/gone.ts');

            expect(entry.content).toBe('');
            expect(entry.projectDependencies.size).toBe(0);
        });
    });

    describe('imports', () => {
        test('should record a project import as a dependency and point it at the emitted declaration', () => {
            sources['/project/src/index.ts'] = 'import type { Builder } from "./builder";\nexport const make: Builder = 1 as never;';

            const entry = model.touch('src/index.ts');

            expect([ ...entry.projectDependencies ]).toEqual([ '/project/src/builder.ts' ]);
            expect(entry.declaration).toContain('\'./builder.d.ts\'');
            expect(entry.content).not.toContain('builder');
        });

        test('should record the bindings of a package import', () => {
            sources['/project/src/index.ts'] = 'import ts, { type Program } from "typescript";\nexport const p: Program = 1 as never;\nexport const n: ts.Node = 1 as never;';

            const entry = model.touch('src/index.ts');

            expect(entry.packageImports.typescript).toEqual({
                default: 'ts', named: [{ name: 'Program' }]
            });
            expect(entry.projectDependencies.size).toBe(0);
        });

        test('should record a side-effect import', () => {
            sources['/project/src/index.ts'] = 'import "polyfill";\nexport const a: string = "1";';

            expect(model.touch('src/index.ts').packageImports.polyfill).toEqual({ side: true });
        });

        test('should record a namespace import', () => {
            sources['/project/src/index.ts'] = 'import * as ns from "pkg";\nexport const a: ns.Thing = 1 as never;';

            expect(model.touch('src/index.ts').packageImports.pkg).toEqual({ namespaces: [ 'ns' ] });
        });

        test('should record the alias a named import was bound to', () => {
            sources['/project/src/index.ts'] = 'import { type A as B } from "pkg";\nexport const a: B = 1 as never;';

            expect(model.touch('src/index.ts').packageImports.pkg).toEqual({ named: [{ name: 'A', alias: 'B' }] });
        });

        test('should record an external import-equals as a namespace import', () => {
            sources['/project/src/index.ts'] = 'import fs = require("fs");\nexport const a: fs.Stats = 1 as never;';

            expect(model.touch('src/index.ts').packageImports.fs).toEqual({ namespaces: [ 'fs' ] });
        });

        test('should keep an import-equals that aliases a local name', () => {
            sources['/project/src/index.ts'] = 'declare namespace A { const b: string; }\nimport C = A.b;\nexport const d: typeof C = 1 as never;';

            expect(model.touch('src/index.ts').content).toContain('import C = A.b;');
        });
    });

    describe('exports', () => {
        test('should record a star re-export of a project file', () => {
            sources['/project/src/index.ts'] = 'export * from "./builder";';

            const entry = model.touch('src/index.ts');

            expect([ ...entry.projectExports.star ]).toEqual([ '/project/src/builder.ts' ]);
            expect(entry.content).not.toContain('export *');
        });

        test('should record a namespace re-export of a project file under its name', () => {
            sources['/project/src/index.ts'] = 'export * as api from "./builder";';

            expect(model.touch('src/index.ts').projectExports.namespace).toEqual({ api: '/project/src/builder.ts' });
        });

        test('should record a star re-export of a package', () => {
            sources['/project/src/index.ts'] = 'export * from "pkg";';

            expect(model.touch('src/index.ts').packageExports.pkg).toEqual({ star: true });
        });

        test('should record a named re-export of a package', () => {
            sources['/project/src/index.ts'] = 'export { type A as B } from "pkg";';

            expect(model.touch('src/index.ts').packageExports.pkg).toEqual({ named: [{ name: 'A', alias: 'B' }] });
        });

        test('should record a named export list as the file own surface', () => {
            sources['/project/src/index.ts'] = 'declare const a: string;\nexport { a };';

            const entry = model.touch('src/index.ts');

            expect(entry.projectExports.exports).toEqual([{ name: 'a' }]);
            expect(entry.content).not.toContain('export {');
        });

        test('should keep a named default export as an ambient declaration', () => {
            sources['/project/src/index.ts'] = 'export default class Foo { a: string = "1"; }';

            const entry = model.touch('src/index.ts');

            expect(entry.content).toContain('declare class Foo');
            expect(entry.projectExports.exports).toEqual([{ name: 'Foo', alias: 'default' }]);
        });

        test('should drop an anonymous default export', () => {
            sources['/project/src/index.ts'] = 'declare const a: string;\nexport default a;';

            const entry = model.touch('src/index.ts');

            expect(entry.content).not.toContain('export default');
            expect(entry.projectExports.exports).toEqual([{ name: 'a', alias: 'default' }]);
        });

        test('should drop an export assignment and a namespace export declaration', () => {
            sources['/project/src/index.ts'] = 'declare const a: string;\nexport = a;';

            expect(model.touch('src/index.ts').content).not.toContain('export =');
        });
    });

    describe('comments', () => {
        test('should drop a doc comment the stripping left attached to nothing', () => {
            sources['/project/src/index.ts'] = '/**\n * The builder.\n */\nimport type { B } from "./builder";\nexport const a: B = 1 as never;';

            expect(model.touch('src/index.ts').content).not.toContain('The builder.');
        });

        test('should keep a doc comment attached to a surviving declaration', () => {
            sources['/project/src/index.ts'] = '/**\n * The version.\n */\nexport const version: string = "1";';

            expect(model.touch('src/index.ts').content).toContain('The version.');
        });
    });

    describe('emit', () => {
        test('should write one declaration per project file the entry reaches', async () => {
            sources['/project/src/index.ts'] = 'import type { B } from "./builder";\nexport const a: B = 1 as never;';
            sources['/project/src/builder.ts'] = 'export const b: string = "1";';

            await expect(model.emit({ index: 'src/index.ts' }))
                .resolves.toEqual([ '/project/dist/index.d.ts', '/project/dist/builder.d.ts' ]);

            expect(writeFileMock).toHaveBeenCalledTimes(2);
            expect(mkdirMock).toHaveBeenCalledWith('/project/dist', { recursive: true });
        });

        test('should name an entry after the key it was given', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';

            await expect(model.emit({ main: 'src/index.ts' })).resolves.toEqual([ '/project/dist/main.d.ts' ]);
        });

        test('should nest an entry whose key carries a directory', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';

            await expect(model.emit({ 'types/main': 'src/index.ts' }))
                .resolves.toEqual([ '/project/dist/types/main.d.ts' ]);
            expect(mkdirMock).toHaveBeenCalledWith('/project/dist/types', { recursive: true });
        });

        test('should tell two entries of the same file name apart by their keys', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            sources['/project/src/utils/index.ts'] = 'export const b: string = "2";';

            await expect(model.emit({ index: 'src/index.ts', 'utils/index': 'src/utils/index.ts' }))
                .resolves.toEqual([ '/project/dist/utils/index.d.ts', '/project/dist/index.d.ts' ]);
        });

        test('should leave a file alone whose entry has not changed since the last emit', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            await model.emit({ index: 'src/index.ts' });

            await expect(model.emit({ index: 'src/index.ts' })).resolves.toEqual([]);
            expect(writeFileMock).toHaveBeenCalledTimes(1);
        });

        test('should write everything again when it emits into another directory', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            await model.emit({ index: 'src/index.ts' });

            await expect(model.emit({ index: 'src/index.ts' }, 'types'))
                .resolves.toEqual([ '/project/types/index.d.ts' ]);
        });

        test('should skip a declaration input', async () => {
            sources['/project/src/index.d.ts'] = 'export declare const a: string;';

            await expect(model.emit({ index: 'src/index.d.ts' })).resolves.toEqual([]);
            expect(writeFileMock).not.toHaveBeenCalled();
        });

        test('should touch the disk not at all when there is nothing to write', async () => {
            await expect(model.emit({})).resolves.toEqual([]);
            expect(mkdirMock).not.toHaveBeenCalled();
            expect(writeFileMock).not.toHaveBeenCalled();
        });

        test('should lay the output beside its source when nothing configures an output directory', async () => {
            service.config.options = {};
            sources['/project/src/index.ts'] = 'export const a: string = "1";';

            await expect(model.emit({ index: 'src/index.ts' })).resolves.toEqual([ '/project/src/index.d.ts' ]);
        });

        test('should let declarationDir win over outDir', async () => {
            service.config.options.declarationDir = 'types';
            sources['/project/src/index.ts'] = 'export const a: string = "1";';

            await expect(model.emit({ index: 'src/index.ts' })).resolves.toEqual([ '/project/types/index.d.ts' ]);
        });

        test('should name an entry .d.ts whatever module flavor its own extension carried', async () => {
            sources['/project/src/a.mts'] = 'export const a: string = "1";';

            await expect(model.emit({ a: 'src/a.mts' })).resolves.toEqual([ '/project/dist/a.d.ts' ]);
        });

        test('should mirror the source tree for the files an entry reaches', async () => {
            sources['/project/src/index.ts'] = 'import type { B } from "./models/a";\nexport const a: B = 1 as never;';
            sources['/project/src/models/a.ts'] = 'export type B = string;';

            await expect(model.emit({ index: 'src/index.ts' }))
                .resolves.toEqual([ '/project/dist/index.d.ts', '/project/dist/models/a.d.ts' ]);
        });

        test('should keep the module flavor of a file an entry reaches', async () => {
            sources['/project/src/index.ts'] = 'import type { B } from "./lib.mts";\nexport const a: B = 1 as never;';
            sources['/project/src/lib.mts'] = 'export type B = string;';

            await expect(model.emit({ index: 'src/index.ts' }))
                .resolves.toEqual([ '/project/dist/index.d.ts', '/project/dist/lib.d.mts' ]);
        });

        test('should write the standalone declaration of each file', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            await model.emit({ index: 'src/index.ts' });

            expect(writeFileMock).toHaveBeenCalledWith(
                '/project/dist/index.d.ts', model.touch('src/index.ts').declaration, 'utf-8'
            );
        });
    });

    describe('emitBundle', () => {
        test('should write one bundle per entry point, named after its key', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';

            await expect(model.emitBundle({ main: 'src/index.ts' })).resolves.toEqual([ '/project/dist/main.d.ts' ]);
        });

        test('should tell two entries of the same file name apart by their keys', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            sources['/project/src/utils/index.ts'] = 'export const b: string = "2";';

            await expect(model.emitBundle({ index: 'src/index.ts', 'utils/index': 'src/utils/index.ts' }))
                .resolves.toEqual([ '/project/dist/index.d.ts', '/project/dist/utils/index.d.ts' ]);
            expect(mkdirMock).toHaveBeenCalledWith('/project/dist/utils', { recursive: true });
        });

        test('should land in the working directory when nothing configures an output one', async () => {
            service.config.options = {};
            sources['/project/src/index.ts'] = 'export const a: string = "1";';

            await expect(model.emitBundle({ index: 'src/index.ts' })).resolves.toEqual([ '/project/index.d.ts' ]);
        });

        test('should open the bundle with the generated-file header', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            await model.emitBundle({ index: 'src/index.ts' });

            expect(writeFileMock.mock.calls[0][1]).toContain('automatically generated by xBuild');
        });

        test('should inline the declarations of the whole closure, dependencies first', async () => {
            sources['/project/src/index.ts'] = 'import type { B } from "./builder";\nexport const a: B = 1 as never;';
            sources['/project/src/builder.ts'] = 'export type B = string;';
            await model.emitBundle({ index: 'src/index.ts' });

            const bundle = writeFileMock.mock.calls[0][1];

            expect(bundle.indexOf('type B')).toBeLessThan(bundle.indexOf('declare const a'));
            expect(bundle).toContain('export {\n\ta\n};');
        });

        test('should merge the package imports of every inlined file', async () => {
            sources['/project/src/index.ts'] = 'import type { A } from "pkg";\nimport type { B } from "./builder";\nexport const a: A | B = 1 as never;';
            sources['/project/src/builder.ts'] = 'import type { C } from "pkg";\nexport type B = C;';
            await model.emitBundle({ index: 'src/index.ts' });

            expect(writeFileMock.mock.calls[0][1]).toContain('import { A, C } from \'pkg\';');
        });

        test('should follow a star re-export of a project file into the surface', async () => {
            sources['/project/src/index.ts'] = 'export * from "./builder";';
            sources['/project/src/builder.ts'] = 'export const b: string = "1";';
            await model.emitBundle({ index: 'src/index.ts' });

            expect(writeFileMock.mock.calls[0][1]).toContain('export {\n\tb\n};');
        });

        test('should pass a package re-export through as a statement', async () => {
            sources['/project/src/index.ts'] = 'export * from "pkg";';
            await model.emitBundle({ index: 'src/index.ts' });

            expect(writeFileMock.mock.calls[0][1]).toContain('export * from \'pkg\';');
        });

        test('should close a bundle that exposes nothing with an empty export clause', async () => {
            sources['/project/src/index.ts'] = 'declare const a: string;';
            await model.emitBundle({ index: 'src/index.ts' });

            expect(writeFileMock.mock.calls[0][1]).toContain('export {};');
        });

        test('should walk a dependency cycle once', async () => {
            sources['/project/src/index.ts'] = 'import type { B } from "./builder";\nexport const a: B = 1 as never;';
            sources['/project/src/builder.ts'] = 'import type { A } from "./index";\nexport type B = A;';
            await model.emitBundle({ index: 'src/index.ts' });

            const bundle = writeFileMock.mock.calls[0][1];

            expect(bundle.split('type B').length - 1).toBe(1);
        });

        test('should rebuild the bundle on every call', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            await model.emitBundle({ index: 'src/index.ts' });

            await expect(model.emitBundle({ index: 'src/index.ts' })).resolves.toEqual([ '/project/dist/index.d.ts' ]);
            expect(writeFileMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('clear', () => {
        test('should drop the cached entries and the record of what reached the disk', async () => {
            sources['/project/src/index.ts'] = 'export const a: string = "1";';
            await model.emit({ index: 'src/index.ts' });

            model.clear();

            expect(model.cache.size).toBe(0);
            await expect(model.emit({ index: 'src/index.ts' })).resolves.toEqual([ '/project/dist/index.d.ts' ]);
        });
    });
});
