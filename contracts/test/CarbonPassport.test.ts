import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const PQ_PK = ethers.hexlify(ethers.randomBytes(1952));
const PQ_SIG = ethers.hexlify(ethers.randomBytes(3309));
const STATUS = { None: 0n, Pending: 1n, Issued: 2n, Rejected: 3n, Revoked: 4n };
const CN_HRC = 72083900;
const INSTALLATION = ethers.id("TR-INST-0001");
const day = 24 * 60 * 60;
const Q3_START = 1782864000; // 2026-07-01
const Q3_END = Q3_START + 92 * day - 1;

function salt(i: number) {
  return ethers.zeroPadValue(ethers.toBeHex(1000 + i), 32);
}

function evidenceTree() {
  const leaves: [string, string, string, string][] = [
    ["fuel.natural_gas", "13200", "GJ", salt(1)],
    ["electricity.grid", "4630", "MWh", salt(2)],
    ["input.electrodes", "17.5", "t", salt(3)],
    ["production.hrc", "10000", "t", salt(4)],
    ["doc.gas_invoice_2026-07.pdf", "9f2c" + "00".repeat(30), "sha256", salt(5)],
  ];
  return StandardMerkleTree.of(leaves, ["string", "string", "string", "bytes32"]);
}

function batchInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    installationId: INSTALLATION,
    cnCode: CN_HRC,
    periodStart: Q3_START,
    periodEnd: Q3_END,
    tonnes: 10_000,
    directKgPerT: 352,
    indirectKgPerT: 214,
    dataRoot: evidenceTree().root,
    reportHash: ethers.sha256(ethers.toUtf8Bytes("report-q3-2026")),
    ...overrides,
  };
}

async function deployFixture() {
  const [admin, producer, verifier, importerA, importerB, outsider] = await ethers.getSigners();
  const registry = await ethers.deployContract("VerifierRegistry", [admin.address]);
  const passport = await ethers.deployContract("CarbonPassport", [
    await registry.getAddress(),
    "https://carbonpass.example/api/metadata/{id}",
    admin.address,
  ]);
  await registry.accredit(verifier.address, "EuroVerify (fictional)", ethers.id("ACC-REF-1"), PQ_PK);
  await passport.registerInstallation(INSTALLATION, producer.address, "Anatolia Green Steel (fictional)");
  return { registry, passport, admin, producer, verifier, importerA, importerB, outsider };
}

async function issuedFixture() {
  const f = await deployFixture();
  await f.passport.connect(f.producer).submitBatch(batchInput());
  await f.passport.connect(f.verifier).attestAndIssue(1, PQ_SIG);
  return f;
}

