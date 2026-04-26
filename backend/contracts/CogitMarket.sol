// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * CogitMarket — AI Agent API Marketplace
 *
 * Deploy to Polygon Amoy testnet (free):
 *   1. Install Hardhat:  npm install -g hardhat
 *   2. Deploy:           npx hardhat run scripts/deploy.js --network amoy
 *   3. Set env var:      COGIT_CONTRACT=<deployed_address>
 *
 * Or use Remix IDE (remix.ethereum.org) → free, no setup needed.
 * Set environment to "Injected Provider - MetaMask" and deploy on Amoy testnet.
 */
contract CogitMarket {

    struct Service {
        address payable provider;
        uint256  priceWei;        // price per API call in wei (MATIC)
        string   name;
        string   description;
        string   endpointUrl;
        string   domain;
        bool     active;
        uint256  totalCalls;
        uint256  totalEarned;     // wei
    }

    mapping(bytes32  => Service) public services;
    mapping(address  => uint256) public reputation;     // 0-100, set by community
    mapping(address  => uint256) public totalEarned;    // cumulative wei per provider
    bytes32[] public serviceList;

    event ServiceRegistered(
        bytes32 indexed serviceId,
        address indexed provider,
        uint256 priceWei,
        string  name,
        string  domain
    );
    event CallPaid(
        bytes32 indexed serviceId,
        address indexed caller,
        address indexed provider,
        uint256 amount,
        uint256 totalCalls
    );
    event Rated(address indexed provider, uint256 score, address indexed ratedBy);
    event ServiceDeactivated(bytes32 indexed serviceId);

    // ── Service registration ────────────────────────────────────────────────
    function registerService(
        bytes32 serviceId,
        uint256 priceWei,
        string calldata name,
        string calldata description,
        string calldata endpointUrl,
        string calldata domain
    ) external {
        require(services[serviceId].provider == address(0), "ID taken");
        require(priceWei > 0, "Price must be > 0");

        services[serviceId] = Service({
            provider:    payable(msg.sender),
            priceWei:    priceWei,
            name:        name,
            description: description,
            endpointUrl: endpointUrl,
            domain:      domain,
            active:      true,
            totalCalls:  0,
            totalEarned: 0
        });
        serviceList.push(serviceId);

        emit ServiceRegistered(serviceId, msg.sender, priceWei, name, domain);
    }

    // ── Pay for one API call ────────────────────────────────────────────────
    function payForCall(bytes32 serviceId) external payable returns (bool) {
        Service storage svc = services[serviceId];
        require(svc.active,              "Service inactive");
        require(msg.value >= svc.priceWei, "Insufficient MATIC");

        // Direct transfer to provider — no escrow risk
        svc.provider.transfer(svc.priceWei);
        svc.totalCalls++;
        svc.totalEarned  += svc.priceWei;
        totalEarned[svc.provider] += svc.priceWei;

        // Refund excess
        uint256 excess = msg.value - svc.priceWei;
        if (excess > 0) payable(msg.sender).transfer(excess);

        emit CallPaid(serviceId, msg.sender, svc.provider, svc.priceWei, svc.totalCalls);
        return true;
    }

    // ── Community reputation rating ─────────────────────────────────────────
    function rate(address provider, uint256 score) external {
        require(score <= 100, "Score must be 0-100");
        reputation[provider] = score;
        emit Rated(provider, score, msg.sender);
    }

    // ── Provider can deactivate their service ───────────────────────────────
    function deactivate(bytes32 serviceId) external {
        require(services[serviceId].provider == msg.sender, "Not owner");
        services[serviceId].active = false;
        emit ServiceDeactivated(serviceId);
    }

    // ── Views ───────────────────────────────────────────────────────────────
    function getServiceCount() external view returns (uint256) {
        return serviceList.length;
    }

    function getService(bytes32 serviceId) external view returns (
        address provider, uint256 priceWei, string memory name,
        bool active, uint256 totalCalls, uint256 totalEarnedWei
    ) {
        Service storage s = services[serviceId];
        return (s.provider, s.priceWei, s.name, s.active, s.totalCalls, s.totalEarned);
    }
}
