#!/usr/bin/env bash
# 生成发布目录 _site/：只复制白名单里的、已被 git 追踪的站点文件。
# 开发资料（shots/、docs/、tests/、gpt_brief.md、.github/ 等）留在仓库里，但不会进入线上。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

OUT=_site
ROOT_FILES=(index.html 404.html style.css mobile.css mobile.js study-bridge.js)
SITE_DIRS=(assets c config data gs jsj study tower wy yy)
FORBIDDEN=(shots docs tests gpt_brief.md .github node_modules)

rm -rf "$OUT"
mkdir -p "$OUT"
for f in "${ROOT_FILES[@]}"; do
  [ -f "$f" ] || { echo "缺少站点文件：$f" >&2; exit 1; }
  cp "$f" "$OUT/"
done
git ls-files -z -- "${SITE_DIRS[@]}" | xargs -0 cp --parents -t "$OUT"
touch "$OUT/.nojekyll"

for p in "${FORBIDDEN[@]}"; do
  if [ -e "$OUT/$p" ]; then echo "发布目录不应包含：$p" >&2; exit 1; fi
done

files=$(find "$OUT" -type f | wc -l)
size=$(du -sm "$OUT" | cut -f1)
echo "发布目录 $OUT：$files 个文件，约 ${size} MB"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  { echo "## 发布目录"; echo; echo "- 文件数：$files"; echo "- 体积：约 ${size} MB"; echo "- 已确认不包含：${FORBIDDEN[*]}"; } >> "$GITHUB_STEP_SUMMARY"
fi
