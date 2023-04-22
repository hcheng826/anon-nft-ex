/* eslint-disable @typescript-eslint/no-unused-vars */
import { Box, Button, Divider, Heading, HStack, Link, Text, useBoolean, VStack } from "@chakra-ui/react"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { BigNumber, ethers, utils } from "ethers"
import getNextConfig from "next/config"
import { useRouter } from "next/router"
import { useContractWrite, useContract, Web3Button, useAddress } from "@thirdweb-dev/react"
import { useCallback, useContext, useEffect, useState } from "react"
import SimpleNFTArtifact from "../../contract-artifacts/SimpleNFT.json"
import AnonNFTEx from "../../contract-artifacts/AnonNFTEx.json"
import LogsContext from "../context/LogsContext"
import SemaphoreContext from "../context/SemaphoreContext"
import IconAddCircleFill from "../icons/IconAddCircleFill"
import IconRefreshLine from "../icons/IconRefreshLine"

const { publicRuntimeConfig: env } = getNextConfig()
const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS || "0x0165878a594ca255338adfa4d48449f69242eb8f"
const pollingInterval = 5000 // Polling interval in milliseconds

async function fetchOwnedNFTs(userAddress: string, nftContractAddresses: string[]) {
    const provider = new ethers.providers.JsonRpcProvider(env.rpcUrl)
    const erc721ABI = [
        "function balanceOf(address _owner) external view returns (uint256)",
        "function tokenOfOwnerByIndex(address _owner, uint256 _index) external view returns (uint256)",
        "function ownerOf(uint256 tokenId) public view returns (address)"
    ]

    const nftInfoList: Array<{ contractAddress: string; tokenId: number }> = []

    for (const nftContractAddr of nftContractAddresses) {
        const nftContract = new ethers.Contract(nftContractAddr, erc721ABI, provider)
        try {
            for (let i = 1; i < 5; i += 1) {
                if ((await nftContract.ownerOf(i)) === userAddress) {
                    nftInfoList.push({ contractAddress: nftContractAddr, tokenId: i })
                }
            }
        } catch (error) {
            console.error(`Error fetching NFTs from contract ${nftContractAddr}:`, error)
        }
    }

    return nftInfoList
}

export default function ListNFTPage() {
    const router = useRouter()
    const address = useAddress()

    const [_loading, setLoading] = useBoolean()
    const [_identity, setIdentity] = useState<Identity>()
    const [nftInfoList, setNftInfoList] = useState<Array<{ contractAddress: string; tokenId: BigNumber }>>([])

    useEffect(() => {
        if (address) {
            const nftContractAddresses = [nftContractAddress]

            const fetchAndUpdateNFTs = async () => {
                const ownedNFTs = await fetchOwnedNFTs(address, nftContractAddresses)
                setNftInfoList(ownedNFTs)
            }

            fetchAndUpdateNFTs()
            const pollingIntervalId = setInterval(fetchAndUpdateNFTs, pollingInterval)

            return () => {
                clearInterval(pollingIntervalId)
            }
        }
    }, [address])

    const { contract } = useContract(nftContractAddress, SimpleNFTArtifact.abi)
    const { mutateAsync, isLoading, error } = useContractWrite(contract, "mintNFT")

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
            <VStack align="start" spacing={4}>
                {nftInfoList.map((nftInfo, index) => (
                    <Box key={index}>
                        <Text>
                            Contract Address: <strong>{nftInfo.contractAddress}</strong>
                        </Text>
                        <Text>
                            Token ID: <strong>{nftInfo.tokenId.toString()}</strong>
                        </Text>
                    </Box>
                ))}
            </VStack>
        </>
    )
}
