package com.trash.ecommerce.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class ReturnEvidenceServiceImpl implements ReturnEvidenceService {

    private static final int MAX_FILE_COUNT = 5;
    private static final int MAX_IMAGE_COUNT = 3;
    private static final int MAX_VIDEO_COUNT = 2;

    @Autowired
    private StorageService storageService;

    @Override
    public List<String> uploadEvidence(Long userId, List<MultipartFile> files) throws IOException {
        List<MultipartFile> normalizedFiles = files == null ? List.of() : files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();

        if (normalizedFiles.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng chọn ít nhất một tệp bằng chứng");
        }
        if (normalizedFiles.size() > MAX_FILE_COUNT) {
            throw new IllegalArgumentException("Tối đa " + MAX_FILE_COUNT + " tệp bằng chứng cho mỗi yêu cầu");
        }

        int imageCount = 0;
        int videoCount = 0;
        for (MultipartFile file : normalizedFiles) {
            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            if (contentType.startsWith("image/")) {
                imageCount++;
            } else if (contentType.startsWith("video/")) {
                videoCount++;
            } else {
                throw new IllegalArgumentException("Chỉ chấp nhận ảnh hoặc video làm bằng chứng");
            }
        }

        if (imageCount > MAX_IMAGE_COUNT) {
            throw new IllegalArgumentException("Tối đa " + MAX_IMAGE_COUNT + " ảnh bằng chứng cho mỗi yêu cầu");
        }
        if (videoCount > MAX_VIDEO_COUNT) {
            throw new IllegalArgumentException("Tối đa " + MAX_VIDEO_COUNT + " video bằng chứng cho mỗi yêu cầu");
        }

        List<String> urls = new ArrayList<>();
        for (MultipartFile file : normalizedFiles) {
            String mediaType = file.getContentType() != null && file.getContentType().toLowerCase(Locale.ROOT).startsWith("video/")
                    ? "video"
                    : "image";
            urls.add(storageService.uploadReviewMedia(userId, file, mediaType));
        }
        return urls;
    }
}