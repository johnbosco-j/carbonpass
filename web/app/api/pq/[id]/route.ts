import { keccak256, type Hex } from "viem";
import { deployment, passport, publicClient, registry } from "@/lib/chain/server";
import { attestationMessage, pqVerify, PQ_CONTEXT_LABEL } from "@/lib/pq";

export const dynamic = "force-dynamic";

/**
 * Verifies a batch's post-quantum attestation using only on-chain data: the ML-DSA-65 signature from the
 * BatchIssued event, the verifier's public key from the VerifierAccredited event, and the batch commitments.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const batchId = BigInt((await params).id);
  const fromBlock = BigInt(deployment.deployBlock);
  const b = await publicClient.readContract({ ...passport, functionName: "getBatch", args: [batchId] });
  if (b.status < 2) return Response.json({ verified: false, reason: "Batch not issued" });

  const [issued] = await publicClient.getContractEvents({ ...passport, eventName: "BatchIssued", args: { batchId }, fromBlock });
  const accredited = await publicClient.getContractEvents({ ...registry, eventName: "VerifierAccredited", args: { verifier: b.verifier }, fromBlock });
  const latestKey = accredited.at(-1);
  if (!issued?.args.pqSignature || !latestKey?.args.pqPublicKey) {
    return Response.json({ verified: false, reason: "Signature or public key event not found" });
  }
  const signature = issued.args.pqSignature as Hex;
  const publicKey = latestKey.args.pqPublicKey as Hex;
  const onChainKeyHash = (await publicClient.readContract({ ...registry, functionName: "getVerifier", args: [b.verifier] })).pqPublicKeyHash;

  const message = attestationMessage(deployment.chainId, deployment.passport as Hex, batchId, b.dataRoot, b.reportHash);
  const t0 = performance.now();
  const valid = pqVerify(signature, message, publicKey);
  const verifyMs = performance.now() - t0;

  return Response.json({
    verified: valid && keccak256(signature) === b.pqSignatureHash && keccak256(publicKey) === onChainKeyHash,
    scheme: "ML-DSA-65 (NIST FIPS 204)",
    context: PQ_CONTEXT_LABEL,
    signatureBytes: (signature.length - 2) / 2,
    publicKeyBytes: (publicKey.length - 2) / 2,
    signatureHashMatches: keccak256(signature) === b.pqSignatureHash,
    publicKeyHashMatches: keccak256(publicKey) === onChainKeyHash,
    signatureValid: valid,
    verifyMs: Math.round(verifyMs * 10) / 10,
    txHash: issued.transactionHash,
    signaturePreview: `${signature.slice(0, 66)}…`,
  });
}
