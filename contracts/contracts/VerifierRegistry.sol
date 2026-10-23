// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title VerifierRegistry
/// @notice On-chain list of accredited CBAM verifiers. An accreditation body
///         (ACCREDITOR_ROLE) adds and revokes verifiers; CarbonPassport only
///         accepts attestations from verifiers that are active here.
contract VerifierRegistry is AccessControl {
    bytes32 public constant ACCREDITOR_ROLE = keccak256("ACCREDITOR_ROLE");

    struct Verifier {
        string name;
        bytes32 accreditationRef; // hash of the accreditation certificate / national body reference
        bytes32 pqPublicKeyHash;  // keccak256 of the verifier's ML-DSA-65 public key
        bool active;
        uint64 since;
    }

    mapping(address => Verifier) private _verifiers;
    address[] private _verifierList;

    event VerifierAccredited(address indexed verifier, string name, bytes32 accreditationRef, bytes32 pqPublicKeyHash);
    event VerifierRevoked(address indexed verifier, bytes32 reasonHash);

    error ZeroAddress();
    error NotAccredited(address verifier);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ACCREDITOR_ROLE, admin);
    }

    function accredit(address verifier, string calldata name, bytes32 accreditationRef, bytes32 pqPublicKeyHash)
        external
        onlyRole(ACCREDITOR_ROLE)
    {
        if (verifier == address(0)) revert ZeroAddress();
        if (_verifiers[verifier].since == 0) _verifierList.push(verifier);
        _verifiers[verifier] = Verifier(name, accreditationRef, pqPublicKeyHash, true, uint64(block.timestamp));
        emit VerifierAccredited(verifier, name, accreditationRef, pqPublicKeyHash);
    }

    function revoke(address verifier, bytes32 reasonHash) external onlyRole(ACCREDITOR_ROLE) {
        if (!_verifiers[verifier].active) revert NotAccredited(verifier);
        _verifiers[verifier].active = false;
        emit VerifierRevoked(verifier, reasonHash);
    }

    function isActive(address verifier) external view returns (bool) {
        return _verifiers[verifier].active;
    }

    function getVerifier(address verifier) external view returns (Verifier memory) {
        return _verifiers[verifier];
    }

    function verifiers() external view returns (address[] memory) {
        return _verifierList;
    }
}
