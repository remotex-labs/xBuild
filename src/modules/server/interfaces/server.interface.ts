/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { IncomingMessage, ServerResponse } from 'http';

/**
 * How a server listens and what it does with requests.
 *
 * @remarks
 * Every field is optional, a server with no configuration at all listening on a system-assigned port of `localhost`
 * and serving its root directory as it stands.
 * The object is kept by the server rather than copied, and written back to: the defaults land on it when the server
 * is constructed, and the port does once it is listening.
 *
 * @example
 * ```ts
 * const config: ServerConfigurationInterface = { port: 0, verbose: true };
 * const server = new ServerModule(config, 'dist');
 *
 * await server.start();
 * config.port; // 54321 - no longer the 0 that was passed in
 * ```
 *
 * @since 2.0.0
 */

export interface ServerConfigurationInterface {
    /**
     * Port to listen on, or `0` to let the system choose one.
     *
     * @remarks
     * Defaults to `0`, which is also what an explicit `0` means: the operating system picks a free port, and it is
     * written back here once bound, so this field is how the chosen port is read afterward.
     * That is the value to leave it at when several servers run at once and a fixed port would collide.
     *
     * @example
     * ```ts
     * config.port; // 0 before starting, 54321 after
     * ```
     *
     * @since 2.0.0
     */

    port?: number;

    /**
     * Interface to bind to.
     *
     * @remarks
     * Defaults to `localhost`, which accepts only connections from the machine itself.
     * `0.0.0.0` binds every interface, which is what makes the server reachable from another device or from outside a
     * container - and worth choosing deliberately, the directory being served to whoever can reach the port.
     *
     * @example
     * ```ts
     * config.host; // 'localhost'
     * ```
     *
     * @since 2.0.0
     */

    host?: string;

    /**
     * Path of the private key to serve HTTPS with.
     *
     * @remarks
     * Read once at startup, and only when {@link https} is set.
     * Left out, the key shipped with the framework stands in.
     *
     * @example
     * ```ts
     * config.key; // './certs/server.key'
     * ```
     *
     * @see cert
     * @since 2.0.0
     */

    key?: string;

    /**
     * Path of the certificate to serve HTTPS with.
     *
     * @remarks
     * Read once at startup, and only when {@link https} is set.
     * Left out, the certificate shipped with the framework stands in - self-signed, so a browser will ask before
     * trusting it.
     *
     * @example
     * ```ts
     * config.cert; // './certs/server.crt'
     * ```
     *
     * @see key
     * @since 2.0.0
     */

    cert?: string;

    /**
     * Whether to serve over HTTPS rather than HTTP.
     *
     * @remarks
     * Decides which server is created, and so which scheme the `onStart` hook reports.
     * Neither {@link key} nor {@link cert} is required alongside it, the framework's own pair standing in.
     *
     * @example
     * ```ts
     * config.https; // true - onStart reports a https:// url
     * ```
     *
     * @since 2.0.0
     */

    https?: boolean;

    /**
     * Whether to log every request as it arrives.
     *
     * @remarks
     * Logs the requested url and nothing else, so the output stays readable while a page loads its assets.
     *
     * @example
     * ```ts
     * config.verbose; // true - '[xBuild] Request /index.js' per request
     * ```
     *
     * @since 2.0.0
     */

    verbose?: boolean;

    /**
     * Hook given every request before the server handles it.
     *
     * @param req - Request as it arrived
     * @param res - Response to write to
     * @param next - The static-file handling, to call or to skip
     *
     * @remarks
     * Calling `next` hands the request back to the server.
     * Not calling it takes the request over entirely, which is how a route or a single-page fallback is served
     * alongside the files.
     * It runs before the path is resolved, so a request that would be refused as outside the root still reaches it.
     *
     * @example
     * ```ts
     * config.onRequest = (req, res, next) => {
     *     if (req.url !== '/api/health') return next();
     *     res.end('ok');
     * };
     * ```
     *
     * @since 2.0.0
     */

    onRequest?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

    /**
     * Hook called once the server is listening.
     *
     * @remarks
     * Runs from the listen callback, after the assigned port has been written back,
     * so what it is handed is what was actually bound rather than what was asked for.
     * That is how the url of a server given port `0` is learned.
     *
     * @example
     * ```ts
     * config.onStart = ({ url }) => console.log(url); // 'http://localhost:54321'
     * ```
     *
     * @since 2.0.0
     */

    onStart?: (config: { host: string, port: number, url: string }) => void;
}
