package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.OrderMessageResponseDTO;
import com.trash.ecommerce.dto.OrderPreviewResponseDTO;
import com.trash.ecommerce.dto.OrderResponseDTO;
import com.trash.ecommerce.dto.OrderSummaryDTO;

import java.util.List;

public interface OrderService {
    public List<OrderSummaryDTO> getAllMyOrders(Long userId, String IpAddress);
    public OrderResponseDTO getOrderById(Long userId, Long orderId, String IpAddress);
    public OrderPreviewResponseDTO previewMyOrder(Long userId, String discountVoucherCode, String shippingVoucherCode,
                                                  String deliveryType, String toDistrictId, String toWardCode);
    public OrderPreviewResponseDTO previewBuyNowOrder(Long userId, Long productId, Long quantity,
                                                      String discountVoucherCode, String shippingVoucherCode,
                                                      String deliveryType, String toDistrictId, String toWardCode);
    public List<OrderResponseDTO> createMyOrder(Long userId, Long paymentMethodId, String discountVoucherCode,
                                                String shippingVoucherCode, String deliveryType,
                                                String toDistrictId, String toWardCode, String IpAddress);
    public OrderResponseDTO createBuyNowOrder(Long userId, Long productId, Long quantity, Long paymentMethodId,
                                              String discountVoucherCode, String shippingVoucherCode,
                                              String deliveryType, String toDistrictId, String toWardCode,
                                              String IpAddress);
    public String retryPendingPayment(Long userId, Long orderId, String IpAddress);
    public void expirePendingPayments();
    public OrderMessageResponseDTO deleteOrder(Long userId, Long orderId);
    public OrderMessageResponseDTO updateBuyerOrderStatus(Long userId, Long orderId, String status);

}
