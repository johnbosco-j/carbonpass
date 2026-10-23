/**
 * Tops up the demo role wallets from the deployer so the live demo keeps working during judging.
 * Claim Sepolia ETH to the deployer from a faucet first, then:
 *   pnpm --filter contracts topup:sepolia
 */
import { ethers } from "hardhat";

const ROLES = ["PRODUCER", "VERIFIER", "IMPORTER_A", "IMPORTER_B", "SUPPLIER"];
const MIN = ethers.parseEther(process.env.TOPUP_MIN ?? "0.004");
const AMOUNT = ethers.parseEther(process.env.TOPUP_AMOUNT ?? "0.006");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer ${deployer.address}: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  for (const role of ROLES) {
    const key = process.env[`${role}_PRIVATE_KEY`];
    if (!key) continue;
    const addr = new ethers.Wallet(key).address;
    const bal = await ethers.provider.getBalance(addr);
    if (bal >= MIN) {
      console.log(`${role.padEnd(11)} ${ethers.formatEther(bal)} ETH (ok)`);
      continue;
    }
    await (await deployer.sendTransaction({ to: addr, value: AMOUNT })).wait();
    console.log(`${role.padEnd(11)} ${ethers.formatEther(bal)} → +${ethers.formatEther(AMOUNT)} ETH`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
