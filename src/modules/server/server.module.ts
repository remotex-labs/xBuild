/**
 * Import will remove at compile time
 */

import type { Stats } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ServerConfigurationInterface } from './interfaces/server.interface';

/**
 * Imports
 */

import * as http from 'http';
import * as https from 'https';
import html from './html/server.html';
import { extname, join, normalize } from 'path';
import { prefix } from '@components/banner.component';
import { readdir, readFile, readFileSync, stat } from 'fs';
import { xterm } from '@remotex-labs/xansi/xterm.component';

/**
 * A mapping of file extensions to their corresponding icon and color.
 *
 * @remarks
 * This constant provides a standardized way to represent different file types visually in the UI.
 * Each entry maps a file extension (without the dot) to an object containing:
 * - `icon`: A Font Awesome icon class name (without the 'fa-' prefix)
 * - `color`: A hexadecimal color code for the icon
 *
 * File types are grouped by category with consistent visual representation:
 * - Code files (html, css, js) use code-related icons with language-specific colors
 * - Data files (json) use structured data icons with distinctive colors
 * - Image files (png, jpg, jpeg, gif) use the same image icon with a consistent blue color
 * - Text files (txt) use a text document icon with a neutral gray color
 * - Folders have a special entry with a folder icon in yellow
 *
 * The constant is marked with `as const` to ensure type safety when accessing the values.
 *
 * @example
 * ```tsx
 * // Getting icon information for a file by its extension
 * function getFileIconInfo(filename: string) {
 *   const extension = filename.split('.').pop() || '';
 *   return fileIcons[extension] || { icon: 'fa-file', color: '#8e8e8e' };
 * }
 *
 * // Using the icon information in a component
 * function FileIcon({ filename }: { filename: string }) {
 *   const { icon, color } = getFileIconInfo(filename);
 *   return (
 *     <i className={`fa ${icon}`} style={{ color }} aria-hidden="true"></i>
 *   );
 * }
 * ```
 *
 * @since 1.0.0
 */

const fileIcons: Record<string, { icon: string, color: string }> = {
    html: { icon: 'fa-file-code', color: '#d1a65f' },
    css: { icon: 'fa-file-css', color: '#264de4' },
    js: { icon: 'fa-file-code', color: '#f7df1e' },
    ts: { icon: 'fa-file-code', color: '#f7df1e' },
    json: { icon: 'fa-file-json', color: '#b41717' },
    png: { icon: 'fa-file-image', color: '#53a8e4' },
    jpg: { icon: 'fa-file-image', color: '#53a8e4' },
    jpeg: { icon: 'fa-file-image', color: '#53a8e4' },
    gif: { icon: 'fa-file-image', color: '#53a8e4' },
    txt: { icon: 'fa-file-alt', color: '#8e8e8e' },
    folder: { icon: 'fa-folder', color: '#ffb800' }
} as const;

export class ServerModule {
    /**
     * The root directory path from which static files will be served.
     *
     * @since 1.0.0
     */


    private readonly rootDir: string;

    /**
     * Creates an instance of ServerProvider.
     *
     * @param config - The server configuration object that controls server behavior
     * @param dir - The root directory path from which static files will be served
     *
     * @throws Error If the provided directory path does not exist or is not accessible
     *
     * @remarks
     * The constructor initializes a new server provider with the specified configuration and root directory.
     *
     * The `config` parameter contains server settings:
     * - `port`: The TCP port number on which the server will listen
     * - `host`: The hostname or IP address to bind the server to
     * - `key`: Optional path to the SSL key file for HTTPS support
     * - `cert`: Optional path to the SSL certificate file for HTTPS support
     * - `https`: Optional flag to enable HTTPS server (requires key and cert)
     * - `verbose`: Optional flag to enable detailed request logging
     * - `onRequest`: Optional callback function for custom request handling
     * - `onStart`: Optional callback function that runs before the server starts
     *
     * The `dir` parameter is normalized internally to ensure consistent path handling across
     * different operating systems. The normalized path is stored in the `rootDir` property.
     *
     * @example
     * ```ts
     * // Basic HTTP configuration
     * const server = new ServerModule({
     *   port: 8080,
     *   host: 'localhost'
     * }, './public');
     *
     * // HTTPS configuration
     * const secureServer = new ServerModule({
     *   port: 443,
     *   host: 'example.com',
     *   https: true,
     *   key: './certs/server.key',
     *   cert: './certs/server.crt'
     * }, './www');
     *
     * // With custom request handler and startup hook
     * const customServer = new ServerModule({
     *   port: 3000,
     *   host: '0.0.0.0',
     *   verbose: true,
     *   onRequest: (req, res, next) => {
     *     console.log(`Request received: ${ req.url }`);
     *     next();
     *   },
     *   onStart: async () => {
     *     console.log('Server is about to start...');
     *   }
     * }, './public');
     *
     * // Start the server
     * server.start();
     * ```
     *
     * @since 1.0.0
     */

