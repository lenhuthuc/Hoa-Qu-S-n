package com.trash.ecommerce.service;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.mapper.ProductMapper;
import com.trash.ecommerce.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.trash.ecommerce.dto.ProductDetailsResponseDTO;
import com.trash.ecommerce.dto.ProductRequestDTO;
import com.trash.ecommerce.dto.ProductResponseDTO;
import com.trash.ecommerce.exception.FindingUserError;
import com.trash.ecommerce.exception.ProductFingdingException;

import jakarta.transaction.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private JwtService jwtService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProductMapper productMapper;
    @Autowired
    private CartItemRepository cartItemRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private ProductImageRepository productImageRepository;
    @Override
    public ProductDetailsResponseDTO findProductById(Long id) {
        ProductDetailsResponseDTO productDTO = new ProductDetailsResponseDTO();
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ProductFingdingException("Không tìm thấy sản phẩm"));
        productDTO = productMapper.mapperProduct(product);
        return productDTO;
    }

    @Override
    public List<ProductDetailsResponseDTO> findAllProduct(int noPage, int sizePage) {
        PageRequest pageRequest = PageRequest.of(noPage, sizePage);
        Page<Product> products = productRepository.findAll(pageRequest);
        List<ProductDetailsResponseDTO> productsDTOs = products
                .getContent()
                .stream()
                .map(product -> productMapper.mapperProduct(product))
                .toList();
        return productsDTOs;
    }

    @Override
    public List<ProductDetailsResponseDTO> findProductByName(String name, int noPage, int sizePage) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Product name cannot be null or empty");
        }
        PageRequest pageRequest = PageRequest.of(noPage, sizePage);
        Page<Product> products = productRepository.findProductsByName(name, pageRequest);
        List<ProductDetailsResponseDTO> productDetailsResponseDTO = products.getContent()
                                                                                .stream()
                                                                                .map(product -> productMapper.mapperProduct(product))
                                                                                .toList();
        return productDetailsResponseDTO;
    }

    @Override
    public ProductResponseDTO createProduct(ProductRequestDTO productRequestDTO, MultipartFile file, Long sellerId) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        
        Product product = new Product();
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isEmpty()) {
            throw new IllegalArgumentException("File name is required");
        }
        
        String fileResource = UUID.randomUUID() + "_" + originalFilename;
        Path path = Paths.get("uploads/" + fileResource);
        Files.copy(file.getInputStream(), path);

        product.setPrice(productRequestDTO.getPrice());
        product.setProductName(productRequestDTO.getProductName());
        product.setUnitWeightGrams(productRequestDTO.getUnitWeightGrams());
        product.setTotalStockWeightKg(productRequestDTO.getTotalStockWeightKg());
        product.setShelfLifeDays(productRequestDTO.getShelfLifeDays());
        product.setQuantity(resolveInventoryQuantity(productRequestDTO, null));
        product.setDescription(productRequestDTO.getDescription());
        product.setBatchId(productRequestDTO.getBatchId());
        product.setOrigin(productRequestDTO.getOrigin());

        // Category
        if (productRequestDTO.getCategoryId() != null) {
            Category category = categoryRepository.findById(productRequestDTO.getCategoryId())
                    .orElseThrow(() -> new ProductFingdingException("Category not found"));
            product.setCategory(category);
        }

        // Seller
        if (sellerId != null) {
            Users seller = userRepository.findById(sellerId)
                    .orElseThrow(() -> new FindingUserError("Seller not found"));
            product.setSeller(seller);
        }

        product = productRepository.save(product);

        // Save primary image
        ProductImage primaryImage = new ProductImage();
        primaryImage.setProduct(product);
        primaryImage.setImagePath(fileResource);
        primaryImage.setSortOrder(0);
        primaryImage.setIsPrimary(true);
        productImageRepository.save(primaryImage);
        product.getImages().add(primaryImage);

        ProductResponseDTO response = new ProductResponseDTO("creating product is successful");
        response.setProductId(product.getId());
        return response;
    }

    @Override
    @Transactional
    public ProductResponseDTO updateProduct(ProductRequestDTO productRequestDTO, Long id, MultipartFile file) throws IOException {
        Product product = productRepository.findById(id).orElseThrow(
            () -> new ProductFingdingException("Product is not found")
        );
        if (file != null && !file.isEmpty()) {
            // Delete old primary image file
            String oldImgPath = product.getPrimaryImagePath();
            if (oldImgPath != null && !oldImgPath.isEmpty()) {
                Path oldFilePath = Paths.get("uploads/" + oldImgPath);
                File oldFile = oldFilePath.toFile();
                if (oldFile.exists()) {
                    oldFile.delete();
                }
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.isEmpty()) {
                throw new IllegalArgumentException("File name is required");
            }
            
            String filename = UUID.randomUUID() + "_" + originalFilename;
            Path uploadPath = Paths.get("uploads/" + filename);
            Files.copy(file.getInputStream(), uploadPath, StandardCopyOption.REPLACE_EXISTING);

            // Remove old primary image record and add new one
            product.getImages().removeIf(img -> Boolean.TRUE.equals(img.getIsPrimary()));
            ProductImage newImage = new ProductImage();
            newImage.setProduct(product);
            newImage.setImagePath(filename);
            newImage.setSortOrder(0);
            newImage.setIsPrimary(true);
            product.getImages().add(newImage);
        }
        if (productRequestDTO.getPrice() != null) {
            product.setPrice(productRequestDTO.getPrice());
        }
        if (productRequestDTO.getProductName() != null && !productRequestDTO.getProductName().isEmpty()) {
            product.setProductName(productRequestDTO.getProductName());
        }
        if (productRequestDTO.getQuantity() != null) {
            product.setQuantity(productRequestDTO.getQuantity());
        }
        if (productRequestDTO.getUnitWeightGrams() != null) {
            product.setUnitWeightGrams(productRequestDTO.getUnitWeightGrams());
        }
        if (productRequestDTO.getTotalStockWeightKg() != null) {
            product.setTotalStockWeightKg(productRequestDTO.getTotalStockWeightKg());
        }
        if (productRequestDTO.getShelfLifeDays() != null) {
            product.setShelfLifeDays(productRequestDTO.getShelfLifeDays());
        }
        if (productRequestDTO.getUnitWeightGrams() != null
                || productRequestDTO.getTotalStockWeightKg() != null) {
            product.setQuantity(resolveInventoryQuantity(productRequestDTO, product.getQuantity()));
        }
        if (productRequestDTO.getCategoryId() != null) {
            Category category = categoryRepository.findById(productRequestDTO.getCategoryId())
                    .orElseThrow(() -> new ProductFingdingException("Category not found"));
            product.setCategory(category);
        }
        if (productRequestDTO.getDescription() != null) {
            product.setDescription(productRequestDTO.getDescription());
        }
        productRepository.save(product);
        return new ProductResponseDTO("Update product is successful");
    }

    @Override
    @Transactional
    public ProductResponseDTO deleteProductById(Long id) {
        Product product = productRepository.findById(id).orElseThrow(
            () -> new ProductFingdingException("Product is not found")
        );
        if (product.getCartItems() != null) {
            for(CartItem cartItem : product.getCartItems())  {
                if (cartItem != null) {
                    cartItem.setProduct(null);
                }
            }
        }
        productRepository.delete(product);
        return new ProductResponseDTO("successful");
    }

    @Override
    public ProductResponseDTO addToCart(String token, Long productId, Long quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than 0");
        }
        
        Long userId = jwtService.extractId(token);
        Users users = userRepository.findById(userId)
                                        .orElseThrow(() -> new FindingUserError("user is not found"));
        Cart cart = users.getCart();
        if (cart == null) {
            throw new FindingUserError("Cart not found for user");
        }
        
        Long cartId = cart.getId();
        if (cartId == null) {
            throw new FindingUserError("Cart ID is null");
        }
        
        Product product = productRepository.findById(productId)
                                        .orElseThrow(() -> new ProductFingdingException("product can't be found"));
        
        CartItemId cartItemId = new CartItemId(cartId, productId);
        CartItem cartItem = new CartItem();
        cartItem.setId(cartItemId);
        cartItem.setCart(cart);
        cartItem.setProduct(product);
        cartItem.setQuantity(quantity);
        
        if (product.getCartItems() == null) {
            product.setCartItems(new HashSet<>());
        }
        product.getCartItems().add(cartItem);
        
        if (cart.getItems() == null) {
            cart.setItems(new HashSet<>());
        }
        cart.getItems().add(cartItem);
        
        // SAVE cartItem vào database
        cartItemRepository.save(cartItem);
        
        return new ProductResponseDTO("Them san pham vao gio hang thanh cong !");
    }

    private Long resolveInventoryQuantity(ProductRequestDTO productRequestDTO, Long currentQuantity) {
        Long unitWeightGrams = productRequestDTO.getUnitWeightGrams();
        BigDecimal totalStockWeightKg = productRequestDTO.getTotalStockWeightKg();

        if (unitWeightGrams != null || totalStockWeightKg != null) {
            if (unitWeightGrams == null || unitWeightGrams <= 0) {
                throw new IllegalArgumentException("Trọng lượng mỗi sản phẩm phải lớn hơn 0 gram");
            }
            if (totalStockWeightKg == null || totalStockWeightKg.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Tổng trọng lượng hàng phải lớn hơn 0 kg");
            }

            BigDecimal totalWeightGrams = totalStockWeightKg.multiply(BigDecimal.valueOf(1000));
            long computedQuantity = totalWeightGrams
                    .divide(BigDecimal.valueOf(unitWeightGrams), 0, RoundingMode.DOWN)
                    .longValue();
            if (computedQuantity <= 0) {
                throw new IllegalArgumentException("Tổng trọng lượng phải đủ để tạo ít nhất 1 sản phẩm tồn kho");
            }
            return computedQuantity;
        }

        if (productRequestDTO.getQuantity() != null) {
            return productRequestDTO.getQuantity();
        }
        if (currentQuantity != null) {
            return currentQuantity;
        }

        throw new IllegalArgumentException("Thiếu số lượng tồn kho hoặc thông tin trọng lượng");
    }

    @Override
    public String getImgProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ProductFingdingException("Product not found"));
        String imgData = product.getPrimaryImagePath();
        if (imgData == null || imgData.isEmpty()) {
            throw new ProductFingdingException("Product image not found");
        }
        return imgData;
    }

    @Override
    public List<ProductDetailsResponseDTO> getProductsRecommendation(Long productId) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ProductFingdingException("Product not found"));

        // Recommend products from same category, excluding the current product
        List<Product> candidates = productRepository.findAll().stream()
            .filter(p -> !p.getId().equals(productId))
            .filter(p -> product.getCategory() != null && p.getCategory() != null
                && p.getCategory().getId().equals(product.getCategory().getId()))
            .limit(8)
            .toList();

        // Fallback: if not enough same-category, add other products
        if (candidates.size() < 4) {
            List<Long> candidateIds = candidates.stream().map(Product::getId).toList();
            List<Product> extras = productRepository.findAll().stream()
                .filter(p -> !p.getId().equals(productId) && !candidateIds.contains(p.getId()))
                .limit(8 - candidates.size())
                .toList();
            List<Product> combined = new ArrayList<>(candidates);
            combined.addAll(extras);
            candidates = combined;
        }

        return candidates.stream()
            .map(productMapper::mapperProduct)
            .toList();
    }
}
