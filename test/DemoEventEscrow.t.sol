// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DemoEventEscrow} from "../src/DemoEventEscrow.sol";

interface Vm {
    function prank(address sender) external;
    function deal(address account, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes4 selector) external;
}

contract RejectEth {
    receive() external payable {
        revert("reject");
    }

    function claim(DemoEventEscrow escrow) external {
        escrow.claim();
    }
}

contract DemoEventEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address payable private constant BENEFICIARY = payable(address(0xBEEF));
    address private constant REPORTER = address(0xCAFE);
    uint256 private constant AMOUNT = 1 ether;

    function _deploy(address payable beneficiary, uint256 amount)
        private
        returns (DemoEventEscrow)
    {
        return new DemoEventEscrow{value: amount}(
            beneficiary, REPORTER, uint64(block.timestamp + 7 days), "KX-DEMO-MARKET"
        );
    }

    function testYesPaysBeneficiaryOnce() public {
        vm.deal(address(this), AMOUNT);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(true);

        vm.prank(BENEFICIARY);
        escrow.claim();
        require(BENEFICIARY.balance == AMOUNT, "beneficiary not paid");
        require(address(escrow).balance == 0, "escrow not emptied");
        require(escrow.claimed(), "not claimed");

        vm.prank(BENEFICIARY);
        vm.expectRevert(DemoEventEscrow.AlreadyClaimed.selector);
        escrow.claim();
    }

    function testNoRefundsDepositor() public {
        vm.deal(address(this), AMOUNT);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(false);
        vm.prank(BENEFICIARY);
        vm.expectRevert(DemoEventEscrow.NotClaimant.selector);
        escrow.claim();
        escrow.claim();
        require(address(this).balance == AMOUNT, "depositor not refunded");
    }

    function testUnresolvedTimeoutRefundsDepositor() public {
        vm.deal(address(this), AMOUNT);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        vm.expectRevert(DemoEventEscrow.NotClaimable.selector);
        escrow.claim();
        vm.warp(escrow.resolutionDeadline());
        escrow.claim();
        require(address(this).balance == AMOUNT, "timeout refund failed");
    }

    function testOnlyReporterCanResolveAndOnlyOnce() public {
        vm.deal(address(this), AMOUNT);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        vm.expectRevert(DemoEventEscrow.NotReporter.selector);
        escrow.reportSimulatedOutcome(true);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(true);
        vm.prank(REPORTER);
        vm.expectRevert(DemoEventEscrow.AlreadyResolved.selector);
        escrow.reportSimulatedOutcome(false);
    }

    function testCannotResolveAtDeadline() public {
        vm.deal(address(this), AMOUNT);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        vm.warp(escrow.resolutionDeadline());
        vm.prank(REPORTER);
        vm.expectRevert(DemoEventEscrow.ResolutionDeadlinePassed.selector);
        escrow.reportSimulatedOutcome(true);
    }

    function testYesResultStillPaysBeneficiaryAfterDeadline() public {
        vm.deal(address(this), AMOUNT);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(true);
        vm.warp(escrow.resolutionDeadline());
        vm.expectRevert(DemoEventEscrow.NotClaimant.selector);
        escrow.claim();
        vm.prank(BENEFICIARY);
        escrow.claim();
        require(BENEFICIARY.balance == AMOUNT, "YES payout lost after deadline");
    }

    function testDirectDepositRejected() public {
        vm.deal(address(this), AMOUNT + 1);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, AMOUNT);
        (bool success,) = address(escrow).call{value: 1}("");
        require(!success, "direct deposit unexpectedly accepted");
        require(address(escrow).balance == AMOUNT, "escrow balance changed");
    }

    function testTransferFailureDoesNotConsumeClaim() public {
        vm.deal(address(this), AMOUNT);
        RejectEth rejecting = new RejectEth();
        DemoEventEscrow escrow = _deploy(payable(address(rejecting)), AMOUNT);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(true);
        vm.expectRevert(DemoEventEscrow.TransferFailed.selector);
        rejecting.claim(escrow);
        require(!escrow.claimed(), "failed claim consumed");
        require(address(escrow).balance == AMOUNT, "funds lost");
    }

    function testInvalidConfiguration() public {
        vm.deal(address(this), AMOUNT);
        vm.expectRevert(DemoEventEscrow.InvalidConfiguration.selector);
        _deploy(BENEFICIARY, 0);
        vm.expectRevert(DemoEventEscrow.InvalidConfiguration.selector);
        _deploy(payable(address(0)), AMOUNT);
        vm.expectRevert(DemoEventEscrow.InvalidConfiguration.selector);
        new DemoEventEscrow{value: AMOUNT}(
            BENEFICIARY, address(0), uint64(block.timestamp + 1), "X"
        );
        vm.expectRevert(DemoEventEscrow.InvalidConfiguration.selector);
        new DemoEventEscrow{value: AMOUNT}(BENEFICIARY, REPORTER, uint64(block.timestamp), "X");
        vm.expectRevert(DemoEventEscrow.InvalidConfiguration.selector);
        new DemoEventEscrow{value: AMOUNT}(BENEFICIARY, REPORTER, uint64(block.timestamp + 1), "");
    }

    function testRejectsMainnetDeployment() public {
        vm.chainId(1);
        vm.expectRevert(DemoEventEscrow.DemoChainOnly.selector);
        new DemoEventEscrow(BENEFICIARY, REPORTER, uint64(block.timestamp + 1), "X");
    }

    function testFuzzYesPayoutConservesDeposit(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) + 1;
        vm.deal(address(this), amount);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, amount);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(true);
        vm.prank(BENEFICIARY);
        escrow.claim();
        require(BENEFICIARY.balance == amount, "wrong payout");
        require(address(escrow).balance == 0, "escrow not empty");
    }

    function testFuzzNoRefundConservesDeposit(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) + 1;
        vm.deal(address(this), amount);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, amount);
        vm.prank(REPORTER);
        escrow.reportSimulatedOutcome(false);
        escrow.claim();
        require(address(this).balance == amount, "wrong refund");
        require(address(escrow).balance == 0, "escrow not empty");
    }

    function testFuzzTimeoutRefundConservesDeposit(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) + 1;
        vm.deal(address(this), amount);
        DemoEventEscrow escrow = _deploy(BENEFICIARY, amount);
        vm.warp(escrow.resolutionDeadline());
        escrow.claim();
        require(address(this).balance == amount, "wrong timeout refund");
        require(address(escrow).balance == 0, "escrow not empty");
    }

    receive() external payable {}
}
