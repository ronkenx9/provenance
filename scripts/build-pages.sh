#!/usr/bin/env bash
# Assemble the public GitHub Pages site:
#   /            → landing page
#   /docs.html   → documentation
#   /app/        → self-contained dossier viewer (embedded data, no API)
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:site >/dev/null

OUT=dist/pages
rm -rf "$OUT"
mkdir -p "$OUT/app"

cp landing/index.html landing/marketplace.html landing/docs.html landing/style.css landing/app.js landing/three-assets.js "$OUT/"
if [ -d landing/assets ]; then
  cp -R landing/assets "$OUT/assets"
fi
cp dist/site/index.html "$OUT/app/index.html"

# Repo-relative viewer links → Pages-relative
sed -i '' 's|\.\./frontend/index\.html|app/|g' "$OUT/index.html" "$OUT/docs.html"

touch "$OUT/.nojekyll"
echo "Pages site assembled in $OUT"
