package com.trash.ecommerce.dto;

import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FarmingLogResponse {
    private String id;
    private String title;
    private String batchId;
    private Long sellerId;
    private String imageUrl;
    private String videoUrl;
    private String mediaType;
    private String note;
    private Double gpsLat;
    private Double gpsLng;
    private Instant capturedAt;
    private Instant createdAt;
    private String weatherCondition;
    private String activityType;
}
