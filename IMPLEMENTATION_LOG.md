# IMPLEMENTATION LOG (Concise)

Last Updated: 2026-04-20  
Status: Complete and deployed

## Update 2026-04-20 - Facebook Share Dialog Integration

What was implemented:
- Added Facebook Share Dialog for product sharing on social media.
- Integrated Facebook SDK initialization in app layout.
- Implemented server-side Open Graph (OG) tag generation via Next.js `generateMetadata()`.
- Created layout.tsx for `/product/[id]` route to generate rich metadata (image, description with hashtags).
- Built `shareToFacebookDialog()` helper function for client-side Share Dialog invocation.
- Configured automatic OG tags with product info: name, price, image, description with #hoaquason hashtags.

Key Features:
- Users can share products directly to their Facebook feed from product detail page.
- Facebook auto-crawls OG tags from `/product/[id]` for rich preview (image, product name, price, description).
- Each user logs in with their own Facebook account before sharing (uses one centralized Facebook App ID).
- Hashtags (#hoaquason #nongsan #traicay #fresh #vietnam) automatically included in OG description.
- Picture parameter in Share Dialog as fallback for image rendering.

Files Modified:
- frontend/src/lib/facebookShare.ts — Share Dialog helper with `shareToFacebookDialog()` function.
- frontend/src/app/product/[id]/layout.tsx — New file with `generateMetadata()` for OG tag generation.
- frontend/src/app/layout.tsx — Facebook SDK initialization (if not already present).
- README.md — Added configuration guide and troubleshooting for Facebook Share.

Configuration Required:
1. Create Facebook App: https://developers.facebook.com → Create App
2. Add App ID to `.env.local`: `NEXT_PUBLIC_FB_APP_ID=<your-app-id>`
3. Add domain to Facebook App Settings → Settings → Basic → App Domains (e.g., ngrok URL or production domain)
4. Update `NEXT_PUBLIC_SHARE_URL` in `.env.local` to match the public URL

Testing:
- Share product from `/product/[id]` page
- Use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing) to verify OG tags
- Verify image, description, and hashtags appear in Facebook preview

Domain Changes:
- If domain changes (ngrok URL → production), only update:
  - `.env.local` with new `NEXT_PUBLIC_SHARE_URL`
  - Facebook App Settings with new domain
  - No code changes required

Verification Status:
- Frontend build: pass
- facebookShare.ts: no compilation errors
- layout.tsx: generates correct OG tags on server

---
## Update 2026-04-17 - Review Media Upload to Cloudflare R2

What was implemented:
- Migrated review media storage from local disk to Cloudflare R2 object storage.
- Extended StorageService interface with `uploadReviewMedia()` and `downloadReviewMedia()` methods.
- Implemented R2 media upload with validation:
	- Images: 5MB each, max 2 per review (JPEG/PNG/WEBP/GIF)
	- Videos: 25MB each, max 1 per review (MP4/WEBM/MOV/M4V)
	- Total: 30MB per review
- Automatic fallback to local storage if R2 fails (resilient design).
- Refactored ReviewController to use StorageService instead of direct file I/O:
	- Removed local file handling logic
	- Centralized validation in StorageService
	- Unified media retrieval endpoint for both R2 and local references
- Upload path structure: `review-media/{userId}/{mediaType}/{timestamp}_{filename}`
- Backward compatible: supports both R2 public URLs and local reference URLs (prefixed with `local:`).

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/service/StorageService.java
- Ecommerce/src/main/java/com/trash/ecommerce/service/R2StorageServiceImpl.java
- Ecommerce/src/main/java/com/trash/ecommerce/controller/ReviewController.java

Verification Status:
- Backend compile: pass (226 source files, warnings only).
- No DB schema changes needed (URLs still stored as strings in review_attachments).

Requirements:
- Set environment variables: CLOUDFLARE_R2_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET

## Update 2026-04-17 - Review Media Display Compatibility (R2 + Local Legacy)

What was implemented:
- Restored missing review list and delete endpoints in ReviewController to recover review rendering on product page.
- Added media proxy endpoint by URL (`GET /api/reviews/media?url=...`) so frontend can load review media through backend consistently.
- Updated product detail review media rendering to use backend proxy instead of raw stored URLs.
- Added backward compatibility for legacy review media formats:
	- Legacy URL pattern `/api/reviews/media/{filename}`
	- Plain filenames stored from old local upload flow
	- Local key patterns under both `reviews/` and `review-media/`
