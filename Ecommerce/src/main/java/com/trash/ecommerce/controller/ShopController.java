package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.SellerApplication;
import com.trash.ecommerce.entity.TrustScore;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.ReviewRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.TrustScoreRepository;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shop")
public class ShopController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TrustScoreRepository trustScoreRepository;

    @Autowired
    private SellerApplicationRepository sellerApplicationRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @GetMapping("/{sellerId}")
    public ResponseEntity<?> getShopProfile(@PathVariable Long sellerId) {
        try {
            Users seller = userRepository.findById(sellerId)
                    .orElseThrow(() -> new RuntimeException("Nông hộ không tồn tại"));

            Map<String, Object> profile = new HashMap<>();
            profile.put("sellerId", seller.getId());
            profile.put("sellerName", seller.getFullName());
            profile.put("avatar", seller.getAvatar());
            profile.put("phone", seller.getPhone());

            // Get shop name from SellerApplication
            SellerApplication sellerApp = sellerApplicationRepository.findByUserId(seller.getId()).orElse(null);
            if (sellerApp != null && sellerApp.getShopName() != null) {
                profile.put("shopName", sellerApp.getShopName());
            } else {
                profile.put("shopName", seller.getFullName());
            }

            if (seller.getAddress() != null) {
                profile.put("province", seller.getAddress().getProvince());
                profile.put("district", seller.getAddress().getDistrict());
            }

            // Trust score
            TrustScore ts = trustScoreRepository.findBySellerId(sellerId).orElse(null);
            if (ts != null) {
                Map<String, Object> trust = new HashMap<>();
                trust.put("score", ts.getScore());
                trust.put("badge", ts.getBadge());
                trust.put("avgRating", ts.getAvgRating());
                trust.put("totalReviews", ts.getTotalReviews());
                trust.put("successfulOrders", ts.getSuccessfulOrders());
                profile.put("trustScore", trust);
            }

            // Products
            List<Product> products = productRepository.findBySellerId(sellerId);
            List<Map<String, Object>> productList = products.stream().map(p -> {
                Map<String, Object> pm = new HashMap<>();
                pm.put("id", p.getId());
                pm.put("productName", p.getProductName());
                pm.put("price", p.getPrice());
                pm.put("image", p.getPrimaryImagePath());
                pm.put("rating", p.getRating());
                pm.put("ratingCount", p.getRatingCount());
                pm.put("quantity", p.getQuantity());
                return pm;
            }).collect(Collectors.toList());
            profile.put("products", productList);
            profile.put("totalProducts", products.size());

            return ResponseEntity.ok(profile);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