describe("CarbonPassport", () => {
  describe("submit → attest → mint", () => {
    it("issues verified tonnes to the producer", async () => {
      const { passport, producer, verifier } = await loadFixture(deployFixture);
      await expect(passport.connect(producer).submitBatch(batchInput()))
        .to.emit(passport, "BatchSubmitted")
        .withArgs(1, INSTALLATION, producer.address, CN_HRC, Q3_START, Q3_END, 10_000, 352, 214, evidenceTree().root, batchInput().reportHash);
      expect((await passport.getBatch(1)).status).to.equal(STATUS.Pending);
      expect(await passport.balanceOf(producer.address, 1)).to.equal(0);

      await expect(passport.connect(verifier).attestAndIssue(1, PQ_SIG))
        .to.emit(passport, "BatchIssued")
        .withArgs(1, verifier.address, ethers.keccak256(PQ_SIG), PQ_SIG);
      const b = await passport.getBatch(1);
      expect(b.status).to.equal(STATUS.Issued);
      expect(b.verifier).to.equal(verifier.address);
      expect(b.pqSignatureHash).to.equal(ethers.keccak256(PQ_SIG));
      expect(await passport.balanceOf(producer.address, 1)).to.equal(10_000);
      expect(await passport["totalSupply(uint256)"](1)).to.equal(10_000);
    });

    it("only the registered operator can submit for an installation", async () => {
      const { passport, outsider } = await loadFixture(deployFixture);
      await expect(passport.connect(outsider).submitBatch(batchInput()))
        .to.be.revertedWithCustomError(passport, "NotOperator")
        .withArgs(INSTALLATION, outsider.address);
    });

    it("rejects unknown installations, zero tonnes and inverted periods", async () => {
      const { passport, producer } = await loadFixture(deployFixture);
      await expect(passport.connect(producer).submitBatch(batchInput({ installationId: ethers.id("nope") })))
        .to.be.revertedWithCustomError(passport, "UnknownInstallation");
      await expect(passport.connect(producer).submitBatch(batchInput({ tonnes: 0 })))
        .to.be.revertedWithCustomError(passport, "ZeroTonnes");
      await expect(passport.connect(producer).submitBatch(batchInput({ periodEnd: Q3_START })))
        .to.be.revertedWithCustomError(passport, "InvalidPeriod");
    });
  });

  describe("verifier independence", () => {
    it("rejects attestations from non-accredited addresses", async () => {
      const { passport, producer, outsider } = await loadFixture(deployFixture);
      await passport.connect(producer).submitBatch(batchInput());
      await expect(passport.connect(outsider).attestAndIssue(1, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "NotActiveVerifier")
        .withArgs(outsider.address);
    });

    it("blocks a producer from verifying its own batch, even if accredited", async () => {
      const { registry, passport, producer } = await loadFixture(deployFixture);
      await registry.accredit(producer.address, "Self", ethers.id("r"), PQ_PK);
      await passport.connect(producer).submitBatch(batchInput());
      await expect(passport.connect(producer).attestAndIssue(1, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "SelfVerification");
    });

    it("stops a revoked verifier from issuing", async () => {
      const { registry, passport, producer, verifier } = await loadFixture(deployFixture);
      await registry.revoke(verifier.address, ethers.id("audit finding"));
      await passport.connect(producer).submitBatch(batchInput());
      await expect(passport.connect(verifier).attestAndIssue(1, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "NotActiveVerifier");
    });

    it("lets a verifier reject a pending batch, which can then never be issued", async () => {
      const { passport, producer, verifier } = await loadFixture(deployFixture);
      await passport.connect(producer).submitBatch(batchInput());
      await expect(passport.connect(verifier).rejectBatch(1, ethers.id("missing meter log")))
        .to.emit(passport, "BatchRejected");
      await expect(passport.connect(verifier).attestAndIssue(1, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "NotPending");
    });
  });

  describe("double-counting guards", () => {
    it("cannot reuse a report hash", async () => {
      const { passport, producer } = await loadFixture(issuedFixture);
      const later = { periodStart: Q3_END + 1, periodEnd: Q3_END + 90 * day };
      await expect(passport.connect(producer).submitBatch(batchInput(later)))
        .to.be.revertedWithCustomError(passport, "ReportAlreadyUsed");
    });

    it("cannot certify an overlapping period twice", async () => {
      const { passport, producer } = await loadFixture(issuedFixture);
      const overlapping = { periodStart: Q3_START + 30 * day, periodEnd: Q3_END + 30 * day, reportHash: ethers.id("other") };
      await expect(passport.connect(producer).submitBatch(batchInput(overlapping)))
        .to.be.revertedWithCustomError(passport, "PeriodOverlap")
        .withArgs(overlapping.periodStart, Q3_END);
    });

    it("re-checks overlap at issuance when two overlapping batches were pending", async () => {
      const { passport, producer, verifier } = await loadFixture(deployFixture);
      await passport.connect(producer).submitBatch(batchInput());
      await passport.connect(producer).submitBatch(batchInput({ periodStart: Q3_START + day, reportHash: ethers.id("dup") }));
      await passport.connect(verifier).attestAndIssue(1, PQ_SIG);
      await expect(passport.connect(verifier).attestAndIssue(2, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "PeriodOverlap");
    });

    it("cannot ship more verified tonnes than exist", async () => {
      const { passport, producer, importerA, importerB } = await loadFixture(issuedFixture);
      await expect(passport.connect(producer).ship(importerA.address, 1, 6_000, ethers.id("MRN-A")))
        .to.emit(passport, "Shipped")
        .withArgs(1, producer.address, importerA.address, 6_000, ethers.id("MRN-A"));
      await passport.connect(producer).ship(importerB.address, 1, 4_000, ethers.id("MRN-B"));
      await expect(passport.connect(producer).ship(importerB.address, 1, 2_000, ethers.id("MRN-C")))
        .to.be.revertedWithCustomError(passport, "ERC1155InsufficientBalance")
        .withArgs(producer.address, 0, 2_000, 1);
      expect(await passport.balanceOf(importerA.address, 1)).to.equal(6_000);
      expect(await passport.balanceOf(importerB.address, 1)).to.equal(4_000);
    });

    it("burns tonnes on surrender so they can't be declared twice", async () => {
      const { passport, producer, importerA } = await loadFixture(issuedFixture);
      await passport.connect(producer).ship(importerA.address, 1, 6_000, ethers.id("MRN-A"));
      await expect(passport.connect(importerA).surrender(1, 6_000, ethers.id("CBAM-DECL-2026")))
        .to.emit(passport, "Surrendered")
        .withArgs(1, importerA.address, 6_000, ethers.id("CBAM-DECL-2026"));
      await expect(passport.connect(importerA).surrender(1, 1, ethers.id("again")))
        .to.be.revertedWithCustomError(passport, "ERC1155InsufficientBalance");
    });

    it("conserves tonnes: supply + surrendered == issued", async () => {
      const { passport, producer, importerA, importerB } = await loadFixture(issuedFixture);
      await passport.connect(producer).ship(importerA.address, 1, 6_000, ethers.id("A"));
      await passport.connect(producer).ship(importerB.address, 1, 3_000, ethers.id("B"));
      await passport.connect(importerA).surrender(1, 5_000, ethers.id("D1"));
      await passport.connect(importerB).surrender(1, 3_000, ethers.id("D2"));
      const b = await passport.getBatch(1);
      const supply = await passport["totalSupply(uint256)"](1);
      expect(supply + b.surrendered).to.equal(b.tonnes);
      expect(b.surrendered).to.equal(8_000);
    });
  });

  describe("revocation", () => {
    it("freezes a revoked batch", async () => {
      const { passport, producer, verifier, importerA } = await loadFixture(issuedFixture);
      await passport.connect(producer).ship(importerA.address, 1, 1_000, ethers.id("A"));
      await expect(passport.connect(verifier).revokeBatch(1, ethers.id("fraud"))).to.emit(passport, "BatchRevoked");
      await expect(passport.connect(producer).ship(importerA.address, 1, 1_000, ethers.id("B")))
        .to.be.revertedWithCustomError(passport, "BatchFrozen");
      await expect(passport.connect(importerA).surrender(1, 1_000, ethers.id("D")))
        .to.be.revertedWithCustomError(passport, "BatchFrozen");
    });

    it("only the issuing verifier or the registrar can revoke", async () => {
      const { passport, outsider } = await loadFixture(issuedFixture);
      await expect(passport.connect(outsider).revokeBatch(1, ethers.id("x")))
        .to.be.revertedWithCustomError(passport, "NotAuthorized");
    });
  });

  describe("selective disclosure", () => {
    it("verifies a committed evidence field and rejects a tampered one", async () => {
      const { passport } = await loadFixture(issuedFixture);
      const tree = evidenceTree();
      for (const [i, [key, value, unit, s]] of tree.entries()) {
        expect(await passport.verifyDisclosure(1, key, value, unit, s, tree.getProof(i))).to.equal(true);
      }
      const [key, , unit, s] = tree.at(1)!;
      expect(await passport.verifyDisclosure(1, key, "3000", unit, s, tree.getProof(1))).to.equal(false);
    });
  });
});
