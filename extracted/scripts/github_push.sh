#!/usr/bin/env bash
# MONAD -> GitHub push (token comes from the encrypted secret GITHUB_TOKEN)
# usage: GITHUB_OWNER=you GITHUB_REPO=monad bash scripts/github_push.sh
set -euo pipefail
: "${GITHUB_TOKEN:?GITHUB_TOKEN is not set}"
: "${GITHUB_OWNER:?GITHUB_OWNER is not set}"
: "${GITHUB_REPO:=monad}"
cd "$(dirname "$0")/.."

API=https://api.github.com
AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json")

echo "==> whoami"
curl -sf "${AUTH[@]}" "$API/user" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("authenticated as", d["login"])'

echo "==> ensure repository $GITHUB_OWNER/$GITHUB_REPO"
code=$(curl -s -o /tmp/repo.json -w "%{http_code}" "${AUTH[@]}" "$API/repos/$GITHUB_OWNER/$GITHUB_REPO")
if [ "$code" = "404" ]; then
  curl -sf "${AUTH[@]}" -X POST "$API/user/repos" \
    -d "{\"name\":\"$GITHUB_REPO\",\"private\":true,\"description\":\"MONAD — Daily Experience (Phase 1-2)\"}" \
    | python3 -c 'import sys,json; print("created", json.load(sys.stdin)["full_name"])'
elif [ "$code" = "200" ]; then echo "repository already exists"; else echo "error $code"; cat /tmp/repo.json; exit 1; fi

echo "==> push"
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:$GITHUB_TOKEN@github.com/$GITHUB_OWNER/$GITHUB_REPO.git"
git push -u origin HEAD:main --force-with-lease 2>&1 | sed "s/$GITHUB_TOKEN/***/g"
git remote set-url origin "https://github.com/$GITHUB_OWNER/$GITHUB_REPO.git"
echo "==> done: https://github.com/$GITHUB_OWNER/$GITHUB_REPO"
