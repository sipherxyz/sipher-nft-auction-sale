import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { PRECISION, ZERO_ADDRESS } from './utils/constants';
import { BigNumber as BN } from 'ethers';
import { snapshot, revertToSnapshot } from './utils/hardhat';
import chai from 'chai';
const ethersKeccak = ethers.utils.keccak256;
const abiEncoder = ethers.utils.defaultAbiCoder;
const {solidity} = waffle;
chai.use(solidity);

import {
  MockSipherNFT__factory, MockSipherNFT,
  MockContractBuyer__factory, MockContractBuyer
} from '../typechain';
import { fork } from 'cluster';

let SipherNFT: MockSipherNFT__factory;

let sipherNft: MockSipherNFT;

let mockBuyer: MockContractBuyer
let currentTime: number;
let salePrice = PRECISION.div(10);
let MAX_SUPPLY = 10000;

let snapshotId: any;

describe('SipherNFT', () => {
  const [genesisMinter, forkMinter, user, admin] = waffle.provider.getWallets();

  before('deploy Sipher NFT', async () => {
    SipherNFT = (await ethers.getContractFactory('MockSipherNFT')) as MockSipherNFT__factory;
    sipherNft = await SipherNFT.connect(admin).deploy("Sipher NFT", "SNFT");
    await sipherNft.connect(admin).setGenesisMinter(genesisMinter.address);
    await sipherNft.connect(admin).setForkMinter(forkMinter.address);
    const ContractBuyer = (await ethers.getContractFactory('MockContractBuyer')) as MockContractBuyer__factory;
    mockBuyer = await ContractBuyer.deploy();
    snapshotId = await snapshot();
  });

  describe(`#mintGenesis`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert genesis minter is not set', async () => {
      let newContract = await SipherNFT.connect(admin).deploy("Sipher NFT", "SNFT")
      await expect(newContract.connect(genesisMinter).mintGenesis(1, forkMinter.address,1))
        .to.be.revertedWith('SipherERC721: caller is not genesis minter');
    });

    it('revert not genesis minter', async () => {
      await expect(sipherNft.connect(forkMinter).mintGenesis(10, forkMinter.address,1))
        .to.be.revertedWith('SipherERC721: caller is not genesis minter');
    });

    it('revert mint to contract without received func', async () => {
      await expect(sipherNft.connect(genesisMinter).mintGenesis(1, mockBuyer.address,1))
        .to.be.revertedWith('ERC721: transfer to non ERC721Receiver implementer');
    });

    it('revert can not mint when paused', async () => {
      await sipherNft.connect(admin).pause();
      await expect(sipherNft.connect(genesisMinter).mintGenesis(10, forkMinter.address,1))
        .to.be.revertedWith('Pausable: paused');
    });

    it('revert cap reached', async () => {
      await expect(sipherNft.connect(genesisMinter).mintGenesis(MAX_SUPPLY + 1, genesisMinter.address,1))
        .to.be.revertedWith('SipherERC721: max genesis supply reached');
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await expect(sipherNft.connect(genesisMinter).mintGenesis(MAX_SUPPLY - 10 + 1, genesisMinter.address,1))
        .to.be.revertedWith('SipherERC721: max genesis supply reached');
    });

    it('mint and verify', async () => {
      let recipients = [user.address, forkMinter.address];
      for (let r = 0; r < recipients.length; r++) {
        let currentId = await sipherNft.currentId();
        let userBalance = await sipherNft.balanceOf(recipients[r]);
        let amount = r * 10 + 20;
        await sipherNft.connect(genesisMinter).mintGenesis(amount, recipients[r],1);
        for (let i = 1; i <= amount; i++) {
          let tokenId = currentId.add(i);
          // verify owner
          expect(await sipherNft.ownerOf(tokenId)).to.be.eq(recipients[r]);
          // verify enumerable data
          expect(await sipherNft.tokenByIndex(tokenId.sub(1))).to.be.eq(tokenId);
          expect(await sipherNft.tokenOfOwnerByIndex(recipients[r], i - 1)).to.be.eq(tokenId);
        }
        expect(await sipherNft.totalSupply()).to.be.eq(currentId.add(amount));
        expect(await sipherNft.currentId()).to.be.eq(currentId.add(amount));
        expect(await sipherNft.balanceOf(recipients[r])).to.be.eq(userBalance.add(amount));
      }
    });
  });

  describe(`#minFork`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not fork minter', async () => {
      await expect(sipherNft.connect(genesisMinter).mintFork(10))
        .to.be.revertedWith('SipherERC721: caller is not fork minter');
    });

    it('revert fork minter is not set', async () => {
      let newContract = await SipherNFT.connect(admin).deploy("Sipher NFT", "SNFT")
      await expect(newContract.connect(forkMinter).mintFork(1))
        .to.be.revertedWith('SipherERC721: caller is not fork minter');
    });

    it('revert not min full max supply yet', async () => {
      await expect(sipherNft.connect(forkMinter).mintFork(10))
        .to.be.revertedWith('SipherERC721: not mint all genesis yet');
    });

    it('revert can not mint when paused', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await sipherNft.setCurrentId(10000);
      await sipherNft.connect(admin).pause();
      await expect(sipherNft.connect(forkMinter).mintFork(1))
        .to.be.revertedWith('Pausable: paused');
    });

    it('revert token not exist', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await sipherNft.connect(user).burn(1); // burn tokenId 1
      await sipherNft.setCurrentId(10000);
      // invalid token id
      await expect(sipherNft.connect(forkMinter).mintFork(0))
        .to.be.revertedWith('SipherERC721: invalid token id');
      // token id is not minted yet
      await expect(sipherNft.connect(forkMinter).mintFork(10001))
        .to.be.revertedWith('SipherERC721: invalid token id');
      // token minted but has been burnt
      await expect(sipherNft.connect(forkMinter).mintFork(1))
        .to.be.revertedWith('SipherERC721: token does not exist');
    });

    it('mint and verify', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await sipherNft.connect(genesisMinter).mintGenesis(10, genesisMinter.address,1);
      await sipherNft.connect(genesisMinter).mintGenesis(10, forkMinter.address,1);
      await sipherNft.setCurrentId(10000);

      for (let i = 0; i < 30; i++) {
        let currentId = await sipherNft.currentId();
        let forkId = currentId.add(1);
        let owner = await sipherNft.ownerOf(i + 1);
        // mint a fork for a genesis token
        await expect(sipherNft.connect(forkMinter).mintFork(i + 1))
          .to.emit(sipherNft, 'Transfer').withArgs(ZERO_ADDRESS, owner, forkId);
        expect(await sipherNft.ownerOf(forkId)).to.be.eq(owner);
        expect(await sipherNft.currentId()).to.be.eq(forkId);
        expect(await sipherNft.originals(forkId)).to.be.eq(i + 1);

        // mint a fork for a fork
        currentId = await sipherNft.currentId();
        await sipherNft.connect(forkMinter).mintFork(forkId);
        let newForkId = currentId.add(1);

        expect(await sipherNft.ownerOf(newForkId)).to.be.eq(owner);
        expect(await sipherNft.currentId()).to.be.eq(newForkId);
        expect(await sipherNft.originals(newForkId)).to.be.eq(forkId);
      }
    });
  });

  describe(`#burn`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not exist', async () => {
      await expect(sipherNft.connect(admin).burn(0))
      .to.be.revertedWith('ERC721: operator query for nonexistent token');
      await expect(sipherNft.connect(admin).burn(10))
        .to.be.revertedWith('ERC721: operator query for nonexistent token');
    });

    it('revert not owner or approved', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await expect(sipherNft.connect(admin).burn(1))
        .to.be.revertedWith('ERC721Burnable: caller is not owner nor approved');
      await sipherNft.connect(user).approve(admin.address, 1); // approve for admin to burn
      expect(sipherNft.connect(genesisMinter).burn(1))
        .to.be.revertedWith('ERC721Burnable: caller is not owner nor approved');
      // burn by admin works
      await sipherNft.connect(admin).burn(1);
    });

    it('revert already burnt', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await sipherNft.connect(user).burn(5);
      await expect(sipherNft.connect(user).burn(5))
        .to.be.revertedWith('ERC721: operator query for nonexistent token');
    });

    it('burn and verify', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      expect(await sipherNft.ownerOf(5)).to.be.eq(user.address);
      let totalSupply = await sipherNft.totalSupply();
      await expect(sipherNft.connect(user).burn(5))
        .to.emit(sipherNft, 'Transfer').withArgs(user.address, ZERO_ADDRESS, 5);
      expect(await sipherNft.ownerOf(5)).to.be.eq(ZERO_ADDRESS);
      expect(await sipherNft.totalSupply()).to.be.eq(totalSupply.sub(1));
    });
  });

  describe(`#rollStartIndex`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not genesis minter', async () => {
      await expect(sipherNft.connect(admin).rollStartIndex())
        .to.be.revertedWith('SipherERC721: caller is not genesis minter');
    });

    it('revert already rolled', async () => {
      await sipherNft.connect(genesisMinter).rollStartIndex();
      await expect(sipherNft.connect(genesisMinter).rollStartIndex())
        .to.be.revertedWith('SipherERC721: start index is already rolled');
    });

    it('set data and verify', async () => {
      for (let i = 1; i <= 20; i++) {
        let newSipherNft = await SipherNFT.connect(admin).deploy("Test", "Test");
        await newSipherNft.setGenesisMinter(genesisMinter.address);
        await newSipherNft.connect(genesisMinter).rollStartIndex();
        let blockDataPrevious = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber() - 1));
        let blockData = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber()));
        let value = ethers.utils.solidityKeccak256(
          ['bytes32', 'address', 'uint256'],
          [blockDataPrevious.hash, blockData.miner, blockData.difficulty]
        );
        let randomNumber = BN.from(value).mod(MAX_SUPPLY).add(1);
        expect(await newSipherNft.randomizedStartIndex()).to.be.eq(randomNumber);
      }
    });
  });

  describe(`#setGenesisMinter`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherNft.connect(genesisMinter).setGenesisMinter(user.address))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('set data and verify', async () => {
      await sipherNft.connect(admin).setGenesisMinter(genesisMinter.address);
      expect(await sipherNft.genesisMinter()).to.be.eq(genesisMinter.address);
      await sipherNft.connect(admin).setGenesisMinter(user.address);
      expect(await sipherNft.genesisMinter()).to.be.eq(user.address);
    });
  });

  describe(`#setForkMinter`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherNft.connect(genesisMinter).setForkMinter(user.address))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('set data and verify', async () => {
      await sipherNft.connect(admin).setForkMinter(forkMinter.address);
      expect(await sipherNft.forkMinter()).to.be.eq(forkMinter.address);
      await sipherNft.connect(admin).setForkMinter(user.address);
      expect(await sipherNft.forkMinter()).to.be.eq(user.address);
    });
  });

  describe(`#setStoreFrontURI`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherNft.connect(genesisMinter).setStoreFrontURI(user.address))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('set data and verify', async () => {
      await sipherNft.connect(admin).setStoreFrontURI('new store front uri');
      expect(await sipherNft.contractURI()).to.be.eq('new store front uri');
    });
  });

  describe(`#setBaseURI`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherNft.connect(genesisMinter).setBaseURI(user.address))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('set data and verify', async () => {
      let baseURI = "https://etherscan/blocks/";
      await sipherNft.connect(admin).setBaseURI(baseURI);
      expect(await sipherNft.baseSipherURI()).to.be.eq(baseURI);
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      for (let i = 1; i <= 10; i++) {
        expect(await sipherNft.tokenURI(i)).to.be.eq(`${baseURI}${i}`);
      }
      await sipherNft.setCurrentId(MAX_SUPPLY);
      await sipherNft.connect(forkMinter).mintFork(1);
      expect(await sipherNft.tokenURI(MAX_SUPPLY + 1)).to.be.eq(`${baseURI}${MAX_SUPPLY + 1}`);
    });
  });

  describe(`#pause`, async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('revert not owner', async () => {
      await expect(sipherNft.connect(genesisMinter).pause())
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('revert can not transfer when paused', async () => {
      await sipherNft.connect(genesisMinter).mintGenesis(10, user.address,1);
      await sipherNft.connect(admin).pause();
      await expect(sipherNft.connect(user).transferFrom(user.address, forkMinter.address, 1))
        .to.be.revertedWith('Pausable: paused');
    });

    it('set data and verify', async () => {
      await sipherNft.connect(admin).pause();
      expect(await sipherNft.paused()).to.be.eq(true);
      await sipherNft.connect(admin).unpause();
      expect(await sipherNft.paused()).to.be.eq(false);
    });
  });

  describe('#constructor', async () => {
    beforeEach('revert to snapshot', async () => {
      await revertToSnapshot(snapshotId);
      snapshotId = await snapshot();
    });

    it('test correct data init', async () => {
      let newSipherNft = await SipherNFT.connect(admin).deploy("Sipher NFT", "SNFT");
      expect(await newSipherNft.genesisMinter()).to.be.eq(ZERO_ADDRESS);
      expect(await newSipherNft.forkMinter()).to.be.eq(ZERO_ADDRESS);
      expect(await newSipherNft.randomizedStartIndex()).to.be.eq(0);
      expect(await newSipherNft.currentId()).to.be.eq(0);
      expect(await newSipherNft.baseSipherURI()).to.be.eq("");
      expect(await newSipherNft.contractURI()).to.be.eq("");
    });
  });
});
