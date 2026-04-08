package com.trash.ecommerce.controller;

import com.trash.ecommerce.service.CartItemService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/internal/orders")
public class InternalOrderController {

    private static final Logger logger = LoggerFactory.getLogger(InternalOrderController.class);

    @Autowired
    private CartItemService cartItemService;

    @PostMapping("/live")
    public ResponseEntity<?> receiveLiveOrder(@RequestBody Map<String, Object> payload) {
        try {
            Long buyerId = Long.valueOf(payload.get("buyerId").toString());
            Long productId = Long.valueOf(payload.get("productId").toString());
            Long quantity = Long.valueOf(payload.get("quantity").toString());

            logger.info("Received live order from Gateway: buyerId={}, productId={}, quantity={}", buyerId, productId, quantity);

            // Xử lý đơn hàng từ luồng livestream 
            // Bước 1: Thêm nhanh vào giỏ hàng của user
            cartItemService.updateQuantityCartItem(buyerId, quantity, productId);

            return ResponseEntity.ok(Map.of("success", true, "message", "Live order processed successfully"));
        } catch (Exception e) {
            logger.error("Error processing live order", e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}
