# MVP specification

This is a **testnet-only demonstration**. The reporter is an arbitrary trusted address that simulates a Kalshi final result. The contract does not fetch, verify, or authenticate Kalshi data.

## Actors
- **Depositor** deploys and fully funds one escrow with testnet ETH.
- **Beneficiary** receives the ETH if the reporter submits YES.
- **Reporter** submits one simulated YES or NO result at or after the reporting opening time and before the reporting deadline.

## Contract data
- Exact Kalshi market ticker, as a string for display and later integration.
- Depositor, beneficiary, reporter, reporting opening time, reporting deadline, and initial deposit.
- Result state: unresolved, YES, or NO; and whether funds were claimed.

## State transitions
| Initial state | Action | Next state | Who can withdraw? |
| --- | --- | --- | --- |
| Unresolved | Reporter says YES in reporting window | YES | Beneficiary |
| Unresolved | Reporter says NO in reporting window | NO | Depositor |
| Unresolved | Deadline passes | Unresolved/expired | Depositor |
| YES, NO, or expired | Authorized claim | Claimed | Nobody again |

If the claim recipient cannot receive ETH, the claim reverts without marking it paid, allowing a retry. Unexpected direct ETH transfers are rejected. A reporter cannot overwrite a result or report before the opening time or at/after the deadline. The opening time is a scheduling policy, not proof of Kalshi finality; the deadline must allow for settlement delays. A timely reported result remains claimable after the deadline.

The reporter can submit either result without proving that Kalshi settled it. The ticker is not looked up or authenticated. If a beneficiary or depositor is a contract that permanently refuses ETH and cannot call through an alternate method, its payout can remain stuck. This is a demo limitation, not a production escrow design.

## Test matrix
- Constructor rejects empty deposit, zero actor addresses, empty ticker, past deadline, and an opening time at/after the deadline.
- Reporter-only result; one report maximum; no report before opening or at/after deadline.
- YES pays only beneficiary; NO returns only depositor.
- Unresolved timeout returns only depositor; no early refund.
- Claim can happen only once; failed ETH transfer does not consume the claim.
- Fuzz deposit amounts and verify conservation of escrowed ETH.

## Not yet implemented
- A real Kalshi outcome oracle or Stork adapter.
- Market-rule verification and market cancellation handling.
- ERC-20 stablecoin collateral, multiple beneficiaries, partial payouts, dispute resolution.
- Mainnet deployments or real-money use.
