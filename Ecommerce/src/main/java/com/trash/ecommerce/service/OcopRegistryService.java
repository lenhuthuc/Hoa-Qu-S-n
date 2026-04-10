package com.trash.ecommerce.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trash.ecommerce.entity.OcopRegistryEntry;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.OcopRegistryEntryRepository;
import com.trash.ecommerce.repository.ProductRepository;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class OcopRegistryService {

    @Autowired
    private OcopRegistryEntryRepository ocopRepository;

    @Autowired
    private ProductRepository productRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ocop.crawler.source-url:https://ocop.gov.vn}")
    private String sourceUrl;

    @Value("${ocop.crawler.format:html}")
    private String sourceFormat;

    @Scheduled(cron = "${ocop.crawler.cron:0 0 2 * * *}")
    public void scheduledSync() {
        try {
            syncNow();
        } catch (Exception ignored) {
        }
    }

    @Transactional
    public Map<String, Object> syncNow() {
        List<OcopRegistryEntry> parsed = "json".equalsIgnoreCase(sourceFormat)
                ? parseJsonSource(sourceUrl)
                : parseHtmlSource(sourceUrl);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("source", sourceUrl);
        result.put("format", sourceFormat);
        result.put("parsedCount", parsed.size());

        if (parsed.isEmpty()) {
            result.put("updated", false);
            result.put("message", "Không parse được bản ghi OCOP nào từ nguồn dữ liệu");
            return result;
        }

        ocopRepository.deleteAllInBatch();
        ocopRepository.saveAll(parsed);

        result.put("updated", true);
        result.put("message", "Đã đồng bộ OCOP thành công");
        return result;
    }

    public Map<String, Object> verify(String productName, String producerName) {
        String normalizedProduct = normalize(productName);
        String normalizedProducer = normalize(producerName);

        Optional<OcopRegistryEntry> exact = Optional.empty();
        if (!normalizedProduct.isBlank() && !normalizedProducer.isBlank()) {
            exact = ocopRepository.findFirstByNormalizedProductNameAndNormalizedProducerName(normalizedProduct, normalizedProducer);
        }

        List<OcopRegistryEntry> suggestions = normalizedProduct.isBlank()
                ? Collections.emptyList()
                : ocopRepository.findTop20ByNormalizedProductNameContainingOrderByLastSyncedAtDesc(normalizedProduct);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("matched", exact.isPresent());
        result.put("message", exact.isPresent()
                ? "Xác nhận tồn tại trong CSDL OCOP quốc gia"
                : "Không tìm thấy khớp chính xác. Cần admin kiểm tra kỹ hơn");
        result.put("exactMatch", exact.orElse(null));
        result.put("suggestions", suggestions);
        return result;
    }

    public Map<String, Object> verifyByProductId(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm"));

        String producerName = "";
        if (product.getSeller() != null) {
            producerName = product.getSeller().getFullName() != null && !product.getSeller().getFullName().isBlank()
                    ? product.getSeller().getFullName()
                    : product.getSeller().getEmail();
        }

        Map<String, Object> verifyResult = verify(product.getProductName(), producerName);
        verifyResult.put("productId", productId);
        verifyResult.put("productName", product.getProductName());
        verifyResult.put("producerName", producerName);
        return verifyResult;
    }

    private List<OcopRegistryEntry> parseJsonSource(String source) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(source)).GET().build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = objectMapper.readTree(response.body());

            JsonNode rows = root.isArray() ? root : root.path("data");
            if (rows == null || !rows.isArray()) {
                return Collections.emptyList();
            }

            List<OcopRegistryEntry> entries = new ArrayList<>();
            for (JsonNode row : rows) {
                String productName = textOr(row, "productName", "product_name", "name");
                String producerName = textOr(row, "producerName", "producer_name", "producer", "facility");
                if (productName.isBlank() || producerName.isBlank()) {
                    continue;
                }

                OcopRegistryEntry entry = new OcopRegistryEntry();
                entry.setProductName(productName);
                entry.setProducerName(producerName);
                entry.setNormalizedProductName(normalize(productName));
                entry.setNormalizedProducerName(normalize(producerName));
                entry.setProvince(textOr(row, "province", "location"));
                entry.setOcopStars(intOrNull(row, "stars", "ocopStars", "rating"));
                entry.setSourceUrl(textOr(row, "sourceUrl", "url", "link"));
                entry.setLastSyncedAt(LocalDateTime.now());
                entries.add(entry);
            }

            return entries;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<OcopRegistryEntry> parseHtmlSource(String source) {
        try {
            Document doc = Jsoup.connect(source).userAgent("Mozilla/5.0").timeout(15000).get();
            Elements rows = doc.select("table tr");
            List<OcopRegistryEntry> entries = new ArrayList<>();

            for (Element row : rows) {
                Elements cells = row.select("td");
                if (cells.size() < 2) {
                    continue;
                }

                String productName = cells.get(0).text().trim();
                String producerName = cells.get(1).text().trim();
                if (productName.isBlank() || producerName.isBlank()) {
                    continue;
                }

                String province = cells.size() > 2 ? cells.get(2).text().trim() : null;
                Integer stars = null;
                if (cells.size() > 3) {
                    String starText = cells.get(3).text().replaceAll("[^0-9]", "");
                    if (!starText.isBlank()) {
                        try {
                            stars = Integer.parseInt(starText);
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }

                OcopRegistryEntry entry = new OcopRegistryEntry();
                entry.setProductName(productName);
                entry.setProducerName(producerName);
                entry.setNormalizedProductName(normalize(productName));
                entry.setNormalizedProducerName(normalize(producerName));
                entry.setProvince(province);
                entry.setOcopStars(stars);
                entry.setSourceUrl(source);
                entry.setLastSyncedAt(LocalDateTime.now());
                entries.add(entry);
            }

            return entries;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase(Locale.ROOT)
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized;
    }

    private String textOr(JsonNode node, String... candidates) {
        for (String c : candidates) {
            String val = node.path(c).asText("").trim();
            if (!val.isBlank()) {
                return val;
            }
        }
        return "";
    }

    private Integer intOrNull(JsonNode node, String... candidates) {
        for (String c : candidates) {
            JsonNode n = node.path(c);
            if (!n.isMissingNode() && !n.isNull()) {
                String text = n.asText("").replaceAll("[^0-9]", "");
                if (!text.isBlank()) {
                    try {
                        return Integer.parseInt(text);
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        return null;
    }
}
