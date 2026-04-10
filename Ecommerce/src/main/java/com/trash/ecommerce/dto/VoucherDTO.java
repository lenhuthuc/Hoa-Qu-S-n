package com.trash.ecommerce.dto;

import com.trash.ecommerce.entity.DiscountType;
import lombok.*;

import java.math.BigDecimal;
import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class VoucherDTO {
    private Long id;
    private String code;
    private String description;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscount;
    private Integer usageLimit;
    private Integer usedCount;
    private Date startDate;
    private Date endDate;
    private Boolean isActive;
    private Long sellerId;
    private String sellerName;
}
