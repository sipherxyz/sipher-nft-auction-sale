# Smart Contracts for Sipher

## Installation
`yarn install` to install all required packages.


## Compilation
`yarn c` to compile contracts for all solidity versions. The current using version is 0.8.4;


## Testing with Hardhat
1. If contracts have not been compiled, run `yarn c`. This step can be skipped subsequently.
2. Run `yarn test {path_to_file}` to run a specific file test, example: `yarn test tests/sipherNFT.spec.ts`

## Contract Deployment / Interactions

For interactions or contract deployments on public testnets / mainnet, create a `.env` file specifying your data (using `.env.example` as referenace)
