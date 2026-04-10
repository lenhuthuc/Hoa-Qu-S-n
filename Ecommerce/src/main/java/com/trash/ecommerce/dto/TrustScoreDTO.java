package com.trash.ecommerce.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TrustScoreDTO {
    private Long sellerId;
    private String sellerName;
    private BigDecimal score;
    private Integer totalReviews;
    private BigDecimal avgRating;
    private Integer totalOrdersSold;
    private Integer successfulOrders;
    private Integer cancelledOrders;
    private Integer returnRequests;
    private BigDecimal onTimeDeliveryRate;
    private String badge;
    private LocalDateTime updatedAt;
}
