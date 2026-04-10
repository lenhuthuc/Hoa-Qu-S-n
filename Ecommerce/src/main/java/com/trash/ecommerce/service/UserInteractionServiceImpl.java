package com.trash.ecommerce.service;

import com.trash.ecommerce.entity.UserInteractions;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.dto.ProductDetailsResponseDTO;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.UserInteractionsRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.exception.FindingUserError;
import com.trash.ecommerce.exception.ProductFingdingException;
import com.trash.ecommerce.mapper.ProductMapper;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserInteractionServiceImpl implements UserInteractionService {

    @Autowired
    private UserInteractionsRepository userInteractionsRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductMapper productMapper;

    @Transactional
    public UserInteractions recordInteraction(Long userId, Long productId) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new FindingUserError("User not found"));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ProductFingdingException("Product not found"));

        UserInteractions interaction = new UserInteractions();
        interaction.setUser(user);
        interaction.setProduct(product);
        interaction.setCreatedAt(LocalDateTime.now());

        return userInteractionsRepository.save(interaction);
    }

    public List<ProductDetailsResponseDTO> getUserInteractions(Long userId) {
        List<UserInteractions> userInteractions = userInteractionsRepository.findByUserId(userId);
        if (userInteractions.isEmpty()) {
            return Collections.emptyList();
        }
        // Get category IDs from interacted products for same-category recommendations
        List<Long> interactedProductIds = userInteractions.stream()
            .map(ui -> ui.getProduct().getId())
            .distinct()
            .collect(Collectors.toList());

        List<Long> categoryIds = userInteractions.stream()
            .map(ui -> ui.getProduct().getCategory())
            .filter(cat -> cat != null)
            .map(cat -> cat.getId())
            .distinct()
            .collect(Collectors.toList());

        // Recommend products from same categories, excluding already viewed
        List<Product> candidates = productRepository.findAll().stream()
            .filter(p -> !interactedProductIds.contains(p.getId()))
            .filter(p -> p.getCategory() != null && categoryIds.contains(p.getCategory().getId()))
            .limit(10)
            .collect(Collectors.toList());

        // Fallback: if not enough same-category products, add top-rated ones
        if (candidates.size() < 5) {
            List<Long> candidateIds = candidates.stream().map(Product::getId).collect(Collectors.toList());
            productRepository.findAll().stream()
                .filter(p -> !interactedProductIds.contains(p.getId()) && !candidateIds.contains(p.getId()))
                .limit(10 - candidates.size())
                .forEach(candidates::add);
        }

        return candidates.stream()
            .map(productMapper::mapperProduct)
            .collect(Collectors.toList());
    }

    public List<UserInteractions> getProductInteractions(Long productId) {
        return userInteractionsRepository.findByProductId(productId);
    }

    public List<UserInteractions> getUserProductInteractions(Long userId, Long productId) {
        return userInteractionsRepository.findByUserIdAndProductId(userId, productId);
    }
}
