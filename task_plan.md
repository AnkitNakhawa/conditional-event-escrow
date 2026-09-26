# Conditional Event Escrow — build plan

## Goal
Build an open-source developer library for fully funded, event-conditioned escrows. Its first release is testnet-only and uses a simulated result; the library must never imply that a simulated result is verified by Kalshi.

## Current phase
Phase 5 — real outcome integration research (pending).

## Phases

### Phase 1 — repository and specification (complete)
- [x] Create public GitHub repository and commit this plan.
- [x] Document actors, state transitions, funding, timeout, and failure cases.
- [x] Choose a small contract interface and test matrix.

### Phase 2 — contract MVP (complete)
- [x] Implement a single-deposit escrow for one market and one beneficiary.
- [x] Use an explicitly simulated outcome reporter for testnet only.
- [x] Support YES payout, NO refund, and an unresolved timeout refund.
- [x] Prevent duplicate settlement, duplicate claims, and unauthorized reporting.
- [x] Write unit and fuzz/property tests; commit only after tests pass.

### Phase 3 — local transaction proof (complete)
- [x] Add a one-command local Anvil demo using separate deployment, report, and claim transactions.
- [x] Check onchain escrow state and balances after the flow; run the smoke test in CI.
- [x] Include reproducible local demo instructions.
- [x] Test the complete deposit → report → claim/refund path locally.

### Phase 4 — reusable library API (in progress)
- [x] Specify the public SDK surface and safety labels in `docs/library-api.md`.
- [x] Implement a typed TypeScript package for deployment, reading escrow state, and claiming.
- [x] Keep simulated reporting explicitly in a development-only API.
- [x] Test argument validation, bytecode compatibility, and one SDK-to-Anvil flow without duplicating every Solidity test.
- [x] Add package build/typecheck/test to CI and document library usage.
- [x] Add a read-only Kalshi market adapter that validates market identity and exposes its rules/status without claiming the outcome is verified onchain.
  - [x] First slice: fetch one market by exact ticker; validate basic response fields; surface rules/status without reporting onchain.
  - [x] Test valid, missing, malformed, and HTTP-failure responses with a mocked fetch; run full CI checks before commit.
  - [x] Add a read-only settlement-candidate assessment for finalized binary YES/NO API results, with explicit non-actionable reasons and no transaction path.
  - [x] Test finalized YES/NO, unfinished, missing, and unsupported results; verify against a live finalized example.

### Phase 4b — explicit reporting window (complete)
- [x] Add `reportingOpensAt` and `reportingDeadline` to the demo contract; only the reporter may set an outcome inside the window.
- [x] At the deadline, allow the depositor to refund only if still unresolved; preserve a timely YES/NO result after the deadline.
- [x] Update Solidity boundary tests, SDK ABI/types/bytecode, local demo, and docs; run local checks.

### Phase 4c — read-only escrow settlement check (complete)
- [x] Add a library operation that pairs an escrow's exact ticker with an offchain settlement candidate and a fresh, block-pinned escrow/window snapshot.
- [x] Return explicit non-actionable reasons for finalized-result issues, ticker identity problems, resolved/claimed escrows, and closed reporting windows; never submit a transaction.
- [x] Cover stop reasons with focused mocked tests and exercise the full read-only path against Anvil with a mocked Kalshi response.
- [x] Document the point-in-time/trust limits, review the diff, run full checks, and commit/push the increment.

### Phase 5 — real outcome integration research (pending)
- [ ] Confirm a reliable, usable final-outcome feed for specific Kalshi market IDs.
- [ ] Evaluate Stork access, terms, latency, fees, disputes, and unsupported markets.
- [ ] Design a replaceable outcome-source adapter; do not ship real-money settlement by default.

### Phase 6 — optional demos and external review (pending)
- [ ] Add a user-facing interface only if it helps validate a concrete use case.
- [ ] Include testnet deployment instructions after the library and reporter workflow are ready.
- [ ] Get user feedback on a concrete conditional-payment use case.
- [ ] Obtain independent security and legal review before any public real-money use.

## Decisions
| Decision | Reason |
| --- | --- |
| New standalone repository | Existing `onchain-capability-graph` project is unrelated. |
| EVM + Foundry for MVP | Small Solidity contracts and strong local test tooling. |
| Testnet-only and mock reporter first | The Kalshi-to-chain trust boundary is not validated yet. |
| One escrow, not tradable YES/NO tokens | Tests the actual user problem with far less security and regulatory surface. |
| Full funding at creation | A promised payout must be backed before settlement. |
| Testnet ETH deposit for MVP | Minimizes token-integration code while proving payout lifecycle; stablecoin support is later. |
| Explicit `DemoEventEscrow` contract name | Makes the unverified demo status visible to code readers. |
| Small commits after passing tests | Makes changes easy to inspect and recover. |
| Use Anvil's unlocked local accounts for the demo | Avoid storing even throwaway private keys in the repository. |
| Library before interface | Developers need reusable functionality first; a UI is optional and comes later. |
| TypeScript SDK around the existing EVM contract | A typed deploy/read/claim client is the smallest broadly usable developer surface. |
| Market metadata before any outcome oracle | Prevent accidental use of arbitrary or ambiguous ticker strings while keeping data lookup separate from settlement authority. |

## Open questions
- Which Kalshi markets have unambiguous final outcomes suitable for payment conditions?
- What are Stork's access terms and coverage for those markets?
- Which real user would pre-fund this type of payment, and why is existing escrow insufficient?

## Errors encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| `forge fmt --check` found formatting differences | 1 | Ran `forge fmt` before the next test. |
| Foundry treats `testFailed*` as removed legacy `testFail*` syntax | 1 | Renamed test to `testTransferFailureDoesNotConsumeClaim`. |
| `forge inspect ... bytecode --json` is not JSON in this Foundry version | 1 | Treat its raw `0x` output as hex when generating the SDK bytecode constant. |
| SDK integration test compared checksummed and lowercase addresses literally | 1 | Normalize case for address equality; preserve original values in the SDK. |
| Viem's cached block number made a fresh report appear unresolved | 1 | Disable caching for the block-number lookup while pinning all reads to that block. |
| Local TypeScript build and `git status` stalled in filesystem reads | 1 | Verified the SDK from a clean temporary package install; retrying repository checks and will rely on CI for a clean checkout. |
| `git diff --check` temporarily reported "Not a git repository" although `.git` exists | 1 | Repository commands recovered after delayed filesystem reads; recheck before committing. |
| Attempted to read nonexistent `docs/escrow-spec.md` | 1 | Use repository file discovery before opening a spec path. |
| Temporary SDK install with `npm ci --offline` missed cached `ws` tarball, then `tsc` was unavailable | 1 | Retry the isolated install with network access instead of treating the incomplete install as a code failure. |
