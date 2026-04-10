package com.trash.ecommerce.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class ReviewResponse {
    @JsonProperty("id")
    private Long reviewId;
    private Long userId;
    private String reviewerName;
    private Long productId;
    private Integer rating;
    @JsonProperty("comment")
    private String content;
    private List<String> mediaUrls;
    private String createdAt;
}
