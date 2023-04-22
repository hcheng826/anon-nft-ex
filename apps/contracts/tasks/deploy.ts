/* eslint-disable @typescript-eslint/no-unused-vars */
import { task, types } from "hardhat/config"

task("deploy", "Deploy a Feedback contract")
    .addOptionalParam("semaphore", "Semaphore contract address", undefined, types.string)
    .addOptionalParam("group", "Group id", "42", types.string)
    .addOptionalParam("logs", "Print the logs", true, types.boolean)
    .setAction(async ({ logs, semaphore: semaphoreAddress, group: groupId }, { ethers, run }) => {
        const [deployer, ...accounts] = await ethers.getSigners();
        if (!semaphoreAddress) {
            const { semaphore } = await run("deploy:semaphore", {
                logs
            })

            semaphoreAddress = semaphore.address
        }

        // if (!groupId) {
        //     groupId = process.env.GROUP_ID
        // }

        // const FeedbackFactory = await ethers.getContractFactory("Feedback")

        // const feedbackContract = await FeedbackFactory.deploy(semaphoreAddress, groupId)

        // await feedbackContract.deployed()

        // if (logs) {
        //     console.info(`Feedback contract has been deployed to: ${feedbackContract.address}`)
        // }

        const AnonNFTExFactory = await ethers.getContractFactory("AnonNFTEx")

        const AnonNFTExContract = await AnonNFTExFactory.deploy(semaphoreAddress)

        await AnonNFTExContract.deployed()

        const NFTFactory = await ethers.getContractFactory("SimpleNFT")
        const NFT = await NFTFactory.deploy();
        console.log(`NFT contract addr: ${NFT.address} `)

        if (logs) {
            console.info(`AnonNFTEx contract has been deployed to: ${AnonNFTExContract.address}`)
        }

        return AnonNFTExContract
    })