    constructor(private config: ServerConfigurationInterface, dir: string) {
        this.rootDir = normalize(dir);
    }

    /**
     * Starts the server based on the configuration.
     *
     * @throws Error If the HTTPS server fails to start due to invalid certificates or if port binding fails
     *
     * @remarks
     * This method initializes and starts either an HTTP or HTTPS server depending on the configuration.
     * If the `https` flag is set to true in the configuration, an HTTPS server will be started
     * using the provided SSL certificate and key files. Otherwise, an HTTP server will be started.
     *
     * Before starting the server, this method will execute any `onStart` callback provided
     * in the configuration. The `onStart` callback is executed synchronously.
     *
     * @example
     * ```ts
     * // Basic server start
     * server.start();
     *
     * // Start with error handling
     * try {
     *   server.start();
     *   console.log('Server started successfully');
     * } catch (error) {
     *   console.error('Failed to start server:', error);
     * }
     * ```
     *
     * @since 1.0.0
     */

    start(): void {
        if (this.config.onStart)
            this.config.onStart();

        if (this.config.https)
            return this.startHttpsServer();

        this.startHttpServer();
    }

    /**
     * Starts an HTTP server based on the configuration.
     * @throws Error - If the server fails to bind to the specified host and port
     *
     * @since 1.0.0
     */

    private startHttpServer(): void {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res, () => this.defaultResponse(req, res));
        });

        server.listen(this.config.port, this.config.host, () => {
            console.log(`${ prefix() } HTTP server is running at ${
                xterm.canaryYellow(`http://${ this.config.host }:${ this.config.port }`)
            }`);
        });
    }

    /**
     * Starts an HTTPS server based on the configuration.
     *
     * @throws Error -  If the SSL certificate files cannot be read,
     * or if the server fails to bind to the specified host and port
     *
     * @since 1.0.0
     */

    private startHttpsServer(): void {
        const options = {
            key: readFileSync(this.config.key ?? './certs/server.key'),
            cert: readFileSync(this.config.cert ?? './certs/server.crt')
        };

        const server = https.createServer(options, (req, res) => {
            this.handleRequest(req, res, () => this.defaultResponse(req, res));
        });

        server.listen(this.config.port, this.config.host, () => {
            console.log(
                `${ prefix() } HTTPS server is running at ${
                    xterm.canaryYellow(`https://${ this.config.host }:${ this.config.port }`)
                }`
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
     * @since 1.0.0
     */

    private handleRequest(req: IncomingMessage, res: ServerResponse, defaultHandler: () => void): void {
        try {
            if(this.config.verbose) {
                console.log(
                    `${ xterm.burntOrange('[server]') } Request ${ xterm.lightCoral(req.url?.toString() ?? '') }`
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
     * Returns the MIME type for a given file extension.
     * This method maps file extensions to their corresponding MIME types.
     *
     * @param ext - The file extension.
     * @returns The MIME type associated with the file extension.
     *
     * @since 1.0.0
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
     * @throws Error -throw an error if the file or directory cannot be accessed.
     *
     * @since 1.0.0
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
     * Converts the `fs.stat` callback-based method to return a promise.
     *
     * @param path - The file or directory path.
     * @returns A promise that resolves with the file statistics.
     *
     * @since 1.0.0
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
     * @since 1.0.0
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
     * @since 1.0.0
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
     * @param res - The response object.
     *
     * @since 1.0.0
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
     * @since 1.0.0
     */

    private sendError(res: ServerResponse, error: Error): void {
        console.error(prefix(), error.toString());
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}
