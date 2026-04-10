package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "trust_score")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class TrustScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", unique = true, nullable = false)
    private Users seller;

    @Column(name = "score", precision = 4, scale = 2, nullable = false)
    private BigDecimal score = new BigDecimal("5.00");

    @Column(name = "total_reviews")
    private Integer totalReviews = 0;

    @Column(name = "avg_rating", precision = 3, scale = 1)
    private BigDecimal avgRating = BigDecimal.ZERO;

    @Column(name = "total_orders_sold")
    private Integer totalOrdersSold = 0;

    @Column(name = "successful_orders")
    private Integer successfulOrders = 0;

    @Column(name = "cancelled_orders")
    private Integer cancelledOrders = 0;

    @Column(name = "return_requests")
    private Integer returnRequests = 0;

    @Column(name = "on_time_delivery_rate", precision = 5, scale = 2)
    private BigDecimal onTimeDeliveryRate = new BigDecimal("100.00");

    @Column(name = "badge", length = 50)
    private String badge;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
