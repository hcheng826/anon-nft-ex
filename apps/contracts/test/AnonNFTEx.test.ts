/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from "chai"
import { ethers, run } from "hardhat"
import { Contract, ContractFactory, BigNumber } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { SimpleNFT } from "../build/typechain/contracts/SimpleNFT"
import { Group } from "@semaphore-protocol/group"
import { AnonNFTEx, Semaphore } from "../build/typechain"

describe.only("AnonNFTEx", () => {
    let semaphore: Semaphore
    let anonNFTEx: AnonNFTEx
    let simpleNFT: SimpleNFT
    let deployer: SignerWithAddress
    let accounts: SignerWithAddress[]

    let sellerIdentity: any
    let buyerIdentity: any

    const NFT_SOLD_GROUP_ID = 1
    const ETH_DEPOSITED_GROUP_ID = 2

    const nftSoldGroup = new Group(NFT_SOLD_GROUP_ID, 20)
    const ethDepositedGroup = new Group(ETH_DEPOSITED_GROUP_ID, 20)

    before(async () => {
        const AnonNFTExFactory = await ethers.getContractFactory("AnonNFTEx")
        ;[deployer, ...accounts] = await ethers.getSigners()

        const semaphoreDeployment = await run("deploy:semaphore")
        semaphore = semaphoreDeployment.semaphore
        anonNFTEx = await AnonNFTExFactory.deploy(semaphore.address)
        await anonNFTEx.deployed()

        const simpleNFTFactory = await ethers.getContractFactory("SimpleNFT")
        simpleNFT = await simpleNFTFactory.deploy()
    })

    it("Should properly deploy the contract", async () => {
        expect(anonNFTEx.address).to.not.equal("")
    })

    it("Should deposit NFT", async () => {
        const tokenId = 1
        await simpleNFT.connect(deployer).mintNFT(accounts[0].address)
        await simpleNFT.connect(accounts[0]).approve(anonNFTEx.address, tokenId)

        sellerIdentity = new Identity()
        await anonNFTEx.connect(accounts[0]).depositNFT(simpleNFT.address, tokenId, sellerIdentity.commitment)

        const deposit = await anonNFTEx.nftDeposits(simpleNFT.address, tokenId)
        expect(deposit.sellerAddr).to.equal(accounts[0].address)
        expect(deposit.idCommitment).to.equal(sellerIdentity.commitment)
    })

    it("Should deposit ETH", async () => {
        buyerIdentity = new Identity()
        const depositAmount = ethers.utils.parseEther("0.1")

        await anonNFTEx.connect(accounts[1]).depositETH(buyerIdentity.commitment, {
            value: depositAmount
        })

        ethDepositedGroup.addMember(buyerIdentity.commitment)

        const ethDeposit = await anonNFTEx.ethDeposits(accounts[1].address)
        expect(ethDeposit).to.equal(buyerIdentity.commitment.toString())
    })

    it("ETH depositor can buy and claim NFT to new address", async () => {
        const tokenId = 1
        const nftRecipient = accounts[2].address
        const externalNullifier = ethDepositedGroup.root
        // const signal = ethers.utils.hexlify(
        //     ethers.BigNumber.from(
        //         ethers.utils.keccak256(
        //             ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [simpleNFT.address, tokenId])
        //         )
        //     )
        // );
        const signal = 1;
        console.log(signal);
        const fullProof = await generateProof(buyerIdentity, ethDepositedGroup, externalNullifier, signal, {
            zkeyFilePath: "./tests/semaphore/semaphore.zkey",
            wasmFilePath: "./test/semaphore/semaphore.wasm"
        })
        console.log(fullProof);

        await anonNFTEx
            .connect(accounts[0])
            .buyAndClaimNFT(
                simpleNFT.address,
                tokenId,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                fullProof.proof,
                nftRecipient
            )

        expect(await simpleNFT.ownerOf(tokenId)).to.equal(nftRecipient)
    })

    //   it("NFT seller can claim ETH for NFT sold", async () => {
    //     const initialBalance = await accounts[0].getBalance();
    //     const { merkleTreeRoot, nullifierHash, proof } = await generateProof();

    //     await anonNFTEx
    //       .connect(accounts[0])
    //       .claimETH(accounts[0].address, merkleTreeRoot, nullifierHash, proof);

    //     const finalBalance = await accounts[0].getBalance();
    //     expect(finalBalance.sub(initialBalance)).to.equal(
    //       ethers.utils.parseEther("0.1")
    //     );
    //   });

    // TODO: Add more tests for each function in the contract
    // - withdrawNFT
    // - depositETH
    // - withdrawETH
    // - buyAndClaimNFT
    // - claimETH
})
