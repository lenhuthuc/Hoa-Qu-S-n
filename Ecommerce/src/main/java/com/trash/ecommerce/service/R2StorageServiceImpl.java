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
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class R2StorageServiceImpl implements StorageService {

    // ─── Seller Documents ───
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "application/pdf"
    );

    // ─── Review Media (images & videos) ───
    private static final long MAX_IMAGE_SIZE_BYTES = 5L * 1024 * 1024;  // 5MB per image
    private static final long MAX_VIDEO_SIZE_BYTES = 25L * 1024 * 1024; // 25MB per video
    private static final Set<String> ALLOWED_IMAGE_MIME_TYPES = Set.of("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif");
    private static final Set<String> ALLOWED_VIDEO_MIME_TYPES = Set.of("video/mp4", "video/webm", "video/quicktime", "video/x-m4v");

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

        try {
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
            return buildPublicUrl(objectKey);
        } catch (Exception e) {
            Path path = Paths.get("uploads/" + objectKey);
            Files.createDirectories(path.getParent());
            Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            return "local:" + objectKey;
        }
    }

    @Override
    public DocumentFile downloadSellerDocument(String documentUrl) {
        if (documentUrl == null || documentUrl.isBlank()) {
            throw new RuntimeException("Thiếu URL tài liệu");
        }

        if (documentUrl.startsWith("local:")) {
            String objKey = documentUrl.substring("local:".length());
            try {
                Path path = Paths.get("uploads/" + objKey);
                byte[] content = Files.readAllBytes(path);
                String contentType = guessContentType(objKey);
                String fileName = objKey.contains("/") ? objKey.substring(objKey.lastIndexOf('/') + 1) : objKey;
                return new DocumentFile(content, contentType, fileName);
            } catch (IOException e) {
                throw new RuntimeException("Không thể đọc file local: " + e.getMessage());
            }
        }

        String objectKey = extractObjectKey(documentUrl);
        try {
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
        } catch (Exception e) {
            throw new RuntimeException("Không tải được tài liệu từ R2: " + e.getMessage());
        }
    }

    @Override
    public String uploadReviewMedia(Long userId, MultipartFile file, String mediaType) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Tệp tải lên không hợp lệ");
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename().replaceAll("[\\\\/:*?\"<>|]", "_") : "media";
        String extension = getExtension(originalName);
        
        boolean isImage = "image".equals(mediaType);
        if (isImage) {
            if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
                throw new IllegalArgumentException("Ảnh không được vượt quá 5MB");
            }
            String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
            if (!ALLOWED_IMAGE_MIME_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("Ảnh tải lên không hợp lệ. Chỉ hỗ trợ JPG, PNG, WEBP, GIF");
            }
        } else {
            if (file.getSize() > MAX_VIDEO_SIZE_BYTES) {
                throw new IllegalArgumentException("Video không được vượt quá 25MB");
            }
            String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
            if (!ALLOWED_VIDEO_MIME_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("Video tải lên không hợp lệ. Chỉ hỗ trợ MP4, WEBM, MOV, M4V");
            }
        }

        String objectKey = "review-media/" + userId + "/" + mediaType + "/" + System.currentTimeMillis() + "_" + originalName;

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(file.getContentType())
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
            return buildPublicUrl(objectKey);
        } catch (Exception e) {
            // Fallback: lưu local nếu R2 lỗi
            Path path = Paths.get("uploads/" + objectKey);
            Files.createDirectories(path.getParent());
            Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            return "local:" + objectKey;
        }
    }

    @Override
    public DocumentFile downloadReviewMedia(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.isBlank()) {
            throw new RuntimeException("Thiếu URL media");
        }

        if (mediaUrl.startsWith("local:")) {
            String objKey = mediaUrl.substring("local:".length());
            String fileName = objKey.contains("/") ? objKey.substring(objKey.lastIndexOf('/') + 1) : objKey;

            List<Path> candidates = new ArrayList<>();
            candidates.add(Paths.get("uploads/" + objKey));
            candidates.add(Paths.get("uploads/reviews/" + fileName));
            candidates.add(Paths.get("uploads/review-media/" + fileName));

            for (Path path : candidates) {
                if (Files.exists(path)) {
                    try {
                        byte[] content = Files.readAllBytes(path);
                        String contentType = guessContentType(path.getFileName().toString());
                        return maybeTranscodeVideo(content, contentType, fileName);
                    } catch (IOException ignored) {
                    }
                }
            }

            throw new RuntimeException("Không thể đọc file local: " + objKey);
        }

        String objectKey = extractObjectKey(mediaUrl);
        try {
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
            return maybeTranscodeVideo(response.asByteArray(), contentType, fileName);
        } catch (Exception e) {
            throw new RuntimeException("Không tải được media từ R2: " + e.getMessage());
        }
    }

    private DocumentFile maybeTranscodeVideo(byte[] content, String contentType, String fileName) {
        if (!isVideoContent(contentType, fileName)) {
            return new DocumentFile(content, contentType, fileName);
        }

        Path inputFile = null;
        Path outputFile = null;
        try {
            inputFile = Files.createTempFile("story-video-input-", getExtension(fileName).isBlank() ? ".mp4" : getExtension(fileName));
            outputFile = Files.createTempFile("story-video-output-", ".mp4");
            Files.write(inputFile, content);

            Process process = new ProcessBuilder(
                    "ffmpeg",
                    "-y",
                    "-i", inputFile.toAbsolutePath().toString(),
                    "-map", "0:v:0",
                    "-map", "0:a?",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-crf", "23",
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-ar", "44100",
                    "-ac", "2",
                    outputFile.toAbsolutePath().toString()
            ).redirectErrorStream(true).start();

            String output;
            try (InputStream stream = process.getInputStream()) {
                output = new String(stream.readAllBytes());
            }

            boolean finished = process.waitFor(60, TimeUnit.SECONDS);
            if (!finished || process.exitValue() != 0 || !Files.exists(outputFile) || Files.size(outputFile) == 0) {
                throw new RuntimeException("ffmpeg chuyển đổi video thất bại: " + output.trim());
            }

            byte[] converted = Files.readAllBytes(outputFile);
            return new DocumentFile(converted, "video/mp4", ensureMp4FileName(fileName));
        } catch (Exception e) {
            return new DocumentFile(content, contentType != null && !contentType.isBlank() ? contentType : guessContentType(fileName), fileName);
        } finally {
            if (inputFile != null) {
                try {
                    Files.deleteIfExists(inputFile);
                } catch (IOException ignored) {
                }
            }
            if (outputFile != null) {
                try {
                    Files.deleteIfExists(outputFile);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private boolean isVideoContent(String contentType, String fileName) {
        String loweredType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (loweredType.startsWith("video/")) {
            return true;
        }

        String loweredName = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        return loweredName.endsWith(".mp4") || loweredName.endsWith(".webm") || loweredName.endsWith(".mov") || loweredName.endsWith(".m4v");
    }

    private String ensureMp4FileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "video.mp4";
        }
        int dotIndex = fileName.lastIndexOf('.');
        String baseName = dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
        return baseName + ".mp4";
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
            String sanitizedUrl = documentUrl.trim().replace(" ", "%20");
            URI uri = URI.create(sanitizedUrl);
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
        if (lowered.endsWith(".gif")) {
            return "image/gif";
        }
        if (lowered.endsWith(".mp4")) {
            return "video/mp4";
        }
        if (lowered.endsWith(".webm")) {
            return "video/webm";
        }
        if (lowered.endsWith(".mov")) {
            return "video/quicktime";
        }
        if (lowered.endsWith(".m4v")) {
            return "video/x-m4v";
        }
        if (lowered.endsWith(".pdf")) {
            return "application/pdf";
        }
        return "application/octet-stream";
    }
}
