// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AnonNFTEx is ReentrancyGuard {
    ISemaphore public semaphore;

    enum GroupIds {
        NftSold,
        EthDeposited
    }

    uint public constant NFT_SOLD_GROUP_ID = 1;
    uint public constant ETH_DEPOSITED_GROUP_ID = 2;

    struct NFTDeposit {
        address sellerAddr;
        uint idCommitment;
    }

    // Mapping of NFT addresses to their deposits
    // nft contract addr -> tokenId -> idcommitment/holder addr
    mapping(address => mapping(uint256 => NFTDeposit)) public nftDeposits;

    // Mapping of user identityCommitments to their ETH deposit status
    // holder addr -> identity
    mapping(address => uint) public ethDeposits;

    constructor(address semaphoreAddress) {
        semaphore = ISemaphore(semaphoreAddress);

        semaphore.createGroup(NFT_SOLD_GROUP_ID, 20, address(this));
        semaphore.createGroup(ETH_DEPOSITED_GROUP_ID, 20, address(this));
    }

    function depositNFT(
        address nftAddress,
        uint256 tokenId,
        uint256 identityCommitment
    ) external nonReentrant {
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "You do not own this NFT");

        nft.transferFrom(msg.sender, address(this), tokenId);
        nftDeposits[nftAddress][tokenId] = NFTDeposit({
            sellerAddr: msg.sender,
            idCommitment: identityCommitment
        });
    }

    // Original depositer can withdraw the NFT before it's sold
    function withdrawNFT(
        address nftAddress,
        uint256 tokenId
    ) external nonReentrant {
        require(
            nftDeposits[nftAddress][tokenId].sellerAddr == msg.sender,
            "only depositor can withdraw, or NFT not deposited"
        );

        IERC721 nft = IERC721(nftAddress);
        nft.safeTransferFrom(address(this), msg.sender, tokenId);
        nftDeposits[nftAddress][tokenId] = NFTDeposit({
            sellerAddr: address(0),
            idCommitment: 0
        });
    }

    function depositETH(
        uint256 identityCommitment
    ) external payable nonReentrant {
        require(msg.value == 0.1 ether, "Deposit must be exactly 0.1 ETH");
        require(ethDeposits[msg.sender] == 0, "ETH deposit already made");
        ethDeposits[msg.sender] = identityCommitment;
        semaphore.addMember(ETH_DEPOSITED_GROUP_ID, identityCommitment);
    }

    // Original depositer can withdraw the NFT before its spent
    // (Note: had a thought about making withdraw anonymous, but then deposit and withdraw itself becomes another project)
    function withdrawETH(
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external nonReentrant {
        require(ethDeposits[msg.sender] != 0, "No ETH deposit found");

        ethDeposits[msg.sender] = 0;
        // TODO: need to remove the user from the group, or nullify the deposit
        semaphore.verifyProof(
            ETH_DEPOSITED_GROUP_ID,
            merkleTreeRoot,
            0,
            nullifierHash,
            ETH_DEPOSITED_GROUP_ID,
            proof
        );

        (bool success, ) = msg.sender.call{value: 0.1 ether}("");
        require(success, "ETH transfer failed");
    }

    // call by NFT buyer, who has deposited ETH
    function buyAndClaimNFT(
        address nftAddr,
        uint tokenId,
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256[8] calldata proof,
        address nftRecipient
    ) external nonReentrant {
        require(
            nftDeposits[nftAddr][tokenId].sellerAddr != address(0) &&
                nftDeposits[nftAddr][tokenId].idCommitment != 0,
            "NFT not deposited or has been sold"
        );

        uint signal = uint256(keccak256(abi.encodePacked(nftAddr, tokenId)));

        semaphore.verifyProof(
            ETH_DEPOSITED_GROUP_ID,
            merkleTreeRoot,
            signal,
            nullifierHash,
            ETH_DEPOSITED_GROUP_ID,
            proof
        );

        semaphore.addMember(
            NFT_SOLD_GROUP_ID,
            nftDeposits[nftAddr][tokenId].idCommitment
        );

        nftDeposits[nftAddr][tokenId] = NFTDeposit({
            sellerAddr: address(0),
            idCommitment: 0
        });

        IERC721(nftAddr).safeTransferFrom(address(this), nftRecipient, tokenId);
    }

    // call by NFT seller, submit proof that it is in the group of NFT sold
    function claimETH(
        address ethRecipient,
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external nonReentrant {
        semaphore.verifyProof(
            NFT_SOLD_GROUP_ID,
            merkleTreeRoot,
            uint256(uint160(ethRecipient)),
            nullifierHash,
            NFT_SOLD_GROUP_ID,
            proof
        );

        (bool success, ) = ethRecipient.call{value: 0.1 ether}("");
        require(success, "ETH transfer failed");
    }
}
