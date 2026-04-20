import axios from "axios";

// SSR: use Docker internal hostname; Browser: call gateway directly (avoids Next.js rewrite issues in Docker)
const API_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://localhost:3000"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

const RETURN_WINDOW_HOURS = 24;
const EVIDENCE_VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "m4v"];

export function isWithinReturnWindowFromConfirmation(buyerConfirmedAt?: string): boolean {
  if (!buyerConfirmedAt) return false;
  const confirmedTime = new Date(buyerConfirmedAt).getTime();
  if (Number.isNaN(confirmedTime)) return false;
  return Date.now() - confirmedTime <= RETURN_WINDOW_HOURS * 60 * 60 * 1000;
}

export function getFileExtension(url: string): string {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function isVideoEvidenceUrl(url: string): boolean {
  return EVIDENCE_VIDEO_EXTENSIONS.includes(getFileExtension(url));
}

export function getReturnEvidenceMediaSrc(mediaUrl: string): string {
  return `${API_URL}/api/returns/evidence/media?url=${encodeURIComponent(mediaUrl)}`;
}

export function parseEvidenceUrls(rawUrls?: string | null): string[] {
  if (!rawUrls) return [];
  return rawUrls
    .split(/\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const reqUrl = config.url || "";
    const isAuthEndpoint = reqUrl.includes("/api/user/auth/login")
      || reqUrl.includes("/api/user/auth/register")
      || reqUrl.includes("/api/user/auth/reset-password")
      || reqUrl.includes("/api/user/auth/verify-otp")
      || reqUrl.includes("/api/user/auth/change-password");

    const token = localStorage.getItem("hqs_token");
    if (token && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Clear stale token on 401/403
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== "undefined" && err.response?.status === 401) {
      localStorage.removeItem("hqs_token");
      localStorage.removeItem("hqs_refresh_token");
    }
    return Promise.reject(err);
  }
);

// ─── Auth helpers ───
export function parseToken(): { id?: number; roles?: string[]; sub?: string } | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("hqs_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.id, roles: payload.roles || [], sub: payload.sub };
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return parseToken() !== null;
}

export function hasRole(role: string): boolean {
  const parsed = parseToken();
  return parsed?.roles?.includes(role) ?? false;
}

// ─── Auth ───
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/user/auth/login", { email, password }),
  register: (email: string, password: string) =>
    api.post("/api/user/auth/register", { email, password }),
  logout: () => api.post("/api/user/auth/logout"),
};

// ─── Products ───
export const productApi = {
  getAll: (page = 0, size = 30) =>
    api.get(`/api/products/?noPage=${page}&sizePage=${size}`),
  getById: (id: number) => api.get(`/api/products/${id}`),
  search: (name: string) => api.get(`/api/products/products?name=${name}`),
};

