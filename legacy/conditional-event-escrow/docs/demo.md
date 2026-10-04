# Run the local demo

This walkthrough uses local simulated outcomes and test ETH only. It does not contact Kalshi.

The one-command transaction demo needs Foundry (`anvil`, `cast`, and `forge`), `jq`, `python3`, and Bash. From the repository root, run:

```bash
bash scripts/local-demo.sh
```

The command starts a fresh local Anvil chain, deploys a contract with 1 test ETH, sends a simulated YES result from a separate reporter account, claims from the beneficiary account, verifies onchain state and balances, then shuts Anvil down. It refuses to reuse a server already listening on its port. Set `EVENT_ESCROW_DEMO_PORT` if port 18545 is occupied.

The contract's NO and timeout paths are exercised by unit and fuzz tests rather than by this one-command smoke test:

1. Install [Foundry](https://getfoundry.sh/) if it is not already installed.
1. Run `forge test` from the repository root to verify the complete suite.
2. Run `forge test --match-test testNoRefundsDepositor -vvvv` to see a NO result refunding the depositor.
3. Run `forge test --match-test testUnresolvedTimeoutRefundsDepositor -vvvv` to see the timeout-refund path.

The local transaction flow is the first developer-facing demo. A browser interface and a verified Kalshi outcome adapter are later milestones. Do not deploy this contract on a public chain with real money.
