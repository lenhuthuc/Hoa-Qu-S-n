package com.trash.ecommerce.dto;

import com.trash.ecommerce.entity.DiscountType;
import lombok.*;

import java.math.BigDecimal;
import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class VoucherCreateDTO {
    private String code;
    private String description;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscount;
    private Integer usageLimit;
    private Date startDate;
    private Date endDate;
}