- Extended local file resolution candidates and improved media content-type detection for image/video extensions.

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/controller/ReviewController.java
- Ecommerce/src/main/java/com/trash/ecommerce/service/R2StorageServiceImpl.java
- frontend/src/app/product/[id]/page.tsx

Verification Status:
- Backend compile: pass.
- Frontend build: pass.
- Docker rebuild/restart: pass.

## Update 2026-04-17 - DM Chat Naming Uses Shop Name

What was implemented:
- Fixed conversation/chat display naming source in direct messages.
- `otherUserName` and `senderName` now resolve to seller `shopName` when seller has a SellerApplication.
- Added safe fallback chain when shopName is unavailable: fullName -> username -> email.

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/controller/MessageController.java

Verification Status:
- Backend compile: pass.
- Docker rebuild/restart: pass.

## Update 2026-04-17 - Orders Contact Seller Direct Routing

What was implemented:
- Added `sellerId` field to order item response DTO so frontend can route to exact seller chat.
- Mapped sellerId from product seller in OrderMapper for order list/detail payloads.
- Updated orders page "Liên hệ người bán" button:
	- Single seller order -> direct to `/messages?sellerId={sellerId}`
	- Multi-seller/unknown -> fallback `/messages`

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/dto/CartItemDetailsResponseDTO.java
- Ecommerce/src/main/java/com/trash/ecommerce/mapper/OrderMapper.java
- frontend/src/app/orders/page.tsx

Verification Status:
- Backend compile: pass.
- Frontend build: pass.

## Update 2026-04-17 - Buy Now Display Mode (Cart UI, Isolated Data)

What was implemented:
- Separated buy-now display flow from normal cart data.
- Product detail `Mua ngay` now stores temporary buy-now payload and navigates to cart with `mode=buy-now`.
- Cart page now supports `buy-now` mode:
	- Shows only the immediate selected product and quantity.
	- Does not load or display existing cart items.
	- Quantity updates affect buy-now payload only.
	- Checkout button routes with `mode=buy-now` for next-step separation.
- Wrapped cart page with Suspense boundary to satisfy Next.js `useSearchParams()` prerender requirement.

Files modified (related to this task):
- frontend/src/app/product/[id]/page.tsx
- frontend/src/app/cart/page.tsx

Verification Status:
- Frontend build: pass.
- Frontend container rebuild/restart: pass.

## Update 2026-04-17 - Home Sell-Now Redirect by Seller Registration

What was implemented:
- Updated home page CTA button "Đăng bán ngay" to follow seller-channel role gating logic.
- Redirect behavior:
	- Logged-in seller/admin -> `/seller/create-post`
	- Logged-in non-seller -> `/seller/register`
	- Not logged in -> `/seller/register`
- Replaced static link with click handler using token role parsing for consistent behavior with Navbar seller entry.

Files modified (related to this task):
- frontend/src/app/page.tsx

Verification Status:
- Frontend build: pass.
- Frontend container rebuild/restart: pass.

## Update 2026-04-17 - User Profile + Product Detail UI + Shop Name Mapping

## Update 2026-04-17 - Review Feedback Hardening (N+1 + Validation + Upload Security)

What was implemented:
- Removed eager N+1 order detail fetching in orders list page.
- Kept order detail fetch lazy and cached only when needed (rebuy action).
- Centralized review core validation in service layer for both JSON and multipart paths:
	- Rating range 1..5.
	- Non-empty trimmed content.
	- Max content length.
	- Max media URL count.
- Added request-boundary validation for multipart review endpoint.
- Hardened review upload security:
	- Strict allowed MIME + extension checks for image/video.
	- Per-file size limits and total upload size limit.
	- Rejected suspicious filenames/path traversal patterns.
	- Switched file persistence from byte-array write to stream copy.
- Fixed review media input UX on order detail page by resetting file inputs, so selecting the same file again triggers onChange.

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/service/ReviewServiceImpl.java
- Ecommerce/src/main/java/com/trash/ecommerce/controller/ReviewController.java
- frontend/src/app/orders/page.tsx
- frontend/src/app/orders/[id]/page.tsx

Verification Status:
- Backend compile: pass.
- Frontend build: pass.

## Update 2026-04-17 - Review UX + Quota Logic + Reload Consistency

