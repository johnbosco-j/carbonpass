/**
 * Deploys VerifierRegistry + CarbonPassport, accredits the demo verifier, registers the demo
 * installation, funds role wallets (testnets), and writes addresses + ABIs for the web app.
 *
 *   pnpm deploy:local     (needs `pnpm chain` running)
 *   pnpm deploy:sepolia   (needs a funded DEPLOYER_PRIVATE_KEY in contracts/.env)
 */
import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

const WEB_LIB = path.resolve(__dirname, "../../web/lib/chain");
const LOCAL_MNEMONIC = "test test test test test test test test test test test junk";

export const DEMO_INSTALLATION = {
  id: ethers.id("TR-INST-0001"),
  code: "TR-INST-0001",
  name: "Anatolia Green Steel A.Ş. — EAF mill, İzmir (fictional)",
};
const DEMO_VERIFIER_NAME = "EuroVerify Accredited Verification (fictional)";
const FUND_AMOUNT = ethers.parseEther("0.01");

function roleAddresses(): Record<string, string> {
  if (network.name === "sepolia") {
    const get = (k: string) => {
      const v = process.env[k];
      if (!v) throw new Error(`${k} missing in contracts/.env`);
      return new ethers.Wallet(v).address;
    };
    return {
      producer: get("PRODUCER_PRIVATE_KEY"),
      verifier: get("VERIFIER_PRIVATE_KEY"),
      importerA: get("IMPORTER_A_PRIVATE_KEY"),
      importerB: get("IMPORTER_B_PRIVATE_KEY"),
    };
  }
  const at = (i: number) => ethers.HDNodeWallet.fromPhrase(LOCAL_MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).address;
  return { producer: at(1), verifier: at(2), importerA: at(3), importerB: at(4) };
}

function verifierPqPublicKey(): Uint8Array {
  const seed = process.env.VERIFIER_PQ_SEED;
  if (!seed) throw new Error("VERIFIER_PQ_SEED missing in contracts/.env");
  return ml_dsa65.keygen(ethers.getBytes(seed)).publicKey;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const roles = roleAddresses();
  console.log(`Network ${network.name} (${chainId}), deployer ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const registry = await ethers.deployContract("VerifierRegistry", [deployer.address]);
  await registry.waitForDeployment();
  const deployBlock = (await registry.deploymentTransaction()!.wait())!.blockNumber;
  console.log(`VerifierRegistry ${await registry.getAddress()}`);

  const metadataUri = process.env.METADATA_URI ?? "https://carbonpass.vercel.app/api/metadata/{id}";
  const passport = await ethers.deployContract("CarbonPassport", [await registry.getAddress(), metadataUri, deployer.address]);
  await passport.waitForDeployment();
  console.log(`CarbonPassport   ${await passport.getAddress()}`);

  const pqPublicKeyHash = ethers.keccak256(verifierPqPublicKey());
  await (await registry.accredit(roles.verifier, DEMO_VERIFIER_NAME, ethers.id("EU-ACC-DE-2026-0042"), pqPublicKeyHash)).wait();
  console.log(`Accredited verifier ${roles.verifier}`);

  await (await passport.registerInstallation(DEMO_INSTALLATION.id, roles.producer, DEMO_INSTALLATION.name)).wait();
  console.log(`Registered installation ${DEMO_INSTALLATION.code} → ${roles.producer}`);

  if (network.name !== "hardhat") {
    for (const [role, addr] of Object.entries(roles)) {
      const bal = await ethers.provider.getBalance(addr);
      if (bal < FUND_AMOUNT / 2n) {
        await (await deployer.sendTransaction({ to: addr, value: FUND_AMOUNT })).wait();
        console.log(`Funded ${role} ${addr} with ${ethers.formatEther(FUND_AMOUNT)} ETH`);
      }
    }
  }

  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    deployBlock,
    deployedAt: new Date().toISOString(),
    registry: await registry.getAddress(),
    passport: await passport.getAddress(),
    registrar: deployer.address,
    roles,
    installation: DEMO_INSTALLATION,
    verifierName: DEMO_VERIFIER_NAME,
    explorer: network.name === "sepolia" ? "https://sepolia.etherscan.io" : null,
  };

  fs.mkdirSync(WEB_LIB, { recursive: true });
  fs.writeFileSync(path.join(WEB_LIB, `deployment.${network.name}.json`), JSON.stringify(deployment, null, 2) + "\n");
  for (const name of ["VerifierRegistry", "CarbonPassport"]) {
    const { abi } = await artifacts.readArtifact(name);
    fs.writeFileSync(path.join(WEB_LIB, `${name}.abi.json`), JSON.stringify(abi, null, 2) + "\n");
  }
  console.log(`Wrote web/lib/chain/deployment.${network.name}.json and ABIs`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
