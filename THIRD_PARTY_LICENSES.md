# Third-Party Licenses

Last updated: 2026-07-17

This document records the complete production dependency closure installed for
Twist-Dynamics Ver.1.2.0. Development-only packages are intentionally excluded
because they are not shipped in the web application.

## Distribution and verification

The production build generates two compliance artifacts at the root of `dist/`:

- `THIRD_PARTY_LICENSES.txt` contains the full license text and every packaged
  `NOTICE` file for all production dependencies. It is self-contained and does
  not refer users to `node_modules/`.
- `THIRD_PARTY_BUNDLE_MANIFEST.json` records both the complete production
  inventory and the subset of packages actually present in each generated
  JavaScript chunk.

The Vite plugin in `scripts/thirdPartyLicenses.ts` derives the inventory from
the installed dependency graph, inspects Vite's module graph, and fails the
build if a bundled package is absent from the inventory. Packages that omit a
license file from their npm archive have exact-version upstream license text
embedded in that script; an unrecognized omission also fails the build.

After `npm run build`, verify the output with:

```bash
npm run check:licenses
```

The verifier checks that the generated license artifact exactly matches the
installed production tree, every bundle entry has chunk/module evidence, all
referenced chunks exist, and Apache-2.0 text and applicable NOTICE content are
complete.

## Complete production dependency inventory

| Package | Version | Relationship | License | Source |
| --- | --- | --- | --- | --- |
| `fast-xml-parser` | `5.10.1` | Direct | MIT | [NaturalIntelligence/fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) |
| `mathjs` | `15.2.0` | Direct | Apache-2.0 | [josdejong/mathjs](https://github.com/josdejong/mathjs) |
| `ml-matrix` | `6.12.1` | Direct | MIT | [mljs/matrix](https://github.com/mljs/matrix) |
| `three` | `0.185.1` | Direct | MIT | [mrdoob/three.js](https://github.com/mrdoob/three.js) |
| `@babel/runtime` | `7.28.6` | Transitive | MIT | [babel/babel](https://github.com/babel/babel) |
| `@nodable/entities` | `3.0.0` | Transitive | MIT | [nodable/val-parsers](https://github.com/nodable/val-parsers) |
| `anynum` | `1.0.1` | Transitive | MIT | [NaturalIntelligence/anynum](https://github.com/NaturalIntelligence/anynum) |
| `complex.js` | `2.4.3` | Transitive | MIT | [rawify/Complex.js](https://github.com/rawify/Complex.js) |
| `decimal.js` | `10.6.0` | Transitive | MIT | [MikeMcl/decimal.js](https://github.com/MikeMcl/decimal.js) |
| `escape-latex` | `1.2.0` | Transitive | MIT | [dangmai/escape-latex](https://github.com/dangmai/escape-latex) |
| `fast-xml-builder` | `1.3.0` | Transitive | MIT | [NaturalIntelligence/fast-xml-builder](https://github.com/NaturalIntelligence/fast-xml-builder) |
| `fraction.js` | `5.3.4` | Transitive | MIT | [rawify/Fraction.js](https://github.com/rawify/Fraction.js) |
| `is-any-array` | `2.0.1` | Transitive | MIT | [cheminfo-js/is-any-array](https://github.com/cheminfo-js/is-any-array) |
| `is-unsafe` | `2.0.0` | Transitive | MIT | [NaturalIntelligence/is-unsafe](https://github.com/NaturalIntelligence/is-unsafe) |
| `javascript-natural-sort` | `0.7.1` | Transitive | MIT | [Bill4Time/javascript-natural-sort](https://github.com/Bill4Time/javascript-natural-sort) |
| `ml-array-max` | `1.2.4` | Transitive | MIT | [mljs/array](https://github.com/mljs/array) |
| `ml-array-min` | `1.2.3` | Transitive | MIT | [mljs/array](https://github.com/mljs/array) |
| `ml-array-rescale` | `1.3.7` | Transitive | MIT | [mljs/array](https://github.com/mljs/array) |
| `path-expression-matcher` | `1.6.2` | Transitive | MIT | [NaturalIntelligence/path-expression-matcher](https://github.com/NaturalIntelligence/path-expression-matcher) |
| `seedrandom` | `3.0.5` | Transitive | MIT | [davidbau/seedrandom](https://github.com/davidbau/seedrandom) |
| `strnum` | `2.4.1` | Transitive | MIT | [NaturalIntelligence/strnum](https://github.com/NaturalIntelligence/strnum) |
| `tiny-emitter` | `2.1.0` | Transitive | MIT | [scottcorgan/tiny-emitter](https://github.com/scottcorgan/tiny-emitter) |
| `typed-function` | `4.2.2` | Transitive | MIT | [josdejong/typed-function](https://github.com/josdejong/typed-function) |
| `xml-naming` | `0.3.0` | Transitive | MIT | [NaturalIntelligence/xml-naming](https://github.com/NaturalIntelligence/xml-naming) |

The generated bundle manifest is authoritative for the tree-shaken subset in a
specific build. The full production inventory above is deliberately broader so
that optional code paths remain covered by the distributed license artifact.
