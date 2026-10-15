// Lists word swaps reviewers made in overrides whose removed words are not glossary terms, with how many keys still
// contain them. Use it to grow the glossary from what reviewers actually changed, so a fix made in one batch reaches
// every key that uses the same word.
//   pnpm run harvest                       open candidates: not in glossary or harvest-ignore.yml, still used elsewhere
//   pnpm run harvest --all                 also candidates covered by the glossary/ignore list or with no residual
//   pnpm run harvest --format count        number of open candidates (gate for bulk-marking)
// Columns: removed⇥replacements (count)⇥swaps⇥residual keys⇥status⇥examples
// Decide each open row: add a glossary term (then review its matches), or add the removed words to
// overrides/<locale>/harvest-ignore.yml when the swap was a one-off.
import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { assertSynced, harvestCandidates, loadLocales, pickLocale, tsvEscape } from "./lib.ts"

const { values: flags } = parseArgs({
  options: {
    locale: { type: "string" },
    all: { type: "boolean" },
    limit: { type: "string", default: "0" },
    format: { type: "string", default: "tsv" },
    out: { type: "string" },
  },
})

assertSynced()
const config = loadLocales()
const locale = pickLocale(flags.locale, config)
if (!["tsv", "json", "count"].includes(flags.format)) throw new Error("--format must be tsv, json or count")
const limit = Number(flags.limit)

let rows = harvestCandidates(locale, config)
if (!flags.all) rows = rows.filter((c) => c.status === "open" && c.residual > 0)
if (limit > 0) rows = rows.slice(0, limit)

const render = () => {
  if (flags.format === "count") return String(rows.length)
  if (flags.format === "json") return JSON.stringify({ locale, count: rows.length, rows }, null, 2)
  const lines = [`#locale=${locale} rows=${rows.length}`, "#removed\treplacements\tswaps\tresidual\tstatus\texamples"]
  for (const c of rows) {
    const replacements = Object.entries(c.replacements)
      .sort((a, b) => b[1] - a[1])
      .map(([r, n]) => `${r} (${n})`)
      .join("; ")
    lines.push([c.removed, replacements, String(c.swaps), String(c.residual), c.status, c.examples.join(" | ")].map(tsvEscape).join("\t"))
  }
  return lines.join("\n")
}

if (flags.out) {
  writeFileSync(flags.out, `${render()}\n`)
  console.error(`${rows.length} candidates → ${flags.out}`)
} else {
  console.log(render())
}
