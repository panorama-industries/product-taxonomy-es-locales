// Lists keys pending review (or any status with --status), for translators/agents to work in batches.
//   pnpm pending --type values --limit 400 --out /tmp/batch.tsv
// Filters:
//   --type a,b             localization types (default: all)
//   --status s             stale | unreviewed | reviewed | all (default: stale + unreviewed)
//   --key <regex>          key filter, e.g. '^[a-f]'
//   --match <regex>        base or override text filter (case-insensitive)
//   --match-glossary       only keys whose base text contains a glossary term
//   --exclude-glossary     only keys whose base text contains no glossary term
//   --dedupe               group keys with identical en + base + override text into one row (keys comma-separated)
//   --limit n              max rows (0 = no limit, default 400)
// Output: --format tsv (default) | json | keys; --out <file> (default stdout)
import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import {
  type Entry,
  type LocalizationType,
  assertSynced,
  glossaryRegex,
  loadLocales,
  overrideEntries,
  pickLocale,
  pickTypes,
  resolveEntries,
  reviewStatuses,
  sourceEntries,
  tsvEscape,
} from "./lib.ts"

const { values: flags } = parseArgs({
  options: {
    locale: { type: "string" },
    type: { type: "string" },
    status: { type: "string" },
    key: { type: "string" },
    match: { type: "string" },
    "match-glossary": { type: "boolean" },
    "exclude-glossary": { type: "boolean" },
    dedupe: { type: "boolean" },
    limit: { type: "string", default: "400" },
    format: { type: "string", default: "tsv" },
    out: { type: "string" },
  },
})

assertSynced()
const config = loadLocales()
const locale = pickLocale(flags.locale, config)
const types = pickTypes(flags.type)
if (flags.status && !["stale", "unreviewed", "reviewed", "all"].includes(flags.status)) throw new Error("--status must be stale, unreviewed, reviewed or all")
if (!["tsv", "json", "keys"].includes(flags.format)) throw new Error("--format must be tsv, json or keys")
if (flags["match-glossary"] && flags["exclude-glossary"]) throw new Error("--match-glossary and --exclude-glossary are exclusive")

const glossary = flags["match-glossary"] || flags["exclude-glossary"] ? glossaryRegex(locale) : undefined
if (flags["match-glossary"] && !glossary) throw new Error(`No glossary terms for ${locale}`)
const keyFilter = flags.key ? new RegExp(flags.key) : undefined
const textFilter = flags.match ? new RegExp(flags.match, "iu") : undefined
const limit = Number(flags.limit)

type Row = { type: LocalizationType; keys: Array<string>; status: string; en: Entry; base: Entry; override: Entry | null }
const rows: Array<Row> = []
const groups = new Map<string, Row>()
const full = () => limit > 0 && rows.length >= limit

for (const type of types) {
  const base = resolveEntries(config[locale].base, type, config)
  const overrides = overrideEntries(locale, type)
  const source = sourceEntries(type)

  for (const [key, status] of Object.entries(reviewStatuses(locale, type, config))) {
    if (flags.status === undefined ? status === "reviewed" : flags.status !== "all" && status !== flags.status) continue
    if (keyFilter && !keyFilter.test(key)) continue
    const baseText = Object.values(base[key] ?? {}).join("\n")
    if (textFilter && !textFilter.test(`${baseText}\n${Object.values(overrides[key] ?? {}).join("\n")}`)) continue
    if (glossary && glossary.test(baseText) !== Boolean(flags["match-glossary"])) continue

    const row: Row = { type, keys: [key], status, en: source[key], base: base[key] ?? {}, override: overrides[key] ?? null }
    if (flags.dedupe) {
      const id = JSON.stringify([type, row.en, row.base, row.override])
      const existing = groups.get(id)
      if (existing) {
        existing.keys.push(key)
        continue
      }
      if (full()) continue // keep collecting keys for groups already in the batch
      groups.set(id, row)
    } else if (full()) {
      break
    }
    rows.push(row)
  }
}

let output: string
if (flags.format === "json") {
  output = JSON.stringify({ locale, base: config[locale].base, count: rows.length, rows }, null, 2)
} else if (flags.format === "keys") {
  output = rows.flatMap((r) => r.keys).join("\n")
} else {
  const lines = [`#locale=${locale} base=${config[locale].base} rows=${rows.length}`, "#type\tkeys\tfield\ten\tbase\toverride"]
  for (const r of rows) {
    for (const field of Object.keys(r.en)) {
      lines.push([r.type, r.keys.join(","), field, r.en[field], r.base[field] ?? "", r.override?.[field] ?? ""].map(tsvEscape).join("\t"))
    }
  }
  output = lines.join("\n")
}

if (flags.out) {
  writeFileSync(flags.out, `${output}\n`)
  console.error(`${rows.length} rows (${rows.reduce((n, r) => n + r.keys.length, 0)} keys) → ${flags.out}`)
} else {
  console.log(output)
}
