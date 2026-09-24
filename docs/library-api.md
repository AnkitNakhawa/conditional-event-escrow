# Library API

The repository is becoming a reusable **contract + TypeScript SDK**, not a browser application. The first SDK slice below is implemented; market metadata and verified outcome delivery remain planned.

## Initial package

`packages/sdk` exposes typed operations for the current testnet-only escrow:

| Operation | Purpose |
| --- | --- |
| `createEscrow` | Validate the inputs, deploy and fully fund one `DemoEventEscrow`, and return its address and transaction receipt. |
| `getEscrow` | Read the market ticker, parties, deadline, deposit, outcome, and claimed state. |
| `getClaimability` | Explain who can claim now, using contract state and chain time. This is a convenience view, not a substitute for an onchain check. |
| `claimEscrow` | Submit a claim and wait for its receipt. |
| `@conditional-event-escrow/sdk/development` `reportSimulatedOutcome` | Submit a **simulated** result on supported test chains only. |

The initial library should validate addresses, nonzero deposits, nonempty market identifiers, supported chain IDs, and future deadlines before broadcasting. It should surface transaction hashes and onchain errors rather than masking them. It must never label a user-entered result as verified by Kalshi.

The next library slice can read Kalshi's public market metadata to confirm the ticker, show the exact rules, and record what question the developer intended. This is **read-only metadata**, not a trusted onchain result.

## Exclusions

- No browser UI in the first library milestone.
- No mainnet support or npm publication until the API and trust boundaries are reviewed.
- No real Kalshi settlement claim. A later outcome-source adapter will have its own explicit provenance and finality requirements.
- No tradable outcome tokens; the current product is a conditional payment, not a new prediction market.

## Acceptance criteria

A developer can install/build the package locally and, with a local Anvil client, create a funded escrow, read it, submit a clearly simulated result, and claim the payout through the SDK. Unit tests cover validation and state interpretation; one integration test covers the transaction path. Solidity tests remain the source of truth for contract edge cases.
