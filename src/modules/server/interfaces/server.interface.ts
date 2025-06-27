/**
 * Import will remove at compile time
 */

import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Configuration options for the serve the build.
 *
 * This object allows you to specify various settings related to the server,
 * such as the port, host, SSL/TLS certificates, and request handling functions.
 *
 * @example
 * ```ts
 * const serverConfig = {
 *     serve: {
 *         port: 8080,
 *         host: 'localhost',
 *         https: true, // Use HTTPS instead of HTTP
 *         keyfile: '/path/to/ssl/keyfile.pem',
 *         certfile: '/path/to/ssl/certfile.pem',
 *         onStart: () => {
 *             console.log('Server started');
 *         }
 *         onRequest: (req, res, next) => {
 *             console.log('Server request received');
 *             next();
 *         }
 *     }
 * };
 * ```
 *
 * @since 1.0.0
 */

export interface ServerConfigurationInterface {
    port: number
    host: string
    key?: string
    cert?: string,
    https?: boolean,
    verbose?: boolean,
    onRequest?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
    onStart?: () => void
}
