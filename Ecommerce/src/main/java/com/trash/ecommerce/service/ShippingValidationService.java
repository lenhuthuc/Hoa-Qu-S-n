package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ShippingValidationResponse;
import com.trash.ecommerce.dto.ShippingValidationResponse.ShippingOption;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ShippingValidationService {

    private final ProductRepository productRepository;

    @Value("${ghn.token:}")
    private String ghnToken;

    @Value("${ghn.shopId:}")
    private String ghnShopId;

    private static final String GHN_API = "https://online-gateway.ghn.vn/shiip/public-api/v2";

    public ShippingValidationResponse validateShipping(Long productId, String toDistrictId, String toWardCode) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found: " + productId));

        int shelfLifeDays = product.getShelfLifeDays() != null ? product.getShelfLifeDays() : 30;

        // Fetch shipping options from GHN API
        List<ShippingOption> allOptions = fetchGhnShippingOptions(toDistrictId, toWardCode);

        List<ShippingOption> available = new ArrayList<>();
        List<ShippingOption> disabled = new ArrayList<>();

        for (ShippingOption option : allOptions) {
            if (option.getEstimatedDays() <= shelfLifeDays) {
                option.setCompatible(true);
                available.add(option);
            } else {
                option.setCompatible(false);
                option.setReason(String.format(
                        "Thời gian giao hàng (%d ngày) vượt quá hạn sử dụng sản phẩm (%d ngày)",
                        option.getEstimatedDays(), shelfLifeDays));
                disabled.add(option);
            }
        }

        return ShippingValidationResponse.builder()
                .productId(productId)
                .productName(product.getProductName())
                .shelfLifeDays(shelfLifeDays)
                .availableMethods(available)
                .disabledMethods(disabled)
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<ShippingOption> fetchGhnShippingOptions(String toDistrictId, String toWardCode) {
        List<ShippingOption> options = new ArrayList<>();

        if (ghnToken == null || ghnToken.isEmpty()) {
            // Return mock data when GHN token is not configured
            options.add(ShippingOption.builder()
                    .carrier("GHN").serviceName("Giao hàng nhanh")
                    .estimatedDays(2).fee(30000L).build());
            options.add(ShippingOption.builder()
                    .carrier("GHN").serviceName("Giao hàng tiết kiệm")
                    .estimatedDays(5).fee(18000L).build());
            options.add(ShippingOption.builder()
                    .carrier("GHN").serviceName("Giao hàng hỏa tốc")
                    .estimatedDays(1).fee(55000L).build());
            return options;
        }

        try {
            WebClient client = WebClient.builder()
                    .baseUrl(GHN_API)
                    .defaultHeader("Token", ghnToken)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
                    .build();

            Map<String, Object> body = Map.of(
                    "shop_id", Integer.parseInt(ghnShopId),
                    "from_district", 1542,
                    "to_district", Integer.parseInt(toDistrictId)
            );

            Map<String, Object> response = client.post()
                    .uri("/shipping-order/available-services")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.get("data") instanceof List<?> services) {
                for (Object svc : services) {
                    if (svc instanceof Map<?, ?> s) {
                        // Calculate ETD for this service
                        Map<String, Object> etdBody = Map.of(
                                "service_id", s.get("service_id"),
                                "from_district_id", 1542,
                                "to_district_id", Integer.parseInt(toDistrictId),
                                "to_ward_code", toWardCode
                        );

                        Map<String, Object> etdResponse = client.post()
                                .uri("/shipping-order/leadtime")
                                .bodyValue(etdBody)
                                .retrieve()
                                .bodyToMono(Map.class)
                                .block();

                        int estimatedDays = 5; // default
                        if (etdResponse != null && etdResponse.get("data") instanceof Map<?, ?> etdData) {
                            Object leadtime = etdData.get("leadtime");
                            if (leadtime instanceof Number) {
                                // leadtime is unix timestamp — calculate days from now
                                long leadtimeSec = ((Number) leadtime).longValue();
                                long nowSec = System.currentTimeMillis() / 1000;
                                estimatedDays = Math.max(1, (int) ((leadtimeSec - nowSec) / 86400));
                            }
                        }

                        options.add(ShippingOption.builder()
                                .carrier("GHN")
                                .serviceName((String) s.get("short_name"))
                                .estimatedDays(estimatedDays)
                                .fee(s.get("service_id") != null ? 25000L : 0L)
                                .build());
                    }
                }
            }
        } catch (Exception e) {
            // Fallback to mock data on API failure
            options.add(ShippingOption.builder()
                    .carrier("GHN").serviceName("Giao hàng nhanh")
                    .estimatedDays(3).fee(25000L).build());
        }

        return options;
    }
}
