package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "trace_milestones")
@Getter
@Setter
public class TraceabilityMilestone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false, length = 100)
    private String batchId;

    @Column(name = "story_id")
    private Long storyId;

    @Column(name = "seller_id", nullable = false)
    private Long sellerId;

    @Column(name = "title", length = 300)
    private String title;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "activity_type", length = 50)
    private String activityType;

    @Column(name = "media_url", length = 1000)
    private String mediaUrl;

    @Column(name = "media_type", length = 16)
    private String mediaType;

    @Column(name = "captured_at")
    private LocalDateTime capturedAt;

    @Column(name = "gps_lat")
    private Double gpsLat;

    @Column(name = "gps_lng")
    private Double gpsLng;

    @Column(name = "metadata_missing", nullable = false)
    private Boolean metadataMissing = false;

    @Column(name = "has_audio")
    private Boolean hasAudio;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.metadataMissing == null) {
            this.metadataMissing = false;
        }
    }
}
