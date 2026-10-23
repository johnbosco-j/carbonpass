#!/usr/bin/env bash
# Local stack for developing the recorder (run from the repo root; uses ports 8547 and 3104 so it doesn't clash
# with `pnpm chain` / `pnpm dev`). Start the node and the web app in their own terminals first:
#   (cd contracts && DEMO_NODE=true npx hardhat node --port 8547)
#   (cd web && NETWORK=localhost RPC_URL=http://127.0.0.1:8547 GEMINI_API_KEY= npx next dev --port 3104)
# then run this to deploy + seed + snapshot, and record:
#   bash tools/recorder/dev/local-stack.sh && node tools/recorder/record.mjs --base http://localhost:3104
# Note: deploying rewrites the "localhost" entry of web/lib/chain/deployments.json; don't commit that change.
set -euo pipefail
cd "$(dirname "$0")/../../.."
export RPC_URL=${RPC_URL:-http://127.0.0.1:8547}
(cd contracts && npx hardhat --config ../tools/recorder/dev/hardhat.local.config.ts run scripts/deploy.ts --network localhost)
(cd web && NETWORK=localhost npx tsx --env-file-if-exists=.env.local scripts/seed.ts)
node tools/recorder/dev/chain-snapshot.mjs save
