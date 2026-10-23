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
const CN_PIG_IRON = 72011011;
const SUPPLIER_INSTALLATION = ethers.id("TR-INST-0002");
const JUNE_START = Q3_START - 30 * day; // 2026-06-01

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
    precursors: [] as { batchId: number; tonnes: number }[],
    ...overrides,
  };
}

async function deployFixture() {
  const [admin, producer, verifier, importerA, importerB, outsider, supplier] = await ethers.getSigners();
  const registry = await ethers.deployContract("VerifierRegistry", [admin.address]);
  const passport = await ethers.deployContract("CarbonPassport", [
    await registry.getAddress(),
    "https://carbonpass.example/api/metadata/{id}",
    admin.address,
  ]);
  await registry.accredit(verifier.address, "EuroVerify (fictional)", ethers.id("ACC-REF-1"), PQ_PK);
  await passport.registerInstallation(INSTALLATION, producer.address, "Anatolia Green Steel (fictional)");
  await passport.registerInstallation(SUPPLIER_INSTALLATION, supplier.address, "Karadeniz Pig Iron (fictional)");
  return { registry, passport, admin, producer, verifier, importerA, importerB, outsider, supplier };
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

  describe("precursor passports (supply-chain composability)", () => {
    const PIG_IRON_KG = 1_700; // supplier's verified direct intensity
    const STEEL_KG = 352; // own direct ~ 131 kg/t + 1,300 t x 1,700 kg / 10,000 t = 221 kg/t

    function pigIronInput(overrides: Partial<Record<string, unknown>> = {}) {
      return batchInput({
        installationId: SUPPLIER_INSTALLATION,
        cnCode: CN_PIG_IRON,
        periodStart: JUNE_START,
        periodEnd: Q3_START - 1,
        tonnes: 5_000,
        directKgPerT: PIG_IRON_KG,
        indirectKgPerT: 60,
        reportHash: ethers.id("pig-iron-2026-06"),
        ...overrides,
      });
    }

    /** Supplier batch #1 (5,000 t pig iron) issued; 1,300 t shipped to the steel mill. */
    async function supplyFixture() {
      const f = await deployFixture();
      await f.passport.connect(f.supplier).submitBatch(pigIronInput());
      await f.passport.connect(f.verifier).attestAndIssue(1, PQ_SIG);
      await f.passport.connect(f.supplier).ship(f.producer.address, 1, 1_300, ethers.id("CMR-TR-0001"));
      return f;
    }

    const steelWith = (precursors: { batchId: number; tonnes: number }[], overrides: Partial<Record<string, unknown>> = {}) =>
      batchInput({ directKgPerT: STEEL_KG, precursors, ...overrides });

    it("records the claim at submit and consumes precursor tonnes only at issuance", async () => {
      const { passport, producer, verifier } = await loadFixture(supplyFixture);
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }])))
        .to.emit(passport, "PrecursorDeclared")
        .withArgs(2, 1, 1_300);
      // Submitting consumes nothing.
      expect(await passport.balanceOf(producer.address, 1)).to.equal(1_300);
      expect((await passport.getBatch(1)).consumed).to.equal(0);

      await expect(passport.connect(verifier).attestAndIssue(2, PQ_SIG))
        .to.emit(passport, "PrecursorConsumed")
        .withArgs(2, 1, producer.address, 1_300);
      expect(await passport.balanceOf(producer.address, 1)).to.equal(0);
      expect(await passport.balanceOf(producer.address, 2)).to.equal(10_000);
      expect((await passport.getBatch(1)).consumed).to.equal(1_300);
      expect(await passport["totalSupply(uint256)"](1)).to.equal(3_700);
      const inputs = await passport.getPrecursors(2);
      expect(inputs.map((p) => [p.batchId, p.tonnes])).to.deep.equal([[1n, 1_300n]]);
      expect(await passport.getPrecursors(1)).to.deep.equal([]);
    });

    it("rejects a claim for more precursor tonnes than the producer holds", async () => {
      const { passport, producer } = await loadFixture(supplyFixture);
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_500 }])))
        .to.be.revertedWithCustomError(passport, "InsufficientPrecursor")
        .withArgs(1, 1_300, 1_500);
    });

    it("re-checks the balance at issuance if precursor tonnes moved while pending", async () => {
      const { passport, producer, verifier, outsider } = await loadFixture(supplyFixture);
      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }]));
      await passport.connect(producer).ship(outsider.address, 1, 400, ethers.id("resold"));
      await expect(passport.connect(verifier).attestAndIssue(2, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "InsufficientPrecursor")
        .withArgs(1, 900, 1_300);
      expect(await passport.balanceOf(producer.address, 2)).to.equal(0);
    });

    it("blocks reuse: consumed precursor tonnes can't back a second batch", async () => {
      const { passport, producer, verifier } = await loadFixture(supplyFixture);
      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }]));
      await passport.connect(verifier).attestAndIssue(2, PQ_SIG);
      const october = { periodStart: Q3_END + 1, periodEnd: Q3_END + 31 * day, reportHash: ethers.id("report-oct") };
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }], october)))
        .to.be.revertedWithCustomError(passport, "InsufficientPrecursor")
        .withArgs(1, 0, 1_300);
    });

    it("blocks reuse across two pending batches: only the first issued consumes the tonnes", async () => {
      const { passport, producer, verifier } = await loadFixture(supplyFixture);
      const october = { periodStart: Q3_END + 1, periodEnd: Q3_END + 31 * day, reportHash: ethers.id("report-oct") };
      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }]));
      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }], october));
      await passport.connect(verifier).attestAndIssue(2, PQ_SIG);
      await expect(passport.connect(verifier).attestAndIssue(3, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "InsufficientPrecursor")
        .withArgs(1, 0, 1_300);
    });

    it("rejects listing the same precursor twice", async () => {
      const { passport, producer } = await loadFixture(supplyFixture);
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 600 }, { batchId: 1, tonnes: 700 }])))
        .to.be.revertedWithCustomError(passport, "DuplicatePrecursor")
        .withArgs(1);
    });

    it("reverts with UnderstatedPrecursors when the downstream intensity can't cover its precursors", async () => {
      const { passport, producer } = await loadFixture(supplyFixture);
      // 1,300 t x 1,700 kg = 2,210,000 kg embedded; 10,000 t at 220 kg/t declares only 2,200,000 kg.
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }], { directKgPerT: 220 })))
        .to.be.revertedWithCustomError(passport, "UnderstatedPrecursors")
        .withArgs(2_200_000, 2_210_000);
      // Exactly covering the precursors is allowed (integer check, no rounding).
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }], { directKgPerT: 221 }))).to.emit(
        passport,
        "BatchSubmitted",
      );
    });

    it("blocks pending, unknown and revoked precursors, including revocation while the claim is pending", async () => {
      const { passport, producer, verifier, supplier } = await loadFixture(supplyFixture);
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 99, tonnes: 1 }])))
        .to.be.revertedWithCustomError(passport, "PrecursorNotIssued")
        .withArgs(99, STATUS.None);
      const july = { periodStart: Q3_START, periodEnd: Q3_START + 31 * day - 1, reportHash: ethers.id("pig-iron-07") };
      await passport.connect(supplier).submitBatch(pigIronInput(july)); // #2, pending
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 2, tonnes: 1 }])))
        .to.be.revertedWithCustomError(passport, "PrecursorNotIssued")
        .withArgs(2, STATUS.Pending);

      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }])); // #3
      await passport.connect(verifier).revokeBatch(1, ethers.id("supplier fraud"));
      await expect(passport.connect(verifier).attestAndIssue(3, PQ_SIG))
        .to.be.revertedWithCustomError(passport, "PrecursorNotIssued")
        .withArgs(1, STATUS.Revoked);
      await expect(passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }], { reportHash: ethers.id("retry") })))
        .to.be.revertedWithCustomError(passport, "PrecursorNotIssued")
        .withArgs(1, STATUS.Revoked);
    });

    it("a rejected batch consumes nothing, and the tonnes stay usable", async () => {
      const { passport, producer, verifier } = await loadFixture(supplyFixture);
      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }]));
      await passport.connect(verifier).rejectBatch(2, ethers.id("missing coke invoice"));
      expect(await passport.balanceOf(producer.address, 1)).to.equal(1_300);
      expect((await passport.getBatch(1)).consumed).to.equal(0);

      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }], { reportHash: ethers.id("resubmitted") }));
      await expect(passport.connect(verifier).attestAndIssue(3, PQ_SIG)).to.emit(passport, "PrecursorConsumed").withArgs(3, 1, producer.address, 1_300);
    });

    it("caps the number of precursor inputs", async () => {
      const { passport, producer } = await loadFixture(supplyFixture);
      const many = Array.from({ length: 9 }, (_, i) => ({ batchId: i + 1, tonnes: 1 }));
      await expect(passport.connect(producer).submitBatch(steelWith(many)))
        .to.be.revertedWithCustomError(passport, "TooManyPrecursors")
        .withArgs(9, 8);
    });

    it("conserves precursor tonnes: supply + surrendered + consumed == issued", async () => {
      const { passport, producer, verifier, supplier, importerA } = await loadFixture(supplyFixture);
      // Some pig iron goes straight to an EU importer and is declared there; 1,300 t go into steel.
      await passport.connect(supplier).ship(importerA.address, 1, 2_000, ethers.id("MRN-PIG"));
      await passport.connect(importerA).surrender(1, 500, ethers.id("CBAM-DECL-PIG"));
      await passport.connect(producer).submitBatch(steelWith([{ batchId: 1, tonnes: 1_300 }]));
      await passport.connect(verifier).attestAndIssue(2, PQ_SIG);

      const pig = await passport.getBatch(1);
      const supply = await passport["totalSupply(uint256)"](1);
      expect(supply + pig.surrendered + pig.consumed).to.equal(pig.tonnes);
      expect([supply, pig.surrendered, pig.consumed]).to.deep.equal([3_200n, 500n, 1_300n]);
      // The downstream batch is conserved on its own: consumption never touches its supply.
      const steel = await passport.getBatch(2);
      expect((await passport["totalSupply(uint256)"](2)) + steel.surrendered + steel.consumed).to.equal(steel.tonnes);
    });

    it("holds conservation across a seeded random sequence of ships, claims, issuances and surrenders", async () => {
      const { passport, producer, verifier, supplier, importerA, importerB } = await loadFixture(supplyFixture);
      let seed = 42;
      const rand = (n: number) => {
        // mulberry32: small deterministic PRNG, so a failure replays exactly.
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) % n;
      };
      const holders = [supplier, producer, importerA, importerB];
      let nextStart = Q3_START;
      let reverted = 0;
      let consumedSteps = 0;

      for (let step = 0; step < 80; step++) {
        const count = Number(await passport.batchCount());
        const id = 1 + rand(count);
        const op = rand(4);
        try {
          if (op === 0) {
            // Any holder ships part of any batch to another holder.
            const from = holders[rand(holders.length)];
            const to = holders[rand(holders.length)];
            await passport.connect(from).ship(to.address, id, 1 + rand(1_500), ethers.id(`s${step}`));
          } else if (op === 1) {
            // Any holder surrenders part of any batch.
            await passport.connect(holders[rand(holders.length)]).surrender(id, 1 + rand(800), ethers.id(`d${step}`));
          } else if (op === 2) {
            // The mill claims a random amount of a random batch as a precursor for its next month.
            const end = nextStart + 30 * day;
            await passport.connect(producer).submitBatch(
              steelWith([{ batchId: id, tonnes: 1 + rand(1_500) }], { periodStart: nextStart, periodEnd: end, reportHash: ethers.id(`r${step}`), directKgPerT: 2_000 }),
            );
            nextStart = end + 1;
          } else {
            // The verifier issues or rejects a pending batch.
            const b = await passport.getBatch(id);
            if (b.status !== STATUS.Pending) continue;
            if (rand(4) === 0) {
              await passport.connect(verifier).rejectBatch(id, ethers.id("random"));
            } else {
              const hasInputs = (await passport.getPrecursors(id)).length > 0;
              await passport.connect(verifier).attestAndIssue(id, PQ_SIG);
              if (hasInputs) consumedSteps++;
            }
          }
        } catch {
          reverted++; // over-claims, over-ships and stale claims are expected to revert
        }

        for (let i = 1; i <= Number(await passport.batchCount()); i++) {
          const b = await passport.getBatch(i);
          const supply = await passport["totalSupply(uint256)"](i);
          const minted = b.status === STATUS.Issued || b.status === STATUS.Revoked ? b.tonnes : 0n;
          expect(supply + b.surrendered + b.consumed).to.equal(minted);
          const balances = await passport.balanceOfBatch(
            holders.map((h) => h.address),
            holders.map(() => i),
          );
          expect(balances.reduce((a, x) => a + x, 0n)).to.equal(supply);
        }
      }
      // The sequence exercises both paths: some claims are consumed, some are rejected by the contract.
      expect(consumedSteps).to.be.greaterThan(0);
      expect(reverted).to.be.greaterThan(0);
    });
  });
});