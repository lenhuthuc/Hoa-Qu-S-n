package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.BatchCreateRequestDTO;
import com.trash.ecommerce.dto.BatchResponseDTO;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.TraceabilityBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/seller/batches")
@RequiredArgsConstructor
public class BatchController {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final TraceabilityBatchService traceabilityBatchService;

    @GetMapping
    public ResponseEntity<?> getMyBatches(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
            if (!isSellerOrAdmin(seller)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Chỉ người bán mới có thể xem luống"));
            }

            List<BatchResponseDTO> batches = traceabilityBatchService.listBySeller(userId);
            return ResponseEntity.ok(Map.of("data", batches));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createBatch(
            @RequestHeader("Authorization") String token,
            @RequestBody BatchCreateRequestDTO request) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
            if (!isSellerOrAdmin(seller)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Chỉ người bán mới có thể tạo luống"));
            }

            BatchResponseDTO created = traceabilityBatchService.create(userId, request);
            return ResponseEntity.ok(Map.of("data", created));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Không thể tạo luống"));
        }
    }

    private boolean isSellerOrAdmin(Users user) {
        if (user == null || user.getRoles() == null) {
            return false;
        }
        return user.getRoles().stream().anyMatch(role -> {
            String name = role.getRoleName();
            return "SELLER".equalsIgnoreCase(name) || "ADMIN".equalsIgnoreCase(name);
        });
    }
}
