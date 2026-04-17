package com.trash.ecommerce.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface StorageService {
    String uploadSellerDocument(Long userId, MultipartFile file, String category) throws IOException;

    DocumentFile downloadSellerDocument(String documentUrl);

    /**
     * Upload review media (image/video) to R2 or local fallback.
     * @param userId User ID (for folder organization)
     * @param file Image or video file
     * @param mediaType "image" or "video"
     * @return Public URL or local path reference
     */
    String uploadReviewMedia(Long userId, MultipartFile file, String mediaType) throws IOException;

    /**
     * Download review media by URL (support both R2 and local paths).
     * @param mediaUrl Public URL or local reference
     * @return File content with metadata
     */
    DocumentFile downloadReviewMedia(String mediaUrl);

    record DocumentFile(byte[] content, String contentType, String fileName) {}
}
