// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DossierRegistry — on-chain anchor for PROVENANCE risk dossiers
/// @notice PROVENANCE publishes versioned, machine-readable ratings for tokenized
///         assets. The composite score and grade live on-chain so any agent can
///         read them; the full dossier JSON is content-addressed by dossierHash;
///         the scoring methodology is pinned by methodologyHash so a rubric change
///         is visible as a new methodology, never a silent edit.
contract DossierRegistry {
    struct Dossier {
        uint16 score;          // composite x10 (e.g. 76.7 => 767)
        bytes8 grade;          // "AA", "A", "B", "C", "D" (right-padded)
        bytes32 dossierHash;   // sha256 of the canonical dossier JSON
        bytes32 methodologyHash; // sha256 of the rubric weights+code manifest
        uint64 atBlock;
        uint32 version;        // per-asset, monotonically increasing
    }

    address public immutable publisher;

    /// assetId (e.g. keccak("USDY")) => versions
    mapping(bytes32 => Dossier[]) private dossiers;

    event DossierPublished(
        bytes32 indexed assetId,
        uint32 indexed version,
        uint16 score,
        bytes8 grade,
        bytes32 dossierHash,
        bytes32 methodologyHash
    );

    error NotPublisher();
    error NoDossier();
    error ScoreOutOfRange();

    constructor() {
        publisher = msg.sender;
    }

    function publishDossier(
        bytes32 assetId,
        uint16 score,
        bytes8 grade,
        bytes32 dossierHash,
        bytes32 methodologyHash
    ) external returns (uint32 version) {
        if (msg.sender != publisher) revert NotPublisher();
        if (score > 1000) revert ScoreOutOfRange();
        version = uint32(dossiers[assetId].length) + 1;
        dossiers[assetId].push(
            Dossier({
                score: score,
                grade: grade,
                dossierHash: dossierHash,
                methodologyHash: methodologyHash,
                atBlock: uint64(block.number),
                version: version
            })
        );
        emit DossierPublished(assetId, version, score, grade, dossierHash, methodologyHash);
    }

    /// @notice Latest rating for an asset — the one-call agent read.
    function latest(bytes32 assetId) external view returns (Dossier memory) {
        uint256 n = dossiers[assetId].length;
        if (n == 0) revert NoDossier();
        return dossiers[assetId][n - 1];
    }

    /// @notice Full version history for an asset.
    function history(bytes32 assetId) external view returns (Dossier[] memory) {
        return dossiers[assetId];
    }

    function versionCount(bytes32 assetId) external view returns (uint256) {
        return dossiers[assetId].length;
    }

    /// @notice Helper so agents/UIs derive ids identically: keccak256(bytes(symbol)).
    function assetIdOf(string calldata symbol) external pure returns (bytes32) {
        return keccak256(bytes(symbol));
    }
}
