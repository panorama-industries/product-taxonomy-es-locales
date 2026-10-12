# Translating

Goal: each key of each locale ends up **reviewed**. Reviewing a key = deciding if the base text is right for the locale; override only when it isn't.

## Loop

1. `pnpm pending --locale es-AR --type <type> --limit 200` → JSON items with `en`, `base`, current `override`
2. For each item, decide:
   - base is correct for the locale → no override
   - base is wrong or not the local term → add/edit override in `overrides/<locale>/<type>.yml`
   - existing override no longer needed (base now matches) → delete it
3. `pnpm mark-reviewed --locale es-AR --type <type> <keys...>` for every key decided in the batch, override or not
4. `pnpm check`

Types: `categories`, `values`, `attributes`, `return_reasons`. Keys are Shopify IDs (`aa-1-1`, `color__black`). Never invent or rename keys.

## Override format

Same as Shopify's localization files. Only include fields that differ from base:

```yaml
---
es-AR:
  categories:
    aa-1-13-8:
      name: "Remeras"
```

`categories` and `values` have `name`. `attributes` and `return_reasons` have `name` and `description`.

## es-AR rules

- Use Argentine Spanish as used in Argentine e-commerce: remera, campera, pollera, buzo, zapatillas, malla, anteojos, heladera, birome, celular, computadora, auto, frutilla, palta, durazno, etc.
- Keep base text when it's neutral and natural in Argentina. Don't rewrite for style.
- Address the reader as `vos` if a description needs second person; prefer impersonal phrasing like base.
- Match base style: capitalization, punctuation, units, brand names unchanged.
- Category names are part of breadcrumbs (`Indumentaria y accesorios > Ropa > Pantalones > Jeans`); keep them short nouns consistent with siblings and parents.
- Same term across categories, attributes and values (if `camiseta` → `remera` in categories, also in values like `Remera de fútbol`).
- Check `en` for meaning, not just base: base may be a mistranslation (e.g. false friends). Fix those too.

## Don'ts

- Don't edit `.upstream/`, `dist/`, `release-assets/`
- Don't edit `reviewed/*.json` by hand; use `pnpm mark-reviewed`
- Don't mark keys reviewed without looking at them
