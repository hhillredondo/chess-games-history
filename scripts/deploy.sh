#!/usr/bin/env bash
# Usage: ./scripts/deploy.sh [dev|prod]
# Builds the Next.js static export then deploys the CDK stack.
set -euo pipefail

ENV="${1:-dev}"
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "▶ Building Next.js static export..."
cd "$REPO_ROOT"
npm run build:export

echo "▶ Installing infra dependencies..."
cd "$REPO_ROOT/infra"
npm install --prefer-offline --silent

echo "▶ Deploying ChessStats-${ENV} stack..."
npx cdk deploy "ChessStats-${ENV}" \
  -c env="${ENV}" \
  --require-approval never \
  --outputs-file "../.cdk-outputs-${ENV}.json"

echo ""
echo "✓ Done. CloudFront URL is in .cdk-outputs-${ENV}.json"
