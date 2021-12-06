const {MerkleTree} = require('merkletreejs');
import {waffle} from 'hardhat';
const ethers = require('ethers');
const BN = ethers.BigNumber;
const keccak256 = require('keccak256');
const ethersKeccak = ethers.utils.keccak256;
const abiEncoder = ethers.utils.defaultAbiCoder;
const hexlify = ethers.utils.hexlify;
const [user, user2, user3, admin,user4] = waffle.provider.getWallets();


const verifyProof = (root, token, proof) => {
  //
  let computedHash = hexlify(
    ethersKeccak(
      abiEncoder.encode(['address', 'uint32', 'uint32'], [token.WalletAddress, token.privateCap, token.freeMintCap])
    )
  );
  proof.forEach((proofElement) => {
    let hexProof = hexlify(proofElement);
    if (computedHash < hexProof) {
      computedHash = hexlify(keccak256(computedHash + hexProof.substring(2)));
    } else {
      computedHash = hexlify(keccak256(proofElement + computedHash.substring(2)));
    }
  });
  if (hexlify(computedHash) != root) {
    console.log(
      'inconstent root: root computed from proofs is ' + hexlify(computedHash) + ', expected root is ' + root
    );
  }
  return hexlify(computedHash) == root;
};

////////////////////////////////////////////////////////////////////////////////////////////
const parseData = (rawData) => {
  const data = rawData.whitelist.sort((a, b) => {
    if (a.WalletAddress < b.WalletAddress) {
      return -1;
    }
    if (a.WalletAddress > b.WalletAddress) {
      return 1;
    }
    return 0;
  });

  const leaves = data.map((el) => {
    return ethersKeccak(
      abiEncoder.encode(['address', 'uint32', 'uint32'], [el.WalletAddress, el.privateCap, el.freeMintCap])
    );
  });

  const tree = new MerkleTree(leaves, keccak256, {sort: true});

  const tokensWithProof = data.map((element, index) => {
    let newEl = {};
    newEl.proof = tree.getHexProof(leaves[index]);
    newEl.leaf = leaves[index];
    newEl.index = index;
    newEl.WalletAddress = element.WalletAddress;
    newEl.privateCap = element.privateCap;
    newEl.freeMintCap = element.freeMintCap;
    return newEl;
  });
  let data2 = {};
  data2.merkleRoot = tree.getHexRoot();
  data2.whitelist = tokensWithProof;

  return data2;
};

module.exports.GenarateMerkleTree = () => {
  let data = {
    whitelist: [
      {
        WalletAddress: user.address.toString(),
        privateCap: 0,
        freeMintCap: 0,
      },
      {
        WalletAddress: user2.address.toString(),
        privateCap: 5,
        freeMintCap: 0,
      },
      {
        WalletAddress: user3.address.toString(),
        privateCap: 0,
        freeMintCap: 2,
      },
      {
        WalletAddress: admin.address.toString(),
        privateCap: 0,
        freeMintCap: 2,
      },
      {
        WalletAddress: user4.address.toString(),
        privateCap: 1,
        freeMintCap: 1,
      },
    ],
  };
  const merkleData = parseData(data);
  ///  check  ///
  const merkleRoot = merkleData.merkleRoot;
  merkleData.whitelist.forEach((token, index) => {
    const proof = token.proof;
    const tokenData = data.whitelist[index];
    const id = index;
    if (!verifyProof(merkleRoot, tokenData, proof)) {
      console.log('Failed at id: ' + id + '. Abort.');
      process.exit();
    }
  });

  return merkleData;
};



module.exports.GenarateMerkleTree2 = () => {
  let data = {
    whitelist: [
      {
        WalletAddress: user.address.toString(),
        privateCap: 2,
        freeMintCap: 2,
      },
      {
        WalletAddress: user2.address.toString(),
        privateCap: 5,
        freeMintCap: 0,
      },
      {
        WalletAddress: user3.address.toString(),
        privateCap: 0,
        freeMintCap: 2,
      },
      {
        WalletAddress: admin.address.toString(),
        privateCap: 0,
        freeMintCap: 2,
      },
      {
        WalletAddress: user4.address.toString(),
        privateCap: 1,
        freeMintCap: 1,
      },
    ],
  };
  const merkleData = parseData(data);
  ///  check  ///
  const merkleRoot = merkleData.merkleRoot;
  merkleData.whitelist.forEach((token, index) => {
    const proof = token.proof;
    const tokenData = data.whitelist[index];
    const id = index;
    if (!verifyProof(merkleRoot, tokenData, proof)) {
      console.log('Failed at id: ' + id + '. Abort.');
      process.exit();
    }
  });

  return merkleData;
};