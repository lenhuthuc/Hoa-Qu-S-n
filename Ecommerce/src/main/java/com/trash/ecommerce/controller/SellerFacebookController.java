package com.trash.ecommerce.controller;

import com.trash.ecommerce.service.FacebookIntegrationService;
import com.trash.ecommerce.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/seller/facebook")
public class SellerFacebookController {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private FacebookIntegrationService facebookService;

    @GetMapping("/oauth-url")
    public ResponseEntity<?> getOAuthUrl(@RequestHeader("Authorization") String token,
                                         @RequestParam String redirectUri) {
        try {
            Long sellerId = jwtService.extractId(token);
            String state = "seller-" + sellerId + "-" + System.currentTimeMillis();
            String url = facebookService.buildOAuthUrl(redirectUri, state);
            return ResponseEntity.ok(Map.of("oauthUrl", url, "state", state));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "FACEBOOK_NOT_CONFIGURED",
                "message", e.getMessage() + " - Liên hệ admin để cấu hình Facebook App"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/oauth/callback")
    public ResponseEntity<?> handleOAuthCallback(@RequestHeader("Authorization") String token,
                                                 @RequestParam String code,
                                                 @RequestParam String redirectUri) {
        Long sellerId = jwtService.extractId(token);
        List<Map<String, Object>> pages = facebookService.exchangeCodeAndStorePageTokens(sellerId, code, redirectUri);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("connectedPages", pages);
        result.put("message", pages.isEmpty() ? "Đã xác thực nhưng chưa lấy được Page" : "Đã kết nối Facebook Page thành công");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/pages")
    public ResponseEntity<?> getConnectedPages(@RequestHeader("Authorization") String token) {
        Long sellerId = jwtService.extractId(token);
        return ResponseEntity.ok(facebookService.listConnectedPages(sellerId));
    }

    @GetMapping("/check-connected")
    public ResponseEntity<?> checkFacebookConnected(@RequestHeader("Authorization") String token) {
        Long sellerId = jwtService.extractId(token);
        List<Map<String, Object>> pages = facebookService.listConnectedPages(sellerId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isConnected", !pages.isEmpty());
        result.put("pages", pages);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/publish/product/{productId}")
    public ResponseEntity<?> publishProduct(@RequestHeader("Authorization") String token,
                                            @PathVariable Long productId,
                                            @RequestParam String pageId,
                                            @RequestParam(required = false) String message) {
        Long sellerId = jwtService.extractId(token);
        Map<String, Object> result = facebookService.publishExistingProduct(sellerId, pageId, productId, message);
        return ResponseEntity.ok(result);
    }
}
