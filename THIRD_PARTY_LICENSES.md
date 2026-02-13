# Third-Party Licenses

Last updated: 2026-02-12

This file records third-party libraries used in this repository.

## Runtime Dependencies (Shipped With The Web App)

These packages are included in the app/runtime build:

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `fast-xml-parser` | `4.5.3` | MIT | https://github.com/NaturalIntelligence/fast-xml-parser |
| `strnum` | `1.1.2` | MIT | https://github.com/NaturalIntelligence/strnum |

### fast-xml-parser (MIT)

Copyright (c) 2017 Amit Kumar Gupta

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### strnum (MIT)

Copyright (c) 2021 Natural Intelligence

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Development / Build / Test Dependencies (Not Shipped In Runtime Bundle)

These direct dependencies are used for development tooling only:

| Package | Version | License |
| --- | --- | --- |
| `@types/node` | `20.19.33` | MIT |
| `tsx` | `4.21.0` | MIT |
| `typescript` | `5.9.3` | Apache-2.0 |
| `vite` | `5.4.21` | MIT |
| `vitest` | `2.1.9` | MIT |

## Verification

License information was verified from installed package manifests under `node_modules/*/package.json`.
