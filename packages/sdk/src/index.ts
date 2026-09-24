import {
  isAddress,
  parseAbi,
  zeroAddress,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type TransactionReceipt,
  type Transport,
  type WalletClient,
} from 'viem';
import { demoEscrowBytecode } from './bytecode.generated.js';

export const demoEscrowAbi = parseAbi([
  'constructor(address beneficiary_, address reporter_, uint64 resolutionDeadline_, string marketTicker_) payable',
  'function depositor() view returns (address)',
  'function beneficiary() view returns (address)',
  'function reporter() view returns (address)',
  'function resolutionDeadline() view returns (uint64)',
  'function deposit() view returns (uint256)',
  'function marketTicker() view returns (string)',
  'function outcome() view returns (uint8)',
  'function claimed() view returns (bool)',
  'function claim()',
  'function reportSimulatedOutcome(bool yes)',
]);

export type DemoWalletClient = WalletClient<Transport, Chain, Account>;
export type DemoPublicClient = PublicClient<Transport, Chain>;
export type Outcome = 'unresolved' | 'yes' | 'no';

export interface CreateEscrowInput {
  beneficiary: Address;
  reporter: Address;
  resolutionDeadline: bigint;
  marketTicker: string;
  amountWei: bigint;
}

export interface EscrowState {
  address: Address;
  depositor: Address;
  beneficiary: Address;
  reporter: Address;
  resolutionDeadline: bigint;
  depositWei: bigint;
  marketTicker: string;
  outcome: Outcome;
  claimed: boolean;
}

const maxUint64 = (1n << 64n) - 1n;

export function assertDemoChain(chainId: number): void {
  if (chainId !== 31337 && chainId !== 84532) {
    throw new Error('Demo escrow only supports local Anvil (31337) or Base Sepolia (84532)');
  }
}

export function validateCreateEscrow(input: CreateEscrowInput, nowSeconds: bigint): void {
  if (!isAddress(input.beneficiary) || input.beneficiary.toLowerCase() === zeroAddress) {
    throw new Error('Invalid beneficiary address');
  }
  if (!isAddress(input.reporter) || input.reporter.toLowerCase() === zeroAddress) {
    throw new Error('Invalid reporter address');
  }
  if (input.amountWei <= 0n) throw new Error('Deposit must be positive');
  if (input.resolutionDeadline <= nowSeconds || input.resolutionDeadline > maxUint64) {
    throw new Error('Resolution deadline must be a future uint64 timestamp');
  }
  if (!input.marketTicker.trim()) throw new Error('Market ticker must not be empty');
}

async function checkClients(publicClient: DemoPublicClient, walletClient: DemoWalletClient): Promise<void> {
  const [publicChainId, walletChainId] = await Promise.all([
    publicClient.getChainId(),
    walletClient.getChainId(),
  ]);
  assertDemoChain(publicChainId);
  if (walletChainId !== publicChainId) throw new Error('Public and wallet clients use different chains');
}

function requireSuccess(receipt: TransactionReceipt): void {
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${receipt.transactionHash}`);
}

export async function createEscrow(
  publicClient: DemoPublicClient,
  walletClient: DemoWalletClient,
  input: CreateEscrowInput,
): Promise<{ address: Address; receipt: TransactionReceipt }> {
  await checkClients(publicClient, walletClient);
  const block = await publicClient.getBlock();
  validateCreateEscrow(input, block.timestamp);
  const hash = await walletClient.deployContract({
    abi: demoEscrowAbi,
    bytecode: demoEscrowBytecode,
    args: [input.beneficiary, input.reporter, input.resolutionDeadline, input.marketTicker],
    value: input.amountWei,
    account: walletClient.account,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  requireSuccess(receipt);
  if (!receipt.contractAddress) throw new Error('Deployment receipt has no contract address');
  return { address: receipt.contractAddress, receipt };
}

export async function getEscrow(publicClient: DemoPublicClient, address: Address): Promise<EscrowState> {
  assertDemoChain(await publicClient.getChainId());
  if (!isAddress(address)) throw new Error('Invalid escrow address');
  // Pin all reads to one block so a report/claim cannot split this snapshot across blocks.
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
  const read = <T extends keyof typeof getters>(name: T) =>
    publicClient.readContract({ address, abi: demoEscrowAbi, functionName: name, blockNumber });
  const [depositor, beneficiary, reporter, resolutionDeadline, depositWei, marketTicker, rawOutcome, claimed] =
    await Promise.all([
      read('depositor'),
      read('beneficiary'),
      read('reporter'),
      read('resolutionDeadline'),
      read('deposit'),
      read('marketTicker'),
      read('outcome'),
      read('claimed'),
    ]);
  if (rawOutcome !== 0 && rawOutcome !== 1 && rawOutcome !== 2) {
    throw new Error(`Unknown escrow outcome: ${rawOutcome}`);
  }
  const outcome = rawOutcome === 1 ? 'yes' : rawOutcome === 2 ? 'no' : 'unresolved';
  return {
    address,
    depositor: depositor as Address,
    beneficiary: beneficiary as Address,
    reporter: reporter as Address,
    resolutionDeadline: resolutionDeadline as bigint,
    depositWei: depositWei as bigint,
    marketTicker: marketTicker as string,
    outcome,
    claimed: claimed as boolean,
  };
}

const getters = {
  depositor: true,
  beneficiary: true,
  reporter: true,
  resolutionDeadline: true,
  deposit: true,
  marketTicker: true,
  outcome: true,
  claimed: true,
} as const;

export function getClaimability(state: EscrowState, nowSeconds: bigint): {
  claimant: Address | null;
  reason: 'claimed' | 'beneficiary' | 'depositor' | 'pending';
} {
  if (state.claimed) return { claimant: null, reason: 'claimed' };
  if (state.outcome === 'yes') return { claimant: state.beneficiary, reason: 'beneficiary' };
  if (state.outcome === 'no' || nowSeconds >= state.resolutionDeadline) {
    return { claimant: state.depositor, reason: 'depositor' };
  }
  return { claimant: null, reason: 'pending' };
}

export async function claimEscrow(
  publicClient: DemoPublicClient,
  walletClient: DemoWalletClient,
  address: Address,
): Promise<TransactionReceipt> {
  await checkClients(publicClient, walletClient);
  if (!isAddress(address)) throw new Error('Invalid escrow address');
  const hash = await walletClient.writeContract({
    address,
    abi: demoEscrowAbi,
    functionName: 'claim',
    account: walletClient.account,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  requireSuccess(receipt);
  return receipt;
}
