// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleNFT is ERC721, Ownable {
    uint256 private _currentTokenId = 0;

    constructor() ERC721("SimpleNFT", "SNFT") {}

    function mintNFT(address recipient) public returns (uint256) {
        _currentTokenId += 1;
        _safeMint(recipient, _currentTokenId);
        return _currentTokenId;
    }
}
