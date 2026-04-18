package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.OrderMessageResponseDTO;
import com.trash.ecommerce.dto.OrderPreviewResponseDTO;
import com.trash.ecommerce.dto.OrderResponseDTO;
import com.trash.ecommerce.dto.OrderSummaryDTO;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.OrderService;
import com.trash.ecommerce.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private UserService userService;

    @GetMapping("/my-orders")
    public ResponseEntity<List<OrderSummaryDTO>> getMyOrders(
            @RequestHeader("Authorization") String token,
            HttpServletRequest request) {
        Long userId = jwtService.extractId(token);
        String ipAddress = userService.getClientIpAddress(request);
        List<OrderSummaryDTO> orders = orderService.getAllMyOrders(userId, ipAddress);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponseDTO> getOrderById(
            @RequestHeader("Authorization") String token,
            @PathVariable Long orderId,
            HttpServletRequest request) {
        Long userId = jwtService.extractId(token);
        String ipAddress = userService.getClientIpAddress(request);
        OrderResponseDTO orderDetail = orderService.getOrderById(userId, orderId, ipAddress);
        return ResponseEntity.ok(orderDetail);
    }

    @PostMapping("/create")
    public ResponseEntity<OrderResponseDTO> createOrder(
            @RequestHeader("Authorization") String token,
            @RequestParam(value = "paymentMethod", defaultValue = "1") Long paymentMethodId,
            @RequestParam(value = "voucherCode", required = false) String voucherCode,
            @RequestParam(value = "discountVoucherCode", required = false) String discountVoucherCode,
            @RequestParam(value = "shippingVoucherCode", required = false) String shippingVoucherCode,
            @RequestParam(value = "deliveryType", defaultValue = "STANDARD") String deliveryType,
            @RequestParam(value = "toDistrictId", required = false) String toDistrictId,
            @RequestParam(value = "toWardCode", required = false) String toWardCode,
            HttpServletRequest request) {
        Long userId = jwtService.extractId(token);
        String effectiveDiscountVoucher = (discountVoucherCode == null || discountVoucherCode.isBlank())
            ? voucherCode : discountVoucherCode;
        OrderResponseDTO order = orderService.createMyOrder(
            userId,
            paymentMethodId,
            effectiveDiscountVoucher,
            shippingVoucherCode,
            deliveryType,
            toDistrictId,
            toWardCode,
            userService.getClientIpAddress(request));
        return ResponseEntity.ok(order);
    }

    @GetMapping("/buy-now/preview")
    public ResponseEntity<OrderPreviewResponseDTO> previewBuyNowOrder(
            @RequestHeader("Authorization") String token,
            @RequestParam("productId") Long productId,
            @RequestParam(value = "quantity", defaultValue = "1") Long quantity,
            @RequestParam(value = "discountVoucherCode", required = false) String discountVoucherCode,
            @RequestParam(value = "shippingVoucherCode", required = false) String shippingVoucherCode,
            @RequestParam(value = "deliveryType", defaultValue = "STANDARD") String deliveryType,
            @RequestParam(value = "toDistrictId", required = false) String toDistrictId,
            @RequestParam(value = "toWardCode", required = false) String toWardCode) {
        Long userId = jwtService.extractId(token);
        OrderPreviewResponseDTO preview = orderService.previewBuyNowOrder(
                userId,
                productId,
                quantity,
                discountVoucherCode,
                shippingVoucherCode,
                deliveryType,
                toDistrictId,
                toWardCode
        );
        return ResponseEntity.ok(preview);
    }

    @PostMapping("/buy-now/create")
    public ResponseEntity<OrderResponseDTO> createBuyNowOrder(
            @RequestHeader("Authorization") String token,
            @RequestParam("productId") Long productId,
            @RequestParam(value = "quantity", defaultValue = "1") Long quantity,
            @RequestParam(value = "paymentMethod", defaultValue = "1") Long paymentMethodId,
            @RequestParam(value = "voucherCode", required = false) String voucherCode,
            @RequestParam(value = "discountVoucherCode", required = false) String discountVoucherCode,
            @RequestParam(value = "shippingVoucherCode", required = false) String shippingVoucherCode,
            @RequestParam(value = "deliveryType", defaultValue = "STANDARD") String deliveryType,
            @RequestParam(value = "toDistrictId", required = false) String toDistrictId,
            @RequestParam(value = "toWardCode", required = false) String toWardCode,
            HttpServletRequest request) {
        Long userId = jwtService.extractId(token);
        String effectiveDiscountVoucher = (discountVoucherCode == null || discountVoucherCode.isBlank())
                ? voucherCode : discountVoucherCode;
        OrderResponseDTO order = orderService.createBuyNowOrder(
                userId,
                productId,
                quantity,
                paymentMethodId,
                effectiveDiscountVoucher,
                shippingVoucherCode,
                deliveryType,
                toDistrictId,
                toWardCode,
                userService.getClientIpAddress(request)
        );
        return ResponseEntity.ok(order);
    }

        @GetMapping("/preview")
        public ResponseEntity<OrderPreviewResponseDTO> previewOrder(
            @RequestHeader("Authorization") String token,
            @RequestParam(value = "discountVoucherCode", required = false) String discountVoucherCode,
            @RequestParam(value = "shippingVoucherCode", required = false) String shippingVoucherCode,
            @RequestParam(value = "deliveryType", defaultValue = "STANDARD") String deliveryType,
            @RequestParam(value = "toDistrictId", required = false) String toDistrictId,
            @RequestParam(value = "toWardCode", required = false) String toWardCode) {
        Long userId = jwtService.extractId(token);
        OrderPreviewResponseDTO preview = orderService.previewMyOrder(
            userId,
            discountVoucherCode,
            shippingVoucherCode,
            deliveryType,
            toDistrictId,
            toWardCode
        );
        return ResponseEntity.ok(preview);
        }

        @PostMapping("/{orderId}/retry-payment")
        public ResponseEntity<Map<String, String>> retryPayment(
            @RequestHeader("Authorization") String token,
            @PathVariable Long orderId,
            HttpServletRequest request) {
        Long userId = jwtService.extractId(token);
        String paymentUrl = orderService.retryPendingPayment(userId, orderId, userService.getClientIpAddress(request));
        return ResponseEntity.ok(Map.of("paymentUrl", paymentUrl));
        }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<OrderMessageResponseDTO> updateOrderStatus(
            @RequestHeader("Authorization") String token,
            @PathVariable Long orderId,
            @RequestParam String status) {
        Long userId = jwtService.extractId(token);
        OrderMessageResponseDTO response = orderService.updateBuyerOrderStatus(userId, orderId, status);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{orderId}")
    public ResponseEntity<OrderMessageResponseDTO> deleteOrder(
            @RequestHeader("Authorization") String token,
            @PathVariable Long orderId) {
        Long userId = jwtService.extractId(token);
        OrderMessageResponseDTO response = orderService.deleteOrder(userId, orderId);
        return ResponseEntity.ok(response);
    }
}