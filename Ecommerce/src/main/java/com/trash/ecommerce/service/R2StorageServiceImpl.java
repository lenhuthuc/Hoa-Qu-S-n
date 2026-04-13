package com.trash.ecommerce.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.core.ResponseBytes;

import java.io.IOException;
import java.net.URI;
import java.util.Set;
import java.util.UUID;

@Service
public class R2StorageServiceImpl implements StorageService {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "application/pdf"
    );

    private final S3Client s3Client;
    private final String bucket;
    private final String endpoint;

    public R2StorageServiceImpl(
            S3Client s3Client,
            @Value("${S3_BUCKET:}") String bucket,
            @Value("${CLOUDFLARE_R2_ENDPOINT:}") String endpoint
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        this.endpoint = endpoint;
    }

    @Override
    public String uploadSellerDocument(Long userId, MultipartFile file, String category) throws IOException {
        validate(file);

        String extension = getExtension(file.getOriginalFilename());
        String objectKey = "seller-documents/" + userId + "/" + category + "-" + UUID.randomUUID() + extension;

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        return buildPublicUrl(objectKey);
    }

    @Override
    public DocumentFile downloadSellerDocument(String documentUrl) {
        if (documentUrl == null || documentUrl.isBlank()) {
            throw new RuntimeException("Thiếu URL tài liệu");
        }

        String objectKey = extractObjectKey(documentUrl);
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build();
        ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(request);
        String contentType = response.response().contentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = guessContentType(objectKey);
        }

        String fileName = objectKey;
        int idx = objectKey.lastIndexOf('/');
        if (idx >= 0 && idx + 1 < objectKey.length()) {
            fileName = objectKey.substring(idx + 1);
        }
        return new DocumentFile(response.asByteArray(), contentType, fileName);
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File tải lên không hợp lệ");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("File vượt quá 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new RuntimeException("Chỉ hỗ trợ file JPG, PNG hoặc PDF");
        }
    }

    private String getExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    }

    private String buildPublicUrl(String objectKey) {
        String base = endpoint == null ? "" : endpoint.trim();
        if (base.isEmpty()) {
            throw new RuntimeException("Thiếu CLOUDFLARE_R2_ENDPOINT");
        }
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        String bucketSuffix = "/" + bucket;
        if (base.endsWith(bucketSuffix)) {
            return base + "/" + objectKey;
        }
        return base + "/" + bucket + "/" + objectKey;
    }

    private String extractObjectKey(String documentUrl) {
        try {
            URI uri = URI.create(documentUrl);
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (path.startsWith("/")) {
                path = path.substring(1);
            }
            String bucketPrefix = bucket + "/";
            if (path.startsWith(bucketPrefix)) {
                path = path.substring(bucketPrefix.length());
            }
            if (path.isBlank()) {
                throw new RuntimeException("Không thể xác định key tài liệu");
            }
            return path;
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("URL tài liệu không hợp lệ");
        }
    }

    private String guessContentType(String objectKey) {
        String lowered = objectKey.toLowerCase();
        if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lowered.endsWith(".png")) {
            return "image/png";
        }
        if (lowered.endsWith(".webp")) {
            return "image/webp";
        }
        if (lowered.endsWith(".pdf")) {
            return "application/pdf";
        }
        return "application/octet-stream";
    }
}
