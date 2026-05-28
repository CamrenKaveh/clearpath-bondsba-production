#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DO_DEPLOY=1
if [[ "${1:-}" == "--no-deploy" ]]; then
  DO_DEPLOY=0
fi

TIMESTAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TIMESTAMP_LOCAL="$(TZ=America/Toronto date +"%Y-%m-%d %H:%M:%S %Z")"
REPORT_FILE="$ROOT_DIR/phase1-deploy-status-latest.md"

TMP_TEST="$(mktemp)"
TMP_BUILD="$(mktemp)"
TMP_DEPLOY="$(mktemp)"
trap 'rm -f "$TMP_TEST" "$TMP_BUILD" "$TMP_DEPLOY"' EXIT

echo "[ops] Running test suite..."
npm test | tee "$TMP_TEST"

echo "[ops] Building production bundle..."
npm run build | tee "$TMP_BUILD"

DEPLOYMENT_ID="(not run)"
DEPLOYMENT_URL="(not run)"
INSPECTOR_URL="(not run)"

if [[ "$DO_DEPLOY" -eq 1 ]]; then
  echo "[ops] Deploying to production..."
  vercel --prod --yes | tee "$TMP_DEPLOY"

  DEPLOYMENT_ID="$(rg -o "dpl_[A-Za-z0-9]+" "$TMP_DEPLOY" | head -n1 || true)"
  DEPLOYMENT_URL="$(rg -o "https://[a-zA-Z0-9-]+\\.vercel\\.app" "$TMP_DEPLOY" | tail -n1 || true)"
  INSPECTOR_URL="$(rg -o "https://vercel\\.com/[a-zA-Z0-9/_-]+" "$TMP_DEPLOY" | tail -n1 || true)"
fi

echo "[ops] Running live smoke checks..."
HOME_TITLE="$(curl -s https://bondsba.com/ | rg -o "<title>[^<]+</title>" | head -n1 || true)"
JSONLD_PRESENT="$(curl -s https://bondsba.com/ | rg -c "application/ld\\+json" || true)"
ADS_TXT_VALUE="$(curl -s https://bondsba.com/ads.txt | head -n1 || true)"
ROBOTS_HEADER="$(curl -sI https://bondsba.com/surety-dashboard | rg -i "^x-robots-tag:.*" | tr -d '\r' || true)"

cat > "$REPORT_FILE" <<EOF
# Phase 1 Deploy Status (Latest)

- Run UTC: $TIMESTAMP_UTC
- Run Local (America/Toronto): $TIMESTAMP_LOCAL
- Deploy Executed: $([[ "$DO_DEPLOY" -eq 1 ]] && echo "Yes" || echo "No")
- Deployment ID: ${DEPLOYMENT_ID:-"(unavailable)"}
- Deployment URL: ${DEPLOYMENT_URL:-"(unavailable)"}
- Inspector URL: ${INSPECTOR_URL:-"(unavailable)"}

## Verification Snapshot

- Homepage title: ${HOME_TITLE:-"(missing)"}
- Homepage JSON-LD blocks detected: ${JSONLD_PRESENT:-0}
- ads.txt first line: ${ADS_TXT_VALUE:-"(missing)"}
- Protected route robots header: ${ROBOTS_HEADER:-"(missing)"}

## Commands

\`\`\`bash
npm test
npm run build
$( [[ "$DO_DEPLOY" -eq 1 ]] && echo "vercel --prod --yes" || echo "# deploy skipped (--no-deploy)" )
\`\`\`
EOF

echo "[ops] Wrote report: $REPORT_FILE"
echo "[ops] Completed."
