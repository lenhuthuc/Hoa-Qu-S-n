package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.ProductRequestDTO;
import com.trash.ecommerce.dto.ProductResponseDTO;
import com.trash.ecommerce.dto.SellerApplicationResponseDTO;
import com.trash.ecommerce.dto.SellerApplicationReviewRequestDTO;
import com.trash.ecommerce.dto.UserProfileDTO;
import com.trash.ecommerce.dto.UserResponseDTO;
import com.trash.ecommerce.entity.SellerApplication;
import com.trash.ecommerce.exception.FindingUserError;
import com.trash.ecommerce.exception.ProductCreatingException;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.ProductService;
import com.trash.ecommerce.service.SellerApplicationService;
import com.trash.ecommerce.service.StorageService;
import com.trash.ecommerce.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private Logger logger = LoggerFactory.getLogger(CartController.class);
    @Autowired
    private UserService userService;

    @Autowired
    private ProductService productService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private SellerApplicationService sellerApplicationService;

    @Autowired
    private SellerApplicationRepository sellerApplicationRepository;

    @Autowired
    private StorageService storageService;

    // ========== USER MANAGEMENT ==========
    @GetMapping("/users")
    public ResponseEntity<List<UserProfileDTO>> getAllUsers(
            @RequestParam(value = "noPage", defaultValue = "0", required = false) int noPage,
            @RequestParam(value = "sizePage", defaultValue = "20", required = false) int sizePage
    ) {
        try {
            List<UserProfileDTO> users = userService.findAllUser(noPage, sizePage);
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            throw new FindingUserError(e.getMessage());
        }
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserProfileDTO> findUser(@PathVariable Long id) {
        try {
            UserProfileDTO user = userService.findUsersById(id);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            throw new FindingUserError(e.getMessage());
        }
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(
            @PathVariable Long id,
            @RequestHeader("Authorization") String token
    ) {
        try {
            userService.deleteUser(id, token);
            return ResponseEntity.ok(new UserResponseDTO("Succesful"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    // ========== PRODUCT MANAGEMENT ==========
    @PostMapping("/products")
    public ResponseEntity<ProductResponseDTO> addProduct(
            @RequestPart("products") ProductRequestDTO productRequestDTO,
            @RequestPart("file") MultipartFile file
    ) {
        try {
            ProductResponseDTO productResponseDTO = productService.createProduct(productRequestDTO, file, null);
            return ResponseEntity.ok(productResponseDTO);
        } catch (Exception e) {
            throw new ProductCreatingException(e.getMessage());
        }
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<?> updateProduct(
            @RequestPart("products") ProductRequestDTO productRequestDTO,
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file
    ) {
        try {
            ProductResponseDTO productResponseDTO = productService.updateProduct(productRequestDTO, id, file);
            return ResponseEntity.ok(productResponseDTO);
        } catch (Exception e) {
            logger.error("Update product has some problem", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<ProductResponseDTO> deleteProduct(@PathVariable Long id) {
        try {
            ProductResponseDTO productResponseDTO = productService.deleteProductById(id);
            return ResponseEntity.ok(productResponseDTO);
        } catch (Exception e) {
            throw new ProductCreatingException(e.getMessage());
        }
    }

    // ========== SELLER APPLICATIONS ==========
    @GetMapping("/seller-applications")
    public ResponseEntity<?> getSellerApplications(
            @RequestParam(required = false) String status
    ) {
        try {
            List<SellerApplicationResponseDTO> applications = sellerApplicationService.getAll(status);
            return ResponseEntity.ok(applications);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/seller-applications/{id}/start-review")
    public ResponseEntity<?> startReviewSellerApplication(
            @PathVariable Long id,
            @RequestHeader("Authorization") String token
    ) {
        try {
            Long adminId = jwtService.extractId(token);
            SellerApplicationResponseDTO response = sellerApplicationService.startReview(adminId, id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/seller-applications/{id}/review")
    public ResponseEntity<?> reviewSellerApplication(
            @PathVariable Long id,
            @RequestHeader("Authorization") String token,
            @RequestBody SellerApplicationReviewRequestDTO request
    ) {
        try {
            Long adminId = jwtService.extractId(token);
            SellerApplicationResponseDTO response = sellerApplicationService.review(adminId, id, request.getAction(), request.getNote());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/seller-applications/{id}/documents/{type}")
    public ResponseEntity<?> streamSellerApplicationDocument(
            @PathVariable Long id,
            @PathVariable String type
    ) {
        try {
            SellerApplication app = sellerApplicationRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy hồ sơ đăng ký"));

            String normalizedType = type == null ? "" : type.trim().toLowerCase();
            String documentUrl = switch (normalizedType) {
                case "front" -> app.getIdCardFrontUrl();
                case "back" -> app.getIdCardBackUrl();
                case "license" -> app.getBusinessLicenseUrl();
                case "food-safety" -> app.getFoodSafetyDocumentUrl();
                default -> throw new RuntimeException("Loại tài liệu không hợp lệ");
            };

            if (documentUrl == null || documentUrl.isBlank()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "Không tìm thấy tài liệu"));
            }

            StorageService.DocumentFile file = storageService.downloadSellerDocument(documentUrl);
            MediaType mediaType;
            try {
                mediaType = MediaType.parseMediaType(file.contentType());
            } catch (Exception ignored) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                    .body(file.content());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}