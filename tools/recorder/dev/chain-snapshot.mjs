#!/usr/bin/env node
// Dev helper for re-recording against a local Hardhat node without redeploying:
//   node tools/recorder/dev/chain-snapshot.mjs save      (after deploy + seed)
//   node tools/recorder/dev/chain-snapshot.mjs restore   (before each recording; re-saves so it can be reused)
// RPC_URL defaults to http://127.0.0.1:8547. After reverting it mines past the old head, because the web app pins
// reads to the newest block it has seen and would reject an older chain.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8547";
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out", "chain-snapshot.json");
const rpc = async (method, params = []) => {
  const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  if (r.error) throw new Error(`${method}: ${r.error.message}`);
  return r.result;
};
const save = async () => {
  const id = await rpc("evm_snapshot");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ id, rpc: RPC, block: parseInt(await rpc("eth_blockNumber"), 16) }));
  console.log(`snapshot ${id} saved`);
};
const cmd = process.argv[2];
if (cmd === "save") await save();
else if (cmd === "restore") {
  const { id } = JSON.parse(fs.readFileSync(file, "utf8"));
  const head = parseInt(await rpc("eth_blockNumber"), 16);
  if (!(await rpc("evm_revert", [id]))) throw new Error(`evm_revert ${id} failed (node restarted?). Redeploy + seed, then save.`);
  const now = parseInt(await rpc("eth_blockNumber"), 16);
  if (head >= now) await rpc("hardhat_mine", [`0x${(head - now + 1).toString(16)}`]);
  console.log(`reverted to ${id}, mined to block #${parseInt(await rpc("eth_blockNumber"), 16)}`);
  await save();
} else console.log("usage: chain-snapshot.mjs save|restore");
