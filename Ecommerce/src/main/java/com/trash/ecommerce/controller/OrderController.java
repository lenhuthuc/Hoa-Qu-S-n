package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.OrderMessageResponseDTO;
import com.trash.ecommerce.dto.OrderResponseDTO;
import com.trash.ecommerce.dto.OrderSummaryDTO;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.OrderService;
import com.trash.ecommerce.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
            HttpServletRequest request) {
        Long userId = jwtService.extractId(token);
        OrderResponseDTO order = orderService.createMyOrder(userId, paymentMethodId, voucherCode, userService.getClientIpAddress(request));
        return ResponseEntity.ok(order);
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