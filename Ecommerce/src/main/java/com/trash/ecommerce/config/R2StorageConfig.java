package com.trash.ecommerce.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

@Configuration
public class R2StorageConfig {

    @Bean
    public S3Client s3Client(
            @Value("${CLOUDFLARE_R2_ENDPOINT:}") String endpoint,
            @Value("${S3_ACCESS_KEY:}") String accessKey,
            @Value("${S3_SECRET_KEY:}") String secretKey,
            @Value("${S3_BUCKET:}") String bucket
    ) {
        String normalizedEndpoint = normalizeEndpoint(endpoint, bucket);
        if (normalizedEndpoint.isBlank()) {
            throw new IllegalStateException("CLOUDFLARE_R2_ENDPOINT is required for R2 storage");
        }
        if (accessKey == null || accessKey.isBlank() || secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("S3_ACCESS_KEY and S3_SECRET_KEY are required for R2 storage");
        }

        return S3Client.builder()
                .endpointOverride(URI.create(normalizedEndpoint))
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey.trim(), secretKey.trim())
                ))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    private String normalizeEndpoint(String endpoint, String bucket) {
        if (endpoint == null) {
            return "";
        }
        String value = endpoint.trim();
        if (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        if (bucket != null && !bucket.isBlank()) {
            String bucketSuffix = "/" + bucket.trim();
            if (value.endsWith(bucketSuffix)) {
                value = value.substring(0, value.length() - bucketSuffix.length());
            }
        }
        return value;
    }
}
