# Translating

Each locale = base locale + overrides. Goal: every key **reviewed**, i.e. someone decided whether the base text is right for the locale. Override only when it isn't.

Setup: `pnpm install && pnpm run sync`. Ruby is only needed for `pnpm run build` (CI runs it).

Session prompts per phase: `prompts/`.

## Batch loop

1. Get a batch:
   ```bash
   pnpm --silent run pending --type <type> [filters] --limit 400 --out /tmp/batch.tsv
   ```
   Rows: `type⇥keys⇥field⇥en⇥base⇥override`. With `--dedupe`, `keys` is a comma list of keys sharing the same text; one decision covers all of them.
2. Read `/tmp/batch.tsv`. Write `/tmp/changes.tsv` with **only rows that change**:
   ```
   type⇥keys⇥field⇥text
   ```
   Copy `type`, `keys` and `field` exactly from the batch row. `text` = new es-AR text, or `-` to delete an existing override. Text equal to base also deletes the override.
3. Apply and mark the whole batch reviewed:
   ```bash
   pnpm --silent run apply /tmp/batch.tsv /tmp/changes.tsv   # omit changes.tsv if nothing changes
   ```
   On errors nothing is written; fix `changes.tsv` and rerun.
4. Repeat. `pending` only returns keys not yet reviewed, so a new session continues where the last stopped.

Only apply a batch after deciding every row in it.

Filters: `--key <regex>` (key range), `--match <regex>` (base/override text), `--match-glossary`, `--exclude-glossary`, `--glossary-kept` (QA: glossary term kept without override), `--status stale|unreviewed|reviewed|all`, `--dedupe`. Split a scope into files with `--out-dir <dir> [--batch-size 400]`.

## Glossary

`overrides/<locale>/glossary.yml` lists base terms that differ in the locale:

```yaml
terms:
  - match: [camiseta, camisetas] # whole-word, case-insensitive forms found in base text
    use: remera(s)
    note: fem → fem
```

`pnpm --silent run vocab --offset 0 --limit 2000 --out /tmp/vocab.tsv` lists distinct base words (`word⇥count⇥example⇥in glossary`) to build it.

## es-AR rules

- Argentine Spanish as used in Argentine e-commerce (Mercado Libre, local retailers): remera, campera, pollera, buzo, zapatillas, malla, anteojos, heladera, birome, celular, computadora, auto, frutilla, palta, durazno, ananá, maní, jugo, etc.
- Keep base text when it's neutral and natural in Argentina. Don't rewrite for style.
- Check `en` for meaning: base may be a mistranslation or false friend. Fix those too.
- Fix grammar when a term changes gender or number (el bañador azul → la malla azul).
- Match base style: capitalization, punctuation, units, brand and model names unchanged (`Garmin Zumo` stays).
- Category names appear in breadcrumbs (`Indumentaria y accesorios > Ropa > Pantalones > Jeans`): short nouns, consistent with parent and siblings.
- Same term everywhere: if `camiseta` → `remera` in categories, also in attributes and values.
- Descriptions: impersonal like base; if second person is needed, use `vos`.
- Avoid words with vulgar meaning in Argentina (e.g. `coger` → `tomar`, `agarrar`).

## Output

- No narration, no per-batch summaries. Write files and run commands.
- After the last batch: `pnpm --silent run check`, commit, open a PR.

## Don'ts

- Don't edit `.upstream/`, `dist/`, `release-assets/`, `reviewed/*.json`
- Don't commit batch/changes files
- Don't invent or rename keys
