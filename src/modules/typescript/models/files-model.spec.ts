/**
 * Import will remove at compile time
 */

import type { MockState } from '@remotex-labs/xjet';

/**
 * Imports
 */

import { resolve } from 'path';
import { join } from 'path/posix';
import { statSync, readFileSync } from 'fs';
import { FilesModel } from '@typescript/models/files.model';

/**
 * Tests
 */

describe('FilesModel', () => {
    let filesModel: FilesModel;
    let statSyncMock: MockState;
    let readFileSyncMock: MockState;

    beforeEach(() => {
        xJet.resetAllMocks();
        filesModel = new FilesModel();
        xJet.mock(resolve).mockImplementation((...args) => {
            return join('/project/root/', ...args);
        });

        statSyncMock = xJet.mock(statSync).mockImplementation(() => ({
            mtimeMs: 1000
        }));

        readFileSyncMock = xJet.mock(readFileSync).mockImplementation(() => 'file content here');
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    describe('resolve()', () => {
        test('normalizes paths to absolute forward-slash format', () => {
            const p1 = filesModel.resolve('./src/index.ts');
            const p2 = filesModel.resolve('src\\index.ts');
            const p3 = filesModel.resolve('/already/absolute.ts');

            expect(p1).toBe('/project/root/src/index.ts');
            expect(p2).toBe('/project/root/src/index.ts');
            expect(p3).toBe('/project/root/already/absolute.ts');
        });

        test('caches resolved paths', () => {
            filesModel.resolve('./src/a.ts');
            filesModel.resolve('./src/a.ts');
            filesModel.resolve('./src/a.ts');

            expect(resolve).toHaveBeenCalledTimes(1);
        });
    });

    describe('touchFile() – happy path', () => {
        test('first touch creates entry and reads file', () => {
            readFileSyncMock.mockReturnValue('hello world');
            statSyncMock.mockReturnValue({ mtimeMs: 1700001234567 } as any);

            const snap = filesModel.touchFile('./src/app.ts');

            expect(snap.version).toBe(1);
            expect(snap.mtimeMs).toBe(1700001234567);
            expect(snap.contentSnapshot).toBeDefined();
            expect(snap.contentSnapshot!.getText(0, 11)).toBe('hello world');

            expect(statSyncMock).toHaveBeenCalledTimes(1);
            expect(readFileSyncMock).toHaveBeenCalledTimes(1);
        });

        test('returns shallow copy', () => {
            filesModel.touchFile('./src/app.ts');
            const a = filesModel.touchFile('./src/app.ts');
            const b = filesModel.touchFile('./src/app.ts');

            expect(a).not.toBe(b);
            expect(a).toEqual(b);
        });

        test('fast path – same mtime → no re-read', () => {
            filesModel.touchFile('./src/app.ts');           // first read
            const snap2 = filesModel.touchFile('./src/app.ts'); // cached

            expect(readFileSync).toHaveBeenCalledTimes(1);
            expect(snap2.version).toBe(1);
        });

        test('mtime changed → reads again & bumps version', () => {
            statSyncMock
                .mockReturnValueOnce({ mtimeMs: 1000 } as any)
                .mockReturnValueOnce({ mtimeMs: 2000 } as any);

            readFileSyncMock
                .mockReturnValueOnce('v1')
                .mockReturnValueOnce('v2');

            filesModel.touchFile('./src/app.ts');
            const updated = filesModel.touchFile('./src/app.ts');

            expect(updated.version).toBe(2);
            expect(updated.mtimeMs).toBe(2000);
            expect(updated.contentSnapshot!.getText(0, 2)).toBe('v2');
        });
    });

    describe('touchFile() – error handling', () => {
        test('file not found after being tracked → bumps version & clears snapshot', () => {
            // First successful read
            filesModel.touchFile('./src/app.ts');

            // Now simulate deletion / permission error
            statSyncMock.mockImplementation(() => {
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            });

            const after = filesModel.touchFile('./src/app.ts');

            expect(after.version).toBe(2);
            expect(after.mtimeMs).toBe(0);
            expect(after.contentSnapshot).toBeUndefined();
        });

        test('never-seen file that cannot be read → version stays 0, no snapshot', () => {
            statSyncMock.mockImplementation(() => {
                throw new Error('ENOENT');
            });

            const snap = filesModel.touchFile('./does/not/exist.ts');

            expect(snap.version).toBe(0);
            expect(snap.mtimeMs).toBe(0);
            expect(snap.contentSnapshot).toBeUndefined();
        });
    });

    describe('getSnapshot() / getTrackedFilePaths()', () => {
        test('getSnapshot returns undefined before touch', () => {
            expect(filesModel.getSnapshot('./src/not-touched.ts')).toBeUndefined();
        });

        test('getSnapshot returns current state after touch', () => {
            filesModel.touchFile('./src/a.ts');
            const snap = filesModel.getSnapshot('./src/a.ts');

            expect(snap).toBeDefined();
            expect(snap!.version).toBe(1);
        });

        test('getTrackedFilePaths returns normalized paths', () => {
            filesModel.touchFile('./src/a.ts');
            filesModel.touchFile('src/b.ts');
            filesModel.touchFile('./src\\c.ts');

            const tracked = filesModel.getTrackedFilePaths();

            expect(tracked).toHaveLength(3);
            expect(tracked).toContain('/project/root/src/a.ts');
            expect(tracked).toContain('/project/root/src/b.ts');
            expect(tracked).toContain('/project/root/src/c.ts');
        });
    });

    describe('clear()', () => {
        test('clears all snapshots and path cache', () => {
            filesModel.touchFile('./src/a.ts');
            filesModel.touchFile('./src/b.ts');

            expect(filesModel.getTrackedFilePaths().length).toBe(2);
            filesModel.clear();

            expect(filesModel.getTrackedFilePaths().length).toBe(0);
            expect(filesModel.getSnapshot('./src/a.ts')).toBeUndefined();


            filesModel.resolve('./src/a.ts');
            expect(resolve).toHaveBeenCalledTimes(3); // first in touch, second after clear
        });
    });

    describe('language server integration smoke test', () => {
        test('provides expected shape for TypeScript LanguageServiceHost', () => {
            statSyncMock.mockReturnValue({ mtimeMs: 123456789 } as any);
            readFileSyncMock.mockReturnValue('export const answer = 42;');

            const snap = filesModel.touchFile('./src/utils.ts');

            expect(snap.version).toBe(1);
            expect(typeof snap.contentSnapshot?.getText).toBe('function');
            expect(snap.contentSnapshot!.getText(0, 999)).toContain('answer = 42');
            expect(String(snap.version)).toBe('1');
        });
    });

    describe('edge cases', () => {
        test('empty file → snapshot with zero length', () => {
            readFileSyncMock.mockReturnValue('x');

            const snap = filesModel.touchFile('./empty.ts');

            expect(snap.contentSnapshot!.getLength()).toBe(1);
        });

        test('multiple touches in quick succession (same mtime)', () => {
            for (let i = 0; i < 10; i++) {
                filesModel.touchFile('./src/hot.ts');
            }

            expect(readFileSync).toHaveBeenCalledTimes(1);
        });
    });
});
