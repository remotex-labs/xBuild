/**
 * Imports
 */

import { cwd } from 'process';
import { readFileSync } from 'fs';
import { FrameworkService } from './framework.service';
import { normalize, resolve, SourceService } from '@remotex-labs/xmap';

/**
 * Tests
 */

describe('FrameworkService', () => {
    const sourceMap = '{"version":3,"file":"index.js","sources":["index.ts"],"names":[],"mappings":"AAAA"}';
    const emptyMap = '{"version":3,"file":"index.js","sources":["index.ts"],"names":[],"mappings":""}';

    let readMock: any;
    let framework: FrameworkService;

    beforeEach(() => {
        xJet.restoreAllMocks();

        xJet.mock(resolve).mockImplementation((path: string) => path.startsWith('/') ? path : `/abs/${ path }`);
        readMock = xJet.mock(readFileSync).mockReturnValue(<any> sourceMap);
        framework = new FrameworkService();
        readMock.mockClear();
    });

    describe('constructor', () => {
        test('should capture the project root and register the framework own map', () => {
            expect(framework.projectRoot).toBe(normalize(cwd()));
            expect(framework.frameworkFile).toBe(normalize(framework.frameworkFile));
            expect(framework.getSourceMap(framework.frameworkFile)).toBeInstanceOf(SourceService);
        });

        test('should report a framework shipped without a readable map', () => {
            readMock.mockImplementation(() => {
                throw new Error('ENOENT');
            });

            expect(() => new FrameworkService()).toThrow(/Failed to load source map for: .+\nENOENT/);
        });
    });

    describe('resolve', () => {
        test('should resolve a path through the shared file cache', () => {
            expect(FrameworkService.resolve('dist/index.js')).toBe('/abs/dist/index.js');
        });
    });

    describe('isFrameworkFile', () => {
        test('should judge a source that names the framework, whatever its case', () => {
            expect(framework.isFrameworkFile(<any> { source: 'D:/app/node_modules/xBuild/dist/index.js' })).toBe(true);
            expect(framework.isFrameworkFile(<any> { source: 'D:/app/src/index.ts' })).toBe(false);
        });

        test('should fall back to the source root when the source settles nothing', () => {
            expect(framework.isFrameworkFile(<any> { source: 'index.js', sourceRoot: '/app/xbuild/dist' })).toBe(true);
        });

        test('should spare a project xbuild.config file', () => {
            expect(framework.isFrameworkFile(<any> { source: 'D:/app/xbuild.config.ts' })).toBe(false);
        });
    });

    describe('getSourceMap', () => {
        test('should return undefined for a file that was never registered', () => {
            expect(framework.getSourceMap('dist/index.js')).toBeUndefined();
            expect(readMock).not.toHaveBeenCalled();
        });
    });

    describe('addSourceMap', () => {
        test('should register a map under the resolved path of its file', () => {
            framework.addSourceMap('/abs/dist/index.js', sourceMap);

            expect(framework.getSourceMap('dist/index.js')).toBeInstanceOf(SourceService);
        });

        test('should keep the map a file already carries', () => {
            framework.addSourceMap('dist/index.js', sourceMap);
            const registered = framework.getSourceMap('dist/index.js');
            framework.addSourceMap('dist/index.js', sourceMap);

            expect(framework.getSourceMap('dist/index.js')).toBe(registered);
        });

        test('should drop a map that maps nothing', () => {
            framework.addSourceMap('dist/index.js', emptyMap);

            expect(framework.getSourceMap('dist/index.js')).toBeUndefined();
        });

        test('should report the file when the content does not parse', () => {
            expect(() => framework.addSourceMap('dist/index.js', 'not a source map'))
                .toThrow('Failed to load source map for: /abs/dist/index.js');
        });
    });

    describe('loadSourceMap', () => {
        test('should register the map the companion beside the file carries', () => {
            framework.loadSourceMap('dist/index.js');

            expect(readMock).toHaveBeenCalledWith('/abs/dist/index.js.map', 'utf-8');
            expect(framework.getSourceMap('dist/index.js')).toBeInstanceOf(SourceService);
        });

        test('should ignore an empty path', () => {
            framework.loadSourceMap('');

            expect(readMock).not.toHaveBeenCalled();
        });

        test('should leave a file that already carries a map alone', () => {
            framework.addSourceMap('dist/index.js', sourceMap);
            framework.loadSourceMap('dist/index.js');

            expect(readMock).not.toHaveBeenCalled();
        });

        test('should report the file when the companion cannot be read', () => {
            readMock.mockImplementation(() => {
                throw new Error('ENOENT');
            });

            expect(() => framework.loadSourceMap('dist/index.js'))
                .toThrow('Failed to load source map for: /abs/dist/index.js\nENOENT');
        });

        test('should report a failure that was thrown as something other than an error', () => {
            readMock.mockImplementation(() => {
                throw 'EACCES';
            });

            expect(() => framework.loadSourceMap('dist/index.js'))
                .toThrow('Failed to load source map for: /abs/dist/index.js\nEACCES');
        });

        test('should drop a companion that maps nothing', () => {
            readMock.mockReturnValue(<any> emptyMap);

            framework.loadSourceMap('dist/index.js');

            expect(framework.getSourceMap('dist/index.js')).toBeUndefined();
        });
    });
});
