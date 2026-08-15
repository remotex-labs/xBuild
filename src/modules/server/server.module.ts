/**
 * Type-only imports erased during TypeScript compilation.
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
import { prefix } from '@ui/banner.ui';
import { join } from '@remotex-labs/xmap';
import { inject } from '@remotex-labs/xinject';
import { readdir, stat, readFile } from 'fs/promises';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FrameworkService } from '@services/framework.service';

/**
 * Serves one directory over HTTP or HTTPS, files and listings alike.
 *
 * @remarks
 * Meant for looking at build output while developing: a request maps to a path under the root, a file is sent with a
 * content type guessed from its extension, and a directory is rendered as a browsable listing.
 * A configuration can take a request over before any of that happens, which is the hook to reach for when the output
 * needs an API beside it or a single-page fallback.
 * Constructed rather than injected, so a build can run several of them over different roots at once.
 *
 * @example
 * ```ts
 * const server = new ServerModule({ port: 0, verbose: true }, 'dist');
 *
 * await server.start();  // resolves once listening, after onStart has run
 * server.config.port;    // 54321 - the port the system picked, written back
 * await server.stop();
 * ```
 *
 * @see ServerConfigurationInterface
 * @since 2.0.0
 */

export class ServerModule {

    /**
     * Node server currently listening, absent until {@link start} and again after {@link stop}.
     *
     * @remarks
     * Holds either an HTTP or an HTTPS server, the two being interchangeable here - `https.Server` extends the type.
     * Its presence is what {@link stop} treats as whether anything is running.
     *
     * @since 2.0.0
     */

    private server?: http.Server;

    /**
     * Absolute directory every request is resolved inside.
     *
     * @remarks
     * Resolved once in the constructor, so a later change to the working directory cannot move what is being served.
     *
     * @since 2.0.0
     */

    private readonly rootDir: string;

    /**
     * Framework service, consulted for the directory the bundled certificates ship in.
     *
     * @remarks
     * Only reached when HTTPS is started without a key and certificate of its own.
     *
     * @see FrameworkService
     * @since 2.0.0
     */

    private readonly framework = inject(FrameworkService);

    /**
     * Creates a server over one directory.
     *
     * @param config - How to listen and what to do with requests
     * @param dir - Directory to serve, resolved to an absolute path immediately
     *
     * @remarks
     * The configuration is kept by reference and written back to: the host and port defaults land on it here,
     * and the port the system assigns lands on it once listening.
     * The object the caller passed is therefore also how the caller learns what was bound.
     * A port of `0`, which is also the default, leaves the choice to the operating system.
     *
     * @example
     * ```ts
     * const config = { port: 8080, https: true, onRequest: (req, res, next) => next() };
     * const server = new ServerModule(config, './public');
     *
     * config.host; // 'localhost' - defaulted here, on the caller's own object
     * ```
     *
     * @see ServerConfigurationInterface
     * @since 2.0.0
     */

    constructor(readonly config: ServerConfigurationInterface, dir: string) {
        this.rootDir = FrameworkService.resolve(dir);
        this.config.port ||= 0;
        this.config.host ||= 'localhost';
    }

    /**
     * Starts listening, over HTTPS when the configuration asks for it.
     *
     * @returns A promise settling once the server is listening
     *
     * @remarks
     * The `onStart` hook runs from the listen callback, so it has already been called - and the assigned port already
     * written back - by the time this resolves.
     * Nothing guards against starting twice: a second call replaces the reference and leaves the first server
     * listening with no way left to close it, so reach for {@link restart} rather than starting again.
     *
     * @example
     * ```ts
     * const server = new ServerModule({ port: 3000, onStart: ({ url }) => console.log(url) }, 'dist');
     * await server.start(); // logs 'http://localhost:3000'
     * ```
     *
     * @see stop
     * @see restart
     *
     * @since 2.0.0
     */

    async start(): Promise<void> {
        if (this.config.https)
            return await this.startHttpsServer();

        await this.startHttpServer();
    }

