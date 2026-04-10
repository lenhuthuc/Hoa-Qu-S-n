package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.InvoiceResponse;
import com.trash.ecommerce.service.InvoiceService;
import com.trash.ecommerce.service.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private Logger logger = LoggerFactory.getLogger(InvoiceController.class);
    @Autowired
    private InvoiceService invoiceService;
    @Autowired
    private JwtService jwtService;

    @PostMapping
    public ResponseEntity<?> createInvoice(
            @RequestHeader("Authorization") String token,
            @RequestParam Long orderId,
            @RequestParam(defaultValue = "1") Long paymentMethodId) {
        try {
            Long userId = jwtService.extractId(token);
            InvoiceResponse invoice = invoiceService.createInvoice(userId, orderId, paymentMethodId);
            return ResponseEntity.ok(invoice);
        } catch (Exception e) {
            logger.error("Generated invoice has some errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi tạo hóa đơn"));
        }
    }

    @DeleteMapping("/{invoiceId}")
    public ResponseEntity<?> deleteInvoice(
            @RequestHeader("Authorization") String token,
            @PathVariable Long invoiceId) {
        try {
            Long userId = jwtService.extractId(token);
            invoiceService.deleteInvoice(userId, invoiceId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("Delete invoice has some errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi xóa hóa đơn"));
        }
    }
}