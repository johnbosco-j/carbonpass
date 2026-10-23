#!/usr/bin/env bash
# Fresh Sepolia deployment for recording the demo video: new contracts (so July 2026 is the next free month),
# April–June history seeded, source verified on Sourcify, and the live site redeployed to point at them.
#   bash scripts/fresh-demo.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/5 Deploying contracts to Sepolia…"
pnpm --filter contracts deploy:sepolia

echo "2/5 Seeding April–June 2026 history…"
(cd web && NETWORK=sepolia npx tsx --env-file-if-exists=.env.local scripts/seed.ts)

echo "3/5 Verifying source on Sourcify…"
REG=$(node -e 'console.log(require("./web/lib/chain/deployments.json").sepolia.registry)')
PP=$(node -e 'console.log(require("./web/lib/chain/deployments.json").sepolia.passport)')
(cd contracts && node scripts/sourcify-verify.mjs 11155111 "$REG" contracts/VerifierRegistry.sol:VerifierRegistry && node scripts/sourcify-verify.mjs 11155111 "$PP" contracts/CarbonPassport.sol:CarbonPassport) || echo "Sourcify verification failed (non-fatal)"

echo "4/5 Committing the new addresses…"
git add web/lib/chain/deployments.json web/lib/chain/abi.ts
git commit -m "Fresh Sepolia deployment for demo recording" && git push || true

echo "5/5 Redeploying the site…"
(cd web && vercel deploy --prod --yes)

echo "Done. New CarbonPassport: $PP. Update the addresses in README.md, docs/DEVPOST.md and the dossier cover."
