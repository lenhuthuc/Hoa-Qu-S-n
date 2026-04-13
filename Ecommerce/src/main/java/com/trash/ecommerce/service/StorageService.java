package com.trash.ecommerce.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface StorageService {
    String uploadSellerDocument(Long userId, MultipartFile file, String category) throws IOException;

    DocumentFile downloadSellerDocument(String documentUrl);

    record DocumentFile(byte[] content, String contentType, String fileName) {}
}
