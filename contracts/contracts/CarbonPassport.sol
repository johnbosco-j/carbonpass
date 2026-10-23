// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {VerifierRegistry} from "./VerifierRegistry.sol";

/// @title CarbonPassport
/// @notice Verified embedded-emissions batches for EU CBAM, as ERC-1155 tokens.
///         One token id = one batch (installation x CN code x reporting period).
///         One token unit = one tonne of product carrying the verified intensity.
///
///         Double-counting guards:
///          - tonnes are minted once, on verification, and only move by transfer or burn
///          - a report hash can be used once
///          - certified periods per installation and CN code never overlap
///          - a producer cannot verify its own batch
///          - importers burn (surrender) tonnes when they file a CBAM declaration
///          - precursor tonnes (e.g. pig iron in steel) are burned when the downstream batch is issued,
///            so a supplier's verified tonnes count in exactly one downstream product
contract CarbonPassport is ERC1155Supply, AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum Status {
        None,
        Pending,
        Issued,
        Rejected,
        Revoked
    }

    struct Installation {
        address operator;
        string name;
        bool registered;
    }

    struct BatchInput {
        bytes32 installationId;
        uint32 cnCode;
        uint64 periodStart;
        uint64 periodEnd;
        uint64 tonnes;
        uint32 directKgPerT; // kgCO2e per tonne of product
        uint32 indirectKgPerT;
        bytes32 dataRoot; // Merkle root of salted evidence leaves
        bytes32 reportHash; // sha256 of the canonical report JSON
        PrecursorInput[] precursors; // verified upstream tonnes this batch embeds (consumed at issuance)
    }

    /// @notice `tonnes` of precursor batch `batchId` used to make a downstream batch.
    struct PrecursorInput {
        uint256 batchId;
        uint64 tonnes;
    }

    struct Batch {
        address producer;
        bytes32 installationId;
        uint32 cnCode;
        uint64 periodStart;
        uint64 periodEnd;
        uint64 tonnes;
        uint32 directKgPerT;
        uint32 indirectKgPerT;
        bytes32 dataRoot;
        bytes32 reportHash;
        address verifier;
        bytes32 pqSignatureHash; // keccak256 of the verifier's ML-DSA-65 signature
        uint64 submittedAt;
        uint64 issuedAt;
        uint64 surrendered;
        uint64 consumed; // tonnes burned as a precursor of downstream batches
        Status status;
    }

    /// @notice Upper bound on precursor inputs per batch, so issuance gas stays bounded.
    uint256 public constant MAX_PRECURSORS = 8;

    VerifierRegistry public immutable registry;
    uint256 public batchCount;

    mapping(uint256 => Batch) private _batches;
    mapping(bytes32 => Installation) private _installations;
    mapping(bytes32 => uint256[]) private _installationBatches;
    mapping(bytes32 => bool) public reportHashUsed;
    /// @dev keccak256(installationId, cnCode) => end of the latest certified period
    mapping(bytes32 => uint64) public lastCertifiedEnd;
    /// @dev downstream batchId => declared precursor inputs
    mapping(uint256 => PrecursorInput[]) private _precursors;

    event InstallationRegistered(bytes32 indexed installationId, address indexed operator, string name);
    event BatchSubmitted(
        uint256 indexed batchId,
        bytes32 indexed installationId,
        address indexed producer,
        uint32 cnCode,
        uint64 periodStart,
        uint64 periodEnd,
        uint64 tonnes,
        uint32 directKgPerT,
        uint32 indirectKgPerT,
        bytes32 dataRoot,
        bytes32 reportHash
    );
    /// @dev The full ML-DSA-65 signature is emitted so the post-quantum attestation is verifiable from chain data alone.
    event BatchIssued(uint256 indexed batchId, address indexed verifier, bytes32 pqSignatureHash, bytes pqSignature);
    event BatchRejected(uint256 indexed batchId, address indexed verifier, bytes32 reasonHash);
    event BatchRevoked(uint256 indexed batchId, address indexed by, bytes32 reasonHash);
    event Shipped(uint256 indexed batchId, address indexed from, address indexed to, uint64 tonnes, bytes32 shipmentRef);
    event Surrendered(uint256 indexed batchId, address indexed holder, uint64 tonnes, bytes32 declarationRef);
    event PrecursorDeclared(uint256 indexed batchId, uint256 indexed precursorId, uint64 tonnes);
    event PrecursorConsumed(uint256 indexed batchId, uint256 indexed precursorId, address indexed holder, uint64 tonnes);

    error UnknownInstallation(bytes32 installationId);
    error NotOperator(bytes32 installationId, address caller);
    error UnknownBatch(uint256 batchId);
    error ZeroTonnes();
    error InvalidPeriod(uint64 periodStart, uint64 periodEnd);
    error PeriodOverlap(uint64 periodStart, uint64 lastCertifiedEnd);
    error ReportAlreadyUsed(bytes32 reportHash);
    error NotPending(uint256 batchId, Status status);
    error NotIssued(uint256 batchId, Status status);
    error NotActiveVerifier(address caller);
    error SelfVerification(address producer);
    error NotAuthorized(address caller);
    error BatchFrozen(uint256 batchId);
    error TooManyPrecursors(uint256 count, uint256 max);
    error DuplicatePrecursor(uint256 precursorId);
    error PrecursorNotIssued(uint256 precursorId, Status status);
    error InsufficientPrecursor(uint256 precursorId, uint256 held, uint256 needed);
    error UnderstatedPrecursors(uint256 declaredKg, uint256 precursorKg);

    constructor(VerifierRegistry registry_, string memory uri_, address admin) ERC1155(uri_) {
        registry = registry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    // ---------------------------------------------------------------- installations

    function registerInstallation(bytes32 installationId, address operator, string calldata name)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        _installations[installationId] = Installation(operator, name, true);
        emit InstallationRegistered(installationId, operator, name);
    }

    // ---------------------------------------------------------------- batch lifecycle

    /// @notice Submit a batch for verification. Declared precursors are checked here (fail fast) but nothing is
    ///         consumed until a verifier issues the batch; the submission is the producer's consent to that burn.
    function submitBatch(BatchInput calldata input) external returns (uint256 batchId) {
        Installation storage inst = _installations[input.installationId];
        if (!inst.registered) revert UnknownInstallation(input.installationId);
        if (inst.operator != msg.sender) revert NotOperator(input.installationId, msg.sender);
        if (input.tonnes == 0) revert ZeroTonnes();
        if (input.periodEnd <= input.periodStart) revert InvalidPeriod(input.periodStart, input.periodEnd);
        if (reportHashUsed[input.reportHash]) revert ReportAlreadyUsed(input.reportHash);
        uint64 lastEnd = lastCertifiedEnd[_periodKey(input.installationId, input.cnCode)];
        if (input.periodStart <= lastEnd) revert PeriodOverlap(input.periodStart, lastEnd);

        reportHashUsed[input.reportHash] = true;
        batchId = ++batchCount;
        Batch storage b = _batches[batchId];
        b.producer = msg.sender;
        b.installationId = input.installationId;
        b.cnCode = input.cnCode;
        b.periodStart = input.periodStart;
        b.periodEnd = input.periodEnd;
        b.tonnes = input.tonnes;
        b.directKgPerT = input.directKgPerT;
        b.indirectKgPerT = input.indirectKgPerT;
        b.dataRoot = input.dataRoot;
        b.reportHash = input.reportHash;
        b.submittedAt = uint64(block.timestamp);
        b.status = Status.Pending;
        _installationBatches[input.installationId].push(batchId);

        uint256 n = input.precursors.length;
        if (n > MAX_PRECURSORS) revert TooManyPrecursors(n, MAX_PRECURSORS);
        for (uint256 i = 0; i < n; ++i) {
            PrecursorInput calldata p = input.precursors[i];
            for (uint256 j = 0; j < i; ++j) {
                if (input.precursors[j].batchId == p.batchId) revert DuplicatePrecursor(p.batchId);
            }
            _precursors[batchId].push(p);
        }
        _checkPrecursors(b, _precursors[batchId]);

        emit BatchSubmitted(
            batchId,
            input.installationId,
            msg.sender,
            input.cnCode,
            input.periodStart,
            input.periodEnd,
            input.tonnes,
            input.directKgPerT,
            input.indirectKgPerT,
            input.dataRoot,
            input.reportHash
        );
        for (uint256 i = 0; i < n; ++i) {
            emit PrecursorDeclared(batchId, input.precursors[i].batchId, input.precursors[i].tonnes);
        }
    }

    /// @notice Verify a pending batch: mints its tonnes to the producer and burns the precursor tonnes it declared.
    /// @param pqSignature ML-DSA-65 signature (context "CarbonPass/v1") over
    ///        abi.encode(chainId, address(this), batchId, dataRoot, reportHash). Verified off-chain.
    function attestAndIssue(uint256 batchId, bytes calldata pqSignature) external {
        Batch storage b = _pendingBatch(batchId);
        _requireIndependentVerifier(b);
        bytes32 key = _periodKey(b.installationId, b.cnCode);
        // Re-check: another batch for an overlapping period may have been issued while this one was pending.
        if (b.periodStart <= lastCertifiedEnd[key]) revert PeriodOverlap(b.periodStart, lastCertifiedEnd[key]);
        // Re-check: a precursor may have been revoked, or its tonnes moved or consumed, while this one was pending.
        PrecursorInput[] storage inputs = _precursors[batchId];
        _checkPrecursors(b, inputs);

        lastCertifiedEnd[key] = b.periodEnd;
        bytes32 pqSignatureHash = keccak256(pqSignature);
        b.verifier = msg.sender;
        b.pqSignatureHash = pqSignatureHash;
        b.issuedAt = uint64(block.timestamp);
        b.status = Status.Issued;

        // Burn precursors before minting: the mint can call back into a contract producer.
        for (uint256 i = 0; i < inputs.length; ++i) {
            PrecursorInput storage p = inputs[i];
            _burn(b.producer, p.batchId, p.tonnes);
            _batches[p.batchId].consumed += p.tonnes;
            emit PrecursorConsumed(batchId, p.batchId, b.producer, p.tonnes);
        }
        _mint(b.producer, batchId, b.tonnes, "");
        emit BatchIssued(batchId, msg.sender, pqSignatureHash, pqSignature);
    }

    function rejectBatch(uint256 batchId, bytes32 reasonHash) external {
        Batch storage b = _pendingBatch(batchId);
        _requireIndependentVerifier(b);
        b.verifier = msg.sender;
        b.status = Status.Rejected;
        emit BatchRejected(batchId, msg.sender, reasonHash);
    }

    /// @notice Freeze an issued batch, e.g. after fraud is discovered. Revoked tonnes can no longer move or be surrendered.
    function revokeBatch(uint256 batchId, bytes32 reasonHash) external {
        Batch storage b = _batches[batchId];
        if (b.status != Status.Issued) revert NotIssued(batchId, b.status);
        if (msg.sender != b.verifier && !hasRole(REGISTRAR_ROLE, msg.sender)) revert NotAuthorized(msg.sender);
        b.status = Status.Revoked;
        emit BatchRevoked(batchId, msg.sender, reasonHash);
    }

    // ---------------------------------------------------------------- movement

    /// @notice Allocate verified tonnes to an importer with a shipment (e.g. customs MRN hash).
    function ship(address to, uint256 batchId, uint64 tonnes, bytes32 shipmentRef) external {
        if (tonnes == 0) revert ZeroTonnes();
        _safeTransferFrom(msg.sender, to, batchId, tonnes, "");
        emit Shipped(batchId, msg.sender, to, tonnes, shipmentRef);
    }

    /// @notice Burn tonnes when they are used in a CBAM declaration, so they can never be claimed again.
    function surrender(uint256 batchId, uint64 tonnes, bytes32 declarationRef) external {
        if (tonnes == 0) revert ZeroTonnes();
        _burn(msg.sender, batchId, tonnes);
        _batches[batchId].surrendered += tonnes;
        emit Surrendered(batchId, msg.sender, tonnes, declarationRef);
    }

    // ---------------------------------------------------------------- proofs & views

    /// @notice Check that one evidence field (or document hash) is part of a batch's committed evidence.
    ///         Leaf encoding matches OpenZeppelin StandardMerkleTree with types (string, string, string, bytes32).
    function verifyDisclosure(
        uint256 batchId,
        string calldata key,
        string calldata value,
        string calldata unit,
        bytes32 salt,
        bytes32[] calldata proof
    ) external view returns (bool) {
        Batch storage b = _batches[batchId];
        if (b.status == Status.None) revert UnknownBatch(batchId);
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(key, value, unit, salt))));
        return MerkleProof.verifyCalldata(proof, b.dataRoot, leaf);
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        if (_batches[batchId].status == Status.None) revert UnknownBatch(batchId);
        return _batches[batchId];
    }

    /// @notice The precursor inputs a batch declared. Once the batch is Issued, these tonnes have been burned.
    function getPrecursors(uint256 batchId) external view returns (PrecursorInput[] memory) {
        if (_batches[batchId].status == Status.None) revert UnknownBatch(batchId);
        return _precursors[batchId];
    }

    function getInstallation(bytes32 installationId) external view returns (Installation memory) {
        return _installations[installationId];
    }

    function installationBatches(bytes32 installationId) external view returns (uint256[] memory) {
        return _installationBatches[installationId];
    }

    function setURI(string calldata newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ---------------------------------------------------------------- internals

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                if (_batches[ids[i]].status == Status.Revoked) revert BatchFrozen(ids[i]);
            }
        }
        super._update(from, to, ids, values);
    }

    function _pendingBatch(uint256 batchId) private view returns (Batch storage b) {
        b = _batches[batchId];
        if (b.status == Status.None) revert UnknownBatch(batchId);
        if (b.status != Status.Pending) revert NotPending(batchId, b.status);
    }

    function _requireIndependentVerifier(Batch storage b) private view {
        if (!registry.isActive(msg.sender)) revert NotActiveVerifier(msg.sender);
        if (msg.sender == b.producer) revert SelfVerification(b.producer);
    }

    /// @dev Every precursor must be Issued (not revoked) and held by the producer in full, and the batch's direct
    ///      intensity must cover what it embeds: directKgPerT * tonnes >= sum(precursor tonnes * precursor directKgPerT).
    ///      Integer form of the check, so there is no rounding. A precursor is always an older batch than the one
    ///      consuming it (it must already be Issued at submit), so the supply-chain graph is acyclic.
    function _checkPrecursors(Batch storage b, PrecursorInput[] storage inputs) private view {
        uint256 precursorKg;
        for (uint256 i = 0; i < inputs.length; ++i) {
            PrecursorInput storage p = inputs[i];
            if (p.tonnes == 0) revert ZeroTonnes();
            Batch storage pre = _batches[p.batchId];
            if (pre.status != Status.Issued) revert PrecursorNotIssued(p.batchId, pre.status);
            uint256 held = balanceOf(b.producer, p.batchId);
            if (held < p.tonnes) revert InsufficientPrecursor(p.batchId, held, p.tonnes);
            precursorKg += uint256(p.tonnes) * pre.directKgPerT;
        }
        uint256 declaredKg = uint256(b.tonnes) * b.directKgPerT;
        if (declaredKg < precursorKg) revert UnderstatedPrecursors(declaredKg, precursorKg);
    }

    function _periodKey(bytes32 installationId, uint32 cnCode) private pure returns (bytes32) {
        return keccak256(abi.encode(installationId, cnCode));
    }
}
