package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.ReturnRequestCreateDTO;
import com.trash.ecommerce.dto.ReturnRequestDTO;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.ReturnService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/returns")
public class ReturnController {

    private static final Logger logger = LoggerFactory.getLogger(ReturnController.class);

    @Autowired
    private ReturnService returnService;
    @Autowired
    private JwtService jwtService;

    @PostMapping
    public ResponseEntity<?> createReturnRequest(
            @RequestHeader("Authorization") String token,
            @RequestBody ReturnRequestCreateDTO dto) {
        try {
            Long userId = jwtService.extractId(token);
            ReturnRequestDTO result = returnService.createReturnRequest(userId, dto);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error creating return request", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-requests")
    public ResponseEntity<?> getMyReturns(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<ReturnRequestDTO> results = returnService.getMyReturnRequests(userId);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            logger.error("Error getting return requests", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/seller-requests")
    public ResponseEntity<?> getSellerReturns(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<ReturnRequestDTO> results = returnService.getSellerReturnRequests(userId);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            logger.error("Error getting seller return requests", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{returnId}/respond")
    public ResponseEntity<?> sellerRespond(
            @RequestHeader("Authorization") String token,
            @PathVariable Long returnId,
            @RequestParam String action,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            Long userId = jwtService.extractId(token);
            String response = body != null ? body.get("response") : null;
            ReturnRequestDTO result = returnService.sellerRespond(userId, returnId, action, response);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error responding to return request", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{returnId}")
    public ResponseEntity<?> getReturnById(
            @RequestHeader("Authorization") String token,
            @PathVariable Long returnId) {
        try {
            Long userId = jwtService.extractId(token);
            ReturnRequestDTO result = returnService.getReturnById(userId, returnId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error getting return request", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
