# Release Notes

What shipped in the v1.x line of `@remotex-labs/xbuild`.

## v1.6.0

- **Added**: Glob patterns in `esbuild.entryPoints`, so entry points can be declared as `src/**/*.ts` instead of
  listing every file.

## v1.5.x

- **Added**: `banner` and `footer` accept functions (`() => string`) in addition to plain strings. See the
  [config reference](configuration/file#properties).
- **Added**: `$$`-prefixed class methods are stripped like `$$` functions when their definition is removed. See
  [ifdef](macros/ifdef).
- **Changed**: `.html` files load with the `text` loader.

## v1.3.0

- **Changed**: Build error handling was centralized: [lifecycle hooks](configuration/lifecycle) can report `errors`
  and `warnings` back to the build, and failures across `run`, `serve`, and debug flows go through a single execution
  path.

## v1.2.0

- **Added**: `--typeCheck` / `--tc` CLI option to run TypeScript type checking as a standalone action. See
  [CLI options](configuration/cli).

## v1.1.0

- **Added**: `tsconfig.json` path aliases resolve to relative paths in the output (resolve-alias plugin).
- **Changed**: [`ifdef`](macros/ifdef) comment markers are removed from the emitted code.

## v1.0.0

Initial release: an esbuild-powered build tool configured through `xbuild.config.ts`.

- [`xbuild.config.ts`](configuration/file) with esbuild options, TypeScript declaration output (`declaration`, `bundleDeclaration`), and multi-config arrays.
- [Lifecycle hooks](configuration/lifecycle): `onStart`, `onResolve`, `onLoad`, `onEnd`, `onSuccess`.
- [Conditional code](macros/ifdef) with `// ifdef` blocks and `$$` function stripping, driven by `define`.
- [Dev server](configuration/serve) (HTTP/HTTPS) plus watch mode and a Node.js dev runner.
- [Programmatic API](advanced/programmatic): `build`, `buildWithConfigPath`, `buildWithArgv`.

## See also

- [Getting Started](guide)
- [`xbuild.config.ts` reference](configuration/file)
