# Serve Configuration

The `serve` option in your `xbuild.config.ts` allows you to launch an HTTP/HTTPS server to serve your built output.

You can also enable this from the command line using:

```bash
xbuild -s
# or
xbuild --serve
```

## `ServeInterface`

Defines configuration options for the built-in server.

### Example

```ts
const config = {
  serve: {
    active: true,
    port: 8080,
    host: 'localhost',
    keyfile: '/path/to/ssl/keyfile.pem',
    certfile: '/path/to/ssl/certfile.pem',
    onStart: () => {
      console.log('Server started');
    },
    onRequest: (req, res, next) => {
      console.log('Incoming request');
      next();
    }
  }
}
```

---

### Properties

#### `active: boolean`

Whether to enable the server. Equivalent to passing `-s` or `--serve` via CLI.

#### `port: number`

Port number for the server to listen on.

#### `host: string`

Hostname for the server (e.g., `"localhost"` or `"0.0.0.0"`).

#### `keyfile?: string`

Path to the SSL key file (for HTTPS support).

#### `certfile?: string`

Path to the SSL certificate file (for HTTPS support).

#### `onRequest?: (req, res, next) => void`

A custom request handler. Runs on every HTTP request. You must call `next()` to continue.

#### `onStart?: () => void`

Callback that runs once the server starts.

## CLI Activation

To quickly enable the server without modifying the config file, use:

```bash
xbuild -s
# or
xbuild --serve
```

This is equivalent to setting:

```ts
serve: {
  active: true
}
```
