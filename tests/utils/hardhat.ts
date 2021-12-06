import hardhat from 'hardhat';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export async function runWithImpersonation(target: string, run: () => Promise<void>): Promise<void> {
  await hardhat.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [target],
  });

  await run();

  await hardhat.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [target],
  });
}

export async function snapshot() {
  return await hardhat.network.provider.request({
    method: 'evm_snapshot',
  });
}

export async function revertToSnapshot(snapshotId: any) {
  return await hardhat.network.provider.request({
    method: 'evm_revert',
    params: [snapshotId],
  });
}

export async function getCurrentBlockTime() {
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
};

export async function mineNewBlockAt(timestamp: number) {
  await hardhat.network.provider.request({
    method: 'evm_mine',
    params: [timestamp],
  });
}

export async function increaseTime(timestamp: number) {
  await hardhat.network.provider.request({
    method: 'evm_increaseTime',
    params: [timestamp],
  });
}