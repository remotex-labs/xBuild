# Serve

`serve` is a top-level block. It describes a static server for the build output, and a run that asks for one also
watches, since output nobody rebuilds is not worth serving.

```ts
serve: {
    dir: 'dist',
    start: true,
    host: 'localhost',
    port: 3000
}
```

`--serve` starts the same server from the command line, and carries the directory to serve:

```bash
xBuild --serve          # the configured directory, or dist
xBuild --serve public   # public, where the configuration names no dir of its own
```

A configured `dir` wins over the one the flag carries, so a project that already states where its output lives
gets that directory whichever way the server was asked for.

## Options

| Field       | Type                            | Default       | Notes                                        |
|-------------|---------------------------------|---------------|----------------------------------------------|
| `dir`       | `string`                        | required      | Directory to serve.                          |
| `start`     | `boolean`                       | `false`       | Bring the server up with the build.          |
| `host`      | `string`                        | `'localhost'` | Interface to bind to.                        |
| `port`      | `number`                        | `0`           | Port, or `0` to let the system choose one.   |
| `https`     | `boolean`                       | `false`       | Serve over HTTPS.                            |
| `key`       | `string`                        | bundled       | Private key path, read only with `https`.    |
| `cert`      | `string`                        | bundled       | Certificate path, read only with `https`.    |
| `verbose`   | `boolean`                       | `false`       | Log every request as it arrives.             |
| `onRequest` | `(req, res, next) => void`      |               | Middleware, run before the path is resolved. |
| `onStart`   | `({ host, port, url }) => void` |               | Called once the server is listening.         |

::: warning 🌍 `host` is a decision
`localhost` accepts only connections from the machine itself. `0.0.0.0` binds every interface, which is what makes
the server reachable from another device or from outside a container, and serves the directory to whoever can
reach the port.
:::

## Port `0`

`0` is the default, and asks the system for a free port. The chosen one is written back onto the configuration
object once bound, and `onStart` is called from the listen callback after that, so what it is handed is what was
actually bound rather than what was asked for.

```ts
serve: {
    dir: 'dist',
    port: 0,
    onStart({ url }) {
        console.log(url); // 'http://localhost:54321'
    }
}
```

## `onRequest`

Calling `next` hands the request back to the server. Not calling it takes the request over entirely, which is how
a route or a single-page fallback is served alongside the files.

```ts
serve: {
    dir: 'dist',
    onRequest(req, res, next) {
        if (req.url !== '/api/health') return next();
        res.end('ok');
    }
}
```

It runs before the path is resolved, so a request that would be refused as outside the root still reaches it.

## HTTPS

```ts
serve: {
    dir: 'dist',
    start: true,
    https: true,
    key: './certs/dev.key',
    cert: './certs/dev.crt'
}
```

With `https: true` and neither `key` nor `cert` given, the self-signed pair shipped with the package stands in, so
a browser will ask before trusting it.

## Reporting

The server reports through the run's screen rather than to the console, so its address reaches the status line
and its requests are held to the level the run reports at. Request lines appear only at `logLevel: 'verbose'`, or
after pressing `v`, one line being worth little against a page that fetches thirty files.

## Using the server directly

`ServerModule` is exported, takes its configuration and the directory separately, and reports what it does as a
stream rather than writing anything itself:

```ts
import { ServerModule } from '@remotex-labs/xbuild';

const server = new ServerModule({ port: 3000, host: 'localhost' }, 'dist');

server.subscribe(event => {
    if (event.type === 'start') console.log(event.url); // 'http://localhost:3000'
});

await server.start();
```

Events are discriminated on `type`: `start` carries the address it settled on, `stop` carries whether a server was
up at all, `request` names what was asked for, and `error` carries the failure.

::: tip 🔭 Streams
The stream is a subject from [xObservable](https://remotex-labs.github.io/xObservable/), so `pipe` and the
operators it ships work on it.
:::

## See also

- [config.xbuild.ts](/configuration/file)
- [Watch](/configuration/watch)
- [Programmatic API](/advanced/programmatic)
