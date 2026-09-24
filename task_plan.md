# Conditional Event Escrow — build plan

## Goal
Build an open-source, testnet-only demo of a fully funded conditional payment tied to the final outcome of a named Kalshi market. The demo must never imply that a simulated result is verified by Kalshi.

## Current phase
Phase 1 — repository and specification.

## Phases

### Phase 1 — repository and specification (in progress)
- [ ] Create public GitHub repository and commit this plan.
- [ ] Document actors, state transitions, funding, timeout, and failure cases.
- [ ] Choose a small contract interface and test matrix.

### Phase 2 — contract MVP (pending)
- [ ] Implement a single-deposit escrow for one market and one beneficiary.
- [ ] Use an explicitly simulated outcome reporter for testnet only.
- [ ] Support YES payout, NO refund, and an unresolved timeout refund.
- [ ] Prevent duplicate settlement, duplicate claims, and unauthorized reporting.
- [ ] Write unit, fuzz, and invariant tests; commit only after tests pass.

### Phase 3 — demo workflow (pending)
- [ ] Add a minimal interface showing market rules, escrow status, and testnet disclaimer.
- [ ] Include reproducible local and testnet instructions.
- [ ] Test the complete deposit → report → claim/refund path.

### Phase 4 — real outcome integration research (pending)
- [ ] Confirm a reliable, usable final-outcome feed for specific Kalshi market IDs.
- [ ] Evaluate Stork access, terms, latency, fees, disputes, and unsupported markets.
- [ ] Design a replaceable reporter interface; do not ship real-money settlement by default.

### Phase 5 — external review and pilot (pending)
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
| Small commits after passing tests | Makes changes easy to inspect and recover. |

## Open questions
- Which Kalshi markets have unambiguous final outcomes suitable for payment conditions?
- What are Stork's access terms and coverage for those markets?
- Which real user would pre-fund this type of payment, and why is existing escrow insufficient?

## Errors encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| None yet | — | — |
