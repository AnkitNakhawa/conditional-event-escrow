#!/usr/bin/env bash
set -euo pipefail

# LOCAL ANVIL ONLY. The reporter below simulates an outcome; no Kalshi API is used.
demo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo_port="${EVENT_ESCROW_DEMO_PORT:-18545}"
demo_rpc="http://127.0.0.1:${demo_port}"
demo_log="$(mktemp)"
demo_pid=""

cleanup() {
    if [[ -n "$demo_pid" ]]; then
        kill "$demo_pid" 2>/dev/null || true
        wait "$demo_pid" 2>/dev/null || true
    fi
    rm -f "$demo_log"
}
trap cleanup EXIT

for tool in anvil cast forge jq python3; do
    command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done

if cast chain-id --rpc-url "$demo_rpc" >/dev/null 2>&1; then
    echo "Port $demo_port already has an Ethereum RPC server; choose EVENT_ESCROW_DEMO_PORT." >&2
    exit 1
fi

anvil --chain-id 31337 --accounts 3 --balance 100 --host 127.0.0.1 --port "$demo_port" --silent >"$demo_log" 2>&1 &
demo_pid=$!

ready=false
for _ in {1..30}; do
    if cast chain-id --rpc-url "$demo_rpc" >/dev/null 2>&1; then
        ready=true
        break
    fi
    if ! kill -0 "$demo_pid" 2>/dev/null; then
        echo "Anvil exited unexpectedly:" >&2
        sed -n '1,80p' "$demo_log" >&2
        exit 1
    fi
    sleep 0.2
done
if [[ "$ready" != true ]]; then
    echo "Anvil did not become ready:" >&2
    sed -n '1,80p' "$demo_log" >&2
    exit 1
fi

accounts="$(cast rpc eth_accounts --rpc-url "$demo_rpc")"
depositor="$(jq -r '.[0]' <<<"$accounts")"
reporter="$(jq -r '.[1]' <<<"$accounts")"
beneficiary="$(jq -r '.[2]' <<<"$accounts")"
reporting_opens_at="$(date +%s)"
reporting_deadline="$(( reporting_opens_at + 604800 ))"
deposit_wei="1000000000000000000"

cd "$demo_root"
echo "LOCAL DEMO ONLY — the reporter simulates YES; this does not verify Kalshi."
echo "Depositor: $depositor"
echo "Reporter: $reporter"
echo "Beneficiary: $beneficiary"
echo "Beneficiary before: $(cast balance "$beneficiary" --rpc-url "$demo_rpc") wei"

deployment="$(forge create src/DemoEventEscrow.sol:DemoEventEscrow \
    --rpc-url "$demo_rpc" --unlocked --from "$depositor" --broadcast --json \
    --value 1ether --constructor-args "$beneficiary" "$reporter" "$reporting_opens_at" "$reporting_deadline" "KX-DEMO-MARKET")"
escrow="$(jq -r '.deployedTo // .contractAddress // empty' <<<"$deployment")"
if [[ -z "$escrow" ]]; then
    echo "Could not read deployed contract address:" >&2
    echo "$deployment" >&2
    exit 1
fi
echo "Escrow deployed: $escrow"
[[ "$(cast balance "$escrow" --rpc-url "$demo_rpc")" == "$deposit_wei" ]]
echo "Escrow funded: $deposit_wei wei"

report_receipt="$(cast send "$escrow" 'reportSimulatedOutcome(bool)' true \
    --rpc-url "$demo_rpc" --unlocked --from "$reporter" --json)"
[[ "$(jq -r '.status' <<<"$report_receipt")" == '0x1' ]]
[[ "$(cast call "$escrow" 'outcome()(uint8)' --rpc-url "$demo_rpc")" == '1' ]]
echo "Simulated YES reported: $(jq -r '.transactionHash' <<<"$report_receipt")"

beneficiary_before="$(cast balance "$beneficiary" --rpc-url "$demo_rpc")"
claim_receipt="$(cast send "$escrow" 'claim()' \
    --rpc-url "$demo_rpc" --unlocked --from "$beneficiary" --json)"
[[ "$(jq -r '.status' <<<"$claim_receipt")" == '0x1' ]]
[[ "$(cast call "$escrow" 'claimed()(bool)' --rpc-url "$demo_rpc")" == 'true' ]]
[[ "$(cast balance "$escrow" --rpc-url "$demo_rpc")" == '0' ]]
beneficiary_after="$(cast balance "$beneficiary" --rpc-url "$demo_rpc")"
python3 -c 'import sys; assert int(sys.argv[1]) > int(sys.argv[2])' \
    "$beneficiary_after" "$beneficiary_before"

echo "Claim transaction: $(jq -r '.transactionHash' <<<"$claim_receipt")"
echo "Beneficiary after: $beneficiary_after wei"
echo "Escrow after: 0 wei"
echo "PASS: funded deployment → simulated result → payout completed on local Anvil."
