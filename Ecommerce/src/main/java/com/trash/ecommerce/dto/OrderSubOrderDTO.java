package com.trash.ecommerce.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.trash.ecommerce.entity.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class OrderSubOrderDTO {
    private Long id;
    private Long sellerId;
    private String sellerName;
    @JsonProperty("totalAmount")
    private BigDecimal totalPrice;
    private BigDecimal shippingFee;
    private OrderStatus status;
    @JsonProperty("items")
    private Set<CartItemDetailsResponseDTO> cartItems = new HashSet<>();
}
