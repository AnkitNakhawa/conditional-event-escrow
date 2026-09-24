import { isAddress, type Address, type TransactionReceipt } from 'viem';
import { assertDemoChain, demoEscrowAbi, type DemoPublicClient, type DemoWalletClient } from './index.js';

/** Simulated outcome only. This does NOT verify a Kalshi result. */
export async function reportSimulatedOutcome(
  publicClient: DemoPublicClient,
  walletClient: DemoWalletClient,
  address: Address,
  yes: boolean,
): Promise<TransactionReceipt> {
  const [publicChainId, walletChainId] = await Promise.all([
    publicClient.getChainId(),
    walletClient.getChainId(),
  ]);
  assertDemoChain(publicChainId);
  if (walletChainId !== publicChainId) throw new Error('Public and wallet clients use different chains');
  if (!isAddress(address)) throw new Error('Invalid escrow address');
  const hash = await walletClient.writeContract({
    address,
    abi: demoEscrowAbi,
    functionName: 'reportSimulatedOutcome',
    args: [yes],
    account: walletClient.account,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${receipt.transactionHash}`);
  return receipt;
}
