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
- SDK dependencies are now pinned locally (`viem` 2.56.8 and TypeScript 5.9.3); initial typecheck passed. Foundry's artifact stores creation bytecode at `out/DemoEventEscrow.sol/DemoEventEscrow.json` under `bytecode.object`.
- Focused SDK review found two read-side risks: values could be sampled from different blocks, and an unknown numeric outcome could be mislabeled unresolved. The SDK now pins all state reads to one block and rejects unknown outcomes.
- Viem cached `getBlockNumber()` across a newly mined report transaction in the local SDK test. `getEscrow` explicitly requests an uncached block number before taking its single-block snapshot.
- Kalshi's public, unauthenticated `GET /markets/{ticker}` endpoint returns a `market` object with `ticker`, `market_type`, `title`, `rules_primary`, `rules_secondary`, `status`, and `result`. Official API docs: https://docs.kalshi.com/api-reference/market/get-market and https://docs.kalshi.com/getting_started/quick_start_market_data. Public metadata is offchain information, not a verified contract input.
- A live read of finalized binary ticker `KXCOPPERW-26JUL2417-T6.29` returned the documented fields, `status: "finalized"`, and `result: "yes"`. The adapter should keep status/result as descriptive API data rather than equating them with onchain settlement authority. Market ticker syntax includes dots as well as hyphens.
- For the next read-only assessment, use the existing exact-ticker/binary lookup and fail closed: only `status: "finalized"` with raw `result: "yes"` or `"no"` produces an offchain candidate. Other statuses and results remain non-actionable. This is an SDK safety convention based on the observed API shape, not a claim of cryptographic finality or source authentication.
- Review of the candidate helper found no onchain write path. Remaining product risks are explicit: status strings may evolve (so the helper may conservatively reject a valid future status), public API data is not authenticated to the contract, and ticker/rules are not bound to a deployed escrow. These are deliberately deferred rather than silently treated as solved.
- The existing contract's single `resolutionDeadline` already acts as an unresolved-refund long-stop, but it does not distinguish the start of reporting from that long-stop. The next increment should add `reportingOpensAt` as an explicit lower bound and rename the upper bound to `reportingDeadline`. This does not verify Kalshi finality; it only enforces a chosen reporting window.
- The SDK now has two separate read-only building blocks: `getEscrow` reads escrow state pinned to one chain block, and `getKalshiSettlementCandidate` classifies an exact-ticker public API response. The next increment should compose them without a wallet client or transaction path. Because the HTTP lookup can be slow, the onchain state and chain timestamp should be refreshed together at one block *after* the API response before returning a point-in-time assessment.
- The new composition takes a block-pinned initial snapshot, skips HTTP entirely for already claimed/resolved or out-of-window escrows, and takes a second block-pinned snapshot after a potentially slow HTTP response. This narrows stale-read risk but cannot make public API data trustworthy to the contract or prevent the assessment from becoming stale immediately after return.

## References
- Kalshi public market API: https://docs.kalshi.com/getting_started/quick_start_market_data
- Stork Kalshi integration: https://www.stork.network/blog/kalshi-events-on-chain
- Foundry documentation: https://getfoundry.sh/
- Foundry GitHub Action: https://github.com/foundry-rs/foundry-toolchain
- Viem contract docs: https://viem.sh/docs/contract/readContract and https://viem.sh/docs/contract/writeContract

## 2026-10-04 — initial outcome-source research
- Stork's October 2025 Kalshi announcement says its pull oracle delivers Kalshi prices, liquidity, and resolution outcomes, but instructs developers to contact Stork for access. Source: https://www.stork.network/blog/kalshi-events-on-chain
- Stork's EVM contract address page lists a Base Sepolia deployment, but a deployed generic oracle contract is not evidence that any specific Kalshi final-outcome feed is available there. Source: https://docs.stork.network/resources/contract-addresses/evm
- The public Stork asset-ID registry appears focused on price feeds; this initial search did not find a documented Kalshi outcome asset ID. Specific feed coverage, encoding, access terms, and fees remain unverified. Source: https://docs.stork.network/resources/asset-id-registry
- Stork's generic temporal numeric value encodes a timestamp and number; a finalized event outcome would need an explicit per-feed mapping, including YES/NO/void, before it could safely drive payouts. Source: https://docs.stork.network/introduction/core-concepts
- A search of the public Stork asset-ID registry found no `KALSHI` or `KX` entry; this is evidence only about the public listing, not proof that private/custom feeds do not exist. Source: https://docs.stork.network/resources/asset-id-registry
- Stork's EVM API exposes signed-update submission, latest value by bytes32 feed ID, an unsafe historical/stale read, and per-update fee quotation. Generic safe reads may reject values past a chain-specific staleness threshold (typically one hour), which needs design for one-time final outcomes. Source: https://docs.stork.network/api-reference/contract-apis/evm
- Kalshi's unauthenticated `GET /markets/{ticker}` exposes market identity, rules, status, result, settlement timestamp, and `is_provisional`. These fields support offchain cross-checking; the public HTTP response is not an onchain proof. Source: https://docs.kalshi.com/api-reference/market/get-market
- The previously used finalized example ticker `KXCOPPERW-26JUL2417-T6.29` returned HTTP 404 in a direct live check on 2026-10-04; do not reuse it as proof of current API availability without finding a current example.
- On 2026-10-04, Kalshi's live unauthenticated series query `GET /markets?limit=100&status=settled&series_ticker=KXHIGHNY` returned finalized binary markets. Exact ticker `KXHIGHNY-26OCT03-B70.5` returned `status: finalized`, `result: yes`, and `settlement_ts: 2026-10-04T11:10:27.124832Z`; `is_provisional` was null, so do not infer its semantics from this example. Its rules reference The Weather Company and caveat preliminary data. This is a feasible *offchain cross-check example*, not evidence that Stork publishes it.
- Stork's public Kalshi announcement provides no public feed ID or terms, and directs builders to its contact form. Its separate September 2026 Kalshi market-data announcement concerns licensed trading data; do not assume that product includes final-outcome oracle access or the same terms. Sources: https://www.stork.network/blog/kalshi-events-on-chain and https://www.stork.network/blog/prediction-market-data-kalshi-license
