/**
 * Import will remove at compile time
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { ServerConfigurationInterface } from '@server/interfaces/server.interface';

/**
 * Imports
 */

import * as http from 'http';
import * as https from 'https';
import { extname } from 'path';
import { readFileSync } from 'fs';
import html from './html/server.html';
import { inject } from '@symlinks/symlinks.module';
import { prefix } from '@components/banner.component';
import { readdir, stat, readFile } from 'fs/promises';
import { resolve, join } from '@components/path.component';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FrameworkService } from '@services/framework.service';

/**
 * Provides a basic HTTP/HTTPS server module with static file serving
 * and directory listing capabilities.
 *
 * @remarks
 * The `ServerModule` supports serving static files, directories, and
 * optional HTTPS configuration. It handles request logging and error
 *  responses and can invoke user-defined hooks via the configuration.
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
     * The underlying HTTP or HTTPS server instance.
     *
     * @remarks
     * This property holds the active server instance created by either {@link startHttpServer}
     * or {@link startHttpsServer}. It remains undefined until {@link start} is called.
     * The server instance is used to manage the lifecycle of the HTTP/HTTPS server,
     * including stopping and restarting operations.
     *
     * @see start
     * @see stop
     * @see restart
     * @see startHttpServer
     * @see startHttpsServer
     *
     * @since 2.0.0
     */

    private server?: http.Server;

    /**
     * Normalized absolute root directory for serving files.
     *
     * @readonly
     * @since 2.0.0
     */

    private readonly rootDir: string;

    /**
     * Injected {@link FrameworkService} instance used for path resolution and framework assets.
     *
     * @readonly
     * @see FrameworkService
     *
     * @since 2.0.0
     */

    private readonly framework = inject(FrameworkService);

    /**
     * Initializes a new {@link ServerModule} instance.
     *
     * @param config - Server configuration including host, port, HTTPS options, and hooks.
     * @param dir - Root directory from which files will be served.
     *
     * @example
     * ```ts
     * import { ServerProvider } from './server-provider';
     *
     * const serverConfig = {
     *     port: 8080,
     *     keyfile: './path/to/keyfile',
     *     certfile: './path/to/certfile',
     *     onRequest: (req, res, next) => { /* custom request handling *\/ }
     * };
     * const provider = new ServerProvider(serverConfig, './public');
     * provider.start();
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
     * Starts the HTTP or HTTPS server based on configuration.
     *
     * @returns A promise that resolves when the server is fully started and listening.
     *
     * @remarks
     * This method performs the following steps:
     * 1. Invokes the optional {@link ServerConfigurationInterface.onStart} hook if provided.
     * 2. Determines whether to start an HTTPS or HTTP server based on the {@link ServerConfigurationInterface.https} flag.
     * 3. Calls {@link startHttpsServer} if HTTPS is enabled, otherwise calls {@link startHttpServer}.
     *
     * @example
     * ```ts
     * const server = new ServerModule({
     *   port: 3000,
     *   host: 'localhost',
     *   https: true,
     *   onStart: () => console.log('Server starting...')
     * }, '/var/www');
     * await server.start();
     * ```
     *
     * @see stop
     * @see restart
     * @see startHttpServer
     * @see startHttpsServer
     * @see ServerConfigurationInterface
     *
     * @since 2.0.0
     */

    async start(): Promise<void> {
        if (this.config.https)
            return await this.startHttpsServer();

        await this.startHttpServer();
    }

    /**
     * Stops the running HTTP or HTTPS server.
     *
     * @returns A promise that resolves when the server is fully stopped.
     *
     * @remarks
     * This method gracefully shuts down the server by closing all active connections.
     * If no server is currently running, it logs a message and returns early.
     * Once stopped, the {@link server} instance is set to `undefined`.
     *
     * @example
     * ```ts
     * const server = new ServerModule({ port: 3000, host: 'localhost' }, '/var/www');
     * server.start();
     * // Later...
     * await server.stop();
     * ```
     *
     * @see start
     * @see server
     * @see restart
     *
     * @since 2.0.0
     */

    async stop(): Promise<void> {
        if (!this.server) {
            console.log(prefix(), xterm.gray('No server is currently running.'));

            return;
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
     * Restarts the HTTP or HTTPS server.
     *
     * @returns A promise that resolves when the server has been stopped and restarted.
     *
     * @remarks
     * This method performs a graceful restart by first calling {@link stop} to shut down
     * the current server instance, then calling {@link start} to create a new server
     * with the same configuration. This is useful when configuration changes need to be
     * applied or when recovering from errors.
     *
     * @example
     * ```ts
     * const server = new ServerModule({ port: 3000, host: 'localhost' }, '/var/www');
     * server.start();
     * // Later, restart the server...
     * await server.restart();
     * ```
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
     * Updates the configuration with the actual port assigned by the system.
     *
     * @remarks
     * This method is called after the server starts listening to retrieve and store the
     * actual port number when port `0` was specified in the configuration. When port `0`
     * is used, the operating system automatically assigns an available port, and this
     * method captures that assigned port for use throughout the application.
     *
     * **When this method is needed**:
     * - {@link ServerConfigurationInterface.port} is set to `0` (dynamic port allocation)
     * - The server has started and bound to a port
     * - The actual port needs to be known for logging, testing, or external configuration
     *
     * **Behavior**:
     * 1. Checks if the configured port is `0` (indicating dynamic allocation request)
     * 2. Retrieves the address information from the active server using {@link Server.address}
     * 3. Validates that the address is an object containing a port property
     * 4. Updates {@link config.port} with the system-assigned port number
     *
     * This is particularly useful in:
     * - Testing environments where multiple servers run simultaneously
     * - CI/CD pipelines where port conflicts must be avoided
     * - Containerized deployments with dynamic port mapping
     * - Development tools that spawn multiple server instances
     *
     * The method safely handles cases where the server address might not be available
     * or might not be in the expected format, preventing runtime errors.
     *
     * @example
     * ```ts
     * // Configuration with dynamic port
     * const config = { port: 0, host: 'localhost' };
     * const server = new ServerModule(config, '/var/www');
     *
     * await server.start();
     * // After start, setActualPort() is called internally
     *
     * console.log(config.port); // Now shows actual assigned port, e.g., 54321
     *
     * // Use case: Testing with dynamic ports
     * async function createTestServer() {
     *   const config = { port: 0, host: 'localhost' };
     *   const server = new ServerModule(config, './public');
     *   await server.start();
     *   // setActualPort() has updated config.port
     *   return { server, port: config.port }; // Return actual port for tests
     * }
     *
     * const { server, port } = await createTestServer();
     * console.log(`Test server running on port ${port}`);
     * ```
     *
     * @see Server.address
     * @see startHttpServer
     * @see startHttpsServer
     * @see ServerConfigurationInterface.port
     *
     * @since 2.0.0
     */

    private setActualPort(): void {
        if (this.config.port === 0) {
            const address = this.server!.address();
            if(address && typeof address === 'object' && address.port)
                this.config.port = address.port;
        }
    }

    /**
     * Starts an HTTP server.
     *
     * @returns A promise that resolves when the server is listening and ready to accept connections.
     *
     * @remarks
     * Creates an HTTP server instance using Node.js's built-in {@link http} module.
     * All incoming requests are passed to {@link handleRequest}, which routes them to
     * {@link defaultResponse} for serving static files or directories.
     *
     * The server listens on the configured {@link ServerConfigurationInterface.host} and
     * {@link ServerConfigurationInterface.port} from the {@link config}.
     *
     * @example
     * ```ts
     * const server = new ServerModule({ port: 3000, host: 'localhost' }, '/var/www');
     * await server.start(); // Internally calls startHttpServer if HTTPS is not configured
     * ```
     *
     * @see start
     * @see handleRequest
     * @see defaultResponse
     * @see ServerConfigurationInterface
     *
     * @since 2.0.0
     */

    private startHttpServer(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, () => this.defaultResponse(req, res));
            });

            this.server.listen(this.config.port, this.config.host, () => {
                this.setActualPort();
                this.config.onStart?.({
                    host: this.config.host!,
                    port: this.config.port!,
                    url: `http://${ this.config.host }:${ this.config.port }`
                });
                resolve();
            });
        });
    }

    /**
     * Starts an HTTPS server using configured certificate and key files.
     *
     * @returns A promise that resolves when the server is listening and ready to accept connections.
     *
     * @remarks
     * Creates an HTTPS server instance using Node.js's built-in {@link https} module.
     * If {@link ServerConfigurationInterface.key} or {@link ServerConfigurationInterface.cert}
     * are not provided in the configuration, defaults are loaded from the framework's
     * distribution path at `certs/server.key` and `certs/server.crt`.
     *
     * All incoming requests are passed to {@link handleRequest}, which routes them to
     * {@link defaultResponse} for serving static files or directories.
     *
     * The server listens on the configured {@link ServerConfigurationInterface.host} and
     * {@link ServerConfigurationInterface.port} from the {@link config}.
     *
     * @example
     * ```ts
     * const server = new ServerModule({
     *   port: 3000,
     *   host: 'localhost',
     *   https: true,
     *   key: './path/to/key.pem',
     *   cert: './path/to/cert.pem'
     * }, '/var/www');
     * await server.start(); // Internally calls startHttpsServer
     * ```
     *
     * @see start
     * @see handleRequest
     * @see defaultResponse
     * @see FrameworkService
     * @see ServerConfigurationInterface
     *
     * @since 2.0.0
     */

    private startHttpsServer(): Promise<void> {
        return new Promise((resolve) => {
            const options = {
                key: readFileSync(this.config.key ?? join(this.framework.distPath, '..', 'certs', 'server.key')),
                cert: readFileSync(this.config.cert ?? join(this.framework.distPath, '..', 'certs', 'server.crt'))
            };

            this.server = https.createServer(options, (req, res) => {
                this.handleRequest(req, res, () => this.defaultResponse(req, res));
            });

            this.server.listen(this.config.port, this.config.host, () => {
                this.setActualPort();
                this.config.onStart?.({
                    host: this.config.host!,
                    port: this.config.port!,
                    url: `https://${ this.config.host }:${ this.config.port }`
                });
                resolve();
            });
        });
    }

    /**
     * Handles incoming HTTP/HTTPS requests, optionally invoking user-defined hooks.
     *
     * @param req - Incoming HTTP request.
     * @param res - Server response object.
     * @param defaultHandler - Callback for default request handling.
     *
     * @remarks
     * If `config.verbose` is true, logs requests to the console.
     * Errors during handling are forwarded to {@link sendError}.
     *
     * @see sendError
     * @since 2.0.0
     */

    private handleRequest(req: IncomingMessage, res: ServerResponse, defaultHandler: () => void): void {
        try {
            if(this.config.verbose) {
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
     * Returns the MIME content type for a given file extension.
     *
     * @param ext - File extension without the leading dot.
     * @returns MIME type string for the provided extension.
     *
     * @since 2.0.0
     */

    private getContentType(ext: string): string {
        const contentTypes: Record<string, string> = {
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
        };

        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * Handles default responses for requests by serving files or directories.
     *
     * @param req - Incoming HTTP request.
     * @param res - Server response.
     *
     * @remarks
     * Ensures the requested path is within the server root.
     * Calls {@link handleDirectory} or {@link handleFile} depending on resource type.
     *
     * @see handleFile
     * @see sendNotFound
     * @see handleDirectory
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
     * Handles directory listing for a request path.
     *
     * @param fullPath - Absolute directory path.
     * @param requestPath - Relative path from the server root.
     * @param res - Server response.
     *
     * @remarks
     * Generates an HTML listing with icons
     * Invalid filenames are skipped.
     *
     * @see fileIcons
     * @since 2.0.0
     */

    private async handleDirectory(fullPath: string, requestPath: string, res: ServerResponse): Promise<void> {
        const files = await readdir(fullPath);
        let fileList = files.map(file => {
            const fullPath = join(requestPath, file);
            const ext = extname(file).slice(1) || 'folder';

            if(ext === 'folder') {
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

        if(!fileList) {
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
     * Serves a static file.
     *
     * @param fullPath - Absolute path to the file.
     * @param res - Server response.
     *
     * @remarks
     * Determines MIME type using {@link getContentType}.
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
     * Sends a 404 Not Found response.
     *
     * @param res - Server response.
     *
     * @since 2.0.0
     */

    private sendNotFound(res: ServerResponse): void {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }

    /**
     * Sends a 500 Internal Server Error response and logs the error.
     *
     * @param res - Server response.
     * @param error - Error object to log.
     *
     * @since 2.0.0
     */

    private sendError(res: ServerResponse, error: Error): void {
        console.error(prefix(), error.toString());
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}
