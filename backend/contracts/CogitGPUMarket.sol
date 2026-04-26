// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * CogitGPUMarket — Decentralized GPU Rental
 *
 * Flow:
 *   1. Provider registers GPU with hourly price
 *   2. Renter calls rentGPU(serviceId, hours) with MATIC payment
 *   3. MATIC goes directly to provider
 *   4. Event emitted → backend issues access credentials
 *   5. Rental tracked on-chain with end timestamp
 */
contract CogitGPUMarket {

    struct GPUService {
        address payable provider;
        string  gpuModel;
        uint256 vramGb;
        uint256 pricePerHourWei;
        uint256 minHours;
        uint256 maxHours;
        string  region;
        bool    available;
        uint256 totalHoursRented;
        uint256 totalEarned;
    }

    struct Rental {
        bytes32 serviceId;
        address renter;
        address provider;
        uint256 hours;
        uint256 amountPaid;
        uint256 startTime;
        uint256 endTime;
        bool    active;
    }

    mapping(bytes32  => GPUService) public services;
    mapping(bytes32  => Rental)     public rentals;
    mapping(address  => uint256)    public providerEarnings;
    bytes32[] public serviceList;
    bytes32[] public rentalList;

    event GPURegistered(
        bytes32 indexed serviceId,
        address indexed provider,
        string  gpuModel,
        uint256 pricePerHourWei
    );
    event GPURented(
        bytes32 indexed rentalId,
        bytes32 indexed serviceId,
        address indexed renter,
        address provider,
        uint256 hours,
        uint256 amount,
        uint256 endTime
    );
    event RentalEnded(bytes32 indexed rentalId);

    // ── Register GPU service ─────────────────────────────────────────────────
    function registerGPU(
        bytes32 serviceId,
        string  calldata gpuModel,
        uint256 vramGb,
        uint256 pricePerHourWei,
        uint256 minHours,
        uint256 maxHours,
        string  calldata region
    ) external {
        require(services[serviceId].provider == address(0), "ID taken");
        require(pricePerHourWei > 0, "Price must be > 0");
        require(maxHours >= minHours && minHours >= 1, "Invalid hours");

        services[serviceId] = GPUService({
            provider:          payable(msg.sender),
            gpuModel:          gpuModel,
            vramGb:            vramGb,
            pricePerHourWei:   pricePerHourWei,
            minHours:          minHours,
            maxHours:          maxHours,
            region:            region,
            available:         true,
            totalHoursRented:  0,
            totalEarned:       0
        });
        serviceList.push(serviceId);

        emit GPURegistered(serviceId, msg.sender, gpuModel, pricePerHourWei);
    }

    // ── Rent GPU ─────────────────────────────────────────────────────────────
    function rentGPU(bytes32 serviceId, uint256 hours) external payable returns (bytes32 rentalId) {
        GPUService storage svc = services[serviceId];
        require(svc.available,              "GPU not available");
        require(hours >= svc.minHours,      "Below minimum hours");
        require(hours <= svc.maxHours,      "Exceeds maximum hours");

        uint256 totalCost = svc.pricePerHourWei * hours;
        require(msg.value >= totalCost,     "Insufficient MATIC");

        // Direct payment to provider
        svc.provider.transfer(totalCost);
        svc.totalHoursRented += hours;
        svc.totalEarned      += totalCost;
        providerEarnings[svc.provider] += totalCost;

        // Refund excess
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        // Create rental record
        rentalId = keccak256(abi.encodePacked(serviceId, msg.sender, block.timestamp));
        uint256 endTime = block.timestamp + (hours * 3600);

        rentals[rentalId] = Rental({
            serviceId:   serviceId,
            renter:      msg.sender,
            provider:    svc.provider,
            hours:       hours,
            amountPaid:  totalCost,
            startTime:   block.timestamp,
            endTime:     endTime,
            active:      true
        });
        rentalList.push(rentalId);

        emit GPURented(rentalId, serviceId, msg.sender, svc.provider, hours, totalCost, endTime);
        return rentalId;
    }

    // ── Toggle availability ──────────────────────────────────────────────────
    function setAvailability(bytes32 serviceId, bool available) external {
        require(services[serviceId].provider == msg.sender, "Not owner");
        services[serviceId].available = available;
    }

    // ── Views ────────────────────────────────────────────────────────────────
    function getServiceCount() external view returns (uint256) { return serviceList.length; }
    function getRentalCount()  external view returns (uint256) { return rentalList.length; }

    function isRentalActive(bytes32 rentalId) external view returns (bool) {
        Rental storage r = rentals[rentalId];
        return r.active && block.timestamp < r.endTime;
    }
}
