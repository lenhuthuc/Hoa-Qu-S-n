# IMPLEMENTATION LOG (Concise)

Last Updated: 2026-04-15  
Status: Complete and deployed

## Scope Summary
- Seller onboarding flow completed (upload, review, email workflow).
- Checkout/cart/order flow upgraded (preview, shipping validation, payment retry, UI redesign).
- GHN integration completed (province/district/ward, fee + leadtime validation).

## Task Checklist

### Task 1 - R2 Document Upload (Backend)
- Added Cloudflare R2 upload service for seller documents.
- Added upload endpoint for seller onboarding documents.
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/config/R2StorageConfig.java, Ecommerce/src/main/java/com/trash/ecommerce/service/R2StorageServiceImpl.java, Ecommerce/src/main/java/com/trash/ecommerce/controller/UserController.java.

### Task 2 - Seller Email Workflow
- Added async email notifications for submit/start review/approve/revision/reject.
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/service/SellerApplicationServiceImpl.java, Ecommerce/src/main/resources/application.properties, docker-compose.yml.

### Task 3 - Auto UNDER_REVIEW Transition
- Added start-review flow before review decision.
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/controller/AdminController.java, Ecommerce/src/main/java/com/trash/ecommerce/service/SellerApplicationService.java, frontend/src/lib/api.ts, frontend/src/app/admin/page.tsx.

### Task 4 - Frontend File Upload Form
- Reworked seller registration form to upload files instead of plain URL input.
- Main files: frontend/src/app/seller/register/page.tsx, frontend/src/lib/api.ts.

### Task 5 - Admin Seller Detail Modal
- Added seller application detail modal with document preview and review actions.
- Main file: frontend/src/app/admin/page.tsx.

### Task 6 - Checkout and Payment Hardening
- Added order preview, voucher split (discount/freeship), stock reservation, payment retry flow.
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/service/OrderServiceImpl.java, Ecommerce/src/main/java/com/trash/ecommerce/controller/OrderController.java, frontend/src/app/checkout/page.tsx, frontend/src/app/orders/[id]/page.tsx.

### Task 7 - Weight-Based Product Stock
- Added weight inputs for seller posting and auto stock calculation.
- Formula: quantity = floor(totalStockWeightKg * 1000 / unitWeightGrams).
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/entity/Product.java, frontend/src/app/seller/create-post/page.tsx, frontend/src/app/seller/products/create/page.tsx.

### Task 8 - GHN Phase 1 (Address + Preview)
- Added shipping APIs for provinces/districts/wards and preview with delivery type.
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/controller/ShippingController.java, Ecommerce/src/main/java/com/trash/ecommerce/service/ShippingValidationService.java, frontend/src/lib/api.ts, frontend/src/app/checkout/page.tsx.

### Task 9 - Shipping Freshness and Service Type Filter
- Enforced freshness check by leadtime vs shelf-life.
- Allowed only service types 1 and 2; blocked unsupported options gracefully.
- Returned canCheckout=false + warning messages instead of hard-fail exception.
- Main files: Ecommerce/src/main/java/com/trash/ecommerce/service/ShippingValidationService.java, Ecommerce/src/main/java/com/trash/ecommerce/service/OrderServiceImpl.java, frontend/src/app/checkout/page.tsx.

### Task 10 - Checkout and Cart UI Redesign
- Rebuilt checkout and cart screens with green brand theme, responsive layout, sticky summary.
- Main files: frontend/src/app/checkout/page.tsx, frontend/src/app/cart/page.tsx.

### Task 11 - Order Detail UI Redesign and Data Fix
- Rebuilt orders/[id] page with progress stepper and modern summary panel.
- Removed support card section.
- Fixed payment method type comparison for build stability.
- Replaced hardcoded delivery address with real data from order API (order.address), optional profile phone fallback.
- Removed product subtitle lines per latest request (Sản phẩm nông sản hữu cơ, VietGAP).
- Main file: frontend/src/app/orders/[id]/page.tsx.

## Build/Verification
- Frontend build: pass (next build, all routes generated).
- Docker stack build: pass (docker compose up -d --build).

## Key APIs Added/Used
- GET /api/shipping/provinces
- GET /api/shipping/districts?provinceId=...
- GET /api/shipping/wards?districtId=...
- GET /api/orders/preview
- POST /api/orders/create
- POST /api/orders/{id}/retry-payment
- POST /api/user/seller-applications/documents
- PUT /api/admin/seller-applications/{id}/start-review
- PUT /api/admin/seller-applications/{id}/review

## Deployment Command
```bash
docker compose up -d --build
```
