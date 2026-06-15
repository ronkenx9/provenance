// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DossierRegistry} from "./DossierRegistry.sol";

/// @title AgentUnderwriterNetwork
/// @notice A decentralized network of AI agents underwriting tokenized assets on Mantle.
///         Agents stake ETH to become "Officers", propose risk rating updates,
///         and vote/validate each other's submissions. Correct submissions earn rewards,
///         while incorrect/fraudulent submissions result in slashing.
contract AgentUnderwriterNetwork {
    struct Proposal {
        uint256 id;
        address proposer;
        bytes32 assetId;
        uint16 score;
        bytes8 grade;
        bytes32 dossierHash;
        bytes32 methodologyHash;
        uint256 yesVotes;
        uint256 noVotes;
        uint64 endsAt;
        bool executed;
        bool disputed;
        bool resolved;
        address challenger;
    }

    DossierRegistry public immutable registry;
    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant CHALLENGE_WINDOW = 5 minutes;

    uint256 public proposalCount;
    address public owner;

    // Track active stake of each officer
    mapping(address => uint256) public stakes;
    // Track locked stake per officer (currently locked in active proposals/disputes)
    mapping(address => uint256) public lockedStakes;
    // Track active proposals
    mapping(uint256 => Proposal) public proposals;
    // Track if an officer has voted on a proposal: proposalId => officer => voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event OfficerRegistered(address indexed officer, uint256 amount);
    event OfficerWithdrawn(address indexed officer, uint256 amount);
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 indexed assetId,
        uint16 score,
        bytes8 grade
    );
    event Voted(uint256 indexed proposalId, address indexed voter, bool approve);
    event ProposalDisputed(uint256 indexed proposalId, address indexed challenger);
    event ProposalExecuted(uint256 indexed proposalId, bool indexed approved);
    event Slashed(address indexed proposer, uint256 amount, uint256 indexed proposalId);

    error InsufficientStake();
    error NotAnOfficer();
    error ProposalNotActive();
    error ProposalAlreadyVoted();
    error ChallengePeriodNotEnded();
    error ProposalAlreadyProcessed();
    error StakedFundsLocked();
    error TransferFailed();

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Deploy the owned DossierRegistry
        registry = new DossierRegistry();
    }

    /// @notice Register as an underwriting Officer by staking ETH
    function registerOfficer() external payable {
        stakes[msg.sender] += msg.value;
        if (stakes[msg.sender] < MIN_STAKE) revert InsufficientStake();
        emit OfficerRegistered(msg.sender, msg.value);
    }

    /// @notice Withdraw all unstaked funds and leave the network
    function withdrawStake() external {
        uint256 amount = stakes[msg.sender];
        if (amount == 0) revert InsufficientStake();
        stakes[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit OfficerWithdrawn(msg.sender, amount);
    }

    /// @notice Propose a new risk dossier. Locks MIN_STAKE from the proposer's active stake.
    function proposeDossier(
        bytes32 assetId,
        uint16 score,
        bytes8 grade,
        bytes32 dossierHash,
        bytes32 methodologyHash
    ) external returns (uint256 proposalId) {
        if (stakes[msg.sender] < MIN_STAKE) revert InsufficientStake();

        // Lock stake for this proposal
        stakes[msg.sender] -= MIN_STAKE;
        lockedStakes[msg.sender] += MIN_STAKE;

        proposalCount++;
        proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            assetId: assetId,
            score: score,
            grade: grade,
            dossierHash: dossierHash,
            methodologyHash: methodologyHash,
            yesVotes: 1, // Proposer votes YES by default
            noVotes: 0,
            endsAt: uint64(block.timestamp + CHALLENGE_WINDOW),
            executed: false,
            disputed: false,
            resolved: false,
            challenger: address(0)
        });

        // Record proposer's automatic vote
        hasVoted[proposalId][msg.sender] = true;

        emit ProposalCreated(proposalId, msg.sender, assetId, score, grade);
    }

    /// @notice Vote on a proposal
    function vote(uint256 proposalId, bool approve) external {
        if (stakes[msg.sender] + lockedStakes[msg.sender] < MIN_STAKE) revert NotAnOfficer();
        Proposal storage prop = proposals[proposalId];
        if (block.timestamp > prop.endsAt) revert ProposalNotActive();
        if (prop.executed || prop.resolved || prop.disputed) revert ProposalAlreadyProcessed();
        if (hasVoted[proposalId][msg.sender]) revert ProposalAlreadyVoted();

        hasVoted[proposalId][msg.sender] = true;

        if (approve) {
            prop.yesVotes++;
        } else {
            prop.noVotes++;
        }

        emit Voted(proposalId, msg.sender, approve);
    }

    /// @notice Flag a proposal as disputed/fraudulent. Requires locking a MIN_STAKE challenge bond.
    function dispute(uint256 proposalId) external {
        if (stakes[msg.sender] < MIN_STAKE) revert InsufficientStake();
        Proposal storage prop = proposals[proposalId];
        if (block.timestamp > prop.endsAt) revert ProposalNotActive();
        if (prop.executed || prop.resolved || prop.disputed) revert ProposalAlreadyProcessed();

        // Lock challenger's stake
        stakes[msg.sender] -= MIN_STAKE;
        lockedStakes[msg.sender] += MIN_STAKE;

        prop.disputed = true;
        prop.challenger = msg.sender;

        emit ProposalDisputed(proposalId, msg.sender);
    }

    /// @notice Process a non-disputed proposal after challenge window.
    ///         If approved, publishes to DossierRegistry and returns locked stake.
    ///         If rejected, returns locked stake to proposer without publishing.
    function executeProposal(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];
        if (block.timestamp <= prop.endsAt) revert ChallengePeriodNotEnded();
        if (prop.executed || prop.resolved) revert ProposalAlreadyProcessed();
        if (prop.disputed) revert ProposalNotActive(); // Disputed proposals must be resolved via resolveDispute

        bool approved = (prop.yesVotes > prop.noVotes);

        if (approved) {
            prop.executed = true;
            // Unlock proposer's stake
            lockedStakes[prop.proposer] -= MIN_STAKE;
            stakes[prop.proposer] += MIN_STAKE;

            // Publish to underlying DossierRegistry
            registry.publishDossier(
                prop.assetId,
                prop.score,
                prop.grade,
                prop.dossierHash,
                prop.methodologyHash
            );
        } else {
            prop.resolved = true;
            // Reject but return stake (soft rejection, no slashing unless formally disputed)
            lockedStakes[prop.proposer] -= MIN_STAKE;
            stakes[prop.proposer] += MIN_STAKE;
        }

        emit ProposalExecuted(proposalId, approved);
    }

    /// @notice Resolve a disputed proposal. Only callable by the owner (arbitrator).
    ///         If upheld: proposer is slashed, challenger gets their bond back + proposer's stake.
    ///         If dismissed: challenger is slashed, proposer gets their stake back + challenger's stake.
    function resolveDispute(uint256 proposalId, bool uphold) external onlyOwner {
        Proposal storage prop = proposals[proposalId];
        if (!prop.disputed) revert ProposalNotActive();
        if (prop.executed || prop.resolved) revert ProposalAlreadyProcessed();

        if (uphold) {
            prop.resolved = true;
            
            // Slash proposer
            lockedStakes[prop.proposer] -= MIN_STAKE;
            
            // Refund challenger + reward them with proposer's stake
            lockedStakes[prop.challenger] -= MIN_STAKE;
            stakes[prop.challenger] += MIN_STAKE * 2;

            emit Slashed(prop.proposer, MIN_STAKE, proposalId);
        } else {
            prop.executed = true;
            
            // Slash challenger
            lockedStakes[prop.challenger] -= MIN_STAKE;
            
            // Refund proposer + reward them with challenger's stake
            lockedStakes[prop.proposer] -= MIN_STAKE;
            stakes[prop.proposer] += MIN_STAKE * 2;

            // Publish to underlying DossierRegistry
            registry.publishDossier(
                prop.assetId,
                prop.score,
                prop.grade,
                prop.dossierHash,
                prop.methodologyHash
            );
        }

        emit ProposalExecuted(proposalId, !uphold);
    }
}
