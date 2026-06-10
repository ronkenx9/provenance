// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DossierRegistry} from "../contracts/DossierRegistry.sol";

contract DossierRegistryTest {
    DossierRegistry reg;
    bytes32 constant USDY = keccak256("USDY");

    function setUp() public {
        reg = new DossierRegistry();
    }

    function testPublishAndLatest() public {
        uint32 v = reg.publishDossier(USDY, 602, "B", bytes32(uint256(1)), bytes32(uint256(9)));
        require(v == 1, "first version is 1");
        DossierRegistry.Dossier memory d = reg.latest(USDY);
        require(d.score == 602 && d.grade == bytes8("B") && d.version == 1, "latest mismatch");
    }

    function testVersionIncrements() public {
        reg.publishDossier(USDY, 602, "B", bytes32(uint256(1)), bytes32(uint256(9)));
        uint32 v2 = reg.publishDossier(USDY, 715, "A", bytes32(uint256(2)), bytes32(uint256(9)));
        require(v2 == 2, "second version is 2");
        require(reg.versionCount(USDY) == 2, "two versions stored");
        DossierRegistry.Dossier[] memory h = reg.history(USDY);
        require(h.length == 2 && h[0].score == 602 && h[1].score == 715, "history ordered");
        require(reg.latest(USDY).version == 2, "latest is v2");
    }

    function testOnlyPublisher() public {
        Attacker a = new Attacker();
        bool ok = a.tryPublish(reg);
        require(!ok, "non-publisher must revert");
    }

    function testNoDossierReverts() public {
        bool ok;
        try reg.latest(keccak256("NOPE")) returns (DossierRegistry.Dossier memory) {
            ok = true;
        } catch {
            ok = false;
        }
        require(!ok, "latest on unknown asset must revert");
    }

    function testScoreRangeGuard() public {
        bool ok;
        try reg.publishDossier(USDY, 1001, "A", bytes32(0), bytes32(0)) returns (uint32) {
            ok = true;
        } catch {
            ok = false;
        }
        require(!ok, "score > 1000 must revert");
    }

    function testAssetIdHelperMatchesKeccak() public view {
        require(reg.assetIdOf("USDY") == USDY, "assetId derivation must match keccak256(symbol)");
    }
}

contract Attacker {
    function tryPublish(DossierRegistry reg) external returns (bool ok) {
        try reg.publishDossier(keccak256("USDY"), 1, "D", bytes32(0), bytes32(0)) returns (uint32) {
            ok = true;
        } catch {
            ok = false;
        }
    }
}
