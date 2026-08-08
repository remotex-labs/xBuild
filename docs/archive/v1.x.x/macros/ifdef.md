# ifdef

xBuild v1 supports conditional code inclusion through `// ifdef` comment blocks, driven by the `define` object in `xbuild.config.ts`.

## Enabling flags

Add a `define` object to the configuration:

```ts
export default {
    esbuild: {
        entryPoints: [ './src/main.ts' ],
        outdir: 'dist',
        format: 'esm',
        bundle: true
    },
    define: {
        DEBUG: true,      // includes ifdef DEBUG blocks
        FEATURE_X: false  // strips ifdef FEATURE_X blocks
    }
};
```

## Syntax

Wrap the conditional code between `// ifdef <FLAG>` and `// endif` comments:

```ts
// main.ts

console.log('This code always runs');

// ifdef DEBUG
export function $$logger(...args: Array<unknown>): void {
    console.log(...args);
}
// endif

// ifdef FEATURE_X
console.log('Feature X is active');
// endif

$$logger('data'); // removed everywhere if $$logger does not exist
```

If the flag is truthy in `define`, the block stays (the `ifdef`/`endif` comments themselves are removed).
If the flag is falsy or missing, the whole block is stripped from the output.

## `$$` function stripping

Functions and variables whose names start with `$$` get special treatment: when their declaration is removed
(for example because its `ifdef` block was stripped), **every call site is removed too**.

In the example above, when `DEBUG` is not set, both the `$$logger` declaration and the
`$$logger('data')` call disappear - production builds stay clean without manual guards.

Class methods prefixed with `$$` are stripped the same way.

::: warning
Only use `$$` functions for side effects like logging or instrumentation. Code that consumes their
return value will break when the definition is stripped.
:::

## See also

- [`define` in the config reference](../configuration/file#define)
- [Getting Started](../guide)
