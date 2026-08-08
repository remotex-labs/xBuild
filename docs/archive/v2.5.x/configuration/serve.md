# Serve Configuration

`serve` is a top-level config object in `config.xbuild.ts`.

## Shape

```ts
serve?: {
  dir: string;
  start?: boolean;
  host?: string;
  port?: number;
  https?: boolean;
  key?: string;
  cert?: string;
  verbose?: boolean;
  onRequest?: (req, res, next) => void;
  onStart?: (config: { host: string; port: number; url: string }) => void;
}
```

## Fields

Required:

- `dir`: folder to serve.

Optional:

- `start`: auto-start server after build.
- `host`: bind host.
- `port`: bind port.
- `https`: enable HTTPS.
- `key`: SSL key path (when HTTPS).
- `cert`: SSL cert path (when HTTPS).
- `verbose`: verbose server logging.
- `onRequest(req, res, next)`: request middleware hook.
- `onStart({ host, port, url })`: callback when server starts.

## Notes

- If `host` is omitted, server defaults to `localhost`.
- If `port` is omitted (or `0`), the system can assign an available port.

## Example (HTTP)

```ts
serve: {
  dir: 'dist',
  start: true,
  host: 'localhost',
  port: 3000,
  verbose: true,
  onRequest(req, res, next) {
    console.log(req.method, req.url);
    next();
  },
  onStart(server) {
    console.log(`Server running at ${server.url}`);
  }
}
```

## Example (HTTPS)

```ts
serve: {
  dir: 'dist',
  start: true,
  https: true,
  key: './certs/dev.key',
  cert: './certs/dev.crt'
}
```

## HTTPS Defaults

When `https: true` and `key`/`cert` are not provided, xBuild uses the default certificate files bundled in the package.
