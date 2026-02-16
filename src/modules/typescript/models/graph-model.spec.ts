/**
 * Import will remove at compile time
 */

import type { MockState } from '@remotex-labs/xjet';
import type { FilesModel } from '@typescript/models/files.model';

/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from 'path';
import { join } from 'path/posix';
import { GraphModel } from '@typescript/models/graph.model';

/**
 * Tests
 */

describe('GraphModel', () => {
    let graphModel: GraphModel;
    let filesModel: FilesModel;
    let resolveModuleNameMock: MockState;

    const fakeFileName = '/project/root/src/index.ts';

    beforeEach(() => {
        xJet.resetAllMocks();

        graphModel = new GraphModel();
        filesModel = (graphModel as any).filesCache;

        xJet.mock(resolve).mockImplementation((...args: string[]) => {
            return join('/project/root/', ...args);
        });

        xJet.mock(ts.createSourceFile);
        resolveModuleNameMock = xJet.mock(ts.resolveModuleName);
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    function prepareFileSnapshot(fileName: string, version = 1) {
        filesModel.touchFile(fileName);
        const entry = filesModel.getSnapshot(fileName)!;
        entry.version = version;
    }

    describe('clear & get', () => {
        test('get returns undefined for unresolved path', () => {
            expect(graphModel.get('./src/unknown.ts')).toBeUndefined();
        });
    });

    describe('scan – caching & version check', () => {
        test('returns cached node when version matches', () => {
            prepareFileSnapshot(fakeFileName);

            const sourceFile = ts.createSourceFile(fakeFileName, '', ts.ScriptTarget.Latest);

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: 'export declare const value: string;' }]
            });

            const host = { resolveModuleName: () => null } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const first = graphModel.scan(sourceFile, service, host);
            const second = graphModel.scan(sourceFile, service, host);

            expect(second).toBe(first);
            expect(getEmitOutputMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('internal dependencies (local imports & re-exports)', () => {
        test('collects internal dependencies from named imports', () => {
            prepareFileSnapshot(fakeFileName);

            const declaration = `
                import { Util } from './util';
                export declare const util: typeof Util;
            `;

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: declaration }]
            });

            resolveModuleNameMock.mockReturnValue({
                resolvedModule: { resolvedFileName: '/project/root/src/utils.ts' }
            });

            const source = ts.createSourceFile(fakeFileName, 'import { util } from \'./utils\';', ts.ScriptTarget.Latest);
            const host = { resolveModuleName: resolveModuleNameMock } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const node = graphModel.scan(source, service, host);

            expect(node.internalDeps.has('/project/root/src/utils.ts')).toBe(true);
        });

        test('collects internal star re-exports', () => {
            prepareFileSnapshot(fakeFileName);

            const declaration = 'export * from \'./helpers\';';

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: declaration }]
            });

            resolveModuleNameMock.mockReturnValue({
                resolvedModule: { resolvedFileName: '/project/root/src/helpers.ts' }
            });

            const source = ts.createSourceFile(fakeFileName, 'export * from \'./helpers\';', ts.ScriptTarget.Latest);
            const host = { resolveModuleName: resolveModuleNameMock } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const node = graphModel.scan(source, service, host);

            expect(node.internalExports.star).toContain('/project/root/src/helpers.ts');
            expect(node.internalDeps.has('/project/root/src/helpers.ts')).toBe(true);
        });
    });

    describe('external imports & exports', () => {
        test('collects external default & named imports', () => {
            prepareFileSnapshot(fakeFileName);

            resolveModuleNameMock.mockReturnValue({ resolvedModule: null });

            const declaration = `
                import React from 'react';
                import { Button, useTheme } from 'ui-lib';
                export declare const Button: typeof Button;
                export declare function useTheme(): string;
            `;

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: declaration }]
            });

            const source = ts.createSourceFile(fakeFileName, `
                import React from 'react';
                import { Button, useTheme } from 'ui-lib';
            `, ts.ScriptTarget.Latest);

            const host = { resolveModuleName: resolveModuleNameMock } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const node = graphModel.scan(source, service, host);

            expect(node.externalImports.default['react']).toBe('React');
            expect(node.externalImports.named['ui-lib'] || []).toContain('Button');
            expect(node.externalImports.named['ui-lib'] || []).toContain('useTheme');
        });

        test('collects external namespace import', () => {
            prepareFileSnapshot(fakeFileName);

            resolveModuleNameMock.mockReturnValue({ resolvedModule: null });

            const declaration = `
                import * as lodash from 'lodash';
            `;

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: declaration }]
            });

            const source = ts.createSourceFile(fakeFileName, 'import * as lodash from \'lodash\';', ts.ScriptTarget.Latest);
            const host = { resolveModuleName: resolveModuleNameMock } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const node = graphModel.scan(source, service, host);

            expect(node.externalImports.namespace['lodash']).toBe('lodash');
        });
    });

    describe('cleaned content generation', () => {
        test('removes imports/exports and keeps cleaned declarations', () => {
            prepareFileSnapshot(fakeFileName);

            const emittedDts = `
                import { Theme } from './theme';
                export interface Props { color: Theme; }
                export declare const Component: (props: Props) => any;
            `;

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: emittedDts }]
            });

            resolveModuleNameMock.mockReturnValue({ resolvedModule: { resolvedFileName: '/project/root/src/theme.ts' } });

            const source = ts.createSourceFile(fakeFileName, `
                import { Theme } from './theme';
                export interface Props { color: Theme; }
                export const Component = () => null;
            `, ts.ScriptTarget.Latest);

            const host = { resolveModuleName: resolveModuleNameMock } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const node = graphModel.scan(source, service, host);

            expect(node.content).not.toContain('import');
            expect(node.content).not.toContain('export');
            expect(node.content).toContain('interface Props');
            expect(node.content).toContain('Component: (props: Props) => any');
        });
    });

    describe('alias handling in cleaned content', () => {
        test('replaces aliased names in content', () => {
            prepareFileSnapshot(fakeFileName);

            const emittedDts = `
                import { User as InternalUser } from './types';
                export interface Profile { user: InternalUser; }
            `;

            const getEmitOutputMock = xJet.fn().mockReturnValue({
                outputFiles: [{ text: emittedDts }]
            });

            resolveModuleNameMock.mockReturnValue({ resolvedModule: { resolvedFileName: '/project/root/src/types.ts' } });

            const source = ts.createSourceFile(fakeFileName, `
                import { User as InternalUser } from './types';
                export interface Profile { user: InternalUser; }
            `, ts.ScriptTarget.Latest);

            const host = { resolveModuleName: resolveModuleNameMock } as any;
            const service = { getEmitOutput: getEmitOutputMock } as any;

            const node = graphModel.scan(source, service, host);

            expect(node.content).toContain('user: User');
            expect(node.content).not.toContain('InternalUser');
        });
    });
});
