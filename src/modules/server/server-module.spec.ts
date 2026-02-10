/**
 * Imports
 */

import * as http from 'http';
import * as https from 'https';
import { readFileSync } from 'fs';
import * as process from 'node:process';
import * as fsPromises from 'fs/promises';
import { ServerModule } from '@server/server.module';
import { join, resolve } from '@components/path.component';

/**
 * Tests
 */

describe('ServerModule', () => {
    const rootDir = '/tmp';
    const fakeConfig = {
        port: 4000,
        host: 'localhost',
        verbose: false,
        https: false,
        onStart: xJet.fn(),
        onRequest: xJet.fn()
    };

    let mockServer: any;

    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);

        mockServer = {
            listen: xJet.fn((port: any, host: any, callback: any) => {
                if (callback) callback();
            }),
            close: xJet.fn((callback: any) => {
                if (callback) callback();
            })
        };

        xJet.spyOn(http, 'createServer').mockImplementation(() => mockServer);
        xJet.spyOn(https, 'createServer').mockImplementation(() => mockServer);
        xJet.spyOn(console, 'log').mockImplementation(() => {});
        xJet.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('should instantiate with resolved rootDir', () => {
        const server = new ServerModule(fakeConfig, rootDir);
        expect(server['rootDir']).toBe(resolve(rootDir));
    });

    test('should call onStart when start() is invoked', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        await server.start();
        expect(fakeConfig.onStart).toHaveBeenCalled();
        expect(http.createServer).toHaveBeenCalled();
    });

    test('should start HTTPS server if https is true', async () => {
        const readFileSyncSpy = xJet.mock(readFileSync).mockImplementation(() => '');
        const server = new ServerModule({ ...fakeConfig, https: true, key: undefined, cert: undefined }, rootDir);
        xJet.spyOn(server, <any>'framework').mockReturnValue({
            distPath: join(process.cwd(), 'dist')
        });

        await server.start();
        expect(https.createServer).toHaveBeenCalled();
        expect(readFileSyncSpy).toHaveBeenCalledWith(expect.stringContaining('server.key'));
        expect(readFileSyncSpy).toHaveBeenCalledWith(expect.stringContaining('server.crt'));
    });

    test('should stop server gracefully', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        await server.start();

        await server.stop();

        expect(mockServer.close).toHaveBeenCalled();
        expect(server['server']).toBeUndefined();
    });

    test('should log message when stopping without running server', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const logSpy = xJet.spyOn(console, 'log');

        await server.stop();

        expect(logSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('No server is currently running'));
    });

    test('should restart server by stopping and starting', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        await server.start();

        const stopSpy = xJet.spyOn(server, 'stop');
        const startSpy = xJet.spyOn(server, 'start');

        await server.restart();

        expect(stopSpy).toHaveBeenCalled();
        expect(startSpy).toHaveBeenCalled();
    });

    test('handleRequest should log request when verbose is true', () => {
        const verboseConfig = { ...fakeConfig, verbose: true };
        const server = new ServerModule(verboseConfig, rootDir);

        const req = { url: '/test.html' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;

        const defaultHandler = xJet.fn();
        const logSpy = xJet.spyOn(console, 'log');

        server['handleRequest'](req, res, defaultHandler);

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/test.html'));
        expect(verboseConfig.onRequest).toHaveBeenCalledWith(req, res, defaultHandler);
    });

    test('handleRequest should not log request when verbose is false', () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const req = { url: '/test.html' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const defaultHandler = xJet.fn();
        const logSpy = xJet.spyOn(console, 'log');

        server['handleRequest'](req, res, defaultHandler);

        expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('[server]'), expect.stringContaining('/test.html'));
    });

    test('handleRequest should call onRequest if provided', () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const req = { url: '/' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const defaultHandler = xJet.fn();

        server['handleRequest'](req, res, defaultHandler);
        expect(fakeConfig.onRequest).toHaveBeenCalledWith(req, res, defaultHandler);
    });

    test('handleRequest should call defaultHandler if onRequest is undefined', () => {
        const config = { ...fakeConfig, onRequest: undefined };
        const server = new ServerModule(config, rootDir);
        const req = { url: '/' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const defaultHandler = xJet.fn();

        server['handleRequest'](req, res, defaultHandler);
        expect(defaultHandler).toHaveBeenCalled();
    });

    test('handleRequest should call sendError on exception', () => {
        const config = {
            ...fakeConfig,
            onRequest: () => { throw new Error('test error'); }
        };
        const server = new ServerModule(config, rootDir);
        const req = { url: '/' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const sendErrorSpy = xJet.spyOn(server as any, 'sendError').mockImplementation(() => {});

        server['handleRequest'](req, res, xJet.fn());

        expect(sendErrorSpy).toHaveBeenCalledWith(res, expect.any(Error));
    });

    test('getContentType returns correct content type', () => {
        const server = new ServerModule(fakeConfig, rootDir);
        expect(server['getContentType']('html')).toBe('text/html');
        expect(server['getContentType']('js')).toBe('application/javascript');
        expect(server['getContentType']('unknown')).toBe('application/octet-stream');
    });

    test('defaultResponse should call handleDirectory if path is a directory', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const req = { url: '/' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const statSpy = xJet.spyOn(fsPromises, 'stat').mockResolvedValue({
            isDirectory: () => true,
            isFile: () => false
        } as any);
        const handleDirectorySpy = xJet.spyOn(server as any, 'handleDirectory')
            .mockResolvedValue(undefined as any);

        await server['defaultResponse'](req, res);

        expect(statSpy).toHaveBeenCalled();
        expect(handleDirectorySpy).toHaveBeenCalled();
    });

    test('defaultResponse should call handleFile if path is a file', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const req = { url: '/index.html' } as any;
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;

        xJet.spyOn(fsPromises, 'stat').mockResolvedValue({
            isDirectory: () => false,
            isFile: () => true
        } as any);

        const handleFileSpy = xJet.spyOn(server as any, 'handleFile').mockImplementation(() => {
        });
        await server['defaultResponse'](req, res);

        expect(handleFileSpy).toHaveBeenCalled();
    });

    test('defaultResponse should send 403 for paths outside rootDir', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const res = { end: xJet.fn(), writeHead: xJet.fn(), statusCode: 0 } as any;
        const req = { url: '/../etc/passwd' } as any;

        await server['defaultResponse'](req, res);

        expect(res.statusCode).toBe(403);
        expect(res.end).toHaveBeenCalled();
    });

    test('defaultResponse should sendNotFound when stat fails', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const req = { url: '/missing.txt' } as any;
        xJet.spyOn(fsPromises, 'stat').mockRejectedValue(<any>new Error('ENOENT'));
        const sendNotFoundSpy = xJet.spyOn(server as any, 'sendNotFound').mockImplementation(() => {
        });

        await server['defaultResponse'](req, res);
        expect(sendNotFoundSpy).toHaveBeenCalled();
    });

    test('handleDirectory should render HTML list for files', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;

        xJet.spyOn(fsPromises, 'readdir').mockResolvedValue([ 'index.html', 'folder' ] as any);

        await server['handleDirectory'](rootDir, '', res);

        expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining('<html'));
    });

    test('handleDirectory should handle empty folders', async () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;

        xJet.spyOn(fsPromises, 'readdir').mockResolvedValue([]);
        await server['handleDirectory'](rootDir, '', res);

        expect(res.end).toHaveBeenCalledWith(expect.stringContaining('No files or folders here.'));
    });

    test('handleFile should send file contents with correct MIME type', async () => {
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        const fakeData = Buffer.from('Hello');
        xJet.spyOn(fsPromises, 'readFile').mockResolvedValue(fakeData);

        const server = new ServerModule(fakeConfig, rootDir);
        await server['handleFile'](join(rootDir, 'index.html'), res);

        expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
        expect(res.end).toHaveBeenCalledWith(fakeData);
    });

    test('handleFile should call sendError if readFile fails', () => {
        const server: any = new ServerModule(fakeConfig, rootDir);

        const err = new Error('fail');
        const res = { end: xJet.fn(), writeHead: xJet.fn() } as any;
        xJet.spyOn(fsPromises, 'readFile').mockRejectedValue(<any> err);

        const promiseResult = server['handleFile'](join(rootDir, 'bad.txt'), res);
        expect(promiseResult).rejects.toThrow(err);
    });

    test('sendNotFound should write 404 header and message', () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const res = { writeHead: xJet.fn(), end: xJet.fn() } as any;

        server['sendNotFound'](res);

        expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
        expect(res.end).toHaveBeenCalledWith('Not Found');
    });

    test('sendError should write 500 header and message', () => {
        const server = new ServerModule(fakeConfig, rootDir);
        const res = { writeHead: xJet.fn(), end: xJet.fn() } as any;
        const err = new Error('boom');

        const logSpy = xJet.spyOn(console, 'error').mockImplementation(() => {
        });
        server['sendError'](res, err);

        expect(logSpy).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'text/plain' });
        expect(res.end).toHaveBeenCalledWith('Internal Server Error');
    });
});
