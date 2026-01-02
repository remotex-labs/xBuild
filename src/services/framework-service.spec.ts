/**
 * Import will remove at compile time
 */

import { readFileSync } from 'fs';
import { SourceService } from '@remotex-labs/xmap';
import { FrameworkService } from '@services/framework.service';
import { SINGLETONS, inject } from '@symlinks/symlinks.module';

/**
 * Tests
 */

describe('FrameworkService', () => {
    beforeEach(() => {
        SINGLETONS.clear();
        xJet.resetAllMocks();
    });

    test('should be injectable as a singleton', () => {
        const a = inject(FrameworkService);
        const b = inject(FrameworkService);
        expect(a).toBe(b);
    });

    test('should set filePath, rootPath, and distPath', () => {
        const service = inject(FrameworkService);

        expect(service.filePath).not.toBeDefined();
        expect(service.rootPath).toBe(process.cwd());
        expect(service.distPath).not.toBeDefined();
    });

    test('should return undefined for non-cached source map', () => {
        const service = inject(FrameworkService);
        const result = service.getSourceMap('/non/existent/path');
        expect(result).toBeUndefined();
    });

    test('should cache SourceService when setSource is called', () => {
        const service = inject(FrameworkService);
        const source = '{ "version":3,"file":"test.js","mappings":";AAaA", "sources":["test"], "names": "" }';
        const path = '/path/to/file.js';

        service.setSource(source, path);
        const cached = service.getSourceMap(path);

        expect(cached).toBeDefined();
        expect(cached).toBeInstanceOf(<any>SourceService);
    });

    test('should throw when setSource fails', () => {
        const service = inject(FrameworkService);
        const path = '/path/to/file.js';
        const badSource = null as unknown as string;

        expect(() => service.setSource(badSource, path)).toThrow(/Failed to initialize SourceService/);
    });

    test('should initialize source file from .map file', () => {
        const service = inject(FrameworkService);
        const fakePath = '/tmp/fakefile.js';
        const mockContent = '{ "version":3,"file":"fakefile.js","mappings":";AAaA", "sources":["test"], "names": "" }';
        const readFileSyncMock = xJet.mock(readFileSync).mockReturnValueOnce(mockContent);

        service.setSourceFile(fakePath);
        const cached = service.getSourceMap(fakePath);

        expect(cached).toBeDefined();
        expect(cached).toBeInstanceOf(<any> SourceService);
        expect(readFileSyncMock).toHaveBeenCalledWith(fakePath + '.map', 'utf-8');
    });

    test('should throw if .map file cannot be read', () => {
        const service = inject(FrameworkService);
        const fakePath = '/tmp/missingfile.js';

        const readFileSyncMock = xJet.mock(readFileSync).mockImplementation(() => {
            throw new Error('File not found');
        });

        expect(() => service.setSourceFile(fakePath)).toThrow(/Failed to initialize SourceService/);
        expect(readFileSyncMock).toHaveBeenCalledWith(fakePath + '.map', 'utf-8');
    });

    test('should do nothing if setSourceFile is called with empty path', () => {
        const service = inject(FrameworkService);
        expect(() => service.setSourceFile('')).not.toThrow();
    });

    test('should ignore empty mappings when initializing source map', () => {
        const service = inject(FrameworkService);
        const path = '/path/to/file.js';
        const source = '{ "version":3,"file":"file.js","mappings": "" }';

        service['initializeSourceMap'](source, path);
        const cached = service.getSourceMap(path);

        expect(cached).toBeUndefined();
    });
});
