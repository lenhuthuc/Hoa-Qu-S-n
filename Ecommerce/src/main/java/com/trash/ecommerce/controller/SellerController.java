package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.SellerDashboardDTO;
import com.trash.ecommerce.dto.SellerShopSettingsResponseDTO;
import com.trash.ecommerce.dto.SellerShopSettingsUpdateRequestDTO;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.repository.OrderRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

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
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SellerApplicationRepository sellerApplicationRepository;
    @Autowired
    private StorageService storageService;

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
            List<Order> sellerOrders = orderRepository.findBySellerIdOrderByCreateAtDesc(userId);
            List<Map<String, Object>> result = sellerOrders.stream()
                .filter(o -> o.getMasterOrder() == null || !o.getMasterOrder())
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

                boolean isSellerOrder = order.getSeller() != null && order.getSeller().getId().equals(userId)
                    && (order.getMasterOrder() == null || !order.getMasterOrder());

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

            if (order.getParentOrder() != null) {
                Order parentOrder = order.getParentOrder();
                List<Order> siblings = orderRepository.findByParentOrderIdOrderByCreateAtAsc(parentOrder.getId());
                OrderStatus aggregated = aggregateParentStatus(siblings);
                parentOrder.setStatus(aggregated);
                if (aggregated == OrderStatus.FINISHED) {
                    parentOrder.setBuyerConfirmedAt(new Date());
                }
                orderRepository.save(parentOrder);
            }

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

    private OrderStatus aggregateParentStatus(List<Order> childOrders) {
        if (childOrders == null || childOrders.isEmpty()) {
            return OrderStatus.PENDING;
        }
        boolean allFinished = childOrders.stream().allMatch(o -> o.getStatus() == OrderStatus.FINISHED);
        if (allFinished) return OrderStatus.FINISHED;

        boolean anyShipped = childOrders.stream().anyMatch(o -> o.getStatus() == OrderStatus.SHIPPED);
        if (anyShipped) return OrderStatus.SHIPPED;

        boolean anyPreparing = childOrders.stream().anyMatch(o -> o.getStatus() == OrderStatus.PREPARING);
        if (anyPreparing) return OrderStatus.PREPARING;

        boolean anyPaid = childOrders.stream().anyMatch(o -> o.getStatus() == OrderStatus.PAID);
        if (anyPaid) return OrderStatus.PAID;

        boolean anyPendingPayment = childOrders.stream().anyMatch(o -> o.getStatus() == OrderStatus.PENDING_PAYMENT);
        if (anyPendingPayment) return OrderStatus.PENDING_PAYMENT;

        boolean anyPlaced = childOrders.stream().anyMatch(o -> o.getStatus() == OrderStatus.PLACED);
        if (anyPlaced) return OrderStatus.PLACED;

        boolean allCancelled = childOrders.stream().allMatch(o -> o.getStatus() == OrderStatus.CANCELLED);
        if (allCancelled) return OrderStatus.CANCELLED;

        return childOrders.get(0).getStatus();
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

    @GetMapping("/shop-settings")
    public ResponseEntity<?> getShopSettings(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người bán"));

            SellerApplication sellerApp = sellerApplicationRepository.findByUserId(userId).orElse(null);
            Address address = seller.getAddress();

            SellerShopSettingsResponseDTO dto = new SellerShopSettingsResponseDTO();
            dto.setSellerId(seller.getId());
            dto.setShopName(sellerApp != null && sellerApp.getShopName() != null ? sellerApp.getShopName() : seller.getFullName());
                dto.setAvatar(resolveMediaUrlForClient(
                    sellerApp != null && sellerApp.getShopAvatar() != null
                        ? sellerApp.getShopAvatar()
                        : seller.getAvatar()
                ));
            dto.setProvince(address != null ? address.getProvinceName() : null);
            dto.setDistrict(address != null ? address.getDistrictName() : null);
            dto.setWard(address != null ? address.getWardName() : null);
            dto.setStreetDetail(address != null ? address.getStreetDetail() : null);
            dto.setGhnProvinceId(address != null ? address.getGhnProvinceId() : null);
            dto.setGhnDistrictId(address != null ? address.getGhnDistrictId() : null);
            dto.setGhnWardCode(address != null ? address.getGhnWardCode() : null);

            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            logger.error("Error getting seller shop settings", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping(value = "/shop-settings/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadShopAvatar(
            @RequestHeader("Authorization") String token,
            @RequestPart("file") MultipartFile file) {
        try {
            Long userId = jwtService.extractId(token);
            SellerApplication sellerApp = sellerApplicationRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy hồ sơ cửa hàng"));

            String avatarUrl = storageService.uploadReviewMedia(userId, file, "image");
            sellerApp.setShopAvatar(avatarUrl);
            sellerApplicationRepository.save(sellerApp);

            return ResponseEntity.ok(Map.of("avatarUrl", resolveMediaUrlForClient(avatarUrl)));
        } catch (Exception e) {
            logger.error("Error uploading seller avatar", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/shop-settings")
    @Transactional
    public ResponseEntity<?> updateShopSettings(
            @RequestHeader("Authorization") String token,
            @RequestBody SellerShopSettingsUpdateRequestDTO request) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người bán"));

            SellerApplication sellerApp = sellerApplicationRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy hồ sơ cửa hàng"));

            if (request.getShopName() == null || request.getShopName().trim().isEmpty()) {
                throw new RuntimeException("Tên shop không được để trống");
            }

            String normalizedShopName = request.getShopName().trim();
            if (sellerApplicationRepository.existsByShopNameIgnoreCaseAndUserIdNot(normalizedShopName, userId)) {
                throw new RuntimeException("Tên shop đã được sử dụng");
            }

            sellerApp.setShopName(normalizedShopName);

            if (request.getAvatar() != null) {
                sellerApp.setShopAvatar(request.getAvatar().trim().isEmpty() ? null : request.getAvatar().trim());
            }

            boolean hasAddressPayload =
                    request.getProvince() != null ||
                    request.getDistrict() != null ||
                    request.getWard() != null ||
                    request.getStreetDetail() != null ||
                    request.getGhnProvinceId() != null ||
                    request.getGhnDistrictId() != null ||
                    request.getGhnWardCode() != null;

            if (hasAddressPayload) {
                if (request.getProvince() == null || request.getProvince().trim().isEmpty()) {
                    throw new RuntimeException("Vui lòng nhập Tỉnh/Thành phố");
                }
                if (request.getDistrict() == null || request.getDistrict().trim().isEmpty()) {
                    throw new RuntimeException("Vui lòng nhập Quận/Huyện");
                }
                if (request.getWard() == null || request.getWard().trim().isEmpty()) {
                    throw new RuntimeException("Vui lòng nhập Phường/Xã");
                }
                if (request.getGhnProvinceId() == null || request.getGhnProvinceId() <= 0) {
                    throw new RuntimeException("Thiếu mã tỉnh/thành GHN hợp lệ");
                }
                if (request.getGhnDistrictId() == null || request.getGhnDistrictId() <= 0) {
                    throw new RuntimeException("Thiếu mã quận/huyện GHN hợp lệ");
                }
                if (request.getGhnWardCode() == null || request.getGhnWardCode().trim().isEmpty()) {
                    throw new RuntimeException("Thiếu mã phường/xã GHN hợp lệ");
                }

                Address address = seller.getAddress();
                if (address == null) {
                    address = new Address();
                }

                address.setProvinceName(request.getProvince().trim());
                address.setDistrictName(request.getDistrict().trim());
                address.setWardName(request.getWard().trim());
                address.setStreetDetail(request.getStreetDetail() == null || request.getStreetDetail().trim().isEmpty() ? null : request.getStreetDetail().trim());
                address.setGhnProvinceId(request.getGhnProvinceId());
                address.setGhnDistrictId(request.getGhnDistrictId());
                address.setGhnWardCode(request.getGhnWardCode().trim());

                seller.setAddress(address);
                sellerApp.setPickupAddress(address.getFullAddress());
            }

            sellerApplicationRepository.save(sellerApp);
            userRepository.save(seller);

            SellerShopSettingsResponseDTO dto = new SellerShopSettingsResponseDTO();
            dto.setSellerId(seller.getId());
            dto.setShopName(sellerApp.getShopName());
                dto.setAvatar(resolveMediaUrlForClient(
                    sellerApp.getShopAvatar() != null ? sellerApp.getShopAvatar() : seller.getAvatar()
                ));
            dto.setProvince(seller.getAddress() != null ? seller.getAddress().getProvinceName() : null);
            dto.setDistrict(seller.getAddress() != null ? seller.getAddress().getDistrictName() : null);
            dto.setWard(seller.getAddress() != null ? seller.getAddress().getWardName() : null);
            dto.setStreetDetail(seller.getAddress() != null ? seller.getAddress().getStreetDetail() : null);
            dto.setGhnProvinceId(seller.getAddress() != null ? seller.getAddress().getGhnProvinceId() : null);
            dto.setGhnDistrictId(seller.getAddress() != null ? seller.getAddress().getGhnDistrictId() : null);
            dto.setGhnWardCode(seller.getAddress() != null ? seller.getAddress().getGhnWardCode() : null);

            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            logger.error("Error updating seller shop settings", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    private String resolveMediaUrlForClient(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }

        String value = rawUrl.trim();
        if (value.startsWith("/api/reviews/media")) {
            return value;
        }
        if (value.contains(".r2.cloudflarestorage.com/")) {
            return "/api/reviews/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value;
        }
        if (value.startsWith("local:")) {
            return "/api/reviews/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        if (value.startsWith("review-media/") || value.startsWith("reviews/")) {
            return "/api/reviews/media?url=" + URLEncoder.encode("local:" + value, StandardCharsets.UTF_8);
        }
        return value;
    }
}
