package com.trash.ecommerce.dto;

import lombok.*;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReturnRequestCreateDTO {
    private Long orderId;
    private String reasonCode;
    private String description;
    private String evidenceUrls;
    private BigDecimal refundAmount;
}
