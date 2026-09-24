# Run the local demo

This walkthrough uses local simulated outcomes and test ETH only. It does not contact Kalshi.

1. Install [Foundry](https://getfoundry.sh/) if it is not already installed.
2. Run `forge test` from the repository root to verify the complete suite.
3. Run `forge test --match-test testYesPaysBeneficiaryOnce -vvvv` to see a trace of a YES result paying the beneficiary.
4. Run `forge test --match-test testNoRefundsDepositor -vvvv` to see a NO result refunding the depositor.
5. Run `forge test --match-test testUnresolvedTimeoutRefundsDepositor -vvvv` to see the timeout-refund path.

These traces are the first developer-facing demo. A browser interface and a verified Kalshi outcome adapter are later milestones. Do not deploy this contract on a public chain with real money.
