package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "story")
public class Story {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private Users seller;

    @Column(name = "batch_id", length = 100)
    private String batchId;

    @Column(name = "farming_log_id", length = 100)
    private String farmingLogId;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "video_url", length = 1000)
    private String videoUrl;

    @Column(name = "activity_type", length = 50)
    private String activityType;

    @Column(name = "likes_count", nullable = false)
    private Integer likesCount = 0;

    @Column(name = "is_published", nullable = false)
    private Boolean isPublished = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
