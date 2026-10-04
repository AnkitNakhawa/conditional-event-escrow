# Combo price auditor — progress

## 2026-10-04
- Committed and pushed the pivot plan as `9a7ffe7` before moving code.
- Moved the tracked escrow project toward `legacy/conditional-event-escrow/`; replacing root docs and CI next. No tracked escrow source has been deleted.
- Preserved all tracked escrow files under `legacy/conditional-event-escrow/` and moved its former CI out of the active GitHub workflow directory. Replaced root README and planning files for the new project. `forge test -q` passed from the archived project.