// ─── AI Post ───
export const aiApi = {
  generatePost: (images: File | File[]) => {
    const form = new FormData();
    const files = Array.isArray(images) ? images : [images];
    files.forEach((f) => form.append("images", f));
    return api.post("/api/ai/generate-post", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90000,
    });
  },
  createProduct: (
    product: {
      productName: string;
      price: number;
      quantity?: number;
      unitWeightGrams: number;
      totalStockWeightKg: number;
      shelfLifeDays?: number;
      categoryId: number;
      description: string;
      batchId?: string;
      origin?: string;
    },
    imageFile: File
  ) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    form.append("file", imageFile);
    return api.post("/api/user/products", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  createProductWithFacebook: (
    product: {
      productName: string;
      price: number;
      quantity?: number;
      unitWeightGrams: number;
      totalStockWeightKg: number;
      shelfLifeDays?: number;
      categoryId: number;
      description: string;
      batchId?: string;
      origin?: string;
    },
    imageFile: File,
    pageId: string,
    message?: string
  ) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    form.append("file", imageFile);
    form.append("pageId", pageId);
    if (message) form.append("message", message);
    return api.post("/api/user/products/publish-with-facebook", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ─── Seller Facebook Integration ───
export const facebookApi = {
  getOAuthUrl: (redirectUri: string) =>
    api.get(`/api/seller/facebook/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`),
  handleOAuthCallback: (code: string, redirectUri: string) =>
    api.post(`/api/seller/facebook/oauth/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`),
  getPages: () => api.get("/api/seller/facebook/pages"),
  publishProduct: (productId: number, pageId: string, message?: string) =>
    api.post(`/api/seller/facebook/publish/product/${productId}?pageId=${encodeURIComponent(pageId)}${message ? `&message=${encodeURIComponent(message)}` : ""}`),
};

// ─── Semantic Search ───
export const searchApi = {
  semantic: (query: string, limit = 10) =>
    api.get(`/api/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}`),
  embedProduct: (product: {
    product_id: number;
    product_name: string;
    description?: string;
    category?: string;
    price: number;
  }) => api.post("/api/search/embed-product", product),
};

// ─── Chatbot ───
export const chatbotApi = {
  sendMessage: (message: string, history?: Array<{ role: string; content: string }>) =>
    api.post("/api/chatbot/message", { message, history }),
};

// ─── Farming Journal ───
export const farmingApi = {
  createEntry: (data: FormData) =>
    api.post("/api/farming-journal", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getByBatch: (batchId: string) => api.get(`/api/farming-journal/batch/${batchId}`),
  getMyEntries: () => api.get("/api/farming-journal/my-entries"),
  deleteEntry: (id: string) => api.delete(`/api/farming-journal/${id}`),
};

// ─── Traceability ───
export const traceApi = {
  getTimeline: (batchId: string) => api.get(`/api/traceability/${batchId}`),
  getByBatchId: (batchId: string) => api.get(`/api/traceability/${batchId}`),
  getQrCode: (batchId: string) => api.get(`/api/traceability/${batchId}/qr-base64`),
};

// ─── Seller Batches ───
export const batchApi = {
  getMyBatches: () => api.get("/api/seller/batches"),
  create: (payload: {
    batchName: string;
    cropType?: string;
    startDate?: string;
  }) => api.post("/api/seller/batches", payload),
};

// ─── Shipping ───
export const shippingApi = {
  provinces: () => api.get("/api/shipping/provinces"),
  districts: (provinceId: number) => api.get(`/api/shipping/districts?provinceId=${provinceId}`),
  wards: (districtId: number) => api.get(`/api/shipping/wards?districtId=${districtId}`),
  validate: (productId: number, districtId?: string, wardCode?: string) =>
    api.get("/api/shipping/validate", {
      params: { productId, toDistrictId: districtId, toWardCode: wardCode },
    }),
};

// ─── Livestream ───
export const livestreamApi = {
  start: (title: string) => api.post("/api/livestream/start", { title }),
  stop: (streamKey: string) => api.post("/api/livestream/stop", { streamKey }),
  getActive: () => api.get("/api/livestream/active"),
  /** Lấy thông tin phiên live (title, seller, products, status) */
  getStream: (streamKey: string) => api.get(`/api/livestream/${streamKey}`),
  /** Cập nhật danh sách sản phẩm đang bán trong phiên */
  updateProducts: (streamKey: string, products: Array<{ id: number; name: string; price: number }>) =>
    api.put(`/api/livestream/${streamKey}/products`, { products }),
  /** Lấy lịch sử chat (50 tin gần nhất) */
  getChatHistory: (streamKey: string) => api.get(`/api/livestream/${streamKey}/chat-history`),
};

// ─── Cart & Orders ───
export const cartApi = {
  getItems: () => api.get("/api/cart/items"),
  addItem: (data: { productId: number; quantity: number }) =>
    api.put(`/api/cart/items/${data.productId}?quantity=${data.quantity}`),
  updateItem: (productId: number, quantity: number) =>
    api.put(`/api/cart/items/${productId}?quantity=${quantity}`),
  removeItem: (productId: number) => api.delete(`/api/cart/items/${productId}`),
};

export const orderApi = {
  getMyOrders: () => api.get("/api/orders/my-orders"),
  getAll: () => api.get("/api/orders/my-orders"),
  getById: (id: number) => api.get(`/api/orders/${id}`),
  preview: (params?: {
    discountVoucherCode?: string;
    shippingVoucherCode?: string;
    deliveryType?: "STANDARD" | "EXPRESS";
    toDistrictId?: string;
    toWardCode?: string;
  }) =>
    api.get("/api/orders/preview", { params }),
  previewBuyNow: (params: {
    productId: number;
    quantity: number;
    discountVoucherCode?: string;
    shippingVoucherCode?: string;
    deliveryType?: "STANDARD" | "EXPRESS";
    toDistrictId?: string;
    toWardCode?: string;
  }) => api.get("/api/orders/buy-now/preview", { params }),
  create: (
    paymentMethod: number,
    voucherCode?: string,
    discountVoucherCode?: string,
    shippingVoucherCode?: string,
    deliveryType: "STANDARD" | "EXPRESS" = "STANDARD",
    toDistrictId?: string,
    toWardCode?: string
  ) =>
    api.post(
      `/api/orders/create?paymentMethod=${paymentMethod}` +
      `${voucherCode ? `&voucherCode=${encodeURIComponent(voucherCode)}` : ""}` +
      `${discountVoucherCode ? `&discountVoucherCode=${encodeURIComponent(discountVoucherCode)}` : ""}` +
      `${shippingVoucherCode ? `&shippingVoucherCode=${encodeURIComponent(shippingVoucherCode)}` : ""}` +
      `${deliveryType ? `&deliveryType=${encodeURIComponent(deliveryType)}` : ""}` +
      `${toDistrictId ? `&toDistrictId=${encodeURIComponent(toDistrictId)}` : ""}` +
      `${toWardCode ? `&toWardCode=${encodeURIComponent(toWardCode)}` : ""}`
    ),
  createBuyNow: (
    productId: number,
    quantity: number,
    paymentMethod: number,
    voucherCode?: string,
    discountVoucherCode?: string,
    shippingVoucherCode?: string,
    deliveryType: "STANDARD" | "EXPRESS" = "STANDARD",
    toDistrictId?: string,
    toWardCode?: string
  ) =>
    api.post(
      `/api/orders/buy-now/create?productId=${productId}&quantity=${quantity}&paymentMethod=${paymentMethod}` +
      `${voucherCode ? `&voucherCode=${encodeURIComponent(voucherCode)}` : ""}` +
      `${discountVoucherCode ? `&discountVoucherCode=${encodeURIComponent(discountVoucherCode)}` : ""}` +
      `${shippingVoucherCode ? `&shippingVoucherCode=${encodeURIComponent(shippingVoucherCode)}` : ""}` +
      `${deliveryType ? `&deliveryType=${encodeURIComponent(deliveryType)}` : ""}` +
      `${toDistrictId ? `&toDistrictId=${encodeURIComponent(toDistrictId)}` : ""}` +
      `${toWardCode ? `&toWardCode=${encodeURIComponent(toWardCode)}` : ""}`
    ),
  retryPayment: (id: number) => api.post(`/api/orders/${id}/retry-payment`),
  delete: (id: number) => api.delete(`/api/orders/${id}`),
  updateStatus: (id: number, status: string) =>
    api.put(`/api/orders/${id}/status?status=${status}`),
};

// ─── Categories ───
export const categoryApi = {
  getRoots: () => api.get("/api/categories/"),
  getChildren: (id: number) => api.get(`/api/categories/${id}/children`),
  getAll: () => api.get("/api/categories/all"),
};

// ─── User Profile ───
export const userApi = {
  getProfile: () => api.get("/api/user/profile"),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/user/profile/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  update: (id: number, data: {
    fullName?: string;
    phone?: string;
    avatar?: string;
    province?: string;
    district?: string;
    ward?: string;
    streetDetail?: string;
    ghnProvinceId?: number;
    ghnDistrictId?: number;
    ghnWardCode?: string;
  }) =>
    api.put(`/api/user/updation/${id}`, data),
  refresh: (refreshToken: string) =>
    api.get("/api/user/refresh", { headers: { Authorization: `Bearer ${refreshToken}` } }),
  resetPassword: (email: string) =>
    api.post(`/api/user/auth/reset-password?email=${encodeURIComponent(email)}`),
  verifyOtp: (email: string, otp: string) =>
    api.post(`/api/user/auth/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`),
  changePassword: (email: string, newPassword: string, otp: string) =>
    api.post(`/api/user/auth/change-password?email=${encodeURIComponent(email)}&newPassword=${encodeURIComponent(newPassword)}&otp=${otp}`),
};

// ─── Seller Onboarding ───
export const sellerOnboardingApi = {
  submit: (data: Record<string, unknown>) => api.post("/api/user/seller-applications", data),
  uploadDocuments: (formData: FormData) =>
    api.post("/api/user/seller-applications/documents", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  getMine: () => api.get("/api/user/seller-applications/me"),
  getAll: (status?: string) => api.get(`/api/admin/seller-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  review: (id: number, action: "APPROVE" | "NEEDS_REVISION" | "REJECT", note?: string) =>
    api.put(`/api/admin/seller-applications/${id}/review`, { action, note }),
};

// ─── Reviews ───
export const reviewApi = {
  getByProduct: (productId: number) => api.get(`/api/reviews/products/${productId}`),
  getEligibility: (productId: number) => api.get(`/api/reviews/products/${productId}/eligibility`),
  create: (productId: number, data: { rating: number; comment: string }) =>
    api.post(`/api/reviews/products/${productId}`, data),
  createWithMedia: (productId: number, formData: FormData) =>
    api.post(`/api/reviews/products/${productId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (productId: number, reviewId: number) =>
    api.delete(`/api/reviews/products/${productId}/${reviewId}`),
};

// ─── Market Prices ───
export const marketPriceApi = {
  getAll: () => api.get("/api/market-prices"),
  search: (name: string) => api.get(`/api/market-prices/search?name=${encodeURIComponent(name)}`),
};

// ─── Invoices ───
export const invoiceApi = {
  create: (orderId: number, paymentMethodId?: number) =>
    api.post(`/api/invoices?orderId=${orderId}${paymentMethodId ? `&paymentMethodId=${paymentMethodId}` : ""}`),
  delete: (invoiceId: number) => api.delete(`/api/invoices/${invoiceId}`),
};

// ─── Payments ───
export const paymentApi = {
  createVnPayUrl: (totalPrice: number, orderInfo: string, orderId: number) =>
    api.post(`/api/payments/createUrl?totalPrice=${totalPrice}&orderInfo=${encodeURIComponent(orderInfo)}&orderId=${orderId}`),
  createMoMoUrl: (totalPrice: number, orderInfo: string, orderId: number) =>
    api.post(`/api/payments/createMoMoUrl?totalPrice=${totalPrice}&orderInfo=${encodeURIComponent(orderInfo)}&orderId=${orderId}`),
  addMethod: (name: string) => api.post(`/api/payments/methods?name=${encodeURIComponent(name)}`),
};

// ─── Admin ───
export const adminApi = {
  getUsers: (page = 0, size = 20) => api.get(`/api/admin/users?noPage=${page}&sizePage=${size}`),
  getUser: (id: number) => api.get(`/api/admin/users/${id}`),
  deleteUser: (id: number) => api.delete(`/api/admin/users/${id}`),
  createProduct: (product: Record<string, unknown>, imageFile: File) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    form.append("file", imageFile);
    return api.post("/api/admin/products", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  updateProduct: (id: number, product: Record<string, unknown>, imageFile?: File) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    if (imageFile) form.append("file", imageFile);
    return api.put(`/api/admin/products/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  deleteProduct: (id: number) => api.delete(`/api/admin/products/${id}`),
  getSellerApplications: (status?: string) =>
    api.get(`/api/admin/seller-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  getSellerApplicationDocument: (id: number, type: "front" | "back" | "license" | "food-safety") =>
    api.get(`/api/admin/seller-applications/${id}/documents/${type}`, { responseType: "blob" }),
  startReviewSellerApplication: (id: number) =>
    api.put(`/api/admin/seller-applications/${id}/start-review`),
  reviewSellerApplication: (id: number, action: "APPROVE" | "NEEDS_REVISION" | "REJECT", note?: string) =>
    api.put(`/api/admin/seller-applications/${id}/review`, { action, note }),
};

// ─── User Interactions ───
export const interactionApi = {
  record: (productId: number) => api.post(`/api/interactions/record?productId=${productId}`),
  getRecommendations: () => api.get("/api/interactions/my-recommendations"),
};

// ─── Trust Score ───
export const trustScoreApi = {
  get: (sellerId: number) => api.get(`/api/trust-score/${sellerId}`),
  recalculate: () => api.post("/api/trust-score/recalculate"),
};

// ─── Returns / Refunds ───
export const returnApi = {
  create: (data: { orderId: number; reasonCode: string; description: string; evidenceUrls?: string; refundAmount?: number }) =>
    api.post("/api/returns", data),
  uploadEvidence: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return api.post("/api/returns/evidence", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getMyRequests: () => api.get("/api/returns/my-requests"),
  getSellerRequests: () => api.get("/api/returns/seller-requests"),
  getById: (id: number) => api.get(`/api/returns/${id}`),
  respond: (returnId: number, action: string, response?: string) =>
    api.post(`/api/returns/${returnId}/respond?action=${action}`, { response }),
  buyerDecision: (returnId: number, action: "ACCEPT_REJECTION" | "ESCALATE") =>
    api.post(`/api/returns/${returnId}/buyer-decision?action=${action}`),
};

// ─── Seller ───
export const sellerApi = {
  getDashboard: () => api.get("/api/seller/dashboard"),
  getShopSettings: () => api.get("/api/seller/shop-settings"),
  uploadShopAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/seller/shop-settings/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  updateShopSettings: (data: {
    shopName: string;
    avatar?: string;
    province?: string;
    district?: string;
    ward?: string;
    streetDetail?: string;
    ghnProvinceId?: number | null;
    ghnDistrictId?: number | null;
    ghnWardCode?: string | null;
  }) => api.put("/api/seller/shop-settings", data),
  getProducts: () => api.get("/api/seller/products"),
  deleteProduct: (id: number) => api.delete(`/api/seller/products/${id}`),
  updateStock: (id: number, quantity: number) =>
    api.put(`/api/seller/products/${id}/stock?quantity=${quantity}`),
  toggleVisibility: (id: number) =>
    api.put(`/api/seller/products/${id}/visibility`),
  getOrders: () => api.get("/api/seller/orders"),
  updateOrderStatus: (orderId: number, status: string) =>
    api.put(`/api/seller/orders/${orderId}/status?status=${status}`),
  createProduct: (product: Record<string, unknown>, imageFile?: File) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    if (imageFile) form.append("file", imageFile);
    return api.post("/api/user/products", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

// ─── Notifications ───
export const notificationApi = {
  getAll: (page = 0, size = 20) => api.get(`/api/notifications?page=${page}&size=${size}`),
  getUnreadCount: () => api.get("/api/notifications/unread-count"),
  markAsRead: (id: number) => api.post(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.post("/api/notifications/read-all"),
};

// ─── Vouchers ───
export const voucherApi = {
  getAvailable: () => api.get("/api/vouchers/available"),
  validate: (code: string, orderAmount: number) =>
    api.post(`/api/vouchers/validate?code=${encodeURIComponent(code)}&orderAmount=${orderAmount}`),
  create: (data: { code: string; description: string; discountType: string; discountValue: number; minOrderAmount?: number; maxDiscount?: number; usageLimit?: number; startDate?: string; endDate?: string }) =>
    api.post("/api/vouchers", data),
  getMyVouchers: () => api.get("/api/vouchers/my-vouchers"),
  delete: (id: number) => api.delete(`/api/vouchers/${id}`),
};

// ─── Wishlist ───
export const wishlistApi = {
  getAll: () => api.get("/api/wishlist"),
  add: (productId: number) => api.post(`/api/wishlist/${productId}`),
  remove: (productId: number) => api.delete(`/api/wishlist/${productId}`),
  check: (productId: number) => api.get(`/api/wishlist/check/${productId}`),
};

// ─── Shop (Seller Public Profile) ───
export const shopApi = {
  getProfile: (sellerId: number) => api.get(`/api/shop/${sellerId}`),
};

// ─── Messages ───
export const messageApi = {
  getConversations: () => api.get("/api/messages/conversations"),
  getOrCreateConversation: (otherUserId: number) =>
    api.post(`/api/messages/conversations/${otherUserId}`),
  getMessages: (conversationId: number, page = 0, size = 50) =>
    api.get(`/api/messages/conversations/${conversationId}/messages?page=${page}&size=${size}`),
  sendMessage: (conversationId: number, content: string) =>
    api.post(`/api/messages/conversations/${conversationId}/messages`, { content }),
  deleteConversation: (conversationId: number) =>
    api.delete(`/api/messages/conversations/${conversationId}`),
};

// ─── AgriCoin ───
export const coinApi = {
  getBalance: () => api.get("/api/coins/balance"),
  getHistory: (page = 0, size = 20) =>
    api.get(`/api/coins/history?page=${page}&size=${size}`),
};

// ─── Stories ───
export const storyApi = {
  getAll: (page = 0, size = 20) => api.get(`/api/stories?page=${page}&size=${size}`),
  getBySeller: (sellerId: number) => api.get(`/api/stories/seller/${sellerId}`),
  getMyStories: () => api.get("/api/seller/stories/my"),
  create: (data: FormData) =>
    api.post("/api/seller/stories", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: number) => api.delete(`/api/seller/stories/${id}`),
};

// ─── Admin Analytics ───
export const adminAnalyticsApi = {
  getOverview: () => api.get("/api/admin/analytics/overview"),
  getTopProducts: () => api.get("/api/admin/analytics/top-products"),
  getTopSellers: () => api.get("/api/admin/analytics/top-sellers"),
  getEscalatedReturns: () => api.get("/api/admin/analytics/escalated-returns"),
  resolveEscalatedReturn: (returnId: number, action: "REFUND" | "KEEP_REJECT", note: string) =>
    api.post(`/api/admin/analytics/returns/${returnId}/resolve?action=${action}`, { note }),
};

export default api;
