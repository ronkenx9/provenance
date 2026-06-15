// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentUnderwriterNetwork} from "../contracts/AgentUnderwriterNetwork.sol";
import {DossierRegistry} from "../contracts/DossierRegistry.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function deal(address, uint256) external;
}

contract AgentUnderwriterNetworkTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    AgentUnderwriterNetwork net;
    DossierRegistry reg;

    bytes32 constant USDY = keccak256("USDY");
    address constant OFFICER_1 = address(0x1111);
    address constant OFFICER_2 = address(0x2222);
    address constant OFFICER_3 = address(0x3333);

    function setUp() public {
        net = new AgentUnderwriterNetwork();
        reg = net.registry();

        // Deal ETH to test officers
        vm.deal(OFFICER_1, 1 ether);
        vm.deal(OFFICER_2, 1 ether);
        vm.deal(OFFICER_3, 1 ether);
    }

    function testRegisterOfficer() public {
        vm.prank(OFFICER_1);
        net.registerOfficer{value: 0.05 ether}();

        require(net.stakes(OFFICER_1) == 0.05 ether, "Stake mismatch");
    }

    function testProposeDossier() public {
        vm.prank(OFFICER_1);
        net.registerOfficer{value: 0.02 ether}();

        vm.prank(OFFICER_1);
        uint256 propId = net.proposeDossier(
            USDY,
            602,
            "B",
            bytes32(uint256(123)),
            bytes32(uint256(456))
        );

        require(propId == 1, "First proposal id should be 1");
        require(net.stakes(OFFICER_1) == 0.01 ether, "Active stake should decrease by MIN_STAKE");
        require(net.lockedStakes(OFFICER_1) == 0.01 ether, "Locked stake should increase by MIN_STAKE");
    }

    function testSuccessfulVoteAndExecute() public {
        // Register officers
        vm.prank(OFFICER_1);
        net.registerOfficer{value: 0.02 ether}();
        vm.prank(OFFICER_2);
        net.registerOfficer{value: 0.02 ether}();
        vm.prank(OFFICER_3);
        net.registerOfficer{value: 0.02 ether}();

        // Officer 1 proposes
        vm.prank(OFFICER_1);
        uint256 propId = net.proposeDossier(USDY, 602, "B", bytes32(uint256(123)), bytes32(uint256(456)));

        // Officer 2 and 3 vote yes
        vm.prank(OFFICER_2);
        net.vote(propId, true);
        vm.prank(OFFICER_3);
        net.vote(propId, true);

        // Warp time beyond challenge window (5 minutes = 300 seconds)
        vm.warp(block.timestamp + 301);

        // Execute proposal
        net.executeProposal(propId);

        // Proposer stake should be unlocked
        require(net.stakes(OFFICER_1) == 0.02 ether, "Proposer stake should return");
        require(net.lockedStakes(OFFICER_1) == 0, "Proposer locked stake should clear");

        // Registry should be updated
        DossierRegistry.Dossier memory d = reg.latest(USDY);
        require(d.score == 602, "Registry score incorrect");
        require(d.grade == bytes8("B"), "Registry grade incorrect");
    }

    function testRejectedVoteReturnsStake() public {
        // Register officers
        vm.prank(OFFICER_1);
        net.registerOfficer{value: 0.02 ether}();
        vm.prank(OFFICER_2);
        net.registerOfficer{value: 0.02 ether}();
        vm.prank(OFFICER_3);
        net.registerOfficer{value: 0.02 ether}();

        // Officer 1 proposes
        vm.prank(OFFICER_1);
        uint256 propId = net.proposeDossier(USDY, 602, "B", bytes32(uint256(123)), bytes32(uint256(456)));

        // Officer 2 and 3 vote no (reject)
        vm.prank(OFFICER_2);
        net.vote(propId, false);
        vm.prank(OFFICER_3);
        net.vote(propId, false);

        // Warp time beyond challenge window
        vm.warp(block.timestamp + 301);

        // Execute proposal (will fail but return proposer's stake in soft consensus rejection)
        net.executeProposal(propId);

        // Proposer should get stake back
        require(net.stakes(OFFICER_1) == 0.02 ether, "Proposer should get stake back");
        require(net.lockedStakes(OFFICER_1) == 0, "Locked stake should clear");
    }

    function testDisputedProposalUpholdSlashesProposer() public {
        // Register officers
        vm.prank(OFFICER_1);
        net.registerOfficer{value: 0.02 ether}();
        vm.prank(OFFICER_2);
        net.registerOfficer{value: 0.02 ether}();

        // Officer 1 proposes
        vm.prank(OFFICER_1);
        uint256 propId = net.proposeDossier(USDY, 602, "B", bytes32(uint256(123)), bytes32(uint256(456)));

        // Officer 2 disputes (locks their MIN_STAKE)
        vm.prank(OFFICER_2);
        net.dispute(propId);

        // Owner/arbitrator upholds the dispute (proposer is slashed, challenger gets proposer's stake)
        net.resolveDispute(propId, true);

        // Proposer should be slashed
        require(net.stakes(OFFICER_1) == 0.01 ether, "Proposer should be slashed");
        require(net.lockedStakes(OFFICER_1) == 0, "Proposer locked stake should clear");

        // Challenger (Officer 2) should get their dispute bond back + proposer's slashed stake (total 0.03 ether)
        require(net.stakes(OFFICER_2) == 0.03 ether, "Challenger should get reward");
        require(net.lockedStakes(OFFICER_2) == 0, "Challenger locked stake should clear");
    }

    function testDisputedProposalDismissSlashesChallenger() public {
        // Register officers
        vm.prank(OFFICER_1);
        net.registerOfficer{value: 0.02 ether}();
        vm.prank(OFFICER_2);
        net.registerOfficer{value: 0.02 ether}();

        // Officer 1 proposes
        vm.prank(OFFICER_1);
        uint256 propId = net.proposeDossier(USDY, 602, "B", bytes32(uint256(123)), bytes32(uint256(456)));

        // Officer 2 disputes (locks their MIN_STAKE)
        vm.prank(OFFICER_2);
        net.dispute(propId);

        // Owner/arbitrator dismisses the dispute (challenger is slashed, proposer gets challenger's stake + publishes)
        net.resolveDispute(propId, false);

        // Challenger should be slashed
        require(net.stakes(OFFICER_2) == 0.01 ether, "Challenger should be slashed");
        require(net.lockedStakes(OFFICER_2) == 0, "Challenger locked stake should clear");

        // Proposer (Officer 1) should get their stake back + challenger's slashed stake (total 0.03 ether)
        require(net.stakes(OFFICER_1) == 0.03 ether, "Proposer should get reward");
        require(net.lockedStakes(OFFICER_1) == 0, "Proposer locked stake should clear");

        // Registry should be updated
        DossierRegistry.Dossier memory d = reg.latest(USDY);
        require(d.score == 602, "Registry score incorrect");
    }
}
