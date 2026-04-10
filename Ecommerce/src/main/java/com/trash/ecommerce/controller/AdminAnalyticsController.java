package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.OrderStatus;
import com.trash.ecommerce.repository.*;
import com.trash.ecommerce.service.JwtService;
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
    private ReviewRepository reviewRepository;
    @Autowired
    private JwtService jwtService;

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
            overview.put("totalRevenue", totalRevenue);

            long pendingOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.PLACED || o.getStatus() == OrderStatus.PENDING).count();
            long shippedOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.SHIPPED).count();
            long finishedOrders = allOrders.stream().filter(o -> o.getStatus() == OrderStatus.FINISHED).count();
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

            List<Map<String, Object>> sorted = sellerStats.values().stream()
                    .sorted((a, b) -> ((BigDecimal) b.get("totalRevenue")).compareTo((BigDecimal) a.get("totalRevenue")))
                    .limit(limit)
                    .toList();

            return ResponseEntity.ok(sorted);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
