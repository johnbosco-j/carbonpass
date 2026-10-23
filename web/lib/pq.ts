import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { encodeAbiParameters, hexToBytes, bytesToHex, type Hex } from "viem";

/** ML-DSA context string (FIPS 204 domain separation). Bump the version to rotate schemes. */
export const PQ_CONTEXT_LABEL = "CarbonPass/v1";
const PQ_CONTEXT = new TextEncoder().encode(PQ_CONTEXT_LABEL);

/** The exact bytes a verifier signs for a batch: abi.encode(chainId, contract, batchId, dataRoot, reportHash). */
export function attestationMessage(chainId: number, contract: Hex, batchId: bigint, dataRoot: Hex, reportHash: Hex): Uint8Array {
  return hexToBytes(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes32" }],
      [BigInt(chainId), contract, batchId, dataRoot, reportHash],
    ),
  );
}

export function pqKeysFromSeed(seed: Hex) {
  return ml_dsa65.keygen(hexToBytes(seed));
}

export function pqSign(message: Uint8Array, secretKey: Uint8Array): Hex {
  return bytesToHex(ml_dsa65.sign(message, secretKey, { context: PQ_CONTEXT }));
}

export function pqVerify(signature: Hex, message: Uint8Array, publicKey: Hex): boolean {
  try {
    return ml_dsa65.verify(hexToBytes(signature), message, hexToBytes(publicKey), { context: PQ_CONTEXT });
  } catch {
    return false;
  }
}
