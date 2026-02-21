# ifndef

`$$ifndef` is a compile-time macro that keeps code when a `define` key is missing or falsy.

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
$$ifndef('DEFINE_NAME', valueOrCallback)
```

## Arguments

| Argument          | Type             | Required | Notes                                  |
|-------------------|------------------|----------|----------------------------------------|
| `defineName`      | `string` literal | Yes      | Must be a string literal, ex: `'PROD'` |
| `valueOrCallback` | `unknown`        | Yes      | Function, expression, or literal       |

## Define Evaluation

`$$ifndef` is enabled when the key is missing from `define` or its value is falsy.

```json
define: {
  DEBUG: true,        // disabled
  PROD: false,        // enabled
  LOG_LEVEL: 'info',  // disabled
  RETRIES: 0          // enabled
}
```

> [!NOTE]
> To inspect real macro replacements, run build with `--verbose` or `-v`.
> ![replacement](/images/replacement.png)

## Examples

### Variable macro (function transform)

Source:

```ts
const $$devOnly = $$ifndef('PROD', () => console.log('dev mode'));
```

Output when enabled:

```ts
function $$devOnly() { return console.log('dev mode'); }
```

Output when disabled:

```ts
undefined
```

### Immediate-call shape (IIFE expression)

Source:

```ts
const $$value = $$ifndef('PROD', (name: string) => {
  return name + ' dev';
})('test');
```

Output when enabled:

```ts
const $$value = ((name: string) => {
  return name + ' dev';
})('test');
```

Output when disabled:

```ts
// The macro call expression is removed (empty replacement).
// Avoid this shape when the define may be truthy.
```

### Standalone expression

Source:

```ts
function initDevTools(): void {
  console.log('init dev tools');
}

$$ifndef('PROD', initDevTools());
```

Output when enabled:

```ts
function initDevTools(): void {
  console.log('init dev tools');
}

(() => { return initDevTools(); })();
```

Output when disabled:

```ts
function initDevTools(): void {
  console.log('init dev tools');
}
```

### Exported typed function (complex example)

Source:

```ts
export const $$complexFunction = $$ifndef('PROD', (value: string, key: number) => {
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
undefined('test', 42);
```

### 5. Exported literals

Source:

```ts
export const $$feature = $$ifndef('PROD', true);
export const $$someValue = $$ifndef('PROD', 40);
```

Output when enabled:

```ts
export const $$feature = true;
export const $$someValue = 40;
```

## Validation Rules

- `$$ifndef` requires exactly 2 arguments.
- The first argument must be a string literal.
- Invalid arg count throws a build error.
- Non-string first argument is not transformed.

## Related

- [`ifdef`](./ifdef.md): inverse behavior (keeps code when key exists and is truthy).
