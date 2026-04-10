package com.trash.ecommerce.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class OrderSummaryDTO {
    private Long id;
    @JsonProperty("createdAt")
    private Date createAt;
    private String status;      // Trả về String cho FE dễ hiển thị
    @JsonProperty("totalAmount")
    private BigDecimal totalPrice;
    private BigDecimal shippingFee;
    @JsonProperty("paymentMethod")
    private String paymentMethodName; // "Tiền mặt" hoặc "VNPay"
    private String paymentUrl; // Vẫn cần cái này để hiện nút "Thanh toán lại"
    private int totalItems;    // Số lượng món (VD: "5 sản phẩm")
}
