# Findings

## User requirements
- Create a new public GitHub repository.
- Start with a plan in the repository, then build an escrow-contract demo.
- Commit regularly and test code thoroughly while features are added.

## Context
- The intended product is a conditional payout referencing a specific Kalshi market's final settlement, not a new prediction market.
- Kalshi's price represents an expectation; only the final settlement should control a YES/NO payout.
- A blockchain contract cannot directly call Kalshi's API. A live-money version requires a trustworthy outcome-delivery mechanism.
- The first demo must distinguish simulated reporting from verified Kalshi reporting.

## Technical findings
- GitHub CLI is authenticated as `AnkitNakhawa` and has repository creation scope.
- Foundry `forge` is installed locally.
- The existing `onchain-capability-graph` repository is a separate project.
- The demo contract rejects deployment except on Anvil/local chain ID 31337 and Base Sepolia chain ID 84532.
- Contract review found key non-production limitations: reporter can lie or report before Kalshi settles; a recipient contract that rejects ETH can strand its own payout; ticker is descriptive metadata only and not validated against Kalshi.
- Unit and fuzz/property tests cover YES, NO, timeout, authorization, deadlines, invalid construction, direct deposits, failed transfers, and conservation of the initial deposit.
- Foundry's official GitHub Action (`foundry-rs/foundry-toolchain@v1`) supports installing a specific release and running `forge fmt`, `forge build`, and `forge test` in CI.

## References
- Kalshi public market API: https://docs.kalshi.com/getting_started/quick_start_market_data
- Stork Kalshi integration: https://www.stork.network/blog/kalshi-events-on-chain
- Foundry documentation: https://getfoundry.sh/
- Foundry GitHub Action: https://github.com/foundry-rs/foundry-toolchain
