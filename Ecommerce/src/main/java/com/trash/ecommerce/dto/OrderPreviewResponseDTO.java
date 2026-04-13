package com.trash.ecommerce.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class OrderPreviewResponseDTO {
    private BigDecimal subtotal;
    private BigDecimal shippingFee;
    private BigDecimal discountAmount;
    private BigDecimal shippingDiscountAmount;
    private BigDecimal totalAmount;
    private String deliveryType;
    private List<String> availableDeliveryTypes = new ArrayList<>();
    private List<String> shippingWarnings = new ArrayList<>();
    private boolean canCheckout;
}
