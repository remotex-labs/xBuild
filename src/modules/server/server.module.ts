/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { ServerConfigurationInterface } from './interfaces/server.interface';

/**
 * Imports
 */

import * as http from 'http';
import * as https from 'https';
import { extname } from 'path';
import { readFileSync } from 'fs';
import html from './html/server.html';
import { resolve, join } from '@remotex-labs/xmap';
import { inject } from '@services/symlinks.service';
import { prefix } from '@components/banner.component';
import { readdir, stat, readFile } from 'fs/promises';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FrameworkService } from '@services/framework.service';

/**
 * Maps a file extension (without the leading dot) to its MIME content type.
 *
 * @remarks
 * Extensions absent from this map are served as `application/octet-stream`.
 *
 * @since 2.6.0
 */

const CONTENT_TYPES: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    cjs: 'application/javascript',
    mjs: 'application/javascript',
    ts: 'text/plain',
    map: 'application/json',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    txt: 'text/plain'
} as const;

/**
 * Serves static files and directory listings over HTTP or HTTPS.
 *
 * @remarks
 * Resolves each request against a fixed root directory, serving files directly and rendering directories as HTML
 * listings. Requests may be intercepted by the {@link ServerConfigurationInterface.onRequest} hook before default
 * handling.
 *
 * @example
 * ```ts
 * const server = new ServerModule({ port: 3000, host: 'localhost' }, '/var/www');
 * server.start();
 * ```
 *
 * @see ServerConfigurationInterface
 * @since 2.0.0
 */

export class ServerModule {
    /**
     * The active HTTP or HTTPS server instance.
     *
     * @remarks
     * Created by {@link startHttpServer} or {@link startHttpsServer}, and reset to `undefined` by {@link stop}.
     *
     * @see start
     * @see stop
     * @see restart
     *
     * @since 2.0.0
     */

    private server?: http.Server;

    /**
     * Normalized absolute root directory from which files are served.
     *
     * @since 2.0.0
     */

    private readonly rootDir: string;

    /**
     * Injected {@link FrameworkService}, used to resolve the default certificate paths.
     *
     * @see FrameworkService
     * @since 2.0.0
     */

    private readonly framework = inject(FrameworkService);

    /**
     * Creates a new {@link ServerModule}.
     *
     * @param config - Server configuration including host, port, HTTPS options, and hooks.
     * @param dir - Root directory from which files are served.
     *
     * @remarks
     * Defaults the port to `0` (system-assigned) and the host to `localhost` when either is omitted.
     *
     * @example
     * ```ts
     * const server = new ServerModule({
     *   port: 8443,
     *   https: true,
     *   key: './certs/key.pem',
     *   cert: './certs/cert.pem',
     *   onRequest: (req, res, next) => { console.log(req.url); next(); }
     * }, './public');
     * ```
     *
     * @since 2.0.0
     */

    constructor(readonly config: ServerConfigurationInterface, dir: string) {
        this.rootDir = resolve(dir);
        this.config.port ||= 0;
        this.config.host ||= 'localhost';
    }

    /**
     * Starts the server using the configured protocol.
     *
     * @returns A promise that resolves once the server is listening.
     *
     * @remarks
     * Delegates to {@link startHttpsServer} when {@link ServerConfigurationInterface.https} is set,
     * otherwise to {@link startHttpServer}.
     *
     * @see stop
     * @see restart
     *
     * @since 2.0.0
     */

    async start(): Promise<void> {
        await (this.config.https ? this.startHttpsServer() : this.startHttpServer());
    }

    /**
     * Stops the running server.
     *
     * @returns A promise that resolves once the server has closed.
     *
     * @remarks
     * Closes all active connections and resets {@link server} to `undefined`.
     * Logs a notice and returns early when no server is running.
     *
     * @see start
     * @see restart
     *
     * @since 2.0.0
     */

