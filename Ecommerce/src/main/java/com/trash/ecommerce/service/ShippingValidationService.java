package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ShippingValidationResponse;
import com.trash.ecommerce.dto.ShippingValidationResponse.ShippingOption;
import com.trash.ecommerce.entity.Address;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.ProvinceRepository;
import com.trash.ecommerce.repository.DistrictRepository;
import com.trash.ecommerce.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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

    private int defaultEstimatedDays(Map<?, ?> service) {
        Object type = service.get("service_type_id");
        int typeId = type instanceof Number ? ((Number) type).intValue() : 2;
        return switch (typeId) {
            case 1 -> 1;
            case 3 -> 4;
            default -> 2;
        };
    }

    @SuppressWarnings("unchecked")
    private List<ShippingOption> fetchGhnShippingOptions(Product product, String toDistrictId, String toWardCode) {
        List<ShippingOption> options = new ArrayList<>();

        if (!isGhnConfigured()) {
            options.add(ShippingOption.builder()
                    .carrier("GHN")
                    .serviceName("Chuẩn")
                    .estimatedDays(2)
                    .fee(30000L)
                    .build());
            options.add(ShippingOption.builder()
                    .carrier("GHN")
                    .serviceName("Express")
                    .estimatedDays(1)
                    .fee(60000L)
                    .build());
            return options;
        }

        int fromDistrictId = resolveFromDistrictId(product);
        String fromWardCode = resolveFromWardCode(product);
        int toDistrict = Integer.parseInt(toDistrictId);
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
                Long fee = fetchFee(fromDistrictId, fromWardCode, toDistrict, toWardCode, serviceId, weight, insurance);

                options.add(ShippingOption.builder()
                        .carrier("GHN")
                        .serviceName(buildServiceName(service))
                        .estimatedDays(defaultEstimatedDays(service))
                        .fee(Objects.requireNonNullElse(fee, 0L))
                        .build());
            }
        } catch (Exception ignored) {
            options.add(ShippingOption.builder()
                    .carrier("GHN")
                    .serviceName("Chuẩn")
                    .estimatedDays(2)
                    .fee(30000L)
                    .build());
        }

        return options;
    }

    @SuppressWarnings("unchecked")
    private Long fetchFee(int fromDistrictId, String fromWardCode, int toDistrictId,
                          String toWardCode, long serviceId, long weight, long insuranceValue) {
        Map<String, Object> feeBody = new HashMap<>();
        feeBody.put("from_district_id", fromDistrictId);
        feeBody.put("from_ward_code", fromWardCode);
        feeBody.put("service_id", serviceId);
        feeBody.put("to_district_id", toDistrictId);
        feeBody.put("to_ward_code", toWardCode);
        feeBody.put("height", 10);
        feeBody.put("length", 10);
        feeBody.put("width", 10);
        feeBody.put("weight", weight);
        feeBody.put("insurance_value", Math.max(insuranceValue, 0));
        feeBody.put("cod_value", 0);

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
