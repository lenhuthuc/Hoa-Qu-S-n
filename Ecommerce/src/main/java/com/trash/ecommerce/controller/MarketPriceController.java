package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.MarketPriceResponse;
import com.trash.ecommerce.entity.MarketPrice;
import com.trash.ecommerce.repository.MarketPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market-prices")
@RequiredArgsConstructor
public class MarketPriceController {

    private final MarketPriceRepository marketPriceRepository;

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam String name) {
        List<MarketPrice> results = marketPriceRepository.searchByName(name);
        if (results.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", true, "data", (Object) Map.of()));
        }

        MarketPrice mp = results.get(0);
        MarketPriceResponse response = MarketPriceResponse.builder()
                .id(mp.getId())
                .productName(mp.getProductName())
                .category(mp.getCategory())
                .region(mp.getRegion())
                .avgPrice(mp.getAvgPrice())
                .minPrice(mp.getMinPrice())
                .maxPrice(mp.getMaxPrice())
                .unit(mp.getUnit())
                .source(mp.getSource())
                .build();

        return ResponseEntity.ok(Map.of("success", true, "data", response));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        List<MarketPrice> all = marketPriceRepository.findAll();
        List<MarketPriceResponse> responses = all.stream()
                .map(mp -> MarketPriceResponse.builder()
                        .id(mp.getId())
                        .productName(mp.getProductName())
                        .category(mp.getCategory())
                        .region(mp.getRegion())
                        .avgPrice(mp.getAvgPrice())
                        .minPrice(mp.getMinPrice())
                        .maxPrice(mp.getMaxPrice())
                        .unit(mp.getUnit())
                        .source(mp.getSource())
                        .build())
                .toList();
        return ResponseEntity.ok(Map.of("success", true, "data", responses));
    }
}
