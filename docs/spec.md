# MVP specification

This is a **testnet-only demonstration**. The reporter is an arbitrary trusted address that simulates a Kalshi final result. The contract does not fetch, verify, or authenticate Kalshi data.

## Actors
- **Depositor** deploys and fully funds one escrow with testnet ETH.
- **Beneficiary** receives the ETH if the reporter submits YES.
- **Reporter** submits one simulated YES or NO result before the resolution deadline.

## Contract data
- Exact Kalshi market ticker, as a string for display and later integration.
- Depositor, beneficiary, reporter, resolution deadline, and initial deposit.
- Result state: unresolved, YES, or NO; and whether funds were claimed.

## State transitions
| Initial state | Action | Next state | Who can withdraw? |
| --- | --- | --- | --- |
| Unresolved | Reporter says YES before deadline | YES | Beneficiary |
| Unresolved | Reporter says NO before deadline | NO | Depositor |
| Unresolved | Deadline passes | Unresolved/expired | Depositor |
| YES, NO, or expired | Authorized claim | Claimed | Nobody again |

If the claim recipient cannot receive ETH, the claim reverts without marking it paid, allowing a retry. Unexpected direct ETH transfers are rejected. A reporter cannot overwrite a result or report after the deadline. The deadline is for **resolution**, not the market's event closing time; it must allow for Kalshi settlement delays.

The reporter can submit either result without proving that Kalshi settled it. The ticker is not looked up or authenticated. If a beneficiary or depositor is a contract that permanently refuses ETH and cannot call through an alternate method, its payout can remain stuck. This is a demo limitation, not a production escrow design.

## Test matrix
- Constructor rejects empty deposit, zero actor addresses, empty ticker, and past deadline.
- Reporter-only result; one report maximum; no report at or after deadline.
- YES pays only beneficiary; NO returns only depositor.
- Unresolved timeout returns only depositor; no early refund.
- Claim can happen only once; failed ETH transfer does not consume the claim.
- Fuzz deposit amounts and verify conservation of escrowed ETH.

## Not yet implemented
- A real Kalshi outcome oracle or Stork adapter.
- Market-rule verification and market cancellation handling.
- ERC-20 stablecoin collateral, multiple beneficiaries, partial payouts, dispute resolution.
- Mainnet deployments or real-money use.
