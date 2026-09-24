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

## References
- Kalshi public market API: https://docs.kalshi.com/getting_started/quick_start_market_data
- Stork Kalshi integration: https://www.stork.network/blog/kalshi-events-on-chain
- Foundry documentation: https://getfoundry.sh/
