/**
 * Import will remove at compile time
 */

import type { Stats } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ServeInterface } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import * as http from 'http';
import * as https from 'https';
import html from './html/server.html';
import { xterm } from '@remotex-labs/xansi';
import { extname, join, resolve } from 'path';
import { prefix } from '@components/banner.component';
import { existsSync, readdir, readFile, readFileSync, stat } from 'fs';

/**
 * A mapping of file extensions to their corresponding icon and color.
 *
 * This record associates common file types with a Font Awesome icon class
 * and a color code for display purposes in a file listing UI. Each file type
 * is represented by an icon and a color that visually distinguishes it.
 *
 * Example:
 * - HTML files are represented by a code icon (`fa-file-code`) with a color of `#d1a65f`.
 * - Image files (e.g., PNG, JPG, GIF) share a common image icon (`fa-file-image`) with a color of `#53a8e4`.
 *
 */

const fileIcons: Record<string, { icon: string, color: string }> = {
    html: { icon: 'fa-file-code', color: '#d1a65f' },
    css: { icon: 'fa-file-css', color: '#264de4' },
    js: { icon: 'fa-file-code', color: '#f7df1e' },
    json: { icon: 'fa-file-json', color: '#b41717' },
    png: { icon: 'fa-file-image', color: '#53a8e4' },
    jpg: { icon: 'fa-file-image', color: '#53a8e4' },
    jpeg: { icon: 'fa-file-image', color: '#53a8e4' },
    gif: { icon: 'fa-file-image', color: '#53a8e4' },
    txt: { icon: 'fa-file-alt', color: '#8e8e8e' },
    folder: { icon: 'fa-folder', color: '#ffb800' }
};


/**
 * Manages the HTTP or HTTPS server based on the provided configuration.
 *
 * The `ServerProvider` class initializes and starts either an HTTP or HTTPS server based on whether SSL certificates
 * are provided. It handles incoming requests, serves static files, and lists directory contents with appropriate
 * icons and colors.
 *
 * @class
 */

export class ServerProvider {
    /**
     * Root dir to serve
     */

    private readonly rootDir: string;

    /**
     * Indicates whether the server is configured to use HTTPS.
     */

    private readonly isHttps: boolean;

    /**
     * The server configuration object, including SSL certificate paths and other settings.
     */

    private readonly config: Required<ServeInterface>;

    /**
     * Creates an instance of ServerProvider.
     *
     * @param config - The server configuration object, including port number, SSL certificate paths, and an optional request handler.
     * @param dir - The root directory from which to serve files.
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
     * This example shows how to create an instance of `ServerProvider` and start the server.
     */

    constructor(config: ServeInterface, dir: string) {
        this.rootDir = resolve(dir);
        this.config = <Required<ServeInterface>> config;
        this.isHttps = this.config.keyfile && this.config.certfile
            ? existsSync(this.config.keyfile) && existsSync(this.config.certfile)
            : false;
    }

    /**
     * Starts the server based on the configuration.
     * If SSL certificates are provided and valid, an HTTPS server is started. Otherwise, an HTTP server is started.
     *
     * @example
     * ```ts
     * provider.start();
     * ```
     *
     * This example demonstrates how to start the server. It will either start an HTTP or HTTPS server based on the configuration.
     */

    start(): void {
        if (this.config.onStart)
            this.config.onStart();

        if (this.isHttps)
            return this.startHttpsServer();

        this.startHttpServer();
    }

    /**
     * Starts an HTTP server.
     * This method creates an HTTP server that listens on the configured port and handles incoming requests.
     *
     * @example
     * ```ts
     * provider.startHttpServer();
     * ```
     *
     * This example shows how the `startHttpServer` method is used internally to start an HTTP server.
     */

