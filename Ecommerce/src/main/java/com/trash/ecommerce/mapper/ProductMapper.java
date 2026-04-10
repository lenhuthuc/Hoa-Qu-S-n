package com.trash.ecommerce.mapper;

import com.trash.ecommerce.dto.ProductDetailsResponseDTO;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.ProductImage;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class ProductMapper {

    public ProductDetailsResponseDTO mapperProduct(Product product) {
        ProductDetailsResponseDTO productDTO = new ProductDetailsResponseDTO();
        productDTO.setId(product.getId());
        productDTO.setProduct_name(product.getProductName());
        productDTO.setQuantity(product.getQuantity());
        productDTO.setPrice(product.getPrice());
        // Category
        if (product.getCategory() != null) {
            productDTO.setCategoryId(product.getCategory().getId());
            productDTO.setCategoryName(product.getCategory().getName());
        }
        productDTO.setDescription(product.getDescription());
        // Primary image
        String primaryImage = product.getPrimaryImagePath();
        productDTO.setImage(primaryImage != null ? "/api/products/" + product.getId() + "/img" : null);
        // All image URLs
        if (product.getImages() != null && !product.getImages().isEmpty()) {
            List<String> imageUrls = product.getImages().stream()
                    .map(img -> "/api/products/" + product.getId() + "/images/" + img.getId())
                    .collect(Collectors.toList());
            productDTO.setImageUrls(imageUrls);
        }
        productDTO.setRatingCount(product.getRatingCount());
        productDTO.setRating(product.getRating() != null ? product.getRating().doubleValue() : 0.0);
        // Seller
        if (product.getSeller() != null) {
            productDTO.setSellerId(product.getSeller().getId());
            productDTO.setSellerName(product.getSeller().getFullName() != null
                    ? product.getSeller().getFullName() : product.getSeller().getEmail());
        }
        // Traceability
        productDTO.setBatchId(product.getBatchId());
        productDTO.setOrigin(product.getOrigin());
        return productDTO;
    }
}
