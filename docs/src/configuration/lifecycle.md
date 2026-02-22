# Build Lifecycle Hooks

Build lifecycle hooks are configured under `lifecycle` inside `common` or each variant.

## Available Hooks

- `onStart(context)`
- `onResolve(context)`
- `onLoad(context)`
- `onEnd(context)`
- `onSuccess(context)`

## Async Support

All lifecycle hooks support both synchronous and asynchronous handlers.

- You can return directly (sync)
- Or use `async` / `Promise` (async)

```ts
lifecycle: {
  async onStart(context) {
    await Promise.resolve();
    console.log('async start', context.variantName);
  },
  async onLoad(context) {
    if (context.args.path.endsWith('.txt')) {
      return {
        contents: `export default ${JSON.stringify(context.contents.toString())}`,
        loader: 'js'
      };
    }
  },
  async onEnd(context) {
    await Promise.resolve();
    console.log('async end', context.duration);
  }
}
```

## Context Overview

All hooks receive shared data:

- `context.variantName`
- `context.argv`
- `context.stage`

Hook-specific context:

- `onStart`: `context.build`
- `onResolve`: `context.args` (`OnResolveArgs`)
- `onLoad`: `context.args`, `context.contents`, `context.loader`
- `onEnd` / `onSuccess`: `context.buildResult`, `context.duration`

## Example

```ts
lifecycle: {
  onStart(context) {
    console.log('build start', context.variantName);
  },
  onResolve(context) {
    if (context.args.path.startsWith('@/')) {
      return { path: context.args.path.replace(/^@\//, 'src/') };
    }
  },
  onLoad(context) {
    if (context.args.path.endsWith('.txt')) {
      return {
        contents: `export default ${JSON.stringify(context.contents.toString())}`,
        loader: 'js'
      };
    }
  },
  onEnd(context) {
    console.log('build end', context.duration);
  },
  onSuccess(context) {
    console.log('build success', context.variantName);
  }
}
```

## Related

- `serve` hooks (`onRequest`, `onStart`) are server-level, not build lifecycle hooks.
- See `./serve.md` for server behavior.
