package com.trash.ecommerce.controller;

import com.trash.ecommerce.service.OcopRegistryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/ocop")
public class AdminOcopController {

    @Autowired
    private OcopRegistryService ocopRegistryService;

    @PostMapping("/sync")
    public ResponseEntity<?> syncNow() {
        return ResponseEntity.ok(ocopRegistryService.syncNow());
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam String productName,
                                    @RequestParam(required = false, defaultValue = "") String producerName) {
        return ResponseEntity.ok(ocopRegistryService.verify(productName, producerName));
    }

    @GetMapping("/products/{productId}/verify")
    public ResponseEntity<?> verifyProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(ocopRegistryService.verifyByProductId(productId));
    }
}
