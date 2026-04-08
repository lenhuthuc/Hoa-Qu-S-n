package com.trash.ecommerce.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TraceabilityResponse {
    private String batchId;
    private String productName;
    private String cropType;
    private String sellerName;
    private String origin;
    private String plantedAt;
    private String harvestAt;
    private String status;
    private String qrCodeUrl;
    private List<FarmingLogResponse> timeline;
    private int totalEntries;
}