    private startHttpServer(): void {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res, () => this.defaultResponse(req, res));
        });

        server.listen(this.config.port, this.config.host, () => {
            console.log(`${ prefix() } HTTP/S server is running at http://${ this.config.host }:${ this.config.port }`);
        });
    }

    /**
     * Starts an HTTPS server.
     *
     * This method creates an HTTPS server with SSL/TLS certificates, listens on the configured port, and handles incoming requests.
     *
     * @example
     * ```ts
     * provider.startHttpsServer();
     * ```
     *
     * This example shows how the `startHttpsServer` method is used internally to start an HTTPS server.
     */

    private startHttpsServer(): void {
        const options = {
            key: readFileSync(this.config.keyfile),
            cert: readFileSync(this.config.certfile)
        };

        const server = https.createServer(options, (req, res) => {
            this.handleRequest(req, res, () => this.defaultResponse(req, res));
        });

        server.listen(this.config.port, this.config.host, () => {
            const server = xterm.canaryYellow(`https://${ this.config.host }:${ this.config.port }`);
            console.log(
                `${ prefix() } HTTPS server is running at ${ server }`
            );
        });
    }

    /**
     * Handles incoming requests.
     *
     * This method checks if a custom request handler is provided in the configuration. If so, it uses the custom handler.
     * Otherwise, it delegates to the default request handler.
     *
     * @param req - The incoming request object.
     * @param res - The response object.
     * @param defaultHandler - The default handler functions to be called if no custom handler is provided.
     *
     * @example
     * ```ts
     * // This method is used internally to handle requests
     * ```
     */

    private handleRequest(req: IncomingMessage, res: ServerResponse, defaultHandler: () => void): void {
        try {
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
     * Returns the MIME type for a given file extension.
     *
     * This method maps file extensions to their corresponding MIME types.
     *
     * @param ext - The file extension.
     * @returns The MIME type associated with the file extension.
     *
     * @example
     * ```ts
     * const mimeType = provider.getContentType('html');
     * console.log(mimeType); // 'text/html'
     * ```
     */

    private getContentType(ext: string): string {
        const contentTypes: Record<string, string> = {
            html: 'text/html',
            css: 'text/css',
            js: 'application/javascript',
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
     * Handles the default response for requests, serving files or directories.
     *
     * This method serves the content of files or directories. If the request is for a directory, it lists the contents with
     * appropriate icons and colors.
     *
     * @param req - The incoming request object.
     * @param res - The response object.
     *
     * @returns A promise that resolves when the response is sent.
     *
     * @throws  Throws an error if the file or directory cannot be accessed.
     *
     * @example
     * ```ts
     * // This method is used internally to handle file and directory responses
     * ```
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
            const stats = await this.promisifyStat(fullPath);

            if (stats.isDirectory()) {
                this.handleDirectory(fullPath, requestPath, res);
            } else if (stats.isFile()) {
                this.handleFile(fullPath, res);
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
     * promisifyStat the `fs.stat` method.
     *
     * Converts the `fs.stat` callback-based method to return a promise.
     *
     * @param path - The file or directory path.
     * @returns A promise that resolves with the file statistics.
     *
     * @example
     * ```ts
     * const stats = await provider.promisifyStat('./path/to/file');
     * console.log(stats.isFile()); // true or false
     * ```
     */

    private promisifyStat(path: string): Promise<Stats> {
        return new Promise((resolve, reject) => {
            stat(path, (err, stats) => (err ? reject(err) : resolve(stats)));
        });
    }

    /**
     * Handles directory listings.
     *
     * Reads the contents of a directory and generates an HTML response with file icons and colors.
     *
     * @param fullPath - The full path to the directory.
     * @param requestPath - The request path for generating relative links.
     * @param res - The response object.
     *
     * @example
     * ```ts
     * // This method is used internally to handle directory listings
     * ```
     */

    private handleDirectory(fullPath: string, requestPath: string, res: ServerResponse): void {
        readdir(fullPath, (err, files) => {
            if (err)
                return this.sendError(res, err);

            const fileList = files.map(file => {
                if (file.match(/[^A-Za-z0-9_\/\\.-]/))
                    return;

                const fullPath = join(requestPath, file);
                if (fullPath.match(/[^A-Za-z0-9_\/\\.-]/))
                    return;

                const ext = extname(file).slice(1) || 'folder';
                const { icon, color } = fileIcons[ext] || fileIcons.folder;

                return `<li><i class="fas ${ icon }" style="color: ${ color };"></i> <a href="/${ fullPath }">${ file }</a></li>`;
            }).join('');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html.replace('${ fileList }', fileList));
        });
    }

    /**
     * Handles file responses.
     *
     * Reads and serves the content of a file.
     *
     * @param fullPath - The full path to the file.
     * @param res - The response object.
     *
     * @example
     * ```ts
     * // This method is used internally to handle file responses
     * ```
     */

    private handleFile(fullPath: string, res: ServerResponse): void {
        const ext = extname(fullPath).slice(1) || 'txt';
        const contentType = this.getContentType(ext);

        readFile(fullPath, (err, data) => {
            if (err) {
                return this.sendError(res, err);
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    }

    /**
     * Sends a 404 Not Found response.
     *
     * @param res - The response object.
     *
     * @example
     * ```ts
     * provider.sendNotFound(response);
     * ```
     *
     * This example demonstrates how to send a 404 response using the `sendNotFound` method.
     */

    private sendNotFound(res: ServerResponse): void {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }

    /**
     * Sends an error response.
     *
     * @param res - The response object.
     * @param error - The error object.
     *
     * @example
     * ```ts
     * provider.sendError(response, new Error('Some error'));
     * ```
     *
     * This example shows how to send an error response using the `sendError` method.
     */

    private sendError(res: ServerResponse, error: Error): void {
        console.error(`${ prefix() }`, error.toString());
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}
