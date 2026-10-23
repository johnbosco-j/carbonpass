// Verifies deployed contracts on Sourcify (API v2) using Hardhat's build-info standard JSON input.
//   node scripts/sourcify-verify.mjs <chainId> <address> <sourceName:ContractName>
import fs from "node:fs";
import path from "node:path";
const [chainId, address, identifier] = process.argv.slice(2);
const dir = "artifacts/build-info";
const sourceName = identifier.split(":")[0];
const info = fs.readdirSync(dir).map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).find((b) => b.input.sources[sourceName]);
const headers = { "content-type": "application/json", "user-agent": "carbonpass-hackathon/0.1 (+https://github.com/johnbosco-j/carbonpass)" };
const res = await fetch(`https://sourcify.dev/server/v2/verify/${chainId}/${address}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ stdJsonInput: info.input, compilerVersion: info.solcLongVersion, contractIdentifier: identifier }),
});
const started = await res.json();
if (!res.ok) { console.log(res.status, JSON.stringify(started)); process.exit(1); }
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const job = await (await fetch(`https://sourcify.dev/server/v2/verify/${started.verificationId}`, { headers })).json();
  if (job.isJobCompleted) { console.log(identifier, JSON.stringify(job.contract?.match ?? job.error ?? job)); process.exit(0); }
}
console.log("timed out", started.verificationId);
