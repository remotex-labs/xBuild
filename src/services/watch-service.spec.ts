/**
 * Imports
 */

import { readFileSync } from 'fs';
import { matchesGlob } from 'path';
import { normalize } from 'path/posix';
import { stat, watch } from 'fs/promises';
import { WatchService } from './watch.service';

/**
 * Tests
 */

describe('WatchService', () => {
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
    });

    test('should compile excludes in constructor', () => {
        const patterns = [ '**/node_modules/**' ];
        new WatchService(patterns);
    });

    test('debounce should delay function execution', () => {
        xJet.useFakeTimers();
        const service = new WatchService();
        const fn = xJet.fn();

        service['debounce'](fn, 50);
        expect(fn).not.toHaveBeenCalled();
        xJet.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalled();
    });

    test('handleChangedFiles should call callback and clear set', async () => {
        const service = new WatchService();
        const callback = xJet.fn();
        const changedFilesSet = new Set([ '/file1.ts', '/file2.ts' ]);

        await service['handleChangedFiles'](callback, changedFilesSet);

        expect(callback).toHaveBeenCalledWith([ '/file1.ts', '/file2.ts' ]);
        expect(changedFilesSet.size).toBe(0);
    });

    test('start should watch directory and handle changed files', async () => {
        xJet.mock(stat).mockResolvedValue({ isFile: () => true });

        const service = new WatchService([ '**/ignore/**' ]);
        const callback = xJet.fn();
        const fakeWatcher = {
            [Symbol.asyncIterator]: function* () {
                yield { filename: '/file1.ts' };
                yield { filename: '/ignore/file2.ts' };
                yield { filename: null };
            }
        };

        xJet.spyOn(service['framework'], 'rootPath').mockReturnValue('/root');
        const watchSpy = xJet.mock(watch).mockReturnValue(fakeWatcher as any);
        const matchesGlobSpy = xJet.mock(matchesGlob);

        await service.start(callback);

        expect(watchSpy).toHaveBeenCalledWith('/root', { recursive: true });
        expect(matchesGlobSpy).toHaveBeenCalledTimes(4);
        xJet.runOnlyPendingTimers();
        expect(callback).toHaveBeenCalledWith([ normalize('/file1.ts') ]);
    });
});
