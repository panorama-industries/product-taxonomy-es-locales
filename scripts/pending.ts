// Lists keys pending review (or any status with --status), for translators/agents to work in batches.
//   pnpm run pending --type values --limit 400 --out /tmp/batch.tsv
// Filters:
//   --type a,b             localization types (default: all)
//   --status s             stale | unreviewed | reviewed | all (default: stale + unreviewed)
//   --key <regex>          key filter, e.g. '^[a-f]'
//   --match <regex>        base or override text filter (case-insensitive)
//   --match-glossary       only keys whose base text contains a glossary term
//   --exclude-glossary     only keys whose base text contains no glossary term
//   --glossary-kept        only keys with a field whose current text (override, else base) contains a glossary term
//                          (QA for missed fixes; defaults --status to reviewed)
//   --dedupe               group keys with identical en + base + override text into one row (keys comma-separated)
//   --limit n              max rows (0 = no limit; default 400, or 0 with --out-dir)
// Output: --format tsv (default) | json | keys; --out <file> (default stdout)
//   --out-dir <dir> --batch-size n   split rows into <dir>/batch-001.tsv, ... (n rows each, default 400; replaces old batch files)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import {
  type Entry,
  type LocalizationType,
  assertSynced,
  glossaryKeptFields,
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
    "glossary-kept": { type: "boolean" },
    dedupe: { type: "boolean" },
    limit: { type: "string" },
    "out-dir": { type: "string" },
    "batch-size": { type: "string", default: "400" },
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

const glossary = flags["match-glossary"] || flags["exclude-glossary"] || flags["glossary-kept"] ? glossaryRegex(locale) : undefined
if ((flags["match-glossary"] || flags["glossary-kept"]) && !glossary) throw new Error(`No glossary terms for ${locale}`)
const status = flags.status ?? (flags["glossary-kept"] ? "reviewed" : undefined)
const keyFilter = flags.key ? new RegExp(flags.key) : undefined
const textFilter = flags.match ? new RegExp(flags.match, "iu") : undefined
const limit = Number(flags.limit ?? (flags["out-dir"] ? 0 : 400))
if (flags.out && flags["out-dir"]) throw new Error("--out and --out-dir are exclusive")

type Row = { type: LocalizationType; keys: Array<string>; status: string; en: Entry; base: Entry; override: Entry | null }
const rows: Array<Row> = []
const groups = new Map<string, Row>()
const full = () => limit > 0 && rows.length >= limit

for (const type of types) {
  const base = resolveEntries(config[locale].base, type, config)
  const overrides = overrideEntries(locale, type)
  const source = sourceEntries(type)

  for (const [key, keyStatus] of Object.entries(reviewStatuses(locale, type, config))) {
    if (status === undefined ? keyStatus === "reviewed" : status !== "all" && keyStatus !== status) continue
    if (keyFilter && !keyFilter.test(key)) continue
    const baseText = Object.values(base[key] ?? {}).join("\n")
    if (textFilter && !textFilter.test(`${baseText}\n${Object.values(overrides[key] ?? {}).join("\n")}`)) continue
    if (flags["glossary-kept"] && glossaryKeptFields(base[key], overrides[key], glossary).length === 0) continue
    else if (!flags["glossary-kept"] && glossary && glossary.test(baseText) !== Boolean(flags["match-glossary"])) continue

    const row: Row = { type, keys: [key], status: keyStatus, en: source[key], base: base[key] ?? {}, override: overrides[key] ?? null }
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

const render = (batch: ReadonlyArray<Row>) => {
  if (flags.format === "json") return JSON.stringify({ locale, base: config[locale].base, count: batch.length, rows: batch }, null, 2)
  if (flags.format === "keys") return batch.flatMap((r) => r.keys).join("\n")
  const lines = [`#locale=${locale} base=${config[locale].base} rows=${batch.length}`, "#type\tkeys\tfield\ten\tbase\toverride"]
  for (const r of batch) {
    for (const field of Object.keys(r.en)) {
      lines.push([r.type, r.keys.join(","), field, r.en[field], r.base[field] ?? "", r.override?.[field] ?? ""].map(tsvEscape).join("\t"))
    }
  }
  return lines.join("\n")
}
const keyCount = (batch: ReadonlyArray<Row>) => batch.reduce((n, r) => n + r.keys.length, 0)

const outDir = flags["out-dir"]
if (outDir) {
  const size = Number(flags["batch-size"])
  if (!(size > 0)) throw new Error("--batch-size must be > 0")
  mkdirSync(outDir, { recursive: true })
  for (const file of readdirSync(outDir)) if (/^batch-\d+\.\w+$/.test(file)) rmSync(join(outDir, file))
  const ext = flags.format === "json" ? "json" : flags.format === "keys" ? "txt" : "tsv"
  let n = 0
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size)
    writeFileSync(join(outDir, `batch-${String(++n).padStart(3, "0")}.${ext}`), `${render(batch)}\n`)
  }
  console.error(`${rows.length} rows (${keyCount(rows)} keys) → ${n} batches in ${outDir}`)
} else if (flags.out) {
  writeFileSync(flags.out, `${render(rows)}\n`)
  console.error(`${rows.length} rows (${keyCount(rows)} keys) → ${flags.out}`)
} else {
  console.log(render(rows))
}
