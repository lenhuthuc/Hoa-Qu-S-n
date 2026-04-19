package com.trash.ecommerce.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SellerDashboardDTO {
    private BigDecimal totalRevenue;
    private BigDecimal netRevenue;
    private BigDecimal refundedRevenue;
    private Integer totalOrders;
    private Integer pendingOrders;
    private Integer shippedOrders;
    private Integer completedOrders;
    private Integer refundedOrders;
    private Integer cancelledOrders;
    private Integer totalProducts;
    private BigDecimal cancelRate;
    private List<TopProductDTO> topProducts;
    private TrustScoreDTO trustScore;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class TopProductDTO {
        private Long productId;
        private String productName;
        private Long totalSold;
        private BigDecimal totalRevenue;
        private String imageUrl;
    }
}
