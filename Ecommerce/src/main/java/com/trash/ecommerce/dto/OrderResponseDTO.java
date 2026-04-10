package com.trash.ecommerce.dto;

import java.math.BigDecimal;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.trash.ecommerce.entity.OrderStatus;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class OrderResponseDTO {
    private Long id;
    private String orderNumber;
    @JsonProperty("items")
    private Set<CartItemDetailsResponseDTO> cartItems = new HashSet<>();
    @JsonProperty("totalAmount")
    private BigDecimal totalPrice;
    private BigDecimal shippingFee;
    private OrderStatus status;
    private String address;
    private String paymentUrl;
    private Date createdAt;
    @JsonProperty("paymentMethod")
    private String paymentMethodName;
    private String viewerRole;
}
