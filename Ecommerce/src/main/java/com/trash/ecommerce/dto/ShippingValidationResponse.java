package com.trash.ecommerce.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShippingValidationResponse {
    private Long productId;
    private String productName;
    private Integer shelfLifeDays;
    private List<ShippingOption> availableMethods;
    private List<ShippingOption> disabledMethods;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShippingOption {
        private String carrier;
        private String serviceName;
        private Integer estimatedDays;
        private Long fee;
        private boolean compatible;
        private String reason;
    }
}
