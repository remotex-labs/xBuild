# Serve Configuration

The `serve` option in `xbuild.config.ts` launches an HTTP or HTTPS server that serves the build output.

Enable it from the command line without touching the config:

```bash
xbuild -s
# or
xbuild --serve
```

This is equivalent to setting `serve: { active: true }`.

## Example

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
};
```

## Properties

| Property    | Type                       | Description                                                            |
|-------------|----------------------------|------------------------------------------------------------------------|
| `active`    | `boolean`                  | Enable the server. Equivalent to `-s` / `--serve` on the CLI.          |
| `port`      | `number`                   | Port to listen on.                                                     |
| `host`      | `string`                   | Hostname, e.g. `"localhost"` or `"0.0.0.0"`.                           |
| `keyfile`   | `string?`                  | Path to the SSL key file (enables HTTPS).                              |
| `certfile`  | `string?`                  | Path to the SSL certificate file (enables HTTPS).                      |
| `onRequest` | `(req, res, next) => void` | Custom handler run on every request. Call `next()` to continue.        |
| `onStart`   | `() => void`               | Callback run once the server starts.                                   |

## See also

- [CLI options](cli)
- [`xbuild.config.ts` reference](file)
