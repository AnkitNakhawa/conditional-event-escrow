// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only conditional escrow. The reporter is trusted and SIMULATES a Kalshi result.
/// @dev This contract does not verify Kalshi data and must not be deployed with real funds.
contract DemoEventEscrow {
    enum Outcome {
        Unresolved,
        Yes,
        No
    }

    error DemoChainOnly();
    error InvalidConfiguration();
    error NotReporter();
    error AlreadyResolved();
    error ResolutionDeadlinePassed();
    error NotClaimant();
    error NotClaimable();
    error AlreadyClaimed();
    error TransferFailed();
    error DirectDepositDisabled();

    event SimulatedOutcomeReported(Outcome outcome);
    event Claimed(address indexed recipient, uint256 amount);

    address payable public immutable depositor;
    address payable public immutable beneficiary;
    address public immutable reporter;
    uint64 public immutable resolutionDeadline;
    uint256 public immutable deposit;
    string public marketTicker;

    Outcome public outcome;
    bool public claimed;

    constructor(
        address payable beneficiary_,
        address reporter_,
        uint64 resolutionDeadline_,
        string memory marketTicker_
    ) payable {
        // Deliberately prevent accidental deployment on a value-bearing chain.
        if (block.chainid != 31337 && block.chainid != 84532) revert DemoChainOnly();
        if (
            beneficiary_ == address(0) || reporter_ == address(0) || msg.value == 0
                || resolutionDeadline_ <= block.timestamp || bytes(marketTicker_).length == 0
        ) revert InvalidConfiguration();

        depositor = payable(msg.sender);
        beneficiary = beneficiary_;
        reporter = reporter_;
        resolutionDeadline = resolutionDeadline_;
        deposit = msg.value;
        marketTicker = marketTicker_;
    }

    /// @notice The reporter enters a simulated result. No Kalshi verification happens here.
    function reportSimulatedOutcome(bool yes) external {
        if (msg.sender != reporter) revert NotReporter();
        if (outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp >= resolutionDeadline) revert ResolutionDeadlinePassed();

        outcome = yes ? Outcome.Yes : Outcome.No;
        emit SimulatedOutcomeReported(outcome);
    }

    /// @notice YES pays the beneficiary; NO or an unresolved timeout refunds the depositor.
    function claim() external {
        if (claimed) revert AlreadyClaimed();

        address payable recipient;
        if (outcome == Outcome.Yes) {
            recipient = beneficiary;
        } else if (outcome == Outcome.No || block.timestamp >= resolutionDeadline) {
            recipient = depositor;
        } else {
            revert NotClaimable();
        }

        if (msg.sender != recipient) revert NotClaimant();
        claimed = true;
        (bool success,) = recipient.call{value: deposit}("");
        if (!success) revert TransferFailed();
        emit Claimed(recipient, deposit);
    }

    receive() external payable {
        revert DirectDepositDisabled();
    }
}
