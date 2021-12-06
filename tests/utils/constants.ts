import {ethers} from 'hardhat';

export const BN = ethers.BigNumber;
export const ZERO_ADDRESS = ethers.constants.AddressZero;
export const PRECISION = ethers.constants.WeiPerEther;
export const NEGATIVE_ONE = BN.from(-1);
export const ZERO = ethers.constants.Zero;
export const ONE = ethers.constants.One;
export const TWO = ethers.constants.Two;
export const BPS = BN.from(10000);