    async stop(): Promise<void> {
        if (!this.server) {
            return console.log(prefix(), xterm.gray('No server is currently running.'));
        }

        await new Promise<void>((resolve, reject) => {
            this.server!.close(err => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(prefix(), xterm.dim('Server stopped.'));
        this.server = undefined;
    }

    /**
     * Restarts the server with the current configuration.
     *
     * @returns A promise that resolves once the server has been stopped and started again.
     *
     * @remarks
     * Calls {@link stop} followed by {@link start}.
     *
     * @see stop
     * @see start
     *
     * @since 2.0.0
     */

    async restart(): Promise<void> {
        console.log(prefix(), xterm.burntOrange('Restarting server...'));
        await this.stop();
        await this.start();
    }

    /**
     * Records the system-assigned port after the server binds.
     *
     * @remarks
     * When {@link ServerConfigurationInterface.port} is `0`, the operating system selects an available port on bind.
     * This reads that port back from {@link server} and writes it to {@link config}, ignoring an address that is
     * unavailable or not an object.
     *
     * @see listen
     * @since 2.0.0
     */

    private setActualPort(): void {
        if (this.config.port === 0) {
            const address = this.server!.address();
            if (address && typeof address === 'object' && address.port)
                this.config.port = address.port;
        }
    }

    /**
     * Binds the active {@link server} and resolves once it is listening.
     *
     * @param scheme - URL scheme reported to the {@link ServerConfigurationInterface.onStart} hook.
     * @returns A promise that resolves when the server is listening.
     *
     * @remarks
     * Records the system-assigned port via {@link setActualPort}, then invokes the optional
     * {@link ServerConfigurationInterface.onStart} hook with the resolved host, port, and URL.
     *
     * @see setActualPort
     * @since 2.6.0
     */

    private listen(scheme: 'http' | 'https'): Promise<void> {
        return new Promise<void>((resolve) => {
            this.server!.listen(this.config.port, this.config.host, () => {
                this.setActualPort();
                this.config.onStart?.({
                    host: this.config.host!,
                    port: this.config.port!,
                    url: `${ scheme }://${ this.config.host }:${ this.config.port }`
                });
                resolve();
            });
        });
    }

    /**
     * Creates and starts an HTTP server.
     *
     * @returns A promise that resolves once the server is listening.
     *
     * @remarks
     * Routes every request through {@link requestListener} and binds via {@link listen}.
     *
     * @see start
     * @see listen
     *
     * @since 2.0.0
     */

    private startHttpServer(): Promise<void> {
        this.server = http.createServer(this.requestListener);

        return this.listen('http');
    }

    /**
     * Creates and starts an HTTPS server.
     *
     * @returns A promise that resolves once the server is listening.
     *
     * @remarks
     * Loads the key and certificate from {@link ServerConfigurationInterface.key} and
     * {@link ServerConfigurationInterface.cert}, falling back to `certs/server.key` and `certs/server.crt` under the
     * framework distribution path. Routes every request through {@link requestListener} and binds via {@link listen}.
     *
     * @see start
     * @see listen
     *
     * @since 2.0.0
     */

    private startHttpsServer(): Promise<void> {
        const options = {
            key: readFileSync(this.config.key ?? join(this.framework.distPath, '..', 'certs', 'server.key')),
            cert: readFileSync(this.config.cert ?? join(this.framework.distPath, '..', 'certs', 'server.crt'))
        };

        this.server = https.createServer(options, this.requestListener);

        return this.listen('https');
    }

    /**
     * Request listener shared by the HTTP and HTTPS servers.
     *
     * @param req - The incoming request.
     * @param res - The response to write to.
     *
     * @remarks
     * Delegates every request to {@link handleRequest}, which falls back to {@link defaultResponse} when no
     * {@link ServerConfigurationInterface.onRequest} hook is configured.
     *
     * @see handleRequest
     * @see defaultResponse
     *
     * @since 2.6.0
     */

    private readonly requestListener = (req: IncomingMessage, res: ServerResponse): void => {
        this.handleRequest(req, res, () => this.defaultResponse(req, res));
    };

    /**
     * Dispatches an incoming request to the configured hook or the default handler.
     *
     * @param req - The incoming request.
     * @param res - The response to write to.
     * @param defaultHandler - Invoked when no {@link ServerConfigurationInterface.onRequest} hook is set.
     *
     * @remarks
     * Logs the request URL when {@link ServerConfigurationInterface.verbose} is set,
     * and forwards any thrown error to {@link sendError}.
     *
     * @see sendError
     * @since 2.0.0
     */

    private handleRequest(req: IncomingMessage, res: ServerResponse, defaultHandler: () => void): void {
        try {
            if (this.config.verbose) {
                console.log(
                    `${ prefix() } Request ${ xterm.lightCoral(req.url?.toString() ?? '') }`
                );
            }

            if (this.config.onRequest) {
                this.config.onRequest(req, res, defaultHandler);
            } else {
                defaultHandler();
            }
        } catch (error) {
            this.sendError(res, <Error> error);
        }
    }

    /**
     * Returns the MIME content type for a file extension.
     *
     * @param ext - File extension without the leading dot.
     * @returns The matching MIME type, or `application/octet-stream` when unknown.
     *
     * @see CONTENT_TYPES
     * @since 2.0.0
     */

    private getContentType(ext: string): string {
        return CONTENT_TYPES[ext] ?? 'application/octet-stream';
    }

    /**
     * Serves the file or directory addressed by the request URL.
     *
     * @param req - The incoming request.
     * @param res - The response to write to.
     *
     * @remarks
     * Rejects paths that escape {@link rootDir} with `403`, then delegates to {@link handleDirectory} or
     * {@link handleFile} by resource type. A failed `stat` results in {@link sendNotFound}.
     *
     * @see handleFile
     * @see handleDirectory
     * @see sendNotFound
     *
     * @since 2.0.0
     */

    private async defaultResponse(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const requestPath = req.url === '/' ? '' : req.url?.replace(/^\/+/, '') || '';
        const fullPath = join(this.rootDir, requestPath);

        if (!fullPath.startsWith(this.rootDir)) {
            res.statusCode = 403;
            res.end();

            return;
        }

        try {
            const stats = await stat(fullPath);

            if (stats.isDirectory()) {
                await this.handleDirectory(fullPath, requestPath, res);
            } else if (stats.isFile()) {
                await this.handleFile(fullPath, res);
            }
        } catch (error) {
            const msg = (<Error> error).message;
            if (!msg.includes('favicon')) {
                console.log(prefix(), msg);
            }

            this.sendNotFound(res);
        }
    }

    /**
     * Renders an HTML listing for a directory.
     *
     * @param fullPath - Absolute path of the directory to list.
     * @param requestPath - Request path relative to {@link rootDir}.
     * @param res - The response to write to.
     *
     * @remarks
     * Lists each entry with a file or folder icon and a breadcrumb trail.
     * An empty directory renders a placeholder message.
     *
     * @since 2.0.0
     */

    private async handleDirectory(fullPath: string, requestPath: string, res: ServerResponse): Promise<void> {
        const files = await readdir(fullPath);
        let fileList = files.map(file => {
            const fullPath = join(requestPath, file);
            const ext = extname(file).slice(1) || 'folder';

            if (ext === 'folder') {
                return `
                    <a href="/${ fullPath }" class="folder-row">
                        <div class="icon"><i class="fa-solid fa-folder"></i></div>
                        <div class="meta"><div class="name">${ file }</div><div class="sub">Folder</div></div>
                    </a>
                `;
            }

            return `
                <a href="/${ fullPath }" class="file-row">
                    <div class="icon"><i class="fa-solid fa-file-code"></i></div>
                    <div class="meta"><div class="name">${ file }</div><div class="sub">${ ext }</div></div>
                </a>
            `;
        }).join('');

        if (!fileList) {
            fileList = '<div class="empty">No files or folders here.</div>';
        } else {
            fileList = `<div class="list">${ fileList }</div>`;
        }

        let activePath = '/';
        const segments = requestPath.split('/').map(path => {
            activePath += `${ path }/`;

            return `<li><a href="${ activePath }">${ path }</a></li>`;
        }).join('');

        const htmlResult = html.replace('${ fileList }', fileList)
            .replace('${ paths }', '<li><a href="/">root</a></li>' + segments)
            .replace('${ up }', '/' + requestPath.split('/').slice(0, -1).join('/'));

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlResult);
    }

    /**
     * Serves a single file with its detected content type.
     *
     * @param fullPath - Absolute path of the file to serve.
     * @param res - The response to write to.
     *
     * @remarks
     * Resolves the MIME type via {@link getContentType}, defaulting to a `txt` extension when the file has none.
     *
     * @see getContentType
     * @since 2.0.0
     */

    private async handleFile(fullPath: string, res: ServerResponse): Promise<void> {
        const ext = extname(fullPath).slice(1) || 'txt';
        const contentType = this.getContentType(ext);

        const data = await readFile(fullPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    }

    /**
     * Sends a `404 Not Found` response.
     *
     * @param res - The response to write to.
     *
     * @since 2.0.0
     */

    private sendNotFound(res: ServerResponse): void {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }

    /**
     * Logs an error and sends a `500 Internal Server Error` response.
     *
     * @param res - The response to write to.
     * @param error - The error to log.
     *
     * @since 2.0.0
     */

    private sendError(res: ServerResponse, error: Error): void {
        console.error(prefix(), error.toString());
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}
