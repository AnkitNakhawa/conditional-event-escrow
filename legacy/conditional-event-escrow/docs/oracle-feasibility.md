# Kalshi outcome-oracle feasibility (2026-10-04)

## Decision to make

Can a contract on Base Sepolia safely read an authenticated **final YES/NO outcome** for a specific Kalshi binary market, rather than trusting a person to copy a public API response? This is an investigation, not a production integration. The existing `DemoEventEscrow` still uses a simulated reporter and must not hold real funds.

## What is verified so far

- Kalshi's public `GET /markets/{ticker}` returns exact market identity, rules, status, result, and settlement timestamp without API credentials. On 2026-10-04, `KXHIGHNY-26OCT03-B70.5` returned `finalized` and `yes`. This is a historical **offchain comparison case**, not an onchain oracle feed or a future market to pre-fund. The previous copper example now returns 404, so examples must be rechecked. [Kalshi API](https://docs.kalshi.com/api-reference/market/get-market)
- Stork [announced](https://www.stork.network/blog/kalshi-events-on-chain) support for Kalshi resolution outcomes through a pull oracle, and its [EVM address list](https://docs.stork.network/resources/contract-addresses/evm) includes Base Sepolia. Neither statement proves that the example ticker has a usable feed.
- Stork's public [asset-ID registry](https://docs.stork.network/resources/asset-id-registry) does not list an obvious Kalshi outcome ID. Its [EVM API](https://docs.stork.network/api-reference/contract-apis/evm) accepts signed numeric updates, has an update-fee mechanism, and reads by feed ID. Exact outcome IDs, value encoding, fees, and access are **not yet verified**. One-time final outcomes may need different freshness handling from continuously updated price feeds.

## Smallest proof to run

1. Pick one upcoming, unambiguous binary Kalshi market whose final result and any cancellation/void handling can be checked later. Record its exact ticker, market rules, and expected resolution window. The historical market above is only a first schema check.
2. Ask Stork for a working **final-result feed**, not a YES price feed: exact market ID ↔ feed ID mapping; encoding for unresolved/YES/NO/void; how finality and later corrections work; whether this market/category is covered; and a sample signed update. Confirm Base Sepolia availability, credentials, licensing, latency, uptime, per-update fees, and any subscription/minimum charge.
3. In a read-only script, decode one signed update and compare its market ID, outcome, and timestamp with Kalshi's public API. Do not settle an escrow from this script.
4. On Base Sepolia with testnet ETH only, submit or read a signed Stork update and prove the official Stork contract verifies it for the agreed feed ID. Capture the transaction, value, and fee. A deployed generic Stork contract alone does not satisfy this step.
5. Only after steps 2–4 work, implement a **new, separate** testnet escrow/source adapter that pins the allowed oracle contract, feed ID, market identity, valid final-state encoding, and deadline policy. Keep the simulated demo separate. Test YES, NO, void/unsupported, stale/missing/wrong-feed data, replay/correction, and timeout before a claim path is enabled.

## Go/no-go gate

Go to a testnet contract only if Stork supplies a specific usable final-outcome feed, clear semantics and rights, and a reproducible Base Sepolia proof at acceptable cost. If it supplies only probabilities/prices, or cannot confirm coverage/terms, **do not equate a price of 0 or 1 with settlement**. Continue with the read-only library, or assess another outcome source. A successful testnet proof still does not authorize mainnet or real funds; that needs security and legal review.

## Questions to send Stork

> We are building an open-source, testnet-only event escrow that would pay based on a Kalshi market's *final YES/NO result*, not its trading price. Can you provide a specific Kalshi binary market with an outcome feed on Base Sepolia, its exact feed ID and value mapping (including unresolved/void/correction), a sample signed update/API access, onchain verification instructions, availability/latency expectations, and all access, licensing, subscription, per-update, and gas-related costs? Is a public open-source SDK permitted to use and document this feed?

No message has been sent. Stork's [contact page](https://www.stork.network/contact) is the public onboarding route.
