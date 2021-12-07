---
title: What does the Web3 Demo App by Cloudflare really do?
date: 2021/12/06
description: I dug into the Cloudflare web3 demo app, and here is what I found.
tag: web3
author: Yik San Chan
---

# What does the Web3 Demo App by Cloudflare really do?

Recently, I run into the [Get started Building Web3 Apps with Cloudflare](https://blog.cloudflare.com/get-started-web3/) post. Usually, when I see these web3 / metaverse hypes, I walk away. But when Cloudflare - a big tech that serves (or [bring downs](https://blog.cloudflare.com/cloudflare-outage-on-july-17-2020/)) half the internet - starts to build in the domain, I can't miss.

Here comes the post. First, I play around with Cloudflare's demo app [CFWeb3](https://cf-web3.pages.dev/) to gain some basic ideas, then I dive straight into the code to learn more.

## Prerequisites

There are countless resources on blockchain, but here are the 2 that I find most helpful:

- [But how does bitcoin actually work?](https://www.3blue1brown.com/lessons/bitcoin) by [3b1b](https://www.3blue1brown.com/).
- [Intro to Ethereum](https://ethereum.org/en/developers/docs/intro-to-ethereum/) docs.

The first resource explains how blockchain works and the second resource explains how smart contracts add to that. With them in mind, you are good to go.

## Play-around

To play around with the app, all you need are:

- [MetaMask](https://metamask.io/) chrome extension - a gateway to blockchain apps including CFWeb3.
- Some ETH on the testnet. Visit [here](https://faucets.chain.link/rinkeby), copy your account address from MetaMask, and paste it into "Testnet account address", then we will receive enough ETH for minting purposes.

Switch to Rinkeby network, and you will find:

![Connected](/images/cfweb3/connected.png)

The only mutation allowed is to Mint (ie create) tokens. Click "Mint", and you see a MetaMask prompt:

![MetaMask](/images/cfweb3/metamask.png)

Click "Confirm", wait for a bit, then you will find your tokens. These are mine:

![Home](/images/cfweb3/home.png)

Click into one of them, you land OpenSea, the largest NFT marketplace, and you find your newly created NFT like [this](https://testnets.opensea.io/assets/0x290422ec6eadc2cc12acd98c50333720382ca86b/561). Find "Details" on the page, click into the Contract Address, then you land Etherscan, a blockchain visualization tool, and view the contract info like [this](https://rinkeby.etherscan.io/address/0x290422ec6eadc2cc12acd98c50333720382ca86b).

These are a lot of information, let me sum up. Via the CFWeb3 UI, you create a token aka NFT, publish it on OpenSea for sale, and that's it. Also from the UI, you view what tokens you own.

## Code Deep-dive

There are 3 parts in the project: [UI](https://github.com/cloudflare/cfweb3/tree/main/frontend), [API](https://github.com/cloudflare/cfweb3/tree/main/worker), and [smart contract definition](https://github.com/cloudflare/cfweb3/tree/main/contract). I will let the below questions drive our exploration.

### How does the app read data?

The UI needs 3 pieces of data (thus 3 API calls) for rendering:

- My account address from MetaMask, see [code](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/frontend/src/App.svelte#L7).
- \# Minted tokens from the chain, see [code](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/frontend/src/App.svelte#L89).
- My tokens from the chain, see [code](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/frontend/src/App.svelte#L74).

We count on the `contract` object to access chain data, which is initiated as:

```solidity
contract = new ethers.Contract(CONTRACT_ID, Contract.abi, provider);
```

We leverage several methods in the `contract` object, including [totalSupply](https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721Enumerable-totalSupply--), [tokenOfOwnerByIndex](https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721Enumerable-tokenOfOwnerByIndex-address-uint256-), [tokenURI](https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#ERC721-tokenURI-uint256-), and `MAX_TOKENS`. Note that the first 3 methods are [ERC721](https://docs.openzeppelin.com/contracts/3.x/api/token/erc721) inbuilt that return states of a smart contract.

Also note that all these methods are declared in the `abi` section of [CFNFT.json](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/frontend/src/CFNFT.json). Yes, I believe ABI ≈ API, CFNFT.json ≈ The API Definition (not implementation).

### How does the app write data?

As said, the only mutation allowed is to mint. It calls into the [mintToken](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/frontend/src/App.svelte#L65) method which is implemented in the smart contract [code](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/contract/contracts/CFNFT.sol#L53). The core logic is simple: First, it mints tokens with serial IDs and transfers them to the receiver (me). Second, it emits `Minted` events that [frontend code](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/frontend/src/App.svelte#L67) is listening to.

```solidity
uint256 mintIndex = totalSupply();
_safeMint(receiver, mintIndex);
emit Minted(mintIndex, receiver);
```

### Recap

This architecture diagram from the Cloudflare post is a good recap.

![architecture](/images/cfweb3/architecture.png)

## Wait, I am here for Ethereum Gateway and IPFS Gateway

After reading the [blog](https://blog.cloudflare.com/get-started-web3/), I want to learn how Ethereum Gateway and IPFS Gateway are used, hopefully in CFWeb3. I am sure it wasn't just me.

Good news and bad news.

Bad news first: CFWeb3 is not leveraging Ethereum Gateway 🤷

Good news: CFWeb3 accesses the [NFT image](https://cloudflare-ipfs.com/ipfs/Qma6eRuWT27UyCZCCVNpnndzRYWqyQrX4DfdgMCsLs5u8H) with IPFS Gateway, see [code](https://github.com/cloudflare/cfweb3/blob/270e4c63c1efbdd0b7ae73838c5750631653fd31/worker/index.ts#L14). It feels identical to S3 from the end-user experience.

## It is just a beginning

Even though CFWeb3 doesn't cover Ethereum Gateway, it is still a good beginning to start making sense of buzzwords that are must-learn for web3 developers: smart contract, token, abi, etc.

Hope my walkthrough helps a bit.

---
