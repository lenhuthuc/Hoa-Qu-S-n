package com.trash.ecommerce.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trash.ecommerce.dto.ProductRequestDTO;
import com.trash.ecommerce.entity.FacebookPageCredential;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.FacebookPageCredentialRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.util.TokenCryptoUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class FacebookIntegrationService {

    @Autowired
    private FacebookPageCredentialRepository credentialRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private TokenCryptoUtil tokenCryptoUtil;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${facebook.graph-base-url:https://graph.facebook.com}")
    private String graphBaseUrl;

    @Value("${facebook.api-version:v19.0}")
    private String apiVersion;

    @Value("${facebook.app-id:}")
    private String appId;

    @Value("${facebook.app-secret:}")
    private String appSecret;

    @Value("${app.public-base-url:http://localhost:3000}")
    private String publicBaseUrl;

    @Value("${app.frontend-base-url:http://localhost:3001}")
    private String frontendBaseUrl;

    public String buildOAuthUrl(String redirectUri, String state) {
        if (appId == null || appId.isBlank()) {
            throw new IllegalStateException("Thiếu cấu hình facebook.app-id");
        }

        String encodedRedirectUri = UriUtils.encode(redirectUri, StandardCharsets.UTF_8);
        String encodedState = UriUtils.encode(state, StandardCharsets.UTF_8);
        return graphBaseUrl + "/" + apiVersion + "/dialog/oauth"
                + "?client_id=" + appId
                + "&redirect_uri=" + encodedRedirectUri
                + "&state=" + encodedState
                + "&scope=pages_manage_posts,pages_read_engagement";
    }

    public List<Map<String, Object>> exchangeCodeAndStorePageTokens(Long sellerId, String code, String redirectUri) {
        if (appId == null || appId.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new IllegalStateException("Thiếu cấu hình facebook.app-id hoặc facebook.app-secret");
        }

        WebClient webClient = WebClient.builder().baseUrl(graphBaseUrl).build();

        JsonNode tokenNode = webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/" + apiVersion + "/oauth/access_token")
                        .queryParam("client_id", appId)
                        .queryParam("client_secret", appSecret)
                        .queryParam("redirect_uri", redirectUri)
                        .queryParam("code", code)
                        .build())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        if (tokenNode == null || tokenNode.path("access_token").asText().isBlank()) {
            throw new IllegalStateException("Không đổi được access token từ Facebook");
        }

        String userAccessToken = tokenNode.path("access_token").asText();

        JsonNode pagesNode = webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/" + apiVersion + "/me/accounts")
                        .queryParam("fields", "id,name,access_token")
                        .queryParam("access_token", userAccessToken)
                        .build())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        List<Map<String, Object>> storedPages = new ArrayList<>();
        JsonNode data = pagesNode != null ? pagesNode.path("data") : null;

        if (data == null || !data.isArray() || data.isEmpty()) {
            return storedPages;
        }

        for (JsonNode page : data) {
            String pageId = page.path("id").asText();
            String pageName = page.path("name").asText("Unknown Page");
            String pageAccessToken = page.path("access_token").asText();
            if (pageId.isBlank() || pageAccessToken.isBlank()) {
                continue;
            }

            FacebookPageCredential credential = credentialRepository.findBySellerIdAndPageId(sellerId, pageId)
                    .orElseGet(FacebookPageCredential::new);
            credential.setSellerId(sellerId);
            credential.setPageId(pageId);
            credential.setPageName(pageName);
            credential.setEncryptedPageAccessToken(tokenCryptoUtil.encrypt(pageAccessToken));
            credential.setTokenLastUpdatedAt(LocalDateTime.now());
            credentialRepository.save(credential);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("pageId", pageId);
            item.put("pageName", pageName);
            item.put("connectedAt", credential.getTokenLastUpdatedAt());
            storedPages.add(item);
        }

        return storedPages;
    }

    public List<Map<String, Object>> listConnectedPages(Long sellerId) {
        List<FacebookPageCredential> creds = credentialRepository.findBySellerIdOrderByTokenLastUpdatedAtDesc(sellerId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (FacebookPageCredential cred : creds) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("pageId", cred.getPageId());
            item.put("pageName", cred.getPageName());
            item.put("connectedAt", cred.getTokenLastUpdatedAt());
            result.add(item);
        }
        return result;
    }

    public Map<String, Object> publishExistingProduct(Long sellerId, String pageId, Long productId, String customMessage) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm"));

        if (product.getSeller() == null || !Objects.equals(product.getSeller().getId(), sellerId)) {
            throw new IllegalArgumentException("Bạn chỉ được đăng Facebook cho sản phẩm của mình");
        }

        String productUrl = frontendBaseUrl + "/product/" + productId;
        String imageUrl = product.getPrimaryImagePath() != null
                ? publicBaseUrl + "/api/products/" + productId + "/img"
                : null;
        String message = buildMessage(customMessage, product.getProductName(), product.getPrice());

        return publishToFacebook(sellerId, pageId, message, productUrl, imageUrl, null);
    }

    public Map<String, Object> publishFromProductDraft(Long sellerId,
                                                        String pageId,
                                                        ProductRequestDTO request,
                                                        MultipartFile file,
                                                        String customMessage) {
        String productName = request.getProductName() != null ? request.getProductName() : "Sản phẩm mới";
        String productUrl = frontendBaseUrl + "/search?name=" + UriUtils.encode(productName, StandardCharsets.UTF_8);
        String message = buildMessage(customMessage, productName, request.getPrice());

        byte[] imageBytes = null;
        String filename = null;
        try {
            if (file != null && !file.isEmpty()) {
                imageBytes = file.getBytes();
                filename = file.getOriginalFilename();
            }
        } catch (Exception ignored) {
        }

        return publishToFacebook(sellerId, pageId, message, productUrl, null, imageBytes != null ? Map.of(
                "bytes", imageBytes,
                "filename", filename != null ? filename : "product.jpg"
        ) : null);
    }

    private Map<String, Object> publishToFacebook(Long sellerId,
                                                   String pageId,
                                                   String message,
                                                   String productUrl,
                                                   String imageUrl,
                                                   Map<String, Object> localImagePayload) {
        FacebookPageCredential credential = credentialRepository.findBySellerIdAndPageId(sellerId, pageId)
                .orElseThrow(() -> new IllegalArgumentException("Chưa kết nối Facebook Page này"));

        String pageAccessToken = tokenCryptoUtil.decrypt(credential.getEncryptedPageAccessToken());
        WebClient webClient = WebClient.builder().baseUrl(graphBaseUrl).build();

        String photoId = null;
        String photoError = null;

        try {
            if (localImagePayload != null) {
                byte[] bytes = (byte[]) localImagePayload.get("bytes");
                String filename = (String) localImagePayload.get("filename");
                if (bytes != null && bytes.length > 0) {
                    MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
                    form.add("access_token", pageAccessToken);
                    form.add("published", "false");
                    form.add("source", new ByteArrayResource(bytes) {
                        @Override
                        public String getFilename() {
                            return filename;
                        }
                    });

                    JsonNode photoResp = webClient.post()
                            .uri("/" + apiVersion + "/" + pageId + "/photos")
                            .contentType(MediaType.MULTIPART_FORM_DATA)
                            .body(BodyInserters.fromMultipartData(form))
                            .retrieve()
                            .bodyToMono(JsonNode.class)
                            .block();

                    if (photoResp != null) {
                        photoId = photoResp.path("id").asText(null);
                    }
                }
            } else if (imageUrl != null && !imageUrl.isBlank()) {
                MultiValueMap<String, String> photoForm = new LinkedMultiValueMap<>();
                photoForm.add("access_token", pageAccessToken);
                photoForm.add("published", "false");
                photoForm.add("url", imageUrl);

                JsonNode photoResp = webClient.post()
                        .uri("/" + apiVersion + "/" + pageId + "/photos")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(BodyInserters.fromFormData(photoForm))
                        .retrieve()
                        .bodyToMono(JsonNode.class)
                        .block();

                if (photoResp != null) {
                    photoId = photoResp.path("id").asText(null);
                }
            }
        } catch (Exception e) {
            photoError = e.getMessage();
        }

        MultiValueMap<String, String> feedForm = new LinkedMultiValueMap<>();
        feedForm.add("access_token", pageAccessToken);
        feedForm.add("message", message);
        feedForm.add("link", productUrl);
        if (photoId != null && !photoId.isBlank()) {
            feedForm.add("attached_media[0]", "{\"media_fbid\":\"" + photoId + "\"}");
        }

        JsonNode feedResp = webClient.post()
                .uri("/" + apiVersion + "/" + pageId + "/feed")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(feedForm))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pageId", pageId);
        result.put("pageName", credential.getPageName());
        result.put("postId", feedResp != null ? feedResp.path("id").asText(null) : null);
        result.put("photoId", photoId);
        result.put("photoUploadWarning", photoError);
        result.put("message", message);
        result.put("productUrl", productUrl);
        return result;
    }

    private String buildMessage(String customMessage, String productName, BigDecimal price) {
        if (customMessage != null && !customMessage.isBlank()) {
            return customMessage;
        }
        String pricePart = price != null ? String.format(Locale.US, "%s VND", price.toPlainString()) : "Liên hệ";
        return "🍀 " + productName + "\nGiá: " + pricePart + "\nXem chi tiết sản phẩm tại link bên dưới.";
    }
}