    /**
     * Closes the server and waits for it to finish.
     *
     * @returns A promise settling once every connection has ended
     *
     * @throws Error - Reported by Node when the server was already closed underneath
     *
     * @remarks
     * Closing refuses new connections and waits on the ones in flight, so a request being served delays this rather
     * than being cut off.
     * Stopping when nothing is running is not an error - it reports as much and returns.
     *
     * @example
     * ```ts
     * await server.stop(); // 'Server stopped.'
     * await server.stop(); // 'No server is currently running.'
     * ```
     *
     * @see start
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
     * Stops the server and starts it again.
     *
     * @returns A promise settling once the new server is listening
     *
     * @remarks
     * Reads the configuration afresh on the way back up, so an edit made while it was running takes effect.
     * A port left at `0` is no longer `0` by then, since the previous run wrote the assigned one back,
     * so a restart keeps the port it was given rather than asking for another.
     *
     * @example
     * ```ts
     * server.config.verbose = true;
     * await server.restart(); // 'Restarting server...' then listening again, now logging requests
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
     * Writes the port the system assigned back onto the configuration.
     *
     * @remarks
     * Only a configured `0` is replaced, that being the value which means the choice was left to the operating system.
     * A port asked for by number is already what was bound.
     * Called from the listen callback, before `onStart`, so the hook and every later reader see the real port.
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
     * Creates and starts the plain HTTP server.
     *
     * @returns A promise settling once the server is listening
     *
     * @remarks
     * Every request goes through {@link handleRequest}, which is handed the default handling as a callback so a
     * configuration hook can decide whether to run it.
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
     * Creates and starts the HTTPS server.
     *
     * @returns A promise settling once the server is listening
     *
     * @throws Error - Raised when a key or certificate cannot be read
     *
     * @remarks
     * A configuration naming neither key nor certificate falls back to the pair shipped with the framework,
     * so HTTPS can be switched on without producing one first.
     * That pair is self-signed, so a browser will warn about it, which is what a development server can live with.
     * Both files are read synchronously, before anything is listening, so a missing one fails the start rather than
     * the first request.
     *
     * @since 2.0.0
     */

    private startHttpsServer(): Promise<void> {
        return new Promise((resolve) => {
            const options = {
                key: readFileSync(this.config.key ?? join(this.framework.frameworkRoot, '..', 'certs', 'server.key')),
                cert: readFileSync(this.config.cert ?? join(this.framework.frameworkRoot, '..', 'certs', 'server.crt'))
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
     * Passes a request to the configuration's hook, or to the default handling when there is none.
     *
     * @param req - Request as it arrived
     * @param res - Response to write to
     * @param defaultHandler - The static-file handling, for the hook to call or to skip
     *
     * @remarks
     * A hook that never calls the handler owns the response entirely, which is what makes an API route or a
     * single-page fallback possible.
     * Only what throws synchronously reaches the error response here - the default handling is asynchronous and
     * catches its own failures, and a hook that rejects a promise of its own is beyond this.
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
     * Maps a file extension to the content type it is served as.
     *
     * @param ext - Extension without its dot
     * @returns The matching content type, or the binary fallback for an extension not listed
     *
     * @remarks
     * Covers what a build emits rather than the web at large.
     * TypeScript is served as plain text so a browser shows a source file instead of downloading it, and the binary
     * fallback means an unlisted extension downloads rather than being guessed at.
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
     * Resolves a request to a path under the root and serves whatever is there.
     *
     * @param req - Request as it arrived
     * @param res - Response to write to
     *
     * @remarks
     * The request path is joined onto the root and the result checked for the root prefix,
     * so a path climbing out with `..` is refused with a 403.
     * The check is by prefix rather than true containment,
     * so a sibling directory whose name starts with the root's own would pass it.
     * A directory is listed and a file is sent.
     * Anything else on disk, a socket or a device, matches neither and the request ends unanswered.
     * A path that cannot be reached at all is reported as missing, and a failed `favicon.ico` is passed over in the
     * log, browsers asking for one unprompted on every visit.
     *
     * @see handleFile
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
     * Renders a directory as a browsable listing.
     *
     * @param fullPath - Absolute path of the directory to list
     * @param requestPath - The same directory as the request spelled it, relative to the root
     * @param res - Response to write to
     *
     * @remarks
     * Entries are told apart by whether they have an extension, so a directory carrying a dot in its name is drawn as
     * a file - a listing being navigation rather than a report.
     * The request path is also split into a trail of links, each segment standing for the directory it names, which
     * is what lets a visitor climb back out.
     * Names are put into the template as they are, so a filename containing markup reaches the page intact.
     *
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
     * Sends one file.
     *
     * @param fullPath - Absolute path of the file to send
     * @param res - Response to write to
     *
     * @remarks
     * Read whole before anything is written, so the response carries no length and a large file is held in memory
     * rather than streamed - which a development server serving its own build output can afford.
     * A file with no extension is treated as text.
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
     * Answers a request that reached nothing.
     *
     * @param res - Response to write to
     *
     * @remarks
     * Plain text rather than the listing template, the answer being for whatever asked rather than for a reader.
     *
     * @since 2.0.0
     */

    private sendNotFound(res: ServerResponse): void {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }

    /**
     * Answers a request that failed, and reports why.
     *
     * @param res - Response to write to
     * @param error - The failure to report
     *
     * @remarks
     * The reason is logged rather than sent, so a stack trace reaches the developer running the server and not
     * whoever is connected to it.
     *
     * @since 2.0.0
     */

    private sendError(res: ServerResponse, error: Error): void {
        console.error(prefix(), error.toString());
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}
