# Library API

The repository is becoming a reusable **contract + TypeScript SDK**, not a browser application. The escrow operations and a first read-only market lookup are implemented; verified outcome delivery remains planned.

## Initial package

`packages/sdk` exposes typed operations for the current testnet-only escrow:

| Operation | Purpose |
| --- | --- |
| `createEscrow` | Validate the inputs, deploy and fully fund one `DemoEventEscrow`, and return its address and transaction receipt. |
| `getEscrow` | Read the market ticker, parties, reporting window, deposit, outcome, and claimed state. |
| `getClaimability` | Explain who can claim now, using contract state and chain time. This is a convenience view, not a substitute for an onchain check. |
| `claimEscrow` | Submit a claim and wait for its receipt. |
| `@conditional-event-escrow/sdk/development` `reportSimulatedOutcome` | Submit a **simulated** result on supported test chains only. |
| `@conditional-event-escrow/sdk/kalshi` `getKalshiMarket` | Fetch one binary market's identity, rules, status, and raw API result without changing contract state. |
| `@conditional-event-escrow/sdk/kalshi` `getKalshiSettlementCandidate` | Identify a finalized YES/NO result as an unverified, offchain candidate; explain why other responses cannot be used. |
| `@conditional-event-escrow/sdk/settlement` `checkEscrowSettlement` | Compare one escrow with its exact Kalshi market and current reporting window; return a read-only candidate or a specific stop reason. |

The initial library should validate addresses, nonzero deposits, nonempty market identifiers, supported chain IDs, and a reporting opening time earlier than a future deadline before broadcasting. It should surface transaction hashes and onchain errors rather than masking them. It must never label a user-entered result as verified by Kalshi.

The market lookup confirms the API returned the exact requested ticker and exposes the rules for review. It does not bind the fetched rules to a deployed contract, and its result field is **read-only offchain data**, not a trusted onchain result.
The candidate assessment checks only the public API response. It cannot authenticate Kalshi to a smart contract, evaluate disputes or unusual payout rules, or submit a result.
The escrow settlement check reads the escrow to discover its ticker, performs that public API lookup, then refreshes escrow state and chain time at one block. It is a point-in-time advisory result: a later report, claim, deadline, or chain reorganization can invalidate it. API/HTTP failures reject rather than being treated as a valid outcome. It never sends a transaction and does not make the API result trustworthy onchain.

## Exclusions

- No browser UI in the first library milestone.
- No mainnet support or npm publication until the API and trust boundaries are reviewed.
- No real Kalshi settlement claim. A later outcome-source adapter will have its own explicit provenance and finality requirements.
- No tradable outcome tokens; the current product is a conditional payment, not a new prediction market.

## Acceptance criteria

A developer can install/build the package locally and, with a local Anvil client, create a funded escrow, read it, submit a clearly simulated result, and claim the payout through the SDK. Unit tests cover validation and state interpretation; one integration test covers the transaction path. Solidity tests remain the source of truth for contract edge cases.
