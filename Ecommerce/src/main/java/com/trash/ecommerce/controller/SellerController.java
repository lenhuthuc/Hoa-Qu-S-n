package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.SellerDashboardDTO;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.repository.OrderRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/seller")
public class SellerController {

    private static final Logger logger = LoggerFactory.getLogger(SellerController.class);

    @Autowired
    private JwtService jwtService;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private SellerDashboardService sellerDashboardService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;
    @Autowired
    private TrustScoreService trustScoreService;
    @Autowired
    private AgriCoinService agriCoinService;

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            SellerDashboardDTO dto = sellerDashboardService.getDashboard(userId);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            logger.error("Error getting seller dashboard", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/products")
    public ResponseEntity<?> getMyProducts(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<Product> products = productRepository.findBySellerId(userId);
            List<Map<String, Object>> result = products.stream().map(p -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", p.getId());
                map.put("productName", p.getProductName());
                map.put("price", p.getPrice());
                map.put("quantity", p.getQuantity());
                map.put("rating", p.getRating());
                map.put("ratingCount", p.getRatingCount());
                map.put("category", p.getCategory() != null ? p.getCategory().getName() : null);
                map.put("description", p.getDescription());
                map.put("shelfLifeDays", p.getShelfLifeDays());
                map.put("batchId", p.getBatchId());
                map.put("origin", p.getOrigin());
                map.put("isVisible", p.getIsVisible() != null ? p.getIsVisible() : true);
                map.put("imageUrl", p.getPrimaryImagePath() != null ? "/api/products/" + p.getId() + "/img" : null);
                return map;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error getting seller products", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/products/{productId}")
    @Transactional
    public ResponseEntity<?> deleteProduct(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId) {
        try {
            Long userId = jwtService.extractId(token);
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Product not found"));

            if (product.getSeller() == null || !product.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "You can only delete your own products"));
            }

            // Check if product has active orders
            boolean hasActiveOrders = product.getOrderItems().stream()
                    .anyMatch(oi -> {
                        OrderStatus status = oi.getOrder().getStatus();
                        return status == OrderStatus.PLACED || status == OrderStatus.PAID || status == OrderStatus.SHIPPED;
                    });

            if (hasActiveOrders) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Không thể xóa sản phẩm đang có đơn hàng chưa hoàn thành. Hãy ẩn sản phẩm thay vì xóa."));
            }

            productRepository.delete(product);
            return ResponseEntity.ok(Map.of("message", "Product deleted successfully"));
        } catch (Exception e) {
            logger.error("Error deleting product", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/products/{productId}/stock")
    @Transactional
    public ResponseEntity<?> updateStock(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId,
            @RequestParam Long quantity) {
        try {
            Long userId = jwtService.extractId(token);
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Product not found"));

            if (product.getSeller() == null || !product.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "You can only update your own products"));
            }

            if (quantity < 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Quantity cannot be negative"));
            }

            product.setQuantity(quantity);
            productRepository.save(product);
            return ResponseEntity.ok(Map.of("message", "Stock updated successfully", "quantity", quantity));
        } catch (Exception e) {
            logger.error("Error updating stock", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getSellerOrders(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<Product> products = productRepository.findBySellerId(userId);
            Set<Long> productIds = products.stream().map(Product::getId).collect(Collectors.toSet());

            List<Order> allOrders = orderRepository.findAll();
            List<Map<String, Object>> result = allOrders.stream()
                    .filter(o -> o.getOrderItems().stream()
                            .anyMatch(oi -> productIds.contains(oi.getProduct().getId())))
                    .sorted((a, b) -> b.getCreateAt().compareTo(a.getCreateAt()))
                    .map(o -> {
                        Map<String, Object> map = new LinkedHashMap<>();
                        map.put("orderId", o.getId());
                        map.put("status", o.getStatus());
                        map.put("totalPrice", o.getTotalPrice());
                        map.put("createdAt", o.getCreateAt());
                        map.put("buyerName", o.getUser() != null ? (o.getUser().getFullName() != null ? o.getUser().getFullName() : o.getUser().getEmail()) : "N/A");
                        map.put("address", o.getAddress() != null ? o.getAddress().getFullAddress() : "N/A");
                        map.put("items", o.getOrderItems().stream()
                                .filter(oi -> productIds.contains(oi.getProduct().getId()))
                                .map(oi -> {
                                    Map<String, Object> item = new LinkedHashMap<>();
                                    item.put("productId", oi.getProduct().getId());
                                    item.put("productName", oi.getProduct().getProductName());
                                    item.put("quantity", oi.getQuantity());
                                    item.put("price", oi.getPrice());
                                    return item;
                                }).collect(Collectors.toList()));
                        return map;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error getting seller orders", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/orders/{orderId}/status")
    @Transactional
    public ResponseEntity<?> updateOrderStatus(
            @RequestHeader("Authorization") String token,
            @PathVariable Long orderId,
            @RequestParam String status) {
        try {
            Long userId = jwtService.extractId(token);
            Order order = orderRepository.findById(orderId)
                    .orElseThrow(() -> new RuntimeException("Order not found"));

            // Verify seller owns products in this order
            List<Product> sellerProducts = productRepository.findBySellerId(userId);
            Set<Long> sellerProductIds = sellerProducts.stream().map(Product::getId).collect(Collectors.toSet());
            boolean isSellerOrder = order.getOrderItems().stream()
                    .anyMatch(oi -> sellerProductIds.contains(oi.getProduct().getId()));

            if (!isSellerOrder) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "This order does not contain your products"));
            }

            OrderStatus newStatus;
            try {
                newStatus = OrderStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Invalid status: " + status));
            }

            // Validate status transitions
            OrderStatus currentStatus = order.getStatus();
            boolean validTransition = isValidTransition(currentStatus, newStatus);
            if (!validTransition) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Invalid status transition from " + currentStatus + " to " + newStatus));
            }

            order.setStatus(newStatus);
            orderRepository.save(order);

            // Send notification to buyer about status change
            Long buyerId = order.getUser().getId();
            String buyerMsg = getStatusMessage(newStatus, order.getId());
            NotificationType notifType = getNotificationType(newStatus);
            notificationService.send(buyerId, "Cập nhật đơn hàng #" + order.getId(), buyerMsg, notifType, order.getId());

            // Push real-time update via Redis → gateway WebSocket
            eventPublisher.publishOrderUpdate(buyerId, order.getId(), newStatus.name(), buyerMsg);

            // If order finished → recalculate trust score + reward buyer coins
            if (newStatus == OrderStatus.FINISHED) {
                trustScoreService.recalculateTrustScore(userId);
                try {
                    agriCoinService.reward(buyerId, 5, "ORDER_REWARD",
                        "Thưởng hoàn thành đơn hàng #" + order.getId(), order.getId());
                } catch (Exception ignored) {}
            }

            // If order cancelled → notify
            if (newStatus == OrderStatus.CANCELLED) {
                trustScoreService.recalculateTrustScore(userId);
            }

            return ResponseEntity.ok(Map.of("message", "Order status updated", "newStatus", newStatus));
        } catch (Exception e) {
            logger.error("Error updating order status", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    private boolean isValidTransition(OrderStatus from, OrderStatus to) {
        if (from == OrderStatus.PLACED && to == OrderStatus.PREPARING) return true;
        if (from == OrderStatus.PAID && to == OrderStatus.PREPARING) return true;
        if (from == OrderStatus.PREPARING && to == OrderStatus.SHIPPED) return true;
        if (from == OrderStatus.PLACED && to == OrderStatus.SHIPPED) return true;
        if (from == OrderStatus.PAID && to == OrderStatus.SHIPPED) return true;
        if (from == OrderStatus.SHIPPED && to == OrderStatus.FINISHED) return true;
        if (from == OrderStatus.PLACED && to == OrderStatus.CANCELLED) return true;
        if (from == OrderStatus.PREPARING && to == OrderStatus.CANCELLED) return true;
        return false;
    }

    private String getStatusMessage(OrderStatus status, Long orderId) {
        return switch (status) {
            case PREPARING -> "Đơn hàng #" + orderId + " đang được đóng gói";
            case SHIPPED -> "Đơn hàng #" + orderId + " đã được giao cho đơn vị vận chuyển";
            case FINISHED -> "Đơn hàng #" + orderId + " đã hoàn thành. Cảm ơn bạn!";
            case CANCELLED -> "Đơn hàng #" + orderId + " đã bị hủy";
            default -> "Đơn hàng #" + orderId + " đã cập nhật trạng thái: " + status;
        };
    }

    private NotificationType getNotificationType(OrderStatus status) {
        return switch (status) {
            case SHIPPED -> NotificationType.ORDER_SHIPPED;
            case FINISHED -> NotificationType.ORDER_COMPLETED;
            case CANCELLED -> NotificationType.ORDER_CANCELLED;
            default -> NotificationType.SYSTEM;
        };
    }

    @PutMapping("/products/{productId}/visibility")
    @Transactional
    public ResponseEntity<?> toggleVisibility(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId) {
        try {
            Long userId = jwtService.extractId(token);
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Product not found"));

            if (product.getSeller() == null || !product.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "You can only update your own products"));
            }

            boolean newVisibility = !Boolean.TRUE.equals(product.getIsVisible());
            product.setIsVisible(newVisibility);
            productRepository.save(product);

            return ResponseEntity.ok(Map.of(
                    "message", newVisibility ? "Sản phẩm đã hiển thị" : "Sản phẩm đã ẩn",
                    "isVisible", newVisibility
            ));
        } catch (Exception e) {
            logger.error("Error toggling product visibility", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
