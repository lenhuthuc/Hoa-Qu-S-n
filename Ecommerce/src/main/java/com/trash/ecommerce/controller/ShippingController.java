package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.ShippingValidationResponse;
import com.trash.ecommerce.service.ShippingValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/shipping")
@RequiredArgsConstructor
public class ShippingController {

    private final ShippingValidationService shippingValidationService;

    @GetMapping("/provinces")
    public ResponseEntity<Map<String, Object>> getProvinces() {
        return ResponseEntity.ok(Map.of("success", true, "data", shippingValidationService.getProvinces()));
    }

    @GetMapping("/districts")
    public ResponseEntity<Map<String, Object>> getDistricts(@RequestParam Integer provinceId) {
        return ResponseEntity.ok(Map.of("success", true, "data", shippingValidationService.getDistricts(provinceId)));
    }

    @GetMapping("/wards")
    public ResponseEntity<Map<String, Object>> getWards(@RequestParam Integer districtId) {
        return ResponseEntity.ok(Map.of("success", true, "data", shippingValidationService.getWards(districtId)));
    }

    @GetMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateShipping(
            @RequestParam Long productId,
            @RequestParam(defaultValue = "1542") String toDistrictId,
            @RequestParam(defaultValue = "21012") String toWardCode) {

        ShippingValidationResponse response = shippingValidationService.validateShipping(
                productId, toDistrictId, toWardCode);

        return ResponseEntity.ok(Map.of("success", true, "data", response));
    }
}
