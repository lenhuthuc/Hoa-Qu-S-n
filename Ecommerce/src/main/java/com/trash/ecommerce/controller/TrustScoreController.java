package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.TrustScoreDTO;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.TrustScoreService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/trust-score")
public class TrustScoreController {

    private static final Logger logger = LoggerFactory.getLogger(TrustScoreController.class);

    @Autowired
    private TrustScoreService trustScoreService;
    @Autowired
    private JwtService jwtService;

    @GetMapping("/{sellerId}")
    public ResponseEntity<?> getTrustScore(@PathVariable Long sellerId) {
        try {
            TrustScoreDTO dto = trustScoreService.getTrustScore(sellerId);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            logger.error("Error getting trust score", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/recalculate")
    public ResponseEntity<?> recalculate(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            TrustScoreDTO dto = trustScoreService.recalculateTrustScore(userId);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            logger.error("Error recalculating trust score", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
