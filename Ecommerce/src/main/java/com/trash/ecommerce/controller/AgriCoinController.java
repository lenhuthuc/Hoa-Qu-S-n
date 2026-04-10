package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.CoinTransaction;
import com.trash.ecommerce.repository.AgriCoinRepository;
import com.trash.ecommerce.repository.CoinTransactionRepository;
import com.trash.ecommerce.service.AgriCoinService;
import com.trash.ecommerce.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coins")
public class AgriCoinController {

    @Autowired
    private AgriCoinService agriCoinService;
    @Autowired
    private CoinTransactionRepository coinTransactionRepository;
    @Autowired
    private JwtService jwtService;

    @GetMapping("/balance")
    public ResponseEntity<?> getBalance(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            int balance = agriCoinService.getBalance(userId);
            return ResponseEntity.ok(Map.of("balance", balance));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Long userId = jwtService.extractId(token);
            Page<CoinTransaction> transactions = coinTransactionRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
            List<Map<String, Object>> result = transactions.getContent().stream().map(tx -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", tx.getId());
                map.put("amount", tx.getAmount());
                map.put("type", tx.getType());
                map.put("description", tx.getDescription());
                map.put("createdAt", tx.getCreatedAt());
                return map;
            }).toList();
            return ResponseEntity.ok(Map.of(
                    "transactions", result,
                    "totalPages", transactions.getTotalPages(),
                    "balance", agriCoinService.getBalance(userId)
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
