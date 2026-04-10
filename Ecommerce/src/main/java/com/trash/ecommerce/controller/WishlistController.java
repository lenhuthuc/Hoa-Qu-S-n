package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.entity.Wishlist;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.repository.WishlistRepository;
import com.trash.ecommerce.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {

    @Autowired
    private WishlistRepository wishlistRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @GetMapping
    public ResponseEntity<?> getWishlist(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<Wishlist> items = wishlistRepository.findByUserIdOrderByCreatedAtDesc(userId);
            List<Map<String, Object>> result = items.stream().map(w -> {
                Product p = w.getProduct();
                return Map.<String, Object>of(
                        "id", w.getId(),
                        "productId", p.getId(),
                        "productName", p.getProductName(),
                        "price", p.getPrice(),
                        "image", p.getPrimaryImagePath() != null ? p.getPrimaryImagePath() : "",
                        "quantity", p.getQuantity(),
                        "addedAt", w.getCreatedAt()
                );
            }).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{productId}")
    public ResponseEntity<?> addToWishlist(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId) {
        try {
            Long userId = jwtService.extractId(token);
            if (wishlistRepository.existsByUserIdAndProductId(userId, productId)) {
                return ResponseEntity.ok(Map.of("message", "Sản phẩm đã có trong danh sách yêu thích"));
            }
            Users user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Sản phẩm không tồn tại"));

            Wishlist wishlist = new Wishlist();
            wishlist.setUser(user);
            wishlist.setProduct(product);
            wishlistRepository.save(wishlist);
            return ResponseEntity.ok(Map.of("message", "Đã thêm vào yêu thích"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{productId}")
    @Transactional
    public ResponseEntity<?> removeFromWishlist(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId) {
        try {
            Long userId = jwtService.extractId(token);
            wishlistRepository.deleteByUserIdAndProductId(userId, productId);
            return ResponseEntity.ok(Map.of("message", "Đã xoá khỏi yêu thích"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/check/{productId}")
    public ResponseEntity<?> checkWishlist(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId) {
        try {
            Long userId = jwtService.extractId(token);
            boolean exists = wishlistRepository.existsByUserIdAndProductId(userId, productId);
            return ResponseEntity.ok(Map.of("inWishlist", exists));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
