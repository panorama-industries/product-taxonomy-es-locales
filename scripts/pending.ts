// Prints keys pending review as JSON, for translators/agents to work in batches.
//   pnpm pending --locale es-AR --type values --limit 200 [--status stale|unreviewed]
import { parseArgs } from "node:util"
import {
  type LocalizationType,
  TYPES,
  assertSynced,
  loadLocales,
  overrideEntries,
  resolveEntries,
  reviewStatuses,
  sourceEntries,
} from "./lib.ts"

const { values: flags } = parseArgs({
  options: {
    locale: { type: "string" },
    type: { type: "string" },
    status: { type: "string" },
    limit: { type: "string", default: "100" },
  },
})

assertSynced()
const config = loadLocales()
const locales = Object.keys(config)
const locale = flags.locale ?? (locales.length === 1 ? locales[0] : undefined)
if (!locale || !config[locale]) throw new Error(`--locale must be one of: ${locales.join(", ")}`)
if (flags.type && !TYPES.includes(flags.type as LocalizationType)) throw new Error(`--type must be one of: ${TYPES.join(", ")}`)
if (flags.status && !["stale", "unreviewed"].includes(flags.status)) throw new Error("--status must be stale or unreviewed")

const types = flags.type ? [flags.type as LocalizationType] : TYPES
const limit = Number(flags.limit)
const items = []

for (const type of types) {
  const base = resolveEntries(config[locale].base, type, config)
  const overrides = overrideEntries(locale, type)
  for (const [key, status] of Object.entries(reviewStatuses(locale, type, config))) {
    if (status === "reviewed" || (flags.status && status !== flags.status)) continue
    items.push({ type, key, status, en: sourceEntries(type)[key], base: base[key], override: overrides[key] ?? null })
    if (items.length >= limit) break
  }
  if (items.length >= limit) break
}

console.log(JSON.stringify({ locale, base: config[locale].base, count: items.length, items }, null, 2))
