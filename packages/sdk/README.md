# Conditional Event Escrow SDK (testnet-only)

This is an unpublished, experimental TypeScript package around `DemoEventEscrow`. It supports local Anvil (chain ID 31337) and Base Sepolia (84532) only. Results entered through the development API are **simulated**, not verified against Kalshi. Do not use real funds.

From the repository root, run `forge build`, then `npm ci --prefix packages/sdk` and `npm test --prefix packages/sdk`. The package tests include input/state checks, a bytecode-sync check, and one end-to-end Anvil transaction path.

The main package exports `createEscrow`, `getEscrow`, `getClaimability`, and `claimEscrow`. The separate `@conditional-event-escrow/sdk/development` export contains `reportSimulatedOutcome`. Callers provide their own [Viem](https://viem.sh/) public and wallet clients; the library never holds private keys.

`createEscrow` requires a nonzero ETH deposit, a beneficiary, a reporter, a future resolution deadline, and a market ticker. It returns the deployed address and transaction receipt. `getEscrow` returns a one-block snapshot; `getClaimability` interprets that snapshot at a supplied chain timestamp. `claimEscrow` broadcasts a claim and waits for success.

The separate `@conditional-event-escrow/sdk/kalshi` export provides `getKalshiMarket(ticker)`. It reads one public Kalshi binary market and returns its exact ticker, title, rules, status, and raw API result. It requires no Kalshi key. A caller may inject `fetcher` for tests or pass an abort `signal`; requests time out after ten seconds.

```ts
import { getKalshiMarket } from '@conditional-event-escrow/sdk/kalshi';

const market = await getKalshiMarket('KXCOPPERW-26JUL2417-T6.29');
console.log(market.title, market.rulesPrimary, market.status);
```

This lookup does **not** bind the ticker to the contract, verify that Kalshi's data is authentic onchain, or authorize a payout. `reportedResult` is descriptive offchain API data only. See [the library roadmap](../../docs/library-api.md) for the remaining outcome-source work.
