# Prediction-market combo price auditor

This repository is pivoting to a **read-only, open-source library** for explaining the price of prediction-market combos/parlays. The first milestone is a small, transparent mathematical audit: compare a quoted binary combo with its legs' probability estimates, independence benchmark, and valid joint-probability bounds. It does not trade, create RFQs, or promise profitable opportunities.

The previous testnet-only escrow prototype is preserved under [`legacy/conditional-event-escrow/`](legacy/conditional-event-escrow/README.md). It is not the active product and must not be used with real funds. The GitHub repository URL retains its old name for continuity.

See [`PIVOT_PLAN.md`](PIVOT_PLAN.md) for scope, staged validation, and risks. Implementation is beginning in small, tested commits.
