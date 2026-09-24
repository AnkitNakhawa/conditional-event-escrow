# Conditional Event Escrow

An experimental, testnet-only escrow for payments conditional on an event-market result. The first version uses a **simulated outcome reporter**. It does **not** verify Kalshi settlements and must not be used with real funds.

See [task_plan.md](task_plan.md) for the roadmap and safety boundaries.

## Current contract

`DemoEventEscrow` locks one testnet ETH deposit against a named market ticker. A trusted reporter may submit a **simulated** YES or NO result before a deadline. YES lets the beneficiary claim; NO or an unresolved timeout lets the depositor reclaim. The contract can deploy only on local chain ID 31337 or Base Sepolia chain ID 84532. A reporter can lie, so the contract is **not suitable for real money**. A recipient contract that refuses ETH can also prevent its own claim.

Run `forge test` to exercise the unit and fuzz tests. See [docs/spec.md](docs/spec.md) for the state model and exclusions.
For a one-command local transaction demo and guided test traces, see [docs/demo.md](docs/demo.md).

This project is independent of Kalshi and Stork; it is not endorsed by either.
