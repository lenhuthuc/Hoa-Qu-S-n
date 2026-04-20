package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ShippingValidationResponse;
import com.trash.ecommerce.dto.ShippingValidationResponse.ShippingOption;
import com.trash.ecommerce.entity.Address;
import com.trash.ecommerce.entity.OrderItem;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.ProvinceRepository;
import com.trash.ecommerce.repository.DistrictRepository;
import com.trash.ecommerce.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShippingValidationService {

    private final ProductRepository productRepository;
    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final WardRepository wardRepository;

    @Value("${ghn.token:}")
    private String ghnToken;

    @Value("${ghn.shopId:}")
    private String ghnShopId;

    @Value("${ghn.baseUrl:https://dev-online-gateway.ghn.vn/shiip/public-api}")
    private String ghnBaseUrl;

    @Value("${ghn.defaultFromDistrictId:1542}")
    private Integer ghnDefaultFromDistrictId;

    @Value("${ghn.defaultFromWardCode:21012}")
    private String ghnDefaultFromWardCode;

    public ShippingValidationResponse validateShipping(Long productId, String toDistrictId, String toWardCode) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found: " + productId));

        int shelfLifeDays = product.getShelfLifeDays() != null ? product.getShelfLifeDays() : 30;

        // Fetch shipping options from GHN API
        List<ShippingOption> allOptions = fetchGhnShippingOptions(product, toDistrictId, toWardCode);
        List<ShippingOption> available = new ArrayList<>();
        List<ShippingOption> disabled = new ArrayList<>();

        for (ShippingOption option : allOptions) {
            if (option.getEstimatedDays() > shelfLifeDays) {
                option.setCompatible(false);
                option.setReason(String.format("ETD (%d ngày) > Hạn sử dụng (%d ngày)", 
                        option.getEstimatedDays(), shelfLifeDays));
                disabled.add(option);
                continue;
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

    public List<Map<String, Object>> getProvinces() {
        if (!isGhnConfigured()) {
            return getLocalProvinces();
        }

        try {
            Map<String, Object> response = ghnClient().get()
                    .uri("/master-data/province")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return mapProvinceList(response);
        } catch (Exception e) {
            // Fallback to local DB if GHN is down or returns 400
            return getLocalProvinces();
        }
    }

    private List<Map<String, Object>> getLocalProvinces() {
        return provinceRepository.findAll().stream()
                .map(p -> Map.<String, Object>of("id", Integer.parseInt(p.getCode()), "name", p.getName(), "code", p.getCode()))
                .toList();
    }

    public List<Map<String, Object>> getDistricts(Integer provinceId) {
        if (!isGhnConfigured()) {
            return getLocalDistricts(provinceId);
        }

        try {
            Map<String, Object> response = ghnClient().post()
                    .uri("/master-data/district")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("province_id", provinceId))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return mapDistrictList(response);
        } catch (Exception e) {
            return getLocalDistricts(provinceId);
        }
    }

    private List<Map<String, Object>> getLocalDistricts(Integer provinceId) {
        String pCode = String.format("%02d", provinceId);
        return districtRepository.findByProvinceCode(pCode).stream()
                .map(d -> Map.<String, Object>of("id", Integer.parseInt(d.getCode()), "name", d.getName(), "provinceId", provinceId, "code", d.getCode()))
                .toList();
    }

    public List<Map<String, Object>> getWards(Integer districtId) {
        if (!isGhnConfigured()) {
            return getLocalWards(districtId);
        }

        try {
            Map<String, Object> response = ghnClient().post()
                    .uri("/master-data/ward")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("district_id", districtId))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return mapWardList(response);
        } catch (Exception e) {
            return getLocalWards(districtId);
        }
    }

    private List<Map<String, Object>> getLocalWards(Integer districtId) {
        String dCode = String.format("%03d", districtId);
        return wardRepository.findByDistrictCode(dCode).stream()
                .map(w -> Map.<String, Object>of("code", w.getCode(), "name", w.getName(), "districtId", districtId))
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapProvinceList(Map<String, Object> response) {
        List<Map<String, Object>> mapped = new ArrayList<>();
        if (response == null || !(response.get("data") instanceof List<?> list)) {
            return mapped;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> raw) {
                Map<String, Object> row = new HashMap<>();
                row.put("id", raw.get("ProvinceID"));
                row.put("name", raw.get("ProvinceName"));
                row.put("code", raw.get("Code"));
                mapped.add(row);
            }
        }
        return mapped;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapDistrictList(Map<String, Object> response) {
        List<Map<String, Object>> mapped = new ArrayList<>();
        if (response == null || !(response.get("data") instanceof List<?> list)) {
            return mapped;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> raw) {
                Map<String, Object> row = new HashMap<>();
                row.put("id", raw.get("DistrictID"));
                row.put("name", raw.get("DistrictName"));
                row.put("provinceId", raw.get("ProvinceID"));
                row.put("code", raw.get("Code"));
                mapped.add(row);
            }
        }
        return mapped;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapWardList(Map<String, Object> response) {
        List<Map<String, Object>> mapped = new ArrayList<>();
        if (response == null || !(response.get("data") instanceof List<?> list)) {
            return mapped;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> raw) {
                Map<String, Object> row = new HashMap<>();
                row.put("code", raw.get("WardCode"));
                row.put("name", raw.get("WardName"));
                row.put("districtId", raw.get("DistrictID"));
                mapped.add(row);
            }
        }
        return mapped;
    }

    private boolean isGhnConfigured() {
        return ghnToken != null && !ghnToken.isBlank() && ghnShopId != null && !ghnShopId.isBlank();
    }

    private int resolveFromDistrictId(Product product) {
        Address sellerAddress = product.getSeller() != null ? product.getSeller().getAddress() : null;
        if (sellerAddress != null && sellerAddress.getGhnDistrictId() != null) {
            return sellerAddress.getGhnDistrictId();
        }
        return ghnDefaultFromDistrictId;
    }

    private String resolveFromWardCode(Product product) {
        Address sellerAddress = product.getSeller() != null ? product.getSeller().getAddress() : null;
        if (sellerAddress != null && sellerAddress.getGhnWardCode() != null && !sellerAddress.getGhnWardCode().isBlank()) {
            return sellerAddress.getGhnWardCode();
        }
        return ghnDefaultFromWardCode;
    }

    private String resolveToWardCode(int toDistrictId, String toWardCode) {
        List<Map<String, Object>> wards = getWards(toDistrictId);
        if (wards == null || wards.isEmpty()) {
            return toWardCode;
        }

        if (toWardCode != null && !toWardCode.isBlank()) {
            boolean valid = wards.stream()
                    .map(w -> w.get("code"))
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .anyMatch(code -> code.equalsIgnoreCase(toWardCode));
            if (valid) {
                return toWardCode;
            }
        }

        Object firstCode = wards.get(0).get("code");
        String fallbackWard = firstCode != null ? firstCode.toString() : toWardCode;
        log.warn("Invalid toWardCode '{}' for toDistrictId {}. Fallback to ward '{}'",
                toWardCode, toDistrictId, fallbackWard);
        return fallbackWard;
    }

    private int resolveFromDistrictId(Users seller) {
        Address sellerAddress = seller != null ? seller.getAddress() : null;
        if (sellerAddress != null && sellerAddress.getGhnDistrictId() != null) {
            return sellerAddress.getGhnDistrictId();
        }
        return ghnDefaultFromDistrictId;
    }

    private String resolveFromWardCode(Users seller) {
        Address sellerAddress = seller != null ? seller.getAddress() : null;
        if (sellerAddress != null && sellerAddress.getGhnWardCode() != null && !sellerAddress.getGhnWardCode().isBlank()) {
            return sellerAddress.getGhnWardCode();
        }
        return ghnDefaultFromWardCode;
    }

    private String buildServiceName(Map<?, ?> service) {
        Object shortName = service.get("short_name");
        if (shortName != null && !shortName.toString().isBlank()) {
            return shortName.toString();
        }
        Object type = service.get("service_type_id");
        int typeId = type instanceof Number ? ((Number) type).intValue() : 2;
        return switch (typeId) {
            case 1 -> "Express";
            case 3 -> "Tiết kiệm";
            default -> "Chuẩn";
        };
    }

    @SuppressWarnings("unchecked")
    public List<ShippingOption> estimateShippingOptionsForSeller(Users seller,
                                                                 Collection<OrderItem> orderItems,
                                                                 String toDistrictId,
                                                                 String toWardCode) {
        List<ShippingOption> options = new ArrayList<>();
        if (!isGhnConfigured() || seller == null || orderItems == null || orderItems.isEmpty()) {
            return options;
        }

        int fromDistrictId = resolveFromDistrictId(seller);
        String fromWardCode = resolveFromWardCode(seller);
        int toDistrict = Integer.parseInt(toDistrictId);
        String normalizedToWardCode = resolveToWardCode(toDistrict, toWardCode);

        long totalWeight = 0L;
        long insurance = 0L;
        int minShelfLife = Integer.MAX_VALUE;
        for (OrderItem item : orderItems) {
            if (item == null || item.getProduct() == null || item.getQuantity() == null || item.getQuantity() <= 0) {
                continue;
            }
            Product product = item.getProduct();
            long unitWeight = (product.getUnitWeightGrams() != null && product.getUnitWeightGrams() > 0)
                    ? product.getUnitWeightGrams()
                    : 500L;
            totalWeight += unitWeight * item.getQuantity();
            if (product.getPrice() != null) {
                insurance += product.getPrice().longValue() * item.getQuantity();
            }
            int shelfLife = product.getShelfLifeDays() != null ? product.getShelfLifeDays() : 30;
            minShelfLife = Math.min(minShelfLife, shelfLife);
        }

        if (totalWeight <= 0) {
            totalWeight = 500L;
        }
        if (minShelfLife == Integer.MAX_VALUE) {
            minShelfLife = 30;
        }

        try {
            Map<String, Object> response = ghnClient().post()
                    .uri("/v2/shipping-order/available-services")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "shop_id", Integer.parseInt(ghnShopId),
                            "from_district", fromDistrictId,
                            "to_district", toDistrict
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null || !(response.get("data") instanceof List<?> services)) {
                return options;
            }

            for (Object svc : services) {
                if (!(svc instanceof Map<?, ?> service)) {
                    continue;
                }

                Object serviceIdObj = service.get("service_id");
                if (!(serviceIdObj instanceof Number serviceNumber)) {
                    continue;
                }

                long serviceId = serviceNumber.longValue();
                Integer serviceTypeId = null;
                Object serviceTypeObj = service.get("service_type_id");
                if (serviceTypeObj instanceof Number serviceTypeNumber) {
                    serviceTypeId = serviceTypeNumber.intValue();
                }

                if (serviceTypeId == null || (serviceTypeId != 1 && serviceTypeId != 2)) {
                    continue;
                }

                Long fee = fetchFee(fromDistrictId, fromWardCode, toDistrict, normalizedToWardCode,
                        serviceId, serviceTypeId, totalWeight, insurance);
                Integer estimatedDays = fetchLeadtimeDays(fromDistrictId, fromWardCode, toDistrict,
                        normalizedToWardCode, serviceId);

                int defaultFromDistrict = ghnDefaultFromDistrictId != null ? ghnDefaultFromDistrictId : fromDistrictId;
                String defaultFromWard = (ghnDefaultFromWardCode != null && !ghnDefaultFromWardCode.isBlank())
                        ? ghnDefaultFromWardCode
                        : fromWardCode;

                if ((fee == null || estimatedDays == null)
                        && (fromDistrictId != defaultFromDistrict || !Objects.equals(fromWardCode, defaultFromWard))) {
                    fee = fetchFee(defaultFromDistrict, defaultFromWard, toDistrict, normalizedToWardCode,
                            serviceId, serviceTypeId, totalWeight, insurance);
                    estimatedDays = fetchLeadtimeDays(defaultFromDistrict, defaultFromWard, toDistrict,
                            normalizedToWardCode, serviceId);
                }

                if (fee == null || estimatedDays == null) {
                    continue;
                }

                if (estimatedDays > minShelfLife) {
                    continue;
                }

                options.add(ShippingOption.builder()
                        .carrier("GHN")
                        .serviceName(buildServiceName(service))
                        .serviceTypeId(serviceTypeId)
                        .estimatedDays(estimatedDays)
                        .fee(fee)
                        .compatible(true)
                        .build());
            }
        } catch (Exception e) {
            return options;
        }

        return options;
    }

    @SuppressWarnings("unchecked")
    private List<ShippingOption> fetchGhnShippingOptions(Product product, String toDistrictId, String toWardCode) {
        List<ShippingOption> options = new ArrayList<>();

        if (!isGhnConfigured()) {
            return options;
        }

        int fromDistrictId = resolveFromDistrictId(product);
        String fromWardCode = resolveFromWardCode(product);
        int toDistrict = Integer.parseInt(toDistrictId);
        String normalizedToWardCode = resolveToWardCode(toDistrict, toWardCode);
        long weight = (product.getUnitWeightGrams() != null && product.getUnitWeightGrams() > 0)
                ? product.getUnitWeightGrams()
                : 500L;
        long insurance = product.getPrice() != null ? product.getPrice().longValue() : 0L;

        try {
            Map<String, Object> response = ghnClient().post()
                    .uri("/v2/shipping-order/available-services")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "shop_id", Integer.parseInt(ghnShopId),
                            "from_district", fromDistrictId,
                            "to_district", toDistrict
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null || !(response.get("data") instanceof List<?> services)) {
                return options;
            }

            for (Object svc : services) {
                if (!(svc instanceof Map<?, ?> service)) {
                    continue;
                }

                Object serviceIdObj = service.get("service_id");
                if (!(serviceIdObj instanceof Number serviceNumber)) {
                    continue;
                }

                long serviceId = serviceNumber.longValue();
                Integer serviceTypeId = null;
                Object serviceTypeObj = service.get("service_type_id");
                if (serviceTypeObj instanceof Number serviceTypeNumber) {
                    serviceTypeId = serviceTypeNumber.intValue();
                }

                // Checkout only supports GHN Nhanh (1) and Chuan (2).
                if (serviceTypeId == null || (serviceTypeId != 1 && serviceTypeId != 2)) {
                    continue;
                }

                Long fee = fetchFee(fromDistrictId, fromWardCode, toDistrict, normalizedToWardCode,
                        serviceId, serviceTypeId, weight, insurance);
                Integer estimatedDays = fetchLeadtimeDays(fromDistrictId, fromWardCode, toDistrict,
                    normalizedToWardCode, serviceId);

                int defaultFromDistrict = ghnDefaultFromDistrictId != null ? ghnDefaultFromDistrictId : fromDistrictId;
                String defaultFromWard = (ghnDefaultFromWardCode != null && !ghnDefaultFromWardCode.isBlank())
                        ? ghnDefaultFromWardCode
                        : fromWardCode;

                // Retry with configured default pickup if seller pickup address causes GHN fee API failure.
                if ((fee == null || estimatedDays == null)
                    && (fromDistrictId != defaultFromDistrict || !Objects.equals(fromWardCode, defaultFromWard))) {
                    fee = fetchFee(defaultFromDistrict, defaultFromWard, toDistrict, normalizedToWardCode,
                        serviceId, serviceTypeId, weight, insurance);
                    estimatedDays = fetchLeadtimeDays(defaultFromDistrict, defaultFromWard, toDistrict,
                        normalizedToWardCode, serviceId);
                }

                if (fee == null || estimatedDays == null) {
                    continue;
                }

                options.add(ShippingOption.builder()
                        .carrier("GHN")
                        .serviceName(buildServiceName(service))
                        .serviceTypeId(serviceTypeId)
                        .estimatedDays(estimatedDays)
                        .fee(fee)
                        .build());
            }
        } catch (Exception e) {
            return options;
        }

        return options;
    }

    @SuppressWarnings("unchecked")
    private Long fetchFee(int fromDistrictId, String fromWardCode, int toDistrictId,
                          String toWardCode, long serviceId, Integer serviceTypeId,
                          long weight, long insuranceValue) {
        Map<String, Object> feeBody = new HashMap<>();
        feeBody.put("from_district_id", fromDistrictId);
        feeBody.put("from_ward_code", fromWardCode);
        feeBody.put("service_id", serviceId);
        if (serviceTypeId != null) {
            feeBody.put("service_type_id", serviceTypeId);
        }
        feeBody.put("to_district_id", toDistrictId);
        feeBody.put("to_ward_code", toWardCode);
        feeBody.put("height", 10);
        feeBody.put("length", 10);
        feeBody.put("width", 10);
        feeBody.put("weight", weight);
        feeBody.put("insurance_value", Math.max(insuranceValue, 0));
        feeBody.put("cod_value", 0);
        feeBody.put("cod_failed_amount", 0);
        feeBody.put("coupon", null);
        feeBody.put("items", List.of(Map.of(
                "name", "ITEM",
                "quantity", 1,
                "height", 10,
                "length", 10,
                "width", 10,
                "weight", weight
        )));

        try {
            Map<String, Object> response = ghnClientWithShopId().post()
                    .uri("/v2/shipping-order/fee")
                    .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(feeBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null || !(response.get("data") instanceof Map<?, ?> data)) {
                return null;
            }
            Object total = data.get("total");
            if (total instanceof Number number) {
                return number.longValue();
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Integer fetchLeadtimeDays(int fromDistrictId, String fromWardCode, int toDistrictId,
                                      String toWardCode, long serviceId) {
        Map<String, Object> body = new HashMap<>();
        body.put("from_district_id", fromDistrictId);
        body.put("from_ward_code", fromWardCode);
        body.put("to_district_id", toDistrictId);
        body.put("to_ward_code", toWardCode);
        body.put("service_id", serviceId);

        try {
            Map<String, Object> response = ghnClientWithShopId().post()
                    .uri("/v2/shipping-order/leadtime")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null || !(response.get("data") instanceof Map<?, ?> data)) {
                return null;
            }

            Object leadtimeObj = data.get("leadtime");
            if (!(leadtimeObj instanceof Number leadtimeNum)) {
                return null;
            }

            long leadtimeEpoch = leadtimeNum.longValue();
            long nowEpoch = Instant.now().getEpochSecond();
            long secondsDiff = Math.max(leadtimeEpoch - nowEpoch, 0);
            long days = (long) Math.ceil(secondsDiff / 86400.0);
            return (int) Math.max(days, 1);
        } catch (Exception e) {
            return null;
        }
    }

    private WebClient ghnClient() {
        return WebClient.builder()
                .baseUrl(ghnBaseUrl)
                .defaultHeader("Token", ghnToken)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    private WebClient ghnClientWithShopId() {
        return WebClient.builder()
                .baseUrl(ghnBaseUrl)
                .defaultHeader("Token", ghnToken)
                .defaultHeader("ShopId", ghnShopId)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
