/**
 * Import will remove at compile time
 */

import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Represents the configuration options for a server instance.
 *
 * @remarks
 * These options control server behavior, including host, port,
 * HTTPS settings, verbosity, and lifecycle hooks.
 *
 * @since 2.0.0
 */

export interface ServerConfigurationInterface {
    /**
     * The port number the server will listen to.
     *
     * @remarks
     * Specifies which port the server should bind to. Port behavior:
     * - If not specified: Defaults to `0`
     * - If set to `0`: The system will automatically assign an available port
     * - If not specified: Uses the default port configuration
     * - Valid range: 0-65535
     *
     * Using port `0` is useful for:
     * - Running multiple server instances without port conflicts
     * - Testing environments where specific ports aren't required
     * - Dynamic port allocation in containerized deployments
     *
     *
     * @since 2.0.0
     */

    port?: number;

    /**
     * The hostname or IP address the server will bind to.
     *
     * @remarks
     * Specifies the network interface the server should listen on:
     * - If not specified: Defaults to `localhost` (127.0.0.1)
     * - Use `'0.0.0.0'`: Listen on all network interfaces (accessible externally)
     * - Use `'localhost'` or `'127.0.0.1'`: Local machine only
     * - Use specific IP: Bind to a particular network interface
     *
     * Common configurations:
     * - Development: `localhost` (default) - local access only
     * - Production: `0.0.0.0` - accessible from network
     * - Docker: `0.0.0.0` - allow container external access
     *
     * @since 2.0.0
     */

    host?: string;

    /**
     * Optional path to the SSL key file, required if HTTPS is enabled
     * @since 2.0.0
     */

    key?: string;

    /**
     * Optional path to the SSL certificate file, required if HTTPS is enabled
     * @since 2.0.0
     */

    cert?: string;

    /**
     * If true, the server will run using HTTPS
     * @since 2.0.0
     */

    https?: boolean;

    /**
     * If true, enables verbose logging of server activity
     * @since 2.0.0
     */

    verbose?: boolean;

    /**
     * Hook called on every incoming request.
     *
     * @param req - The incoming HTTP request.
     * @param res - The server response object.
     * @param next - Callback to pass control to the next middleware or handler.
     *
     * @remarks
     * Can be used to implement custom logging, request modification,
     * or authentication before request handling.
     *
     * @since 2.0.0
     */

    onRequest?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

    /**
     * Hook called once the server has started and is listening.
     *
     * @remarks
     * Useful for initialization tasks or logging server start events.
     *
     * @since 2.0.0
     */

    onStart?: (config: { host: string, port: number, url: string }) => void;
}
