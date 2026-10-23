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
        Status status;
    }

    VerifierRegistry public immutable registry;
    uint256 public batchCount;

    mapping(uint256 => Batch) private _batches;
    mapping(bytes32 => Installation) private _installations;
    mapping(bytes32 => uint256[]) private _installationBatches;
    mapping(bytes32 => bool) public reportHashUsed;
    /// @dev keccak256(installationId, cnCode) => end of the latest certified period
    mapping(bytes32 => uint64) public lastCertifiedEnd;

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
    }

    /// @param pqSignature ML-DSA-65 signature (context "CarbonPass/v1") over
    ///        abi.encode(chainId, address(this), batchId, dataRoot, reportHash). Verified off-chain.
    function attestAndIssue(uint256 batchId, bytes calldata pqSignature) external {
        Batch storage b = _pendingBatch(batchId);
        _requireIndependentVerifier(b);
        bytes32 key = _periodKey(b.installationId, b.cnCode);
        // Re-check: another batch for an overlapping period may have been issued while this one was pending.
        if (b.periodStart <= lastCertifiedEnd[key]) revert PeriodOverlap(b.periodStart, lastCertifiedEnd[key]);

        lastCertifiedEnd[key] = b.periodEnd;
        bytes32 pqSignatureHash = keccak256(pqSignature);
        b.verifier = msg.sender;
        b.pqSignatureHash = pqSignatureHash;
        b.issuedAt = uint64(block.timestamp);
        b.status = Status.Issued;

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

    function _periodKey(bytes32 installationId, uint32 cnCode) private pure returns (bytes32) {
        return keccak256(abi.encode(installationId, cnCode));
    }
}
