# Findings

## User requirements
- Create a new public GitHub repository.
- Start with a plan in the repository, then build an escrow-contract demo.
- Commit regularly and test code thoroughly while features are added.
- Prioritize a reusable library over a user interface; demos come later.

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
- Local Foundry has `anvil`, `cast`, and `forge`, and `jq` is available for parsing transaction receipts. `forge create` supports a funded constructor deployment via `--value` and unlocked Anvil accounts via `--unlocked --from`.
- The local smoke script completed actual Anvil transactions for funded deployment, reporter submission, and beneficiary claim. It asserts contract balance, result, claimed flag, receipt status, and beneficiary balance change. Existing unit/fuzz tests cover NO and timeout; the script deliberately covers only the YES end-to-end path to avoid redundant integration testing.
- The current contract is reusable on test chains, but the CLI demo is not a developer API. The next smallest library surface is a typed SDK for deploy/read/claim, with simulated reporting isolated under a development namespace.
- Viem's official docs support typed contract deployment, read/write calls, and wallet/public clients. The SDK can accept caller-provided Viem clients rather than managing keys or RPC credentials.
- Local npm registry check found Viem 2.56.8 available. No dependency has been installed yet; the next coding slice can pin and test the package rather than making a speculative wrapper.

## References
- Kalshi public market API: https://docs.kalshi.com/getting_started/quick_start_market_data
- Stork Kalshi integration: https://www.stork.network/blog/kalshi-events-on-chain
- Foundry documentation: https://getfoundry.sh/
- Foundry GitHub Action: https://github.com/foundry-rs/foundry-toolchain
- Viem contract docs: https://viem.sh/docs/contract/readContract and https://viem.sh/docs/contract/writeContract
