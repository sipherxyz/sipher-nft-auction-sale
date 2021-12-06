// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {ISipherNFTSale} from '../interfaces/ISipherNFTSale.sol';


contract MockContractBuyer {

  function buy(ISipherNFTSale sale, uint32 amount, uint32 privateCap, uint32 freeMintCap, bytes32[] memory proofs) external payable {
    sale.buy{ value: msg.value }(amount, privateCap, freeMintCap, proofs);
  }

  function rollStartIndex(ISipherNFTSale sale) external {
    sale.rollStartIndex();
  }
}
