# Standard Product Taxonomy: Spanish locales

Regional Spanish localizations (`es-AR`) of [Shopify's Standard Product Taxonomy](https://github.com/Shopify/product-taxonomy).

Unofficial project, not affiliated with or endorsed by Shopify.

## Download

Each [release](../../releases) has the same assets as Shopify's releases, for each locale here:

```
categories.es-AR.json.gz   categories.es-AR.txt.gz
attributes.es-AR.json.gz   attributes.es-AR.txt.gz
attribute_values.es-AR.json.gz   attribute_values.es-AR.txt.gz
return_reasons.es-AR.json.gz   return_reasons.es-AR.txt.gz
taxonomy.es-AR.json.gz
```

Same IDs and schema as Shopify's `es` files, generated with Shopify's own dist generator. Release tags are `<shopify tag>.<n>`, e.g. `v2026-08.1` is based on Shopify `v2026-08`.

## How it works

Each locale is a base locale + overrides. `es-AR` = Shopify `es` + `overrides/es-AR/`. Only strings that differ from the base are stored.

| Path                                      | Contents                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `UPSTREAM_VERSION`                        | Pinned Shopify release tag                                                           |
| `locales.yml`                             | Locale → base locale (a Shopify locale or another locale here)                       |
| `overrides/<locale>/<type>.yml`           | Overridden fields, same format as Shopify's `data/localizations/<type>/<locale>.yml` |
| `overrides/<locale>/reviewed/<type>.json` | Key → hash of en + base text when reviewed                                           |
| `.upstream/`                              | Sparse checkout of Shopify's `data/` + `dev/` (gitignored)                           |

A key is **reviewed** when its hash matches the current en + base text, **stale** when either changed upstream since review, **unreviewed** when never reviewed. Pending keys fall back to the base text, so builds always succeed.

## Commands

Requires Node 24+, pnpm, Ruby (version in `.upstream/dev/.ruby-version`).

```bash
pnpm install
pnpm sync                    # download UPSTREAM_VERSION into .upstream/
pnpm check                   # validate overrides, show review progress (--fix drops removed keys)
pnpm vocab                   # distinct base words by frequency, to build the glossary
pnpm pending --type values   # pending keys as TSV (filters: --key, --match, --match-glossary, --dedupe, ...)
pnpm apply batch.tsv changes.tsv   # write overrides from a batch, mark the batch reviewed
pnpm mark-reviewed --type values key1 key2   # or `-` to read keys from stdin
pnpm build                   # generate dist/<locale>/ with Shopify's generator
pnpm stage                   # gzip dist/ into release-assets/
```

## Updating to a new Shopify release

`upstream-bump` workflow runs weekly. When Shopify publishes a release it opens a PR that bumps `UPSTREAM_VERSION`, drops overrides for removed keys and lists stale/unreviewed counts. Review pending keys, merge, then tag `v<version>.1` to publish.

## Adding a locale

1. Add `es-XX: { base: es }` to `locales.yml`
2. Create `overrides/es-XX/` with empty `<type>.yml` files (copy `overrides/es-AR/` structure)
3. `pnpm check`

Locales can build on each other, e.g. a shared `es-419` layer with `es-AR: { base: es-419 }`.

## Contributing

See [AGENTS.md](AGENTS.md) for the batch workflow and translation rules, [prompts/](prompts/) for agent session prompts. Report wrong translations in issues.

## License

MIT. Taxonomy data © Shopify, MIT licensed. See [LICENSE](LICENSE).
