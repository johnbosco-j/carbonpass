// Wraps contracts/hardhat.config.ts so `--network localhost` can point at any port (RPC_URL), without editing the
// tracked config. Used by tools/recorder/dev/local-stack.sh:
//   cd contracts && RPC_URL=http://127.0.0.1:8547 npx hardhat --config ../tools/recorder/dev/hardhat.local.config.ts run scripts/deploy.ts --network localhost
import * as path from "path";
import base from "../../../contracts/hardhat.config";

const config = {
  ...base,
  paths: { ...(base.paths ?? {}), root: path.resolve(__dirname, "../../../contracts") },
  networks: { ...base.networks, localhost: { url: process.env.RPC_URL ?? "http://127.0.0.1:8547" } },
};

export default config;