What was implemented:
- Fixed review modal behavior when uploading media:
	- Prevented submit button from being hidden/covered by content.
	- Converted modal body to scrollable area with sticky action footer.
- Updated product detail review layout:
	- Left rating summary panel set to ~1/3 width.
	- Right review list set to ~2/3 width.
	- Prevented green summary card from stretching to match comment column height.
- Corrected shop identity source in order detail/order list product snippets:
	- Seller display now resolves from seller registration shopName (SellerApplication) instead of account full name when available.
- Implemented review quota by purchase count (not global one-time lock):
	- A user can review a product up to the number of FINISHED orders containing that product.
	- Example: user buys product X in 2 finished orders => can review product X 2 times.
- Added backend eligibility endpoint for review UI hydration after reload:
	- FE now re-checks remaining review quota per product when opening order detail.
	- If quota is exhausted, button remains "Xem đánh giá" after page reload.
- Added backend guard to reject over-quota review creation even if client is bypassed.

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/controller/ReviewController.java
- Ecommerce/src/main/java/com/trash/ecommerce/service/ReviewService.java
- Ecommerce/src/main/java/com/trash/ecommerce/service/ReviewServiceImpl.java
- Ecommerce/src/main/java/com/trash/ecommerce/repository/OrderRepository.java
- Ecommerce/src/main/java/com/trash/ecommerce/repository/ReviewRepository.java
- Ecommerce/src/main/java/com/trash/ecommerce/mapper/OrderMapper.java
- frontend/src/lib/api.ts
- frontend/src/app/orders/[id]/page.tsx
- frontend/src/app/product/[id]/page.tsx

Key API added:
- GET /api/reviews/products/{productId}/eligibility

Verification Status:
- Backend compile: pass.
- Frontend build: pass.

### 1) Code User Profile
What was implemented:
- Rebuilt user profile page into a full account dashboard style layout.
- Added stronger information hierarchy: hero header, profile summary card, quick actions, personal information section, and validated shipping address section.
- Kept full editable profile flow with province/district/ward selection and backend update integration.

Files modified (related to this task):
- frontend/src/app/profile/page.tsx

### 2) Improve Product Detail UI
What was implemented:
- Reworked product detail page into a clearer modern layout:
	- Top section: large gallery + product essentials + shop card.
	- Bottom section: product description first, review section after.
	- Review section includes average score, star distribution bars, and review cards.
- Refined spacing, button sizing, visual consistency, and responsive behavior.
- Added review media rendering support in product detail cards (image/video when available).

Files modified (related to this task):
- frontend/src/app/product/[id]/page.tsx

### 3) Fix User Name -> Shop Name in Product Detail Page
What was implemented:
- Corrected seller identity source so product detail displays shop name from seller registration data instead of user profile full name.
- Extended product detail response model to include shopName.
- Updated product mapping layer to resolve shopName from SellerApplication.
- Updated shop public profile response to expose shopName consistently.
- Product detail UI now prioritizes shopName for seller badge/name display.

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/dto/ProductDetailsResponseDTO.java
- Ecommerce/src/main/java/com/trash/ecommerce/mapper/ProductMapper.java
- Ecommerce/src/main/java/com/trash/ecommerce/controller/ShopController.java
- frontend/src/app/product/[id]/page.tsx

### 4) Product Review Feature (Rating + Comment + Image/Video)
What was implemented:
- Added buyer-side review flow from order detail after order completion.
- Added review modal with star rating (1-5), comment input, and media attachments.
- Added upload constraints in UI/Backend:
	- Max 2 images.
	- Max 1 video.
- Added backend multipart endpoint for review creation with attachments.
- Added backend media serving endpoint for review attachments.
- Added product detail rendering of review media (image/video) when available.
- Fixed media display permission by allowing public GET access to review media endpoint.
- Stabilized file persistence for review uploads by writing bytes directly to avoid temp-file not found errors.

Files modified (related to this task):
- Ecommerce/src/main/java/com/trash/ecommerce/controller/ReviewController.java
- Ecommerce/src/main/java/com/trash/ecommerce/config/SecurityConfig.java
- frontend/src/lib/api.ts
- frontend/src/app/orders/[id]/page.tsx
- frontend/src/app/product/[id]/page.tsx

### Verification Status
- Backend compile: pass.
- Frontend build: pass.

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
