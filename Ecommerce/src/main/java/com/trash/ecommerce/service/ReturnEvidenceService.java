package com.trash.ecommerce.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface ReturnEvidenceService {
    List<String> uploadEvidence(Long userId, List<MultipartFile> files) throws IOException;
}