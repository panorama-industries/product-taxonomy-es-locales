// Gzips dist/ into release-assets/ with Shopify's asset names (e.g. categories.es-AR.json.gz).
import { join } from "node:path"
import { ROOT, UPSTREAM_DIR, assertSynced, run } from "./lib.ts"

assertSynced()
run(
  "bundle",
  ["exec", "bin/product_taxonomy", "stage_dist_assets", "--input_path", join(ROOT, "dist"), "--output_path", join(ROOT, "release-assets")],
  join(UPSTREAM_DIR, "dev"),
)
