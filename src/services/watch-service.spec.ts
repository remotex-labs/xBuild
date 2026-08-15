/**
 * Imports
 */

import { resolve } from '@remotex-labs/xmap';
import { WatchService } from './watch.service';
import { ChangeTypes } from '@constants/watch.constant';
import { watch, statSync, lstatSync, readdirSync, realpathSync } from 'fs';

/**
 * Tests
 */

describe('WatchService', () => {
    const fileStats: any = {
        mtimeMs: 2,
        birthtimeMs: 1,
        isFile: (): boolean => true,
        isDirectory: (): boolean => false,
        isSymbolicLink: (): boolean => false
    };

    const addedStats: any = { ...fileStats, mtimeMs: 1 };
    const linkStats: any = { ...fileStats, isSymbolicLink: (): boolean => true };
    const directoryStats: any = { ...fileStats, isFile: (): boolean => false, isDirectory: (): boolean => true };

    const settle = (): Promise<unknown> => new Promise(done => setTimeout(done, 30));

    let links: Record<string, unknown>;
    let stats: Record<string, unknown>;
    let entries: Record<string, Array<unknown>>;
    let handles: Array<any>;
    let watchMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        links = {};
        stats = {};
        entries = {};
        handles = [];

        xJet.mock(resolve).mockImplementation(((path: string) => path) as any);
        xJet.mock(realpathSync).mockImplementation(((path: string) => path) as any);
        xJet.mock(lstatSync).mockImplementation(((path: string) => links[path]) as any);
        xJet.mock(statSync).mockImplementation(((path: string) => stats[path]) as any);
        xJet.mock(readdirSync).mockImplementation(((path: string) => entries[path] ?? []) as any);
        watchMock = xJet.mock(watch).mockImplementation(((path: string, options: any, listener: any) => {
            const handle: any = { path, options, listener, close: xJet.fn() };
            handles.push(handle);

            return { close: handle.close, on: (_event: string, callback: any) => (handle.error = callback) };
        }) as any);
    });

    describe('subscribe', () => {
        test('should open the base watcher on the first subscription and reuse it for the next', () => {
            const watcher = new WatchService('/base');
            const stopA = watcher.subscribe(() => undefined);
            const stopB = watcher.subscribe(() => undefined);

            expect(watchMock).toHaveBeenCalledTimes(1);
            expect(watchMock).toHaveBeenCalledWith('/base', {
                recursive: false, ignore: expect.any(Function)
            }, expect.any(Function));

            stopA();
            stopB();
        });

        test('should open the base watcher recursively when configured', () => {
            new WatchService('/base', { recursive: true }).subscribe(() => undefined);

            expect(handles[0].options).toEqual({ recursive: true, ignore: expect.any(Function) });
        });

        test('should close every watcher only when the last subscriber leaves', () => {
            const watcher = new WatchService('/base');
            const stopA = watcher.subscribe(() => undefined);
            const stopB = watcher.subscribe(() => undefined);

            stopA();
            expect(handles[0].close).not.toHaveBeenCalled();

            stopB();
            expect(handles[0].close).toHaveBeenCalled();
        });

        test('should open no watcher on a base the ignore rules reject', () => {
            new WatchService('').subscribe(() => undefined);
            new WatchService('/base/a.ts~').subscribe(() => undefined);

            expect(handles).toHaveLength(0);
        });

        test('should open the watchers again for a later subscription', () => {
            const watcher = new WatchService('/base');

            watcher.subscribe(() => undefined)();
            watcher.subscribe(() => undefined)();

            expect(handles.map(handle => handle.path)).toEqual([ '/base', '/base' ]);
        });
    });

    describe('events', () => {
        test('should emit a debounced batch keyed by the path relative to the base', async () => {
            links['/base/a.ts'] = fileStats;
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('change', 'a.ts');
            await settle();

            expect(next).toHaveBeenCalledWith({ 'a.ts': { type: ChangeTypes.Change, stats: fileStats } });
        });

        test('should coalesce a burst of events into a single batch', async () => {
            links['/base/a.ts'] = fileStats;
            links['/base/b.ts'] = addedStats;
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('change', 'a.ts');
            handles[0].listener('change', 'b.ts');
            await settle();

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith({
                'a.ts': { type: ChangeTypes.Change, stats: fileStats },
                'b.ts': { type: ChangeTypes.Added, stats: addedStats }
            });
        });

        test('should hold the batch for 150 milliseconds when no debounce is configured', async () => {
            links['/base/a.ts'] = fileStats;
            const next = xJet.fn();
            new WatchService('/base').subscribe(next);

            handles[0].listener('change', 'a.ts');
            await settle();
            expect(next).not.toHaveBeenCalled();

            await new Promise(done => setTimeout(done, 150));
            expect(next).toHaveBeenCalledWith({ 'a.ts': { type: ChangeTypes.Change, stats: fileStats } });
        });

        test('should emit nothing when the window expires with nothing pending', () => {
            const next = xJet.fn();
            const watcher = new WatchService('/base', { debounce: 10 });
            watcher.subscribe(next);

            (<any> watcher).flush();

            expect(next).not.toHaveBeenCalled();
        });

        test('should report a vanished entry as deleted', async () => {
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('rename', 'a.ts');
            await settle();

            expect(next).toHaveBeenCalledWith({ 'a.ts': { type: ChangeTypes.Deleted, stats: undefined } });
        });

        test('should drop an event the filter rejects', async () => {
            links['/base/a.js'] = fileStats;
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10, filter: [ '**/*.ts' ] }).subscribe(next);

            handles[0].listener('change', 'a.js');
            await settle();

            expect(next).not.toHaveBeenCalled();
        });

        test('should ignore an event that carries no filename', async () => {
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('change', null);
            await settle();

            expect(next).not.toHaveBeenCalled();
        });

        test('should drop a pending batch when the last subscriber leaves before the window closes', async () => {
            links['/base/a.ts'] = fileStats;
            const next = xJet.fn();
            const stop = new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('change', 'a.ts');
            stop();
            await settle();

            expect(next).not.toHaveBeenCalled();
        });

        test('should keep the batch flowing when one subscriber throws', async () => {
            links['/base/a.ts'] = fileStats;
            const next = xJet.fn();
            const watcher = new WatchService('/base', { debounce: 10 });
            watcher.subscribe(() => {
                throw new Error('boom');
            });
            watcher.subscribe(next);

            handles[0].listener('change', 'a.ts');
            await settle();

            expect(next).toHaveBeenCalledWith({ 'a.ts': { type: ChangeTypes.Change, stats: fileStats } });
        });

        test('should forward a watcher error to the subscribers and close that watcher', () => {
            const failure = new Error('boom');
            const error = xJet.fn();
            new WatchService('/base').subscribe(() => undefined, error);

            handles[0].error(failure);

            expect(error).toHaveBeenCalledWith(failure);
            expect(handles[0].close).toHaveBeenCalled();
        });
    });

    describe('symlinks', () => {
        test('should watch a symlink that resolves to a matching file', () => {
            links['/base/link.ts'] = linkStats;
            stats['/base/link.ts'] = fileStats;
            new WatchService('/base', { debounce: 10 }).subscribe(() => undefined);

            handles[0].listener('rename', 'link.ts');

            expect(handles.map(handle => handle.path)).toEqual([ '/base', '/base/link.ts' ]);
        });

        test('should watch a symlink that resolves to a directory recursively', () => {
            links['/base/lib'] = linkStats;
            stats['/base/lib'] = directoryStats;
            new WatchService('/base', { debounce: 10, recursive: true }).subscribe(() => undefined);

            handles[0].listener('rename', 'lib');

            expect(handles[1]).toEqual(expect.objectContaining({
                path: '/base/lib', options: { recursive: true, ignore: expect.any(Function) }
            }));
        });

        test('should open the watch on the real path while reporting events against the original one', async () => {
            xJet.mock(realpathSync).mockImplementation(((path: string) =>
                path === '/base/link.ts' ? '/real/link.ts' : path) as any);

            links['/base/link.ts'] = linkStats;
            stats['/base/link.ts'] = fileStats;
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('change', 'link.ts');
            handles[1].listener('change', 'link.ts');
            await settle();

            expect(handles[1].path).toBe('/real/link.ts');
            expect(next).toHaveBeenCalledWith({ 'link.ts': { type: ChangeTypes.Change, stats: fileStats } });
        });

        test('should open no second watcher for a symlink it already watches', () => {
            links['/base/link.ts'] = linkStats;
            stats['/base/link.ts'] = fileStats;
            new WatchService('/base', { debounce: 10 }).subscribe(() => undefined);

            handles[0].listener('change', 'link.ts');
            handles[0].listener('change', 'link.ts');

            expect(handles).toHaveLength(2);
        });

        test('should close and reopen the watcher of a renamed symlink', () => {
            links['/base/link.ts'] = linkStats;
            stats['/base/link.ts'] = fileStats;
            new WatchService('/base', { debounce: 10 }).subscribe(() => undefined);

            handles[0].listener('rename', 'link.ts');
            handles[0].listener('rename', 'link.ts');

            expect(handles).toHaveLength(3);
            expect(handles[1].close).toHaveBeenCalled();
        });

        test('should close the watcher of a path that vanished', () => {
            links['/base/link.ts'] = linkStats;
            stats['/base/link.ts'] = fileStats;
            new WatchService('/base', { debounce: 10 }).subscribe(() => undefined);

            handles[0].listener('change', 'link.ts');
            delete links['/base/link.ts'];
            handles[0].listener('change', 'link.ts');

            expect(handles[1].close).toHaveBeenCalled();
        });

        test('should drop a broken symlink', async () => {
            links['/base/link.ts'] = linkStats;
            const next = xJet.fn();
            new WatchService('/base', { debounce: 10 }).subscribe(next);

            handles[0].listener('rename', 'link.ts');
            await settle();

            expect(handles).toHaveLength(1);
            expect(next).not.toHaveBeenCalled();
        });

        test('should watch every symbolic link under the base and skip the ignored entries', () => {
            entries['/base'] = [
                { name: 'lib', parentPath: '/base', isSymbolicLink: (): boolean => true, isDirectory: (): boolean => false },
                { name: 'src', parentPath: '/base', isSymbolicLink: (): boolean => false, isDirectory: (): boolean => true },
                { name: '.git', parentPath: '/base', isSymbolicLink: (): boolean => true, isDirectory: (): boolean => false },
                { name: 'a.ts~', parentPath: '/base', isSymbolicLink: (): boolean => true, isDirectory: (): boolean => false }
            ];

            new WatchService('/base', { followSymlinks: true }).subscribe(() => undefined);

            expect(handles.map(handle => handle.path)).toEqual([ '/base', '/base/lib' ]);
        });

        test('should watch a dot entry while walking when dot is set', () => {
            entries['/base'] = [{ name: '.env', parentPath: '/base', isSymbolicLink: (): boolean => true, isDirectory: (): boolean => false }];

            new WatchService('/base', { followSymlinks: true, dot: true }).subscribe(() => undefined);

            expect(handles.map(handle => handle.path)).toEqual([ '/base', '/base/.env' ]);
        });

        test('should fall back to the directory it is reading when an entry carries no parent path', () => {
            entries['/base'] = [{ name: 'lib', isSymbolicLink: (): boolean => true, isDirectory: (): boolean => false }];

            new WatchService('/base', { followSymlinks: true }).subscribe(() => undefined);

            expect(handles.map(handle => handle.path)).toEqual([ '/base', '/base/lib' ]);
        });

        test('should skip a directory it cannot read while walking', () => {
            xJet.mock(readdirSync).mockImplementation((() => {
                throw new Error('EACCES');
            }) as any);

            new WatchService('/base', { followSymlinks: true }).subscribe(() => undefined);

            expect(handles.map(handle => handle.path)).toEqual([ '/base' ]);
        });

        test('should descend into a subdirectory while walking when recursion is enabled', () => {
            entries['/base'] = [{ name: 'src', parentPath: '/base', isSymbolicLink: (): boolean => false, isDirectory: (): boolean => true }];
            entries['/base/src'] = [{ name: 'inner', parentPath: '/base/src', isSymbolicLink: (): boolean => true, isDirectory: (): boolean => false }];

            new WatchService('/base', { followSymlinks: true, recursive: true }).subscribe(() => undefined);

            expect(handles.map(handle => handle.path)).toEqual([ '/base', '/base/src/inner' ]);
        });
    });
});
