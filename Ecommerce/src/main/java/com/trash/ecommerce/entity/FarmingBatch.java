package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "farming_batches")
@Getter
@Setter
public class FarmingBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false, unique = true, length = 100)
    private String batchId;

    @Column(name = "seller_id", nullable = false)
    private Long sellerId;

    @Column(name = "batch_name", length = 255)
    private String batchName;

    @Column(name = "product_name", length = 255)
    private String productName;

    @Column(name = "crop_type", length = 100)
    private String cropType;

    @Column(name = "planted_at")
    private LocalDate plantedAt;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "harvest_at")
    private LocalDate harvestAt;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "qr_code_url", columnDefinition = "TEXT")
    private String qrCodeUrl;

    @Column(name = "qr_code_value", columnDefinition = "TEXT")
    private String qrCodeValue;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null || this.status.isBlank()) {
            this.status = "GROWING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
