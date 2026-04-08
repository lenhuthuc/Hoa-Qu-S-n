package com.trash.ecommerce.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

@Document(collection = "farming_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FarmingLog {

    @Id
    private String id;

    @Indexed
    private String batchId;

    @Indexed
    private Long sellerId;

    private String imageUrl;

    private String videoUrl;

    private String note;

    private Double gpsLat;

    private Double gpsLng;

    private Instant capturedAt;

    private Instant createdAt;

    private String weatherCondition;

    private String activityType; // PLANTING, WATERING, FERTILIZING, PEST_CONTROL, HARVESTING, OTHER
}
