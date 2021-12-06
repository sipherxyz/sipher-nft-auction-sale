// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;


contract MockSipherNFTSimple {
  bool public _pause=false;

  function mintGenesis(uint256 amount, address to, uint256 unitPrice) view external  {
    require(_pause==false,'pause sale');
  }

  function rollStartIndex() external {
  }

  function pause() external {
    _pause = true;
  }

  function unpause() external {
    _pause = false;
  }
}
