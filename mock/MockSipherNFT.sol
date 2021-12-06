// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import '../core/SipherNFT.sol';


contract MockSipherNFT is SipherNFT {

  constructor(string memory name_, string memory symbol_) SipherNFT(name_, symbol_) {}

  // To avoid minting all max supply tokens
  function setCurrentId(uint256 _newId) external {
    currentId = _newId;
  }
}
