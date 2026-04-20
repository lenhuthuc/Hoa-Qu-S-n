package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.ReturnRequestDTO;
import com.trash.ecommerce.entity.OrderStatus;
import com.trash.ecommerce.entity.NotificationType;
import com.trash.ecommerce.entity.ReturnRequest;
import com.trash.ecommerce.entity.ReturnStatus;
import com.trash.ecommerce.repository.*;
import com.trash.ecommerce.service.EventPublisher;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.NotificationService;
import com.trash.ecommerce.service.TrustScoreService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAnalyticsController {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private ReturnRequestRepository returnRequestRepository;
    @Autowired
    private ReviewRepository reviewRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;
    @Autowired
    private TrustScoreService trustScoreService;

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview(@RequestHeader("Authorization") String token) {
        try {
            Map<String, Object> overview = new LinkedHashMap<>();
            overview.put("totalUsers", userRepository.count());
            overview.put("totalProducts", productRepository.count());

            var allOrders = orderRepository.findAll();
            overview.put("totalOrders", allOrders.size());

            BigDecimal totalRevenue = allOrders.stream()
                    .filter(o -> o.getStatus() == OrderStatus.FINISHED)
                    .map(o -> o.getTotalPrice() != null ? o.getTotalPrice() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            var allRefunds = returnRequestRepository.findAll();
            BigDecimal refundedRevenue = allRefunds.stream()
                .filter(r -> r.getStatus() == ReturnStatus.REFUNDED)
                .map(r -> r.getRefundAmount() != null ? r.getRefundAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            long refundedOrders = allRefunds.stream().filter(r -> r.getStatus() == ReturnStatus.REFUNDED).count();

            BigDecimal netRevenue = totalRevenue.subtract(refundedRevenue);
            if (netRevenue.compareTo(BigDecimal.ZERO) < 0) {
            netRevenue = BigDecimal.ZERO;
            }

            long finishedOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.FINISHED).count();

            overview.put("totalRevenue", totalRevenue);
            overview.put("netRevenue", netRevenue);
            overview.put("refundedRevenue", refundedRevenue);
            overview.put("completedOrders", finishedOrders);
            overview.put("refundedOrders", refundedOrders);

            long pendingOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.PLACED || o.getStatus() == OrderStatus.PENDING).count();
            long shippedOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.SHIPPED).count();
            long cancelledOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.CANCELLED).count();

            Map<String, Long> ordersByStatus = new LinkedHashMap<>();
            ordersByStatus.put("pending", pendingOrders);
            ordersByStatus.put("shipped", shippedOrders);
            ordersByStatus.put("finished", finishedOrders);
            ordersByStatus.put("cancelled", cancelledOrders);
            overview.put("ordersByStatus", ordersByStatus);

            overview.put("totalReviews", reviewRepository.count());

            return ResponseEntity.ok(overview);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/top-products")
    public ResponseEntity<?> getTopProducts(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            var allOrders = orderRepository.findAll();
            Map<Long, Map<String, Object>> productStats = new LinkedHashMap<>();

            allOrders.stream()
                    .filter(o -> o.getStatus() == OrderStatus.FINISHED)
                    .flatMap(o -> o.getOrderItems().stream())
                    .forEach(oi -> {
                        Long pid = oi.getProduct().getId();
                        productStats.computeIfAbsent(pid, k -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("productId", pid);
                            m.put("productName", oi.getProduct().getProductName());
                            m.put("totalSold", 0L);
                            m.put("totalRevenue", BigDecimal.ZERO);
                            return m;
                        });
                        Map<String, Object> m = productStats.get(pid);
                        m.put("totalSold", (Long) m.get("totalSold") + oi.getQuantity());
                        m.put("totalRevenue", ((BigDecimal) m.get("totalRevenue")).add(
                                oi.getPrice().multiply(BigDecimal.valueOf(oi.getQuantity()))));
                    });

            List<Map<String, Object>> sorted = productStats.values().stream()
                    .sorted((a, b) -> ((BigDecimal) b.get("totalRevenue")).compareTo((BigDecimal) a.get("totalRevenue")))
                    .limit(limit)
                    .toList();

            return ResponseEntity.ok(sorted);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/top-sellers")
    public ResponseEntity<?> getTopSellers(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            var products = productRepository.findAll();
            Map<Long, Map<String, Object>> sellerStats = new LinkedHashMap<>();

            for (var product : products) {
                if (product.getSeller() == null) continue;
                Long sellerId = product.getSeller().getId();
                sellerStats.computeIfAbsent(sellerId, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sellerId", sellerId);
                    m.put("sellerName", product.getSeller().getFullName() != null
                            ? product.getSeller().getFullName() : product.getSeller().getUsername());
                    m.put("productCount", 0);
                    m.put("totalRevenue", BigDecimal.ZERO);
                    return m;
                });
                Map<String, Object> m = sellerStats.get(sellerId);
                m.put("productCount", (Integer) m.get("productCount") + 1);
            }

                Map<Long, BigDecimal> refundedBySeller = new LinkedHashMap<>();
                returnRequestRepository.findAll().stream()
                    .filter(r -> r.getStatus() == ReturnStatus.REFUNDED && r.getSeller() != null)
                    .forEach(r -> refundedBySeller.merge(
                        r.getSeller().getId(),
                        r.getRefundAmount() != null ? r.getRefundAmount() : BigDecimal.ZERO,
                        BigDecimal::add));

            var allOrders = orderRepository.findAll();
            allOrders.stream()
                    .filter(o -> o.getStatus() == OrderStatus.FINISHED)
                    .flatMap(o -> o.getOrderItems().stream())
                    .forEach(oi -> {
                        if (oi.getProduct().getSeller() != null) {
                            Long sellerId = oi.getProduct().getSeller().getId();
                            Map<String, Object> m = sellerStats.get(sellerId);
                            if (m != null) {
                                m.put("totalRevenue", ((BigDecimal) m.get("totalRevenue")).add(
                                        oi.getPrice().multiply(BigDecimal.valueOf(oi.getQuantity()))));
                            }
                        }
                    });

            refundedBySeller.forEach((sellerId, refundAmount) -> {
                Map<String, Object> m = sellerStats.get(sellerId);
                if (m != null) {
                    BigDecimal gross = (BigDecimal) m.get("totalRevenue");
                    BigDecimal net = gross.subtract(refundAmount);
                    m.put("totalRevenue", net.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : net);
                }
            });

            List<Map<String, Object>> sorted = sellerStats.values().stream()
                    .sorted((a, b) -> ((BigDecimal) b.get("totalRevenue")).compareTo((BigDecimal) a.get("totalRevenue")))
                    .limit(limit)
                    .toList();

            return ResponseEntity.ok(sorted);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/escalated-returns")
    public ResponseEntity<?> getEscalatedReturns(@RequestHeader("Authorization") String token) {
        try {
            List<ReturnRequestDTO> rows = returnRequestRepository
                    .findByStatusOrderByCreatedAtDesc(ReturnStatus.ESCALATED)
                    .stream()
                    .map(this::toReturnRequestDTO)
                    .toList();
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/returns/{returnId}/resolve")
    public ResponseEntity<?> resolveEscalatedReturn(
            @RequestHeader("Authorization") String token,
            @PathVariable Long returnId,
            @RequestParam String action,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            Long adminId = jwtService.extractId(token);
            ReturnRequest rr = returnRequestRepository.findById(returnId)
                    .orElseThrow(() -> new RuntimeException("Return request not found"));

            if (rr.getStatus() != ReturnStatus.ESCALATED) {
                throw new RuntimeException("Only escalated return requests can be resolved by admin");
            }

            String note = body != null && body.get("note") != null ? String.valueOf(body.get("note")).trim() : "";
            if (note.isEmpty()) {
                throw new RuntimeException("Vui lòng nhập ghi chú xử lý");
            }

            String normalizedAction = action.toUpperCase(Locale.ROOT);
            switch (normalizedAction) {
                case "REFUND":
                    rr.setStatus(ReturnStatus.REFUNDED);
                    rr.setSellerResponse(buildAdminDecisionMessage(rr.getSellerResponse(), "HOAN_TIEN", note, adminId));
                    break;
                case "KEEP_REJECT":
                    rr.setStatus(ReturnStatus.REJECTED_ACCEPTED);
                    rr.setSellerResponse(buildAdminDecisionMessage(rr.getSellerResponse(), "GIU_TU_CHOI", note, adminId));
                    break;
                default:
                    throw new RuntimeException("Invalid action. Use: REFUND or KEEP_REJECT");
            }

            returnRequestRepository.save(rr);

            if ("REFUND".equals(normalizedAction)) {
                trustScoreService.recalculateTrustScore(rr.getSeller().getId());
            }

            String buyerMessage = normalizedAction.equals("REFUND")
                    ? "Admin đã duyệt hoàn tiền cho yêu cầu #" + returnId
                    : "Admin giữ quyết định từ chối cho yêu cầu #" + returnId;
            String sellerMessage = normalizedAction.equals("REFUND")
                    ? "Admin đã duyệt hoàn tiền cho yêu cầu #" + returnId
                    : "Admin giữ quyết định từ chối cho yêu cầu #" + returnId;

            notificationService.send(rr.getBuyer().getId(),
                    "Cập nhật xử lý khiếu nại",
                    buyerMessage,
                    normalizedAction.equals("REFUND") ? NotificationType.RETURN_REFUNDED : NotificationType.RETURN_REJECTED,
                    returnId);
            notificationService.send(rr.getSeller().getId(),
                    "Cập nhật xử lý khiếu nại",
                    sellerMessage,
                    normalizedAction.equals("REFUND") ? NotificationType.RETURN_REFUNDED : NotificationType.RETURN_REJECTED,
                    returnId);

            eventPublisher.publishNotification(rr.getBuyer().getId(), "Cập nhật xử lý khiếu nại", "RETURN_ADMIN_RESOLVED", returnId);
            eventPublisher.publishNotification(rr.getSeller().getId(), "Cập nhật xử lý khiếu nại", "RETURN_ADMIN_RESOLVED", returnId);

            return ResponseEntity.ok(toReturnRequestDTO(rr));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private ReturnRequestDTO toReturnRequestDTO(ReturnRequest rr) {
        ReturnRequestDTO dto = new ReturnRequestDTO();
        dto.setId(rr.getId());
        dto.setOrderId(rr.getOrder().getId());
        dto.setBuyerId(rr.getBuyer().getId());
        dto.setBuyerName(rr.getBuyer().getFullName());
        dto.setSellerId(rr.getSeller().getId());
        dto.setSellerName(rr.getSeller().getFullName());
        dto.setReasonCode(rr.getReasonCode());
        dto.setDescription(rr.getDescription());
        dto.setEvidenceUrls(rr.getEvidenceUrls());
        dto.setRefundAmount(rr.getRefundAmount());
        dto.setStatus(rr.getStatus());
        dto.setSellerResponse(rr.getSellerResponse());
        dto.setCreatedAt(rr.getCreatedAt());
        dto.setUpdatedAt(rr.getUpdatedAt());
        dto.setDeadline(rr.getDeadline());
        return dto;
    }

    private String buildAdminDecisionMessage(String existing, String decision, String note, Long adminId) {
        String prefix = existing == null || existing.isBlank() ? "" : existing.trim() + "\n\n";
        return prefix + "[Admin " + adminId + " - " + decision + "] " + note;
    }
}
