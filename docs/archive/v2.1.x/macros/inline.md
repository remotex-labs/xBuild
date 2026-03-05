# inline

`$$inline` executes code at build time and replaces the macro call with the evaluated result.

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
$$inline(expressionOrCallback)
```

## Arguments

| Argument               | Type      | Required | Notes                                                                    |
|------------------------|-----------|----------|--------------------------------------------------------------------------|
| `expressionOrCallback` | `unknown` | Yes      | Function expression, arrow function, identifier reference, or expression |

## Evaluation Behavior

- `$$inline` requires exactly 1 argument.
- The argument is evaluated in a sandboxed Node.js context at build time.
- Current replacement values are emitted for:
  - `string`
  - `number`
  - `boolean`
- For `null`, `undefined`, objects, arrays, or unsupported results, replacement becomes `undefined`.

> [!NOTE]
> To inspect real macro replacements, run build with `--verbose` or `-v`.
> ![replacement](/images/replacement.png)

## Example: Compile Information

Source:

```ts
import type { NetworkInterfaceInfo } from 'os';
const $$compileInformation = $$inline(() => {
    const os = require('os');
    const process = require('process');

    // Computer / Host name
    const hostname = os.hostname();

    // Get all network interfaces and find the most likely local IP
    const interfaces = os.networkInterfaces() as Record<string, Array<NetworkInterfaceInfo>>;
    let localIP = 'Not found';

    // Look for common internal network interfaces
    const preferredInterfaces = [ 'en0', 'eth0', 'wlan0', 'Wi-Fi', 'Ethernet' ];

    for (const [ name, addresses ] of Object.entries(interfaces)) {
        for (const addr of addresses) {
            // We want IPv4 and not internal (127.0.0.1)
            if (addr.family === 'IPv4' && !addr.internal) {
                // Prefer common interface names, otherwise take first non-internal IPv4
                if (preferredInterfaces.some(pref => name.toLowerCase().includes(pref.toLowerCase()))) {
                    localIP = addr.address;
                    break;
                }
                if (localIP === 'Not found') {
                    localIP = addr.address;
                }
            }
        }
        if (localIP !== 'Not found' && preferredInterfaces.some(p => name.includes(p))) break;
    }

    // OS information
    const osType = os.type();           // Windows_NT, Linux, Darwin
    const osRelease = os.release();
    const osArch = os.arch();

    // Node.js information
    const nodeVersion = process.version;           // v20.11.1
    const nodeExecPath = process.execPath;

    console.log('═══════════════════════════════════════════════');
    console.log('       Computer / System Information');
    console.log('═══════════════════════════════════════════════');
    console.log(`Hostname / Computer name  : ${ hostname }`);
    console.log(`Local IP address          : ${ localIP }`);
    console.log(`Operating System          : ${ osType } ${ osRelease } (${ osArch })`);
    console.log(`Node.js version           : ${ nodeVersion }`);
    console.log(`Node executable path      : ${ nodeExecPath }`);
    console.log('═══════════════════════════════════════════════');

    return { hostname, localIP, osType, osRelease, osArch, nodeVersion, nodeExecPath };
});

console.log($$compileInformation);

```

Output with the current implementation:

```ts
const $$compileInformation = {"hostname":"<hostname>","localIP":"192.168.1.1","osType":"<osType>","osRelease":"<osRelease>","osArch":"<osArch>","nodeVersion":"<nodeVersion>","nodeExecPath":"<nodeExecPath>"};
```

## Primitive Return Example

Source:

```ts
const $$buildMode = $$inline(() => process.env.NODE_ENV === 'production');
const $$retries = $$inline(() => 3);
const $$label = $$inline(() => 'build-ok');
```

Output:

```ts
const $$buildMode = true;
const $$retries = 3;
const $$label = "build-ok";
```

## Function Reference Example

Source:

```ts
function getPort() {
  return 3000;
}

const port = $$inline(getPort);
```

Output:

```ts
const port = 3000;
```

## Validation Rules

- `$$inline` requires exactly 1 argument.
- Invalid argument count throws a build error.
- Missing function references emit a warning and resolve to `undefined`.
- Runtime errors during evaluation are reported and replacement becomes `undefined`.

## Related

- [`ifdef`](./ifdef.md): conditional inclusion when define is truthy.
- [`ifndef`](./ifndef.md): conditional inclusion when define is missing/falsy.
