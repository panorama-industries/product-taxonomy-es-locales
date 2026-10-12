// Lists distinct words of the base text, most frequent first, to build the glossary.
//   pnpm run vocab --offset 0 --limit 2000 --out /tmp/vocab.tsv
// Rows: word⇥texts containing it⇥shortest example text⇥in glossary (✓)
import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { TYPES, assertSynced, loadGlossary, loadLocales, pickLocale, resolveEntries, tsvEscape } from "./lib.ts"

const { values: flags } = parseArgs({
  options: {
    locale: { type: "string" },
    offset: { type: "string", default: "0" },
    limit: { type: "string", default: "2000" },
    out: { type: "string" },
  },
})

assertSynced()
const config = loadLocales()
const locale = pickLocale(flags.locale, config)
const glossaryWords = new Set(loadGlossary(locale).flatMap((t) => t.match.map((m) => m.toLowerCase())))

const words = new Map<string, { count: number; example: string }>()
const seenTexts = new Set<string>()
for (const type of TYPES) {
  for (const entry of Object.values(resolveEntries(config[locale].base, type, config))) {
    for (const text of Object.values(entry)) {
      if (seenTexts.has(text)) continue
      seenTexts.add(text)
      for (const word of new Set(text.toLowerCase().match(/\p{L}{2,}/gu) ?? [])) {
        const current = words.get(word)
        if (!current) words.set(word, { count: 1, example: text })
        else {
          current.count++
          if (text.length < current.example.length) current.example = text
        }
      }
    }
  }
}

const sorted = [...words].sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b))
const offset = Number(flags.offset)
const limit = Number(flags.limit)
const page = sorted.slice(offset, limit > 0 ? offset + limit : undefined)
const lines = [
  `#words ${offset + 1}-${offset + page.length} of ${sorted.length}`,
  "#word\tcount\texample\tglossary",
  ...page.map(([word, { count, example }]) => [word, String(count), tsvEscape(example.slice(0, 120)), glossaryWords.has(word) ? "✓" : ""].join("\t")),
]
const output = lines.join("\n")

if (flags.out) {
  writeFileSync(flags.out, `${output}\n`)
  console.error(`${page.length} words → ${flags.out}`)
} else {
  console.log(output)
}
