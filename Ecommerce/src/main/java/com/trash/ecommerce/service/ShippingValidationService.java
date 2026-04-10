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
        
        // 1. Get Seller Coordinates from OSM
        String sellerAddress = product.getSeller().getAddress().getFullAddress();
        double[] sellerCoords = getCoordinatesFromOSM(sellerAddress);
        double sellerLat = sellerCoords[0];
        double sellerLon = sellerCoords[1];
        String sellerProvince = product.getSeller().getAddress().getProvince();

        // 2. Get Buyer Coordinates (for simulation, we assume specific hardcoded names for demo IDs)
        // Default to Hanoi as requested
        String buyerAddressQuery = "Quận Ba Đình, Hà Nội"; 
        String buyerProvince = "Thành phố Hà Nội";

        if (toDistrictId.equals("1444")) { // ID 1444 simulates a shift to HCM
            buyerAddressQuery = "Quận 1, Thành phố Hồ Chí Minh";
            buyerProvince = "Thành phố Hồ Chí Minh";
        }

        double[] buyerCoords = getCoordinatesFromOSM(buyerAddressQuery);
        double buyerLat = buyerCoords[0];
        double buyerLon = buyerCoords[1];

        double distanceKm = calculateDistance(sellerLat, sellerLon, buyerLat, buyerLon);

        // Fetch shipping options from GHN API
        List<ShippingOption> allOptions = fetchGhnShippingOptions(toDistrictId, toWardCode);
        List<ShippingOption> available = new ArrayList<>();
        List<ShippingOption> disabled = new ArrayList<>();

        for (ShippingOption option : allOptions) {
            String serviceMode = option.getServiceName().toLowerCase();
            
            if (option.getEstimatedDays() > shelfLifeDays) {
                option.setCompatible(false);
                option.setReason(String.format("ETD (%d ngày) > Hạn sử dụng (%d ngày)", 
                        option.getEstimatedDays(), shelfLifeDays));
                disabled.add(option);
                continue;
            }

            if (serviceMode.contains("hỏa tốc") || serviceMode.contains("express")) {
                if (distanceKm > 30) {
                    option.setCompatible(false);
                    option.setReason(String.format("Giao hỏa tốc chỉ hỗ trợ < 30km (Tính toán thực tế: %d km)", Math.round(distanceKm)));
                    disabled.add(option);
                    continue;
                }
                if (!sellerProvince.toLowerCase().contains(buyerProvince.toLowerCase()) && 
                    !buyerProvince.toLowerCase().contains(sellerProvince.toLowerCase())) {
                    option.setCompatible(false);
                    option.setReason("Giao hỏa tốc chỉ hỗ trợ nội tỉnh/thành phố");
                    disabled.add(option);
                    continue;
                }
            }

            option.setCompatible(true);
            available.add(option);
        }

        return ShippingValidationResponse.builder()
                .productId(productId)
                .productName(product.getProductName())
                .shelfLifeDays(shelfLifeDays)
                .availableMethods(available)
                .disabledMethods(disabled)
                .build();
    }

    private double[] getCoordinatesFromOSM(String address) {
        try {
            WebClient client = WebClient.builder()
                    .baseUrl("https://nominatim.openstreetmap.org")
                    .defaultHeader(HttpHeaders.USER_AGENT, "HoaQuaSon-Ecommerce-App/1.0")
                    .build();

            List<Map<String, Object>> results = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/search")
                            .queryParam("q", address)
                            .queryParam("format", "json")
                            .queryParam("limit", 1)
                            .build())
                    .retrieve()
                    .bodyToMono(List.class)
                    .block();

            if (results != null && !results.isEmpty()) {
                Map<String, Object> first = results.get(0);
                double lat = Double.parseDouble((String) first.get("lat"));
                double lon = Double.parseDouble((String) first.get("lon"));
                return new double[]{lat, lon};
            }
        } catch (Exception e) {
            System.err.println("OSM Geocoding error: " + e.getMessage());
        }
        // Fallback to District 1, Ho Chi Minh City if API fails or no results
        return new double[]{10.7769, 106.7009};
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radius of the earth
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @SuppressWarnings("unchecked")
    private List<ShippingOption> fetchGhnShippingOptions(String toDistrictId, String toWardCode) {
        List<ShippingOption> options = new ArrayList<>();

        // If GHN Token is missing, provide mock services to test logic
        if (ghnToken == null || ghnToken.isEmpty()) {
            options.add(ShippingOption.builder()
                    .carrier("GHN").serviceName("Giao hàng tiêu chuẩn")
                    .estimatedDays(3).fee(30000L).build());
            options.add(ShippingOption.builder()
                    .carrier("GHN").serviceName("Giao hàng hỏa tốc")
                    .estimatedDays(1).fee(60000L).build());
            return options;
        }
// (rest of the code remains same)

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
