/**
 * Imports
 */

import { FilesModel } from './files.model';
import { readFileSync, statSync } from 'fs';
import { resolve } from '@remotex-labs/xmap';

/**
 * Tests
 */

describe('FilesModel', () => {
    let model: FilesModel;
    let statMock: any;
    let readMock: any;
    let resolveMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        model = new FilesModel();
        resolveMock = xJet.mock(resolve).mockImplementation((path: string) => path.startsWith('/abs/') ? path : `/abs/${ path }`);
        statMock = xJet.mock(statSync).mockReturnValue(<any> { mtimeMs: 100, isFile: (): boolean => true });
        readMock = xJet.mock(readFileSync).mockReturnValue(<any> 'export const answer = 42;');
    });

    describe('resolve', () => {
        test('should memoize the resolution of a path', () => {
            expect(model.resolve('a.ts')).toBe('/abs/a.ts');
            expect(model.resolve('a.ts')).toBe('/abs/a.ts');
            expect(resolveMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('getSnapshot', () => {
        test('should return undefined for a path that was never tracked', () => {
            expect(model.getSnapshot('a.ts')).toBeUndefined();
            expect(statMock).not.toHaveBeenCalled();
            expect(readMock).not.toHaveBeenCalled();
        });

        test('should return the cached entry for a tracked path', () => {
            const entry = model.touch('a.ts');

            expect(model.getSnapshot('a.ts')).toBe(entry);
        });

        test('should serve one entry to every path that resolves the same way', () => {
            resolveMock.mockImplementation((path: string) => `/abs/${ path.replace('./', '') }`);
            const entry = model.touch('./a.ts');

            expect(model.getSnapshot('a.ts')).toBe(entry);
            expect(readMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('touch', () => {
        test('should read the file when the path is not tracked yet', () => {
            const entry = model.touch('a.ts');

            expect(entry).toEqual(expect.objectContaining({ mtimeMs: 100, version: 1 }));
            expect(entry.snapshot?.text).toBe('export const answer = 42;');
            expect(readMock).toHaveBeenCalledWith('/abs/a.ts', 'utf-8');
        });

        test('should serve a tracked path from the cache without a stat', () => {
            const entry = model.touch('a.ts');

            expect(model.touch('a.ts')).toBe(entry);
            expect(statMock).toHaveBeenCalledTimes(1);
            expect(readMock).toHaveBeenCalledTimes(1);
        });

        test('should read with the given encoding', () => {
            model.touch('a.ts', 'latin1');

            expect(readMock).toHaveBeenCalledWith('/abs/a.ts', 'latin1');
        });
    });

    describe('refresh', () => {
        test('should keep the entry when the modification time did not move', () => {
            const entry = model.touch('a.ts');

            expect(model.refresh('a.ts')).toBe(entry);
            expect(readMock).toHaveBeenCalledTimes(1);
        });

        test('should rebuild the entry when the file changed on disk', () => {
            model.touch('a.ts');
            statMock.mockReturnValue({ mtimeMs: 200, isFile: (): boolean => true });
            readMock.mockReturnValue('export const answer = 43;');

            const entry = model.refresh('a.ts');

            expect(entry).toEqual(expect.objectContaining({ mtimeMs: 200, version: 2 }));
            expect(entry.snapshot?.text).toBe('export const answer = 43;');
        });

        test('should use the given stats instead of calling stat', () => {
            const entry = model.refresh('a.ts', <any> { mtimeMs: 300, isFile: (): boolean => true });

            expect(entry).toEqual(expect.objectContaining({ mtimeMs: 300, version: 1 }));
            expect(statMock).not.toHaveBeenCalled();
        });

        test('should track a missing path with an empty snapshot', () => {
            statMock.mockReturnValue(undefined);

            expect(model.refresh('missing.ts')).toEqual({ mtimeMs: 0, version: 1, snapshot: undefined });
            expect(readMock).not.toHaveBeenCalled();
        });

        test('should bump the version once when a tracked file disappears', () => {
            model.touch('a.ts');
            statMock.mockReturnValue(undefined);

            const entry = model.refresh('a.ts');

            expect(entry).toEqual({ mtimeMs: 0, version: 2, snapshot: undefined });
            expect(model.refresh('a.ts')).toBe(entry);
        });
    });

    describe('refreshAll', () => {
        test('should refresh only the given paths', () => {
            model.touch('a.ts');
            model.touch('b.ts');
            statMock.mockClear();

            model.refreshAll([ 'a.ts' ]);

            expect(statMock).toHaveBeenCalledTimes(1);
            expect(statMock).toHaveBeenCalledWith('/abs/a.ts', { throwIfNoEntry: false });
        });

        test('should track a path it was given that was never tracked', () => {
            model.refreshAll([ 'a.ts' ]);

            expect(model.getSnapshot('a.ts')).toEqual(expect.objectContaining({ version: 1 }));
        });

        test('should refresh every tracked path when no paths are given', () => {
            model.touch('a.ts');
            model.touch('b.ts');
            statMock.mockClear();

            model.refreshAll();

            expect(statMock).toHaveBeenCalledTimes(2);
            expect(statMock).toHaveBeenCalledWith('/abs/a.ts', { throwIfNoEntry: false });
            expect(statMock).toHaveBeenCalledWith('/abs/b.ts', { throwIfNoEntry: false });
        });
    });

    describe('clear', () => {
        test('should drop every entry and every memoized path', () => {
            model.touch('a.ts');
            resolveMock.mockClear();
            model.clear();

            expect(model.getSnapshot('a.ts')).toBeUndefined();
            expect(model.touch('a.ts').version).toBe(1);
            expect(resolveMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('snapshot', () => {
        test('should expose the content as text and through the snapshot methods', () => {
            const snapshot = model.touch('a.ts').snapshot;

            expect(snapshot?.text).toBe('export const answer = 42;');
            expect(snapshot?.getLength()).toBe(25);
            expect(snapshot?.getText(0, 6)).toBe('export');
        });

        test('should narrow the change range to the span that differs', () => {
            readMock.mockReturnValue('abcd');
            const previous = model.touch('a.ts').snapshot;

            statMock.mockReturnValue({ mtimeMs: 200, isFile: (): boolean => true });
            readMock.mockReturnValue('abXcd');

            expect(model.refresh('a.ts').snapshot?.getChangeRange(<any> previous)).toEqual({
                span: { start: 2, length: 0 },
                newLength: 1
            });
        });

        test('should report an empty span between two identical texts', () => {
            const snapshot = model.touch('a.ts').snapshot;

            expect(snapshot?.getChangeRange(<any> snapshot)).toEqual({
                span: { start: 25, length: 0 },
                newLength: 0
            });
        });

        test('should keep the prefix and the suffix apart on a text that shrank', () => {
            readMock.mockReturnValue('abcd');
            const previous = model.touch('a.ts').snapshot;

            statMock.mockReturnValue({ mtimeMs: 200, isFile: (): boolean => true });
            readMock.mockReturnValue('ad');

            expect(model.refresh('a.ts').snapshot?.getChangeRange(<any> previous)).toEqual({
                span: { start: 1, length: 2 },
                newLength: 0
            });
        });
    });
});
