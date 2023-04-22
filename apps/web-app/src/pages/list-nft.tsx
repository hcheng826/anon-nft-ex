/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Box, Button, Divider, Heading, HStack, Link, Text, useBoolean, VStack, Textarea } from "@chakra-ui/react"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { BigNumber, ethers, utils } from "ethers"
import getNextConfig from "next/config"
import { useRouter } from "next/router"
import { useContractWrite, useContract, Web3Button, useAddress, useContractRead } from "@thirdweb-dev/react"
import { useCallback, useContext, useEffect, useState } from "react"
import SimpleNFTArtifact from "../../contract-artifacts/SimpleNFT.json"
import AnonNFTEx from "../../contract-artifacts/AnonNFTEx.json"

const { publicRuntimeConfig: env } = getNextConfig()
const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS || "0x0165878a594ca255338adfa4d48449f69242eb8f"
const pollingInterval = 3000 // Polling interval in milliseconds
const anonNFTExContractAddress = process.env.ANONNFTEX_CONTRACT_ADDRESS || "0x5fc8d32690cc91d4c39d9d3abcbd16989f875707"

export default function ListNFTPage() {
    const router = useRouter()
    const address = useAddress()
    const [identityInfo, setIdentityInfo] = useState<string | null>(null)

    const anonNftExContract = useContract(anonNFTExContractAddress, AnonNFTEx.abi)
    const {
        mutateAsync: depositNFTmutateAsync,
        isLoading: depositNFTisLoading,
        error: depositNFTerror
    } = useContractWrite(anonNftExContract.contract, "depositNFT")
    const [nftInfoList, setNftInfoList] = useState<
        Array<{ contractAddress: string; tokenId: BigNumber; isListed: boolean }>
    >([])

    useEffect(() => {
        const fetchOwnedNFTs = async () => {
            if (!address) return

            const provider = new ethers.providers.JsonRpcProvider(env.rpcUrl)
            const erc721ABI = [
                "function balanceOf(address _owner) external view returns (uint256)",
                "function ownerOf(uint256 tokenId) public view returns (address)"
            ]

            const nftInfoList: Array<{ contractAddress: string; tokenId: number; isListed: boolean }> = []

            const nftContract = new ethers.Contract(nftContractAddress, erc721ABI, provider)
            const anonNftExContract = new ethers.Contract(anonNFTExContractAddress, AnonNFTEx.abi, provider)
            try {
                for (let i = 1; i <= (await nftContract.balanceOf(address)); i += 1) {
                    if ((await nftContract.ownerOf(i)) === address) {
                        const nftDeposit = await anonNftExContract.nftDeposits(nftContractAddress, i)
                        const isListed = nftDeposit.idCommitment === 0
                        nftInfoList.push({ contractAddress: nftContractAddress, tokenId: i, isListed })
                    }
                }
            } catch (error) {
                console.error(`Error fetching NFTs from contract ${nftContractAddress}:`, error)
            }

            setNftInfoList(nftInfoList)
        }

        fetchOwnedNFTs()
        const pollingIntervalId = setInterval(fetchOwnedNFTs, pollingInterval)

        return () => {
            clearInterval(pollingIntervalId)
        }
    }, [address])

    const { contract } = useContract(nftContractAddress, SimpleNFTArtifact.abi)
    const { mutateAsync, isLoading, error } = useContractWrite(contract, "mintNFT")
    const { mutateAsync: approve, isLoading: approveIsLoading, error: approveError } = useContractWrite(contract, "approve")

    const handleMint = async () => {
        try {
            await mutateAsync({ args: [address] })
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <>
            <VStack spacing={4}>
                <Box>
                    <Button colorScheme="blue" onClick={handleMint} isLoading={isLoading}>
                        Mint NFT
                    </Button>
                </Box>
                {error! && (
                    <Box>
                        <Text color="red.500">Error</Text>
                    </Box>
                )}
            </VStack>
            <Heading as="h2" size="lg" mb={4}>
                My NFTs
            </Heading>
            {identityInfo && <Textarea mt={2} value={identityInfo} isReadOnly />}
            <VStack align="start" spacing={4}>
                {nftInfoList.map((nftInfo, index) => (
                    <HStack key={index} spacing={4}>
                        <Box>
                            <Text>
                                Contract Address: <strong>{nftInfo.contractAddress}</strong>
                            </Text>
                            <Text>
                                Token ID: <strong>{nftInfo.tokenId.toString()}</strong>
                            </Text>
                        </Box>
                        <Button
                            colorScheme={nftInfo.isListed ? "gray" : "blue"}
                            isDisabled={nftInfo.isListed}
                            onClick={() => {
                                const identity = new Identity()
                                setIdentityInfo(
                                    `trapdoor: ${identity.trapdoor}\n nullifier: ${identity.nullifier}\n commitment: ${identity.commitment}`
                                )
                                depositNFTmutateAsync({
                                    args: [nftInfo.contractAddress, nftInfo.tokenId, identity.commitment.toString()]
                                })
                            }}
                        >
                            {nftInfo.isListed ? "Listed" : "List"}
                        </Button>
                        <Button
                            colorScheme={nftInfo.isListed ? "gray" : "blue"}
                            onClick={() => {
                                approve({
                                    args: [anonNFTExContractAddress, nftInfo.tokenId]
                                })
                            }}
                        >
                            {"Approve"}
                        </Button>
                    </HStack>
                ))}
            </VStack>
        </>
    )
}
