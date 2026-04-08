package com.trash.ecommerce.dto;

import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FarmingLogRequest {
    private String batchId;
    private String note;
    private String activityType;
    private String weatherCondition;
    private Double gpsLat;
    private Double gpsLng;
    private Instant capturedAt;
}
