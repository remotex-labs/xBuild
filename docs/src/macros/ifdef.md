# ifdef

`$$ifdef` is a compile-time macro that keeps code when a `define` key is present and truthy.

> [!IMPORTANT]
> To get macro autocomplete in TypeScript, add `@remotex-labs/xBuild` to `types` in `tsconfig.json`.
>
> ```json
> {
>   "compilerOptions": {
>     "types": [
>       "node",
>       "@remotex-labs/xBuild"
>     ]
>   }
> }
> ```

## Syntax

```ts
$$ifdef('DEFINE_NAME', valueOrCallback)
```

## Arguments

| Argument          | Type             | Required | Notes                                   |
|-------------------|------------------|----------|-----------------------------------------|
| `defineName`      | `string` literal | Yes      | Must be a string literal, ex: `'DEBUG'` |
| `valueOrCallback` | `unknown`        | Yes      | Function, expression, or literal        |

## Define Evaluation

`$$ifdef` is enabled only when the key exists in `define` and the value is truthy.

```ts
define: {
  DEBUG: true,        // enabled
  PROD: false,        // disabled
  LOG_LEVEL: 'info',  // enabled
  RETRIES: 0          // disabled
}
```

> [!NOTE]
> To inspect real macro replacements, run build with `--verbose` or `-v`.
> ![replacement](/images/replacement.png)

## Examples

### Variable macro (function transform)

Source:

```ts
const $$debug = $$ifdef('DEBUG', () => console.log('debug'));
```

Output when enabled:

```ts
function $$debug() { return console.log('debug'); }
```

Output when disabled:

```ts
undefined
```

### Immediate-call shape (IIFE expression)

Source:

```ts
const $$value = $$ifdef('DEBUG', (name: string) => {
  return name + ' 42';
})('test');
```

Output when enabled:

```ts
const $$value = ((name: string) => {
  return name + ' 42';
})('test');
```

Output when disabled:

```ts
// The macro call expression is removed (empty replacement).
// Avoid this shape when the define may be falsy.
```

### Standalone expression

Source:

```ts
function initDebug(): void {
  console.log('init debug');
}

$$ifdef('DEBUG', initDebug());
```

Output when enabled:

```ts
function initDebug(): void {
  console.log('init debug');
}

(() => { return initDebug(); })();
```

Output when disabled:

```ts
function initDebug(): void {
  console.log('init debug');
}
```

### Exported typed function (complex example)

Source:

```ts
export const $$complexFunction = $$ifdef('DEBUG', (value: string, key: number) => {
  return `${value}-${key}`;
});

$$complexFunction('test', 42);
```

Output when enabled:

```ts
export function $$complexFunction(value: string, key: number) {
  return `${value}-${key}`;
}

$$complexFunction('test', 42);
```

Output when disabled:

```ts
// The macro call expression is removed (empty replacement).
```

### 5. Exported literals

Source:

```ts
export const $$feature = $$ifdef('FEATURE_X', true);
export const $$someValue = $$ifdef('FEATURE_X', 40);
```

Output when enabled:

```ts
export const $$feature = true;
export const $$someValue = 40;
```

## Validation Rules

- `$$ifdef` requires exactly 2 arguments.
- The first argument must be a string literal.
- Invalid arg count throws a build error.
- Non-string first argument is not transformed.

## Related

- [`ifndef`](./ifndef.md): inverse behavior (keeps code when key is missing or falsy).
