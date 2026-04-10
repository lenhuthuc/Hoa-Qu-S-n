package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.VoucherCreateDTO;
import com.trash.ecommerce.dto.VoucherDTO;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.VoucherService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vouchers")
public class VoucherController {

    @Autowired
    private VoucherService voucherService;

    @Autowired
    private JwtService jwtService;

    @GetMapping("/available")
    public ResponseEntity<?> getAvailableVouchers() {
        try {
            List<VoucherDTO> vouchers = voucherService.getAvailableVouchers();
            return ResponseEntity.ok(vouchers);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/validate")
    public ResponseEntity<?> validateVoucher(
            @RequestParam String code,
            @RequestParam BigDecimal orderAmount) {
        try {
            VoucherDTO dto = voucherService.validateVoucher(code, orderAmount);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createVoucher(
            @RequestHeader("Authorization") String token,
            @RequestBody VoucherCreateDTO dto) {
        try {
            Long sellerId = jwtService.extractId(token);
            VoucherDTO voucher = voucherService.createVoucher(sellerId, dto);
            return ResponseEntity.ok(voucher);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-vouchers")
    public ResponseEntity<?> getMyVouchers(@RequestHeader("Authorization") String token) {
        try {
            Long sellerId = jwtService.extractId(token);
            List<VoucherDTO> vouchers = voucherService.getSellerVouchers(sellerId);
            return ResponseEntity.ok(vouchers);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVoucher(
            @RequestHeader("Authorization") String token,
            @PathVariable Long id) {
        try {
            Long sellerId = jwtService.extractId(token);
            voucherService.deleteVoucher(id, sellerId);
            return ResponseEntity.ok(Map.of("message", "Đã xoá voucher"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
