import {ethers, waffle} from 'hardhat';
import {expect} from 'chai';
import {PRECISION} from './utils/constants';
import {snapshot, revertToSnapshot, getCurrentBlockTime, mineNewBlockAt} from './utils/hardhat';
import chai from 'chai';
const GenarateMerkleTree = require('./utils/MerkleTool').GenarateMerkleTree;
const whitelistData = GenarateMerkleTree();
const GenarateMerkleTree2 = require('./utils/MerkleTool').GenarateMerkleTree2;
const whitelistData2 = GenarateMerkleTree2();
const {solidity} = waffle;
chai.use(solidity);

import {
  MockSipherNFTSimple,
  MockSipherNFTSimple__factory,
  SipherNFTSale,
  SipherNFTSale__factory,
  MockContractBuyer__factory,
} from '../typechain';

const STEP_AUCTION = 600;
let SipherSale: SipherNFTSale__factory;
let sipherSale: SipherNFTSale;
let mockNft: MockSipherNFTSimple;

let currentTime: number;
let salePrice = PRECISION.div(10);
let ownerInitCap = 500;
let capPerNormal = 5;
let capPerWhitelist = 1;
let zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
let nonZeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000001';

let snapshotId: any;

describe('SipherNFTSale', () => {
  const [user, user2, user3, admin, user4] = waffle.provider.getWallets();
  const user2Whitelisted: {proof: string[]; privateCap: number; freeMintCap: number} = {
    proof: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user2.address)[0].proof,
    privateCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user2.address)[0].privateCap,
    freeMintCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user2.address)[0].freeMintCap,
  };
  const user4Whitelisted: {proof: string[]; privateCap: number; freeMintCap: number} = {
    proof: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user4.address)[0].proof,
    privateCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user4.address)[0].privateCap,
    freeMintCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user4.address)[0].freeMintCap,
  };
  const user3Whitelisted: {proof: string[]; privateCap: number; freeMintCap: number} = {
    proof: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user3.address)[0].proof,
    privateCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user3.address)[0].privateCap,
    freeMintCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user3.address)[0].freeMintCap,
  };
  const userWhitelisted_fail: {proof: string[]; privateCap: number; freeMintCap: number} = {
    proof: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user.address)[0].proof,
    privateCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user.address)[0].privateCap,
    freeMintCap: whitelistData.whitelist.filter((el: any) => el.WalletAddress === user.address)[0].freeMintCap,
  };
  const userWhitelisted: {proof: string[]; privateCap: number; freeMintCap: number} = {
    proof: whitelistData2.whitelist.filter((el: any) => el.WalletAddress === user.address)[0].proof,
    privateCap: whitelistData2.whitelist.filter((el: any) => el.WalletAddress === user.address)[0].privateCap,
    freeMintCap: whitelistData2.whitelist.filter((el: any) => el.WalletAddress === user.address)[0].freeMintCap,
  };

  before('deploy mock nft, sale contract', async () => {
    const SipherNft = (await ethers.getContractFactory('MockSipherNFTSimple')) as MockSipherNFTSimple__factory;
    mockNft = await SipherNft.deploy();

    SipherSale = (await ethers.getContractFactory('SipherNFTSale')) as SipherNFTSale__factory;

    snapshotId = await snapshot();
  });

  const setupSipherSale = async (
    publicTime: number,
    publicEndTime: number,
    privateTime: number,
    freeMintTime: number,
    endTime: number,
    maxSupply: number
  ) => {
    sipherSale = await SipherSale.connect(admin).deploy(
      mockNft.address,
      publicTime,
      publicEndTime,
      privateTime,
      freeMintTime,
      endTime,
      maxSupply
    );
  };

  const verifySaleConfig = async (
    publicTime: number,
    publicEndTime: number,
    privateTime: number,
    freeMintTime: number,
    endTime: number,
    maxSupply: number
  ) => {
    let config = await sipherSale.getSaleConfig();
    expect(config.publicTime).to.be.eq(publicTime);
    expect(config.publicEndTime).to.be.eq(publicEndTime);
    expect(config.privateTime).to.be.eq(privateTime);
    expect(config.freeMintTime).to.be.eq(freeMintTime);
    expect(config.endTime).to.be.eq(endTime);
    expect(config.maxSupply).to.be.eq(maxSupply);
  };

  const verifySaleRecord = async (
    totalSold: number,
    ownerBought: number,
    totalPublicSold: number,
    totalWhitelistSold: number,
    totalFreeMintSold: number
  ) => {
    let saleRecord = await sipherSale.getSaleRecord();
    expect(saleRecord.totalSold).to.be.eq(totalSold);
    expect(saleRecord.ownerBought).to.be.eq(ownerBought);
    expect(saleRecord.totalPublicSold).to.be.eq(totalPublicSold);
    expect(saleRecord.totalWhitelistSold).to.be.eq(totalWhitelistSold);
    expect(saleRecord.totalFreeMintSold).to.be.eq(totalFreeMintSold);
  };

  const verifyUserRecord = async (
    user: string,
    publicBought: number,
    whitelistBought: number,
    freeMintBought: number
  ) => {
    let userRecord = await sipherSale.getUserRecord(user);
    expect(userRecord.publicBought).to.be.eq(publicBought);
    expect(userRecord.whitelistBought).to.be.eq(whitelistBought);
    expect(userRecord.freeMintBought).to.be.eq(freeMintBought);
  };

  describe('#constructor', async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('test correct data init', async () => {
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      expect(await sipherSale.nft()).to.be.eq(mockNft.address);
      expect(await sipherSale.merkleRoot()).to.be.eq(zeroBytes32);
      await verifySaleConfig(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      await verifySaleRecord(0, 0, 0, 0, 0);
    });
  });

  describe(`#withdraw`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      await sipherSale.connect(admin).setMerkleRoot(nonZeroBytes32);
      await sipherSale.connect(admin).buy(1, 0, 0, [], {value: 10000});
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherSale.connect(user).withdrawSaleFunds(admin.address, 10000)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('correct amount withdrawn', async () => {
      await expect(() => sipherSale.connect(admin).withdrawSaleFunds(user.address, 100)).to.changeEtherBalances(
        [user, sipherSale],
        [100, -100]
      );
    });

    it('test event', async () => {
      await expect(sipherSale.connect(admin).withdrawSaleFunds(user.address, 10))
        .to.emit(sipherSale, 'WithdrawSaleFunds')
        .withArgs(user.address, 10);
    });
  });

  describe(`#buy`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      await sipherSale.connect(admin).setMerkleRoot(nonZeroBytes32);

      snapshotId = await snapshot();
    });

    it('revert max cap', async () => {
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      await sipherSale.connect(admin).setMerkleRoot(nonZeroBytes32);
      await expect(sipherSale.buy(10000 + 1, 0, 0, [])).to.be.revertedWith('SipherNFTSale: max supply reached');
    });

    it('revert only owner or EOA', async () => {
      const ContractBuyer = (await ethers.getContractFactory('MockContractBuyer')) as MockContractBuyer__factory;
      let buyer = await ContractBuyer.deploy();
      await mineNewBlockAt(currentTime + 10210);
      await expect(buyer.connect(user).buy(sipherSale.address, 1, 0, 0, [], {value: salePrice})).to.be.revertedWith(
        'SipherNFTSale: only EOA or owner'
      );

      await sipherSale.connect(admin).transferOwnership(buyer.address);
      await buyer.connect(user).buy(sipherSale.address, 1, 0, 0, []);
      await verifySaleRecord(1, 1, 0, 0, 0);
    });

    it('revert owner buy more than the owner init cap', async () => {
      await sipherSale.connect(admin).buy(100, 0, 0, []); // buy 100
      await expect(sipherSale.connect(admin).buy(ownerInitCap - 100 + 1, 0, 0, [])).to.be.revertedWith(
        'SipherNFTSale: max owner initial reached'
      );
    });

    it('revert owner buy more than the owner init cap', async () => {
      await sipherSale.connect(admin).buy(1, 0, 0, []); // buy 1
      await verifySaleRecord(1, 1, 0, 0, 0);
      await expect(sipherSale.connect(admin).buy(ownerInitCap, 0, 0, [])).to.be.revertedWith(
        'SipherNFTSale: max owner initial reached'
      );
      await sipherSale.connect(admin).buy(ownerInitCap - 1, 0, 0, []);
      await verifySaleRecord(ownerInitCap, ownerInitCap, 0, 0, 0);
    });

    it('revert only owner can buy after ended', async () => {
      await mineNewBlockAt(currentTime + 15000);
      await sipherSale.connect(admin).buy(1, 0, 0, []);
      await expect(sipherSale.connect(user).buy(1, 0, 0, [])).to.be.revertedWith('SipherNFTSale: already ended');
    });

    it('revert can not buy when not set merkle root, even owner', async () => {
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      await expect(sipherSale.connect(admin).buy(1, 0, 0, [])).to.be.revertedWith(
        'SipherNFTSale: merkle root is not set yet'
      );
      await expect(sipherSale.connect(user).buy(1, 0, 0, [])).to.be.revertedWith(
        'SipherNFTSale: merkle root is not set yet'
      );
    });

    it('revert can not buy when not start yet, except owner', async () => {
      // public user can not buy
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [])).to.be.revertedWith(
        'SipherNFTSale: Public Sale not started'
      );
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      // whitelisted can not buy
      await expect(
        sipherSale
          .connect(user2)
          .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof)
      ).to.be.revertedWith('SipherNFTSale: Public Sale not started');
      await mineNewBlockAt(currentTime + 10210);
      await expect(
        sipherSale
          .connect(user2)
          .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof)
      ).to.be.revertedWith('SipherNFTSale: Private Sale not started');
      await mineNewBlockAt(currentTime + 15000);
      await expect(
        sipherSale
          .connect(user2)
          .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof)
      ).to.be.revertedWith('SipherNFTSale: already ended');
    });

    it('revert public buyer: invalid paid value or cap reached', async () => {
      await mineNewBlockAt(currentTime + 10); // should be in public buy time now
      // invalid msg.value
      await expect(sipherSale.connect(user).buy(1, 0, 0, [])).to.be.revertedWith('SipherNFTSale: invalid paid value');
      // cap reached
      await expect(
        sipherSale.connect(user).buy(capPerNormal + 1, 0, 0, [], {value: salePrice.mul(capPerNormal + 1).mul(9)})
      ).to.be.revertedWith('SipherNFTSale: normal cap reached');
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(9)});
      await expect(
        sipherSale.connect(user).buy(capPerNormal, 0, 0, [], {value: salePrice.mul(capPerNormal).mul(9)})
      ).to.be.revertedWith('SipherNFTSale: normal cap reached');
    });

    it('revert private buyer: cap reached for private buy', async () => {
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      // delay to whitelist buy time
      await mineNewBlockAt(currentTime + 11000);
      await sipherSale
        .connect(user2)
        .buy(
          user2Whitelisted.privateCap - 1,
          user2Whitelisted.privateCap,
          user2Whitelisted.freeMintCap,
          user2Whitelisted.proof,
          {
            value: salePrice.mul(user2Whitelisted.privateCap - 1),
          }
        );
      await verifyUserRecord(user2.address, 0, user2Whitelisted.privateCap - 1, 0);

      await expect(sipherSale.connect(user2).buy(2, 0, 0, [], {value: salePrice.mul(2)})).to.be.revertedWith(
        'SipherNFTSale: whitelisted private sale cap reached'
      );
      await sipherSale
        .connect(user2)
        .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof, {value: salePrice});
      await verifyUserRecord(user2.address, 0, user2Whitelisted.privateCap, 0);
    });

    it('revert private buyer: invalid paid value or cap reached', async () => {
      await mineNewBlockAt(currentTime + 11000); // should be in whitelist buy time now
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      // invalid msg.value
      await expect(
        sipherSale
          .connect(user2)
          .buy(5, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof)
      ).to.be.revertedWith('SipherNFTSale: invalid paid value');
      // cap reached
      await expect(
        sipherSale
          .connect(user2)
          .buy(
            user2Whitelisted.privateCap + 1,
            user2Whitelisted.privateCap,
            user2Whitelisted.freeMintCap,
            user2Whitelisted.proof,
            {
              value: salePrice.mul(user2Whitelisted.privateCap + 1),
            }
          )
      ).to.be.revertedWith('SipherNFTSale: whitelisted private sale cap reached');
    });

    it('revert free mint buyer: cap reached for free mint', async () => {
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      // delay to whitelist buy time
      await mineNewBlockAt(currentTime + 12000);
      await sipherSale
        .connect(user3)
        .buy(
          user3Whitelisted.freeMintCap - 1,
          user3Whitelisted.privateCap,
          user3Whitelisted.freeMintCap,
          user3Whitelisted.proof
        );
      await verifyUserRecord(user3.address, 0, 0, user3Whitelisted.freeMintCap - 1);

      await expect(
        sipherSale
          .connect(user3)
          .buy(2, user3Whitelisted.privateCap, user3Whitelisted.freeMintCap, user3Whitelisted.proof)
      ).to.be.revertedWith('SipherNFTSale: free mint cap reached');
      await sipherSale
        .connect(user3)
        .buy(1, user3Whitelisted.privateCap, user3Whitelisted.freeMintCap, user3Whitelisted.proof);
      await verifyUserRecord(user2.address, 0, 0, user3Whitelisted.privateCap);
    });

    it('revert free mint buyer: invalid paid value', async () => {
      await mineNewBlockAt(currentTime + 12000); // should be in whitelist buy time now
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      // invalid msg.value
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof,
            {
              value: salePrice.mul(user3Whitelisted.freeMintCap),
            }
          )
      ).to.be.revertedWith('Invalid paid amount');
      // cap reached
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap + 1,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof
          )
      ).to.be.revertedWith('SipherNFTSale: free mint cap reached');
    });

    it('owner bought', async () => {
      await expect(sipherSale.connect(admin).buy(100, 0, 0, []))
        .to.emit(sipherSale, 'OwnerBought')
        .withArgs(admin.address, 100, 0);
      await verifySaleRecord(100, 100, 0, 0, 0);
      await verifyUserRecord(admin.address, 0, 0, 0); // data is not recorded as a normal user
      await expect(sipherSale.connect(admin).buy(10, 0, 0, []))
        .to.emit(sipherSale, 'OwnerBought')
        .withArgs(admin.address, 10, 0);
      await verifySaleRecord(110, 110, 0, 0, 0);
    });

    it('owner can buy after ended with no init cap', async () => {
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        ownerInitCap * 2
      );
      await sipherSale.connect(admin).setMerkleRoot(nonZeroBytes32);
      await sipherSale.connect(admin).buy(ownerInitCap, 0, 0, []);
      // not ended, initial cap for owner has reached
      await expect(sipherSale.connect(admin).buy(1, 0, 0, [])).to.be.revertedWith(
        'SipherNFTSale: max owner initial reached'
      );

      await mineNewBlockAt(currentTime + 13000);
      // ended, owner can buy up to max supply
      await sipherSale.connect(admin).buy(100, 0, 0, []);
      // buy until max supply
      await sipherSale.connect(admin).buy(ownerInitCap * 2 - (ownerInitCap + 100), 0, 0, []);
    });

    it('public bought', async () => {
      await mineNewBlockAt(currentTime + 10);
      //public
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(9)}); // 0.9eth
      await verifySaleRecord(1, 0, 1, 0, 0);
      await verifyUserRecord(user.address, 1, 0, 0);

      // owner bought, only affect owner bought record
      await sipherSale.connect(admin).buy(1, 0, 0, []);
      await verifySaleRecord(2, 1, 1, 0, 0);
      await verifyUserRecord(user.address, 1, 0, 0);

      // private time
      await mineNewBlockAt(currentTime + 11000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      await sipherSale
        .connect(user2)
        .buy(4, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof, {
          value: salePrice.mul(4),
        });
      await verifySaleRecord(6, 1, 1, 4, 0);
      await verifyUserRecord(user2.address, 0, 4, 0);

      await sipherSale
        .connect(user4)
        .buy(1, user4Whitelisted.privateCap, user4Whitelisted.freeMintCap, user4Whitelisted.proof, {value: salePrice});
      await verifySaleRecord(7, 1, 1, 5, 0);
      await verifyUserRecord(user2.address, 0, 4, 0);
      await verifyUserRecord(user4.address, 0, 1, 0);
    });

    it('public auction', async () => {
      //public
      await mineNewBlockAt(currentTime + 10);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(9)}); // 0.9eth
      await verifySaleRecord(1, 0, 1, 0, 0);
      await verifyUserRecord(user.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(85).div(10)}); // 0.85eth
      await verifySaleRecord(2, 0, 2, 0, 0);
      await verifyUserRecord(user.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 2);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(8)}); // 0.8eth
      await verifySaleRecord(3, 0, 3, 0, 0);
      await verifyUserRecord(user.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 3);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(75).div(10)}); // 0.75eth
      await verifySaleRecord(4, 0, 4, 0, 0);
      await verifyUserRecord(user.address, 4, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 4);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(7)}); // 0.7eth
      await verifySaleRecord(5, 0, 5, 0, 0);
      await verifyUserRecord(user.address, 5, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 5);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(65).div(10)}); // 0.65eth
      await verifySaleRecord(6, 0, 6, 0, 0);
      await verifyUserRecord(user2.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 6);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(6)}); // 0.6eth
      await verifySaleRecord(7, 0, 7, 0, 0);
      await verifyUserRecord(user2.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 7);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(55).div(10)}); // 0.55eth
      await verifySaleRecord(8, 0, 8, 0, 0);
      await verifyUserRecord(user2.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 8);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(5)}); // 0.5eth
      await verifySaleRecord(9, 0, 9, 0, 0);
      await verifyUserRecord(user2.address, 4, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 9);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(45).div(10)}); // 0.45eth
      await verifySaleRecord(10, 0, 10, 0, 0);
      await verifyUserRecord(user2.address, 5, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 10);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(4)}); // 0.4eth
      await verifySaleRecord(11, 0, 11, 0, 0);
      await verifyUserRecord(user3.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 11);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(35).div(10)}); // 0.35eth
      await verifySaleRecord(12, 0, 12, 0, 0);
      await verifyUserRecord(user3.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 12);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(3)}); // 0.3eth
      await verifySaleRecord(13, 0, 13, 0, 0);
      await verifyUserRecord(user3.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 13);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(25).div(10)}); // 0.25eth
      await verifySaleRecord(14, 0, 14, 0, 0);
      await verifyUserRecord(user3.address, 4, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 14);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(2)}); // 0.2eth
      await verifySaleRecord(15, 0, 15, 0, 0);
      await verifyUserRecord(user3.address, 5, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 15);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(15).div(10)}); // 0.15eth
      await verifySaleRecord(16, 0, 16, 0, 0);
      await verifyUserRecord(user4.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 16);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)}); // 0.1eth
      await verifySaleRecord(17, 0, 17, 0, 0);
      await verifyUserRecord(user4.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 16 + 10);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)}); // 0.1eth
      await verifySaleRecord(18, 0, 18, 0, 0);
      await verifyUserRecord(user4.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10210);
      await expect(sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)})).to.be.revertedWith(
        'SipherNFTSale: Private Sale not started'
      );
    });

    it('private bought', async () => {
      await mineNewBlockAt(currentTime + 11000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      await expect(
        sipherSale
          .connect(user2)
          .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof, {
            value: salePrice,
          })
      )
        .to.emit(sipherSale, 'PrivateBought')
        .withArgs(user2.address, 1, salePrice);
      await verifySaleRecord(1, 0, 0, 1, 0);
      await verifyUserRecord(user2.address, 0, 1, 0);
      // owner bought, only affect owner bought record
      await sipherSale.connect(admin).buy(1, 0, 0, []);
      await verifySaleRecord(2, 1, 0, 1, 0);
      await verifyUserRecord(user2.address, 0, 1, 0);
    });

    it('free mint', async () => {
      await mineNewBlockAt(currentTime + 12000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof
          )
      )
        .to.emit(sipherSale, 'FreeMintBought')
        .withArgs(user3.address, user3Whitelisted.freeMintCap, 0);
      await verifySaleRecord(user3Whitelisted.freeMintCap, 0, 0, 0, user3Whitelisted.freeMintCap);
      await verifyUserRecord(user3.address, 0, 0, user3Whitelisted.freeMintCap);
      // owner bought, only affect owner bought record
      await sipherSale.connect(admin).buy(1, 0, 0, []);
      await verifySaleRecord(user3Whitelisted.freeMintCap + 1, 1, 0, 0, user3Whitelisted.freeMintCap);
      await verifyUserRecord(user3.address, 0, 0, user3Whitelisted.freeMintCap);
    });

    it('verify balance changed after bought', async () => {
      await expect(() => sipherSale.connect(admin).buy(100, 0, 0, [])).to.changeEtherBalances([sipherSale], [0]);
      await expect(() => sipherSale.connect(admin).buy(100, 0, 0, [], {value: 10})).to.changeEtherBalances(
        [sipherSale],
        [10]
      );
      await mineNewBlockAt(currentTime + 11000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      await expect(() =>
        sipherSale
          .connect(user2)
          .buy(
            user2Whitelisted.privateCap,
            user2Whitelisted.privateCap,
            user2Whitelisted.freeMintCap,
            user2Whitelisted.proof,
            {value: salePrice.mul(user2Whitelisted.privateCap)}
          )
      ).to.changeEtherBalances([sipherSale], [salePrice.mul(user2Whitelisted.privateCap)]);
    });

    it('pause public auction', async () => {
      //public
      await mineNewBlockAt(currentTime + 10);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(9)}); // 0.9eth
      await verifySaleRecord(1, 0, 1, 0, 0);
      await verifyUserRecord(user.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(85).div(10)}); // 0.85eth
      await verifySaleRecord(2, 0, 2, 0, 0);
      await verifyUserRecord(user.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 2);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(8)}); // 0.8eth
      await verifySaleRecord(3, 0, 3, 0, 0);
      await verifyUserRecord(user.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 3);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(75).div(10)}); // 0.75eth
      await verifySaleRecord(4, 0, 4, 0, 0);
      await verifyUserRecord(user.address, 4, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 4);
      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(7)}); // 0.7eth
      await verifySaleRecord(5, 0, 5, 0, 0);
      await verifyUserRecord(user.address, 5, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 5);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(65).div(10)}); // 0.65eth
      await verifySaleRecord(6, 0, 6, 0, 0);
      await verifyUserRecord(user2.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 6);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(6)}); // 0.6eth
      await verifySaleRecord(7, 0, 7, 0, 0);
      await verifyUserRecord(user2.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 7);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(55).div(10)}); // 0.55eth
      await verifySaleRecord(8, 0, 8, 0, 0);
      await verifyUserRecord(user2.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 8);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(5)}); // 0.5eth
      await verifySaleRecord(9, 0, 9, 0, 0);
      await verifyUserRecord(user2.address, 4, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 9);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(45).div(10)}); // 0.45eth
      await verifySaleRecord(10, 0, 10, 0, 0);
      await verifyUserRecord(user2.address, 5, 0, 0);

      //pause
      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 9 + 10);
      const pauseTime = currentTime + 10 + STEP_AUCTION * 9 + 10;
      await mockNft.connect(admin).pause();

      //test buy when pause
      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 9 + 20);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(45).div(10)})).to.be.revertedWith(
        'pause sale'
      ); //maybe block before call mockcontract by price

      //unpause
      const unPauseTime = currentTime + 10 + STEP_AUCTION * 9 + 1000;
      let config = await sipherSale.getSaleConfig();
      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 9 + 1000);
      await sipherSale
        .connect(admin)
        .updateSaleConfigTime(
          unPauseTime - (pauseTime - Number(config.publicTime)),
          unPauseTime - (pauseTime - Number(config.publicEndTime)),
          unPauseTime - (pauseTime - Number(config.privateTime)),
          unPauseTime - (pauseTime - Number(config.freeMintTime)),
          unPauseTime - (pauseTime - Number(config.endTime))
        );
      await mockNft.connect(admin).unpause();

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 10 + 1000);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(4)}); // 0.4eth
      await verifySaleRecord(11, 0, 11, 0, 0);
      await verifyUserRecord(user3.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 11 + 1000);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(35).div(10)}); // 0.35eth
      await verifySaleRecord(12, 0, 12, 0, 0);
      await verifyUserRecord(user3.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 12 + 1000);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(3)}); // 0.3eth
      await verifySaleRecord(13, 0, 13, 0, 0);
      await verifyUserRecord(user3.address, 3, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 13 + 1000);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(25).div(10)}); // 0.25eth
      await verifySaleRecord(14, 0, 14, 0, 0);
      await verifyUserRecord(user3.address, 4, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 14 + 1000);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(2)}); // 0.2eth
      await verifySaleRecord(15, 0, 15, 0, 0);
      await verifyUserRecord(user3.address, 5, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 15 + 1000);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(15).div(10)}); // 0.15eth
      await verifySaleRecord(16, 0, 16, 0, 0);
      await verifyUserRecord(user4.address, 1, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 16 + 1000);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)}); // 0.1eth
      await verifySaleRecord(17, 0, 17, 0, 0);
      await verifyUserRecord(user4.address, 2, 0, 0);

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 16 + 1000 + 10);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)}); // 0.1eth
      await verifySaleRecord(18, 0, 18, 0, 0);
      await verifyUserRecord(user4.address, 3, 0, 0);

      await mockNft.connect(admin).pause();
      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 16 + 1000 + 20);
      await expect(sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)})).to.be.revertedWith(
        'pause sale'
      );

      // await mockNft.connect(admin).unpause();
      // await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 19 + 1000);
      // await expect(sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(1)})).to.be.revertedWith(
      //   'SipherNFTSale: Private Sale not started'
      // );
    });

    it('public refund', async () => {
      //public
      await mineNewBlockAt(currentTime + 10);
      await expect(sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user.address, salePrice); // 1 - 0.9 = 0.1eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION);
      await expect(sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user.address, salePrice.mul(15).div(10)); // 1 - 0.85 = 0.15eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 2);
      await expect(sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user.address, salePrice.mul(2)); // 1 - 0.8 = 0.2eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 3);
      await expect(sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user.address, salePrice.mul(25).div(10)); // 1 - 0.75 = 0.25eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 4);
      await expect(sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user.address, salePrice.mul(3)); // 1 - 0.7 = 0.3eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 5);
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user2.address, salePrice.mul(35).div(10)); // 1 - 0.65 = 0.35eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 6);
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user2.address, salePrice.mul(4)); // 1 - 0.6 = 0.4eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 7);
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user2.address, salePrice.mul(45).div(10)); // 1 - 0.55 = 0.45eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 8);
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user2.address, salePrice.mul(5)); // 1 - 0.5 = 0.5eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 9);
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user2.address, salePrice.mul(55).div(10)); // 1 - 0.45 = 0.55eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 10);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user3.address, salePrice.mul(6)); // 1 - 0.4 = 0.6eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 11);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user3.address, salePrice.mul(65).div(10)); // 1 - 0.35 = 0.65eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 12);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user3.address, salePrice.mul(7)); // 1 - 0.3 = 0.7eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 13);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user3.address, salePrice.mul(75).div(10)); // 1 - 0.25 = 0.75eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 14);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user3.address, salePrice.mul(8)); // 1 - 0.2 = 0.8eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 15);
      await expect(sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user4.address, salePrice.mul(85).div(10)); // 1 - 0.15 = 0.85eth

      await mineNewBlockAt(currentTime + 10 + STEP_AUCTION * 16);
      await expect(sipherSale.connect(user4).buy(1, 0, 0, [], {value: salePrice.mul(10)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user4.address, salePrice.mul(9)); // 1 - 0.1 = 0.9eth

      await expect(sipherSale.connect(user4).buy(3, 0, 0, [], {value: salePrice.mul(30)}))
        .to.emit(sipherSale, 'Refund')
        .withArgs(user4.address, salePrice.mul(27)); // 3 - 0.3 = 2.7eth
    });

    it('private proof', async () => {
      await mineNewBlockAt(currentTime + 11000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      await expect(
        sipherSale
          .connect(user2)
          .buy(
            user2Whitelisted.freeMintCap,
            user2Whitelisted.privateCap,
            user2Whitelisted.freeMintCap,
            user3Whitelisted.proof,
            {
              value: salePrice.mul(user2Whitelisted.freeMintCap),
            }
          )
      ).to.be.revertedWith('SipherNFTSale: only whitelisted buyer');
      await expect(
        sipherSale
          .connect(user2)
          .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof, {
            value: salePrice,
          })
      )
        .to.emit(sipherSale, 'PrivateBought')
        .withArgs(user2.address, 1, salePrice);
      await verifySaleRecord(1, 0, 0, 1, 0);
      await verifyUserRecord(user2.address, 0, 1, 0);
      // owner bought, only affect owner bought record
      await sipherSale.connect(admin).buy(1, 0, 0, []);
      await verifySaleRecord(2, 1, 0, 1, 0);
      await verifyUserRecord(user2.address, 0, 1, 0);
    });

    it('free mint proof', async () => {
      await mineNewBlockAt(currentTime + 12000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);
      await expect(
        sipherSale
          .connect(user2)
          .buy(
            user2Whitelisted.freeMintCap,
            user2Whitelisted.privateCap,
            user2Whitelisted.freeMintCap,
            user3Whitelisted.proof,
            {
              value: salePrice.mul(user2Whitelisted.freeMintCap),
            }
          )
      ).to.be.revertedWith('SipherNFTSale: only whitelisted buyer');
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof
          )
      )
        .to.emit(sipherSale, 'FreeMintBought')
        .withArgs(user3.address, user3Whitelisted.freeMintCap, 0);
      await verifySaleRecord(user3Whitelisted.freeMintCap, 0, 0, 0, user3Whitelisted.freeMintCap);
      await verifyUserRecord(user3.address, 0, 0, user3Whitelisted.freeMintCap);
      // owner bought, only affect owner bought record
      await sipherSale.connect(admin).buy(1, 0, 0, []);
      await verifySaleRecord(user3Whitelisted.freeMintCap + 1, 1, 0, 0, user3Whitelisted.freeMintCap);
      await verifyUserRecord(user3.address, 0, 0, user3Whitelisted.freeMintCap);
    });

    it('max supply', async () => {
      await mineNewBlockAt(currentTime + 10);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 9998);

      await sipherSale.connect(user).buy(1, 0, 0, [], {value: salePrice.mul(9)}); // 0.9eth

      await verifySaleRecord(1, 0, 1, 0, 0);
      await verifyUserRecord(user.address, 1, 0, 0);
      await expect(sipherSale.connect(user).buy(2, 0, 0, [], {value: salePrice.mul(9)})).to.be.revertedWith(
        'SipherNFTSale: max public sale supply reached'
      );

      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(9)}); // 0.9eth
      await verifySaleRecord(2, 0, 2, 0, 0);
      await verifyUserRecord(user2.address, 1, 0, 0);

      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 9996);
      await sipherSale.connect(user2).buy(2, 0, 0, [], {value: salePrice.mul(18)}); // 0.9eth
      await verifySaleRecord(4, 0, 4, 0, 0);
      await verifyUserRecord(user2.address, 3, 0, 0);
    });

    it('change merkle proof', async () => {
      await mineNewBlockAt(currentTime + 11000);
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 1000);

      await expect(
        sipherSale
          .connect(user)
          .buy(1, userWhitelisted_fail.privateCap, userWhitelisted_fail.freeMintCap, userWhitelisted_fail.proof, {
            value: salePrice,
          })
      ).to.be.revertedWith('SipherNFTSale: whitelisted private sale cap reached');

      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData2.merkleRoot, 1000);
      await sipherSale
        .connect(user)
        .buy(1, userWhitelisted.privateCap, userWhitelisted.freeMintCap, userWhitelisted.proof, {
          value: salePrice,
        }); // 0.9eth
    });

    it('aution 2.0', async () => {
      currentTime = await getCurrentBlockTime();
      await sipherSale
        .connect(admin)
        .updateSaleConfigTime(
          currentTime + 10,
          currentTime + 10210,
          currentTime + 54010,
          currentTime + 140410,
          currentTime + 226810
        );
      await sipherSale.connect(admin).setWhitelistedMerkleRoot(whitelistData.merkleRoot, 9993);
      //shift to public sale
      await mineNewBlockAt(currentTime + 10);
      await sipherSale.connect(user).buy(capPerNormal - 1, 0, 0, [], {
        value: salePrice.mul(9).mul(capPerNormal - 1),
      });
      await verifySaleRecord(4, 0, 4, 0, 0);
      await verifyUserRecord(user.address, 4, 0, 0);

      //shift to private sale
      await mineNewBlockAt(currentTime + 54010);
      await sipherSale
        .connect(user2)
        .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof, {
          value: salePrice,
        });
      await verifySaleRecord(5, 0, 4, 1, 0);
      await verifyUserRecord(user2.address, 0, 1, 0);

      //before freemint 30min
      await mineNewBlockAt(currentTime + 122410);
      //setup config time start public 2.0
      await sipherSale.connect(admin).updateSaleConfigTime(
        currentTime + 140410,
        currentTime + 140410 + 10200 + 3000, //extend 0.1eth time price 10p + 50p = 60p
        currentTime + 140410 + 10200 + 3600,
        currentTime + 140410 + 10201 + 3600,
        currentTime + 140410 + 86400
      );
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice})).to.be.revertedWith(
        'SipherNFTSale: Public Sale not started'
      );
      await expect(
        sipherSale.connect(user2).buy(5, 0, 0, [], {
          value: salePrice.mul(9).mul(5),
        })
      ).to.be.revertedWith('SipherNFTSale: Public Sale not started');
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof
          )
      ).to.be.revertedWith('SipherNFTSale: Public Sale not started');

      //shift to public sale 2 start time
      await mineNewBlockAt(currentTime + 140410);
      await expect(sipherSale.connect(user).buy(2, 0, 0, [], {value: salePrice.mul(2).mul(9)})).to.be.revertedWith(
        'SipherNFTSale: normal cap reached'
      );
      await sipherSale.connect(user).buy(1, 0, 0, [], {
        value: salePrice.mul(9),
      });
      await verifySaleRecord(6, 0, 5, 1, 0);
      await verifyUserRecord(user.address, 5, 0, 0);
      await expect(
        sipherSale.connect(user2).buy(5, 0, 0, [], {
          value: salePrice.mul(9).mul(5),
        })
      ).to.be.revertedWith('SipherNFTSale: max public sale supply reached');
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof
          )
      ).to.be.revertedWith('SipherNFTSale: invalid paid value');
      //shift to 60 last mint public 2.0
      await mineNewBlockAt(currentTime + 140410 + 10200);
      await sipherSale.connect(user4).buy(1, 0, 0, [], {
        value: salePrice,
      });
      await verifySaleRecord(7, 0, 6, 1, 0);
      await verifyUserRecord(user4.address, 1, 0, 0);

      //shift to downtime
      await mineNewBlockAt(currentTime + 140410 + 10200 + 3000);
      await expect(sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice})).to.be.revertedWith(
        'SipherNFTSale: Private Sale not started'
      );
      await expect(
        sipherSale.connect(user2).buy(5, 0, 0, [], {
          value: salePrice.mul(9).mul(5),
        })
      ).to.be.revertedWith('SipherNFTSale: Private Sale not started');
      await expect(
        sipherSale
          .connect(user3)
          .buy(
            user3Whitelisted.freeMintCap,
            user3Whitelisted.privateCap,
            user3Whitelisted.freeMintCap,
            user3Whitelisted.proof
          )
      ).to.be.revertedWith('SipherNFTSale: Private Sale not started');

      //shift to freemint
      await mineNewBlockAt(currentTime + 140410 + 10201 + 3600);
      //revert public
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(9)})).to.be.revertedWith(
        'Invalid paid amount'
      );
      //revert private
      await expect(
        sipherSale
          .connect(user2)
          .buy(1, user2Whitelisted.privateCap, user2Whitelisted.freeMintCap, user2Whitelisted.proof)
      ).to.be.revertedWith('SipherNFTSale: free mint cap reached');
      //freemint
      await sipherSale
        .connect(user3)
        .buy(
          user3Whitelisted.freeMintCap,
          user3Whitelisted.privateCap,
          user3Whitelisted.freeMintCap,
          user3Whitelisted.proof
        );
      await verifySaleRecord(9, 0, 6, 1, 2);
      await verifyUserRecord(user3.address, 0, 0, 2);
    });

    it('aution 2.0 pause', async () => {
      currentTime = await getCurrentBlockTime();
      await sipherSale
        .connect(admin)
        .updateSaleConfigTime(
          currentTime + 10,
          currentTime + 10210,
          currentTime + 54010,
          currentTime + 140410,
          currentTime + 226810
        );

      //before freemint 30min
      await mineNewBlockAt(currentTime + 122410);
      //setup config time start public 2.0
      await sipherSale
        .connect(admin)
        .updateSaleConfigTime(
          currentTime + 140410,
          currentTime + 140410 + 10200 + 3600,
          currentTime + 140410 + 10201 + 3600,
          currentTime + 140410 + 10202 + 3600,
          currentTime + 226810
        );
      await mineNewBlockAt(currentTime + 140410);

      await mineNewBlockAt(currentTime + 140410 + STEP_AUCTION * 9);
      await sipherSale.connect(user2).buy(1, 0, 0, [], {value: salePrice.mul(45).div(10)}); // 0.45eth
      await verifySaleRecord(1, 0, 1, 0, 0);
      await verifyUserRecord(user2.address, 1, 0, 0);

      //pause
      await mineNewBlockAt(currentTime + 140410 + STEP_AUCTION * 9 + 10);
      const pauseTime = currentTime + 140410 + STEP_AUCTION * 9 + 10;
      await mockNft.connect(admin).pause();

      //test buy when pause
      await mineNewBlockAt(currentTime + 140410 + STEP_AUCTION * 9 + 20);
      await expect(sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(45).div(10)})).to.be.revertedWith(
        'pause sale'
      ); //maybe block before call mockcontract by price

      //unpause
      const unPauseTime = currentTime + 140410 + STEP_AUCTION * 9 + 1000;
      let config = await sipherSale.getSaleConfig();
      await mineNewBlockAt(currentTime + 140410 + STEP_AUCTION * 9 + 1000);
      await sipherSale
        .connect(admin)
        .updateSaleConfigTime(
          unPauseTime - (pauseTime - Number(config.publicTime)),
          unPauseTime - (pauseTime - Number(config.publicEndTime)),
          unPauseTime - (pauseTime - Number(config.privateTime)),
          unPauseTime - (pauseTime - Number(config.freeMintTime)),
          unPauseTime - (pauseTime - Number(config.endTime))
        );
      await mockNft.connect(admin).unpause();

      await mineNewBlockAt(currentTime + 140410 + STEP_AUCTION * 10 + 1000);
      await sipherSale.connect(user3).buy(1, 0, 0, [], {value: salePrice.mul(4)}); // 0.4eth
      await verifySaleRecord(2, 0, 2, 0, 0);
      await verifyUserRecord(user3.address, 1, 0, 0);
    });
  });

  describe(`#rollStartIndex`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      snapshotId = await snapshot();
    });

    it('revert not ended', async () => {
      await expect(sipherSale.connect(admin).rollStartIndex()).to.be.revertedWith('SipherNFTSale: sale not ended');
    });

    it('revert calls from contract, not owner', async () => {
      await mineNewBlockAt(currentTime + 15000);
      const ContractBuyer = (await ethers.getContractFactory('MockContractBuyer')) as MockContractBuyer__factory;
      let sender = await ContractBuyer.deploy();
      await expect(sender.connect(admin).rollStartIndex(sipherSale.address)).to.be.revertedWith(
        'SipherNFTSale: only EOA or owner'
      );
    });

    it('revert merkle root is not set yet', async () => {
      await mineNewBlockAt(currentTime + 15000);
      await expect(sipherSale.connect(user).rollStartIndex()).to.be.revertedWith('merkle root is not set yet');
    });

    it('test call from the owner is a contract', async () => {
      await sipherSale.setMerkleRoot(nonZeroBytes32);
      await mineNewBlockAt(currentTime + 15000);
      // transfer ownership and try to call
      const ContractBuyer = (await ethers.getContractFactory('MockContractBuyer')) as MockContractBuyer__factory;
      let sender = await ContractBuyer.deploy();
      await sipherSale.connect(admin).transferOwnership(sender.address);
      // should be able to roll now
      await expect(sender.connect(admin).rollStartIndex(sipherSale.address))
        .to.emit(sipherSale, 'RollStartIndex')
        .withArgs(sender.address);
    });

    it('test event', async () => {
      await sipherSale.setMerkleRoot(nonZeroBytes32);
      await mineNewBlockAt(currentTime + 15000);
      await expect(sipherSale.connect(user).rollStartIndex())
        .to.emit(sipherSale, 'RollStartIndex')
        .withArgs(user.address);
    });
  });

  describe(`#setMerkleRoot`, async () => {
    const root = '0x7c281ab1da0529e0b21eacae6ae533127e0fc38ea0aa043ee35a79af7e2b6118';
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      currentTime = await getCurrentBlockTime();
      await setupSipherSale(
        currentTime + 10,
        currentTime + 10210,
        currentTime + 11000,
        currentTime + 12000,
        currentTime + 13000,
        10000
      );
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherSale.connect(user).setMerkleRoot(root)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('revert root is 0x0', async () => {
      await expect(sipherSale.connect(admin).setMerkleRoot(zeroBytes32)).to.be.revertedWith(
        'SipherNFTSale: invalid root'
      );
    });

    it('revert already set', async () => {
      await sipherSale.connect(admin).setMerkleRoot(root);
      await expect(sipherSale.connect(admin).setMerkleRoot(root)).to.be.revertedWith(
        'SipherNFTSale: already set merkle root'
      );
    });

    it('revert set data after whitelist buy time', async () => {
      await mineNewBlockAt(currentTime + 10);
      await expect(sipherSale.connect(admin).setMerkleRoot(root)).to.be.revertedWith(
        'SipherNFTSale: only update before whitelist buy time'
      );
    });

    it('test event', async () => {
      await expect(sipherSale.connect(admin).setMerkleRoot(root)).to.emit(sipherSale, 'SetMerkleRoot').withArgs(root);
    });
  });
});
