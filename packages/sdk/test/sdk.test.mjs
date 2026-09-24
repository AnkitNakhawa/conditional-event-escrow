import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { foundry } from 'viem/chains';
import {
  assertDemoChain,
  claimEscrow,
  createEscrow,
  getClaimability,
  getEscrow,
  validateCreateEscrow,
} from '../dist/index.js';
import { reportSimulatedOutcome } from '../dist/development.js';
import { demoEscrowBytecode } from '../dist/bytecode.generated.js';

const beneficiary = '0x000000000000000000000000000000000000bEEF';
const reporter = '0x000000000000000000000000000000000000cafE';
const validInput = {
  beneficiary,
  reporter,
  resolutionDeadline: 1_000_000n,
  marketTicker: 'KX-DEMO-MARKET',
  amountWei: 1n,
};

test('validates demo chain and creation parameters', () => {
  assert.doesNotThrow(() => assertDemoChain(31337));
  assert.doesNotThrow(() => assertDemoChain(84532));
  assert.throws(() => assertDemoChain(1), /only supports/);
  assert.doesNotThrow(() => validateCreateEscrow(validInput, 999_999n));
  assert.throws(() => validateCreateEscrow({ ...validInput, amountWei: 0n }, 0n), /positive/);
  assert.throws(() => validateCreateEscrow({ ...validInput, marketTicker: ' ' }, 0n), /empty/);
  assert.throws(() => validateCreateEscrow({ ...validInput, resolutionDeadline: 0n }, 0n), /future/);
  assert.throws(() => validateCreateEscrow({ ...validInput, beneficiary: 'invalid' }, 0n), /beneficiary/);
});

test('interprets pending, resolved, expired, and claimed states', () => {
  const state = {
    address: beneficiary,
    depositor: reporter,
    beneficiary,
    reporter,
    resolutionDeadline: 100n,
    depositWei: 1n,
    marketTicker: 'KX-DEMO-MARKET',
    outcome: 'unresolved',
    claimed: false,
  };
  assert.deepEqual(getClaimability(state, 99n), { claimant: null, reason: 'pending' });
  assert.deepEqual(getClaimability({ ...state, outcome: 'yes' }, 99n), { claimant: beneficiary, reason: 'beneficiary' });
  assert.deepEqual(getClaimability({ ...state, outcome: 'no' }, 99n), { claimant: reporter, reason: 'depositor' });
  assert.deepEqual(getClaimability(state, 100n), { claimant: reporter, reason: 'depositor' });
  assert.deepEqual(getClaimability({ ...state, claimed: true }, 100n), { claimant: null, reason: 'claimed' });
});

test('SDK creation bytecode matches the contract build', async () => {
  const artifactUrl = new URL('../../../out/DemoEventEscrow.sol/DemoEventEscrow.json', import.meta.url);
  const artifact = JSON.parse(await readFile(artifactUrl, 'utf8'));
  assert.equal(demoEscrowBytecode, artifact.bytecode.object);
});

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const closed = once(server, 'close');
  server.close();
  await closed;
  return port;
}

test('deploys, reads, reports, and claims via actual Anvil transactions', async () => {
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn('anvil', [
    '--chain-id', '31337', '--accounts', '3', '--balance', '100',
    '--host', '127.0.0.1', '--port', String(port), '--silent',
  ], { stdio: 'ignore' });
  try {
    const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        if (await publicClient.getChainId() === 31337) {
          ready = true;
          break;
        }
      } catch { /* Anvil is still starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Anvil did not start');
    const accounts = await publicClient.request({ method: 'eth_accounts' });
    assert.equal(accounts.length, 3);
    const [depositorAddress, reporterAddress, beneficiaryAddress] = accounts;
    const wallet = address => createWalletClient({
      chain: foundry,
      account: address,
      transport: http(rpcUrl),
    });
    const block = await publicClient.getBlock();
    const { address } = await createEscrow(publicClient, wallet(depositorAddress), {
      beneficiary: beneficiaryAddress,
      reporter: reporterAddress,
      resolutionDeadline: block.timestamp + 7n * 24n * 60n * 60n,
      marketTicker: 'KX-DEMO-MARKET',
      amountWei: parseEther('1'),
    });
    const pending = await getEscrow(publicClient, address);
    assert.equal(pending.depositWei, parseEther('1'));
    assert.equal(pending.outcome, 'unresolved');
    assert.equal((await publicClient.getBalance({ address })), parseEther('1'));

    await reportSimulatedOutcome(publicClient, wallet(reporterAddress), address, true);
    const reported = await getEscrow(publicClient, address);
    assert.equal(reported.outcome, 'yes');
    assert.equal(getClaimability(reported, block.timestamp).claimant.toLowerCase(), beneficiaryAddress.toLowerCase());

    await claimEscrow(publicClient, wallet(beneficiaryAddress), address);
    const claimed = await getEscrow(publicClient, address);
    assert.equal(claimed.claimed, true);
    assert.equal((await publicClient.getBalance({ address })), 0n);
  } finally {
    anvil.kill('SIGTERM');
  }
});
