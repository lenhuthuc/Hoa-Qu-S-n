import axios from "axios";

// SSR: use Docker internal hostname; Browser: use relative path for Next.js proxy
const API_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://localhost:3003"
    : "/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const reqUrl = config.url || "";
    const isAuthEndpoint = reqUrl.includes("/user/auth/login")
      || reqUrl.includes("/user/auth/register")
      || reqUrl.includes("/user/auth/reset-password")
      || reqUrl.includes("/user/auth/verify-otp")
      || reqUrl.includes("/user/auth/change-password");

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
    api.post("/user/auth/login", { email, password }),
  register: (email: string, password: string) =>
    api.post("/user/auth/register", { email, password }),
  logout: () => api.post("/user/auth/logout"),
};

// ─── Products ───
export const productApi = {
  getAll: (page = 0, size = 30) =>
    api.get(`/products/?noPage=${page}&sizePage=${size}`),
  getById: (id: number) => api.get(`/products/${id}`),
  search: (name: string) => api.get(`/products/products?name=${name}`),
};

// ─── AI Post ───
export const aiApi = {
  generatePost: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    return api.post("/ai/generate-post", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
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
    imageFile: File,
    publishToFacebook?: boolean,
    facebookPageId?: string
  ) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    form.append("file", imageFile);
    
    let url = "/api/user/products";
    if (publishToFacebook && facebookPageId) {
      url += `?publishToFacebook=true&facebookPageId=${encodeURIComponent(facebookPageId)}`;
    }
    
    return api.post(url, form, {
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
    return api.post("/user/products/publish-with-facebook", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ─── Seller Facebook Integration ───
export const facebookApi = {
  getOAuthUrl: (redirectUri: string) =>
    api.get(`/seller/facebook/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`),
  handleOAuthCallback: (code: string, redirectUri: string) =>
    api.post(`/seller/facebook/oauth/callback?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`),
  getPages: () => api.get("/seller/facebook/pages"),
  checkConnected: () => api.get("/seller/facebook/check-connected"),
  publishProduct: (productId: number, pageId: string, message?: string) =>
    api.post(`/seller/facebook/publish/product/${productId}?pageId=${encodeURIComponent(pageId)}${message ? `&message=${encodeURIComponent(message)}` : ""}`),
};

// ─── Semantic Search ───
export const searchApi = {
  semantic: (query: string, limit = 10) =>
    api.get(`/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}`),
  embedProduct: (product: {
    product_id: number;
    product_name: string;
    description?: string;
    category?: string;
    price: number;
  }) => api.post("/search/embed-product", product),
};

// ─── Chatbot ───
export const chatbotApi = {
  sendMessage: (message: string, history?: Array<{ role: string; content: string }>) =>
    api.post("/chatbot/message", { message, history }),
};

// ─── Farming Journal ───
export const farmingApi = {
  createEntry: (data: FormData) =>
    api.post("/farming-journal", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getByBatch: (batchId: string) => api.get(`/farming-journal/batch/${batchId}`),
  getMyEntries: () => api.get("/farming-journal/my-entries"),
  deleteEntry: (id: string) => api.delete(`/farming-journal/${id}`),
};

// ─── Traceability ───
export const traceApi = {
  getTimeline: (batchId: string) => api.get(`/traceability/${batchId}`),
  getByBatchId: (batchId: string) => api.get(`/traceability/${batchId}`),
  getQrCode: (batchId: string) => api.get(`/traceability/${batchId}/qr-base64`),
};

// ─── Shipping ───
export const shippingApi = {
  provinces: () => api.get("/shipping/provinces"),
  districts: (provinceId: number) => api.get(`/shipping/districts?provinceId=${provinceId}`),
  wards: (districtId: number) => api.get(`/shipping/wards?districtId=${districtId}`),
  validate: (productId: number, districtId?: string, wardCode?: string) =>
    api.get("/shipping/validate", {
      params: { productId, toDistrictId: districtId, toWardCode: wardCode },
    }),
};

// ─── Livestream ───
export const livestreamApi = {
  start: (title: string) => api.post("/livestream/start", { title }),
  stop: (streamKey: string) => api.post("/livestream/stop", { streamKey }),
  getActive: () => api.get("/livestream/active"),
  /** Lấy thông tin phiên live (title, seller, products, status) */
  getStream: (streamKey: string) => api.get(`/livestream/${streamKey}`),
  /** Cập nhật danh sách sản phẩm đang bán trong phiên */
  updateProducts: (streamKey: string, products: Array<{ id: number; name: string; price: number }>) =>
    api.put(`/livestream/${streamKey}/products`, { products }),
  /** Lấy lịch sử chat (50 tin gần nhất) */
  getChatHistory: (streamKey: string) => api.get(`/livestream/${streamKey}/chat-history`),
};

// ─── Cart & Orders ───
export const cartApi = {
  getItems: () => api.get("/cart/items"),
  addItem: (data: { productId: number; quantity: number }) =>
    api.put(`/cart/items/${data.productId}?quantity=${data.quantity}`),
  updateItem: (productId: number, quantity: number) =>
    api.put(`/cart/items/${productId}?quantity=${quantity}`),
  removeItem: (productId: number) => api.delete(`/cart/items/${productId}`),
};

export const orderApi = {
  getMyOrders: () => api.get("/orders/my-orders"),
  getAll: () => api.get("/orders/my-orders"),
  getById: (id: number) => api.get(`/orders/${id}`),
  preview: (params?: {
    discountVoucherCode?: string;
    shippingVoucherCode?: string;
    deliveryType?: "STANDARD" | "EXPRESS";
    toDistrictId?: string;
    toWardCode?: string;
  }) =>
    api.get("/orders/preview", { params }),
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
  retryPayment: (id: number) => api.post(`/orders/${id}/retry-payment`),
  delete: (id: number) => api.delete(`/orders/${id}`),
  updateStatus: (id: number, status: string) =>
    api.put(`/orders/${id}/status?status=${status}`),
};

// ─── Categories ───
export const categoryApi = {
  getRoots: () => api.get("/categories/"),
  getChildren: (id: number) => api.get(`/categories/${id}/children`),
  getAll: () => api.get("/categories/all"),
};

// ─── User Profile ───
export const userApi = {
  getProfile: () => api.get("/user/profile"),
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
    api.put(`/user/updation/${id}`, data),
  refresh: (refreshToken: string) =>
    api.get("/user/refresh", { headers: { Authorization: `Bearer ${refreshToken}` } }),
  resetPassword: (email: string) =>
    api.post(`/user/auth/reset-password?email=${encodeURIComponent(email)}`),
  verifyOtp: (email: string, otp: string) =>
    api.post(`/user/auth/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`),
  changePassword: (email: string, newPassword: string, otp: string) =>
    api.post(`/user/auth/change-password?email=${encodeURIComponent(email)}&newPassword=${encodeURIComponent(newPassword)}&otp=${otp}`),
};

// ─── Seller Onboarding ───
export const sellerOnboardingApi = {
  submit: (data: Record<string, unknown>) => api.post("/user/seller-applications", data),
  uploadDocuments: (formData: FormData) =>
    api.post("/user/seller-applications/documents", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  getMine: () => api.get("/user/seller-applications/me"),
  getAll: (status?: string) => api.get(`/admin/seller-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  review: (id: number, action: "APPROVE" | "NEEDS_REVISION" | "REJECT", note?: string) =>
    api.put(`/admin/seller-applications/${id}/review`, { action, note }),
};

// ─── Reviews ───
export const reviewApi = {
  getByProduct: (productId: number) => api.get(`/reviews/products/${productId}`),
  getEligibility: (productId: number) => api.get(`/reviews/products/${productId}/eligibility`),
  create: (productId: number, data: { rating: number; comment: string }) =>
    api.post(`/reviews/products/${productId}`, data),
  createWithMedia: (productId: number, formData: FormData) =>
    api.post(`/reviews/products/${productId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (productId: number, reviewId: number) =>
    api.delete(`/reviews/products/${productId}/${reviewId}`),
};

// ─── Market Prices ───
export const marketPriceApi = {
  getAll: () => api.get("/market-prices"),
  search: (name: string) => api.get(`/market-prices/search?name=${encodeURIComponent(name)}`),
};

// ─── Invoices ───
export const invoiceApi = {
  create: (orderId: number, paymentMethodId?: number) =>
    api.post(`/invoices?orderId=${orderId}${paymentMethodId ? `&paymentMethodId=${paymentMethodId}` : ""}`),
  delete: (invoiceId: number) => api.delete(`/invoices/${invoiceId}`),
};

// ─── Payments ───
export const paymentApi = {
  createVnPayUrl: (totalPrice: number, orderInfo: string, orderId: number) =>
    api.post(`/payments/createUrl?totalPrice=${totalPrice}&orderInfo=${encodeURIComponent(orderInfo)}&orderId=${orderId}`),
  addMethod: (name: string) => api.post(`/payments/methods?name=${encodeURIComponent(name)}`),
};

// ─── Admin ───
export const adminApi = {
  getUsers: (page = 0, size = 20) => api.get(`/admin/users?noPage=${page}&sizePage=${size}`),
  getUser: (id: number) => api.get(`/admin/users/${id}`),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  createProduct: (product: Record<string, unknown>, imageFile: File) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    form.append("file", imageFile);
    return api.post("/admin/products", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  updateProduct: (id: number, product: Record<string, unknown>, imageFile?: File) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    if (imageFile) form.append("file", imageFile);
    return api.put(`/admin/products/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  deleteProduct: (id: number) => api.delete(`/admin/products/${id}`),
  getSellerApplications: (status?: string) =>
    api.get(`/admin/seller-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  getSellerApplicationDocument: (id: number, type: "front" | "back" | "license" | "food-safety") =>
    api.get(`/admin/seller-applications/${id}/documents/${type}`, { responseType: "blob" }),
  startReviewSellerApplication: (id: number) =>
    api.put(`/admin/seller-applications/${id}/start-review`),
  reviewSellerApplication: (id: number, action: "APPROVE" | "NEEDS_REVISION" | "REJECT", note?: string) =>
    api.put(`/admin/seller-applications/${id}/review`, { action, note }),
};

// ─── User Interactions ───
export const interactionApi = {
  record: (productId: number) => api.post(`/interactions/record?productId=${productId}`),
  getRecommendations: () => api.get("/interactions/my-recommendations"),
};

// ─── Trust Score ───
export const trustScoreApi = {
  get: (sellerId: number) => api.get(`/trust-score/${sellerId}`),
  recalculate: () => api.post("/trust-score/recalculate"),
};

// ─── Returns / Refunds ───
export const returnApi = {
  create: (data: { orderId: number; reasonCode: string; description: string; evidenceUrls?: string; refundAmount?: number }) =>
    api.post("/returns", data),
  getMyRequests: () => api.get("/returns/my-requests"),
  getSellerRequests: () => api.get("/returns/seller-requests"),
  getById: (id: number) => api.get(`/returns/${id}`),
  respond: (returnId: number, action: string, response?: string) =>
    api.post(`/returns/${returnId}/respond?action=${action}`, { response }),
};

// ─── Seller ───
export const sellerApi = {
  getDashboard: () => api.get("/seller/dashboard"),
  getProducts: () => api.get("/seller/products"),
  deleteProduct: (id: number) => api.delete(`/seller/products/${id}`),
  updateStock: (id: number, quantity: number) =>
    api.put(`/seller/products/${id}/stock?quantity=${quantity}`),
  toggleVisibility: (id: number) =>
    api.put(`/seller/products/${id}/visibility`),
  getOrders: () => api.get("/seller/orders"),
  updateOrderStatus: (orderId: number, status: string) =>
    api.put(`/seller/orders/${orderId}/status?status=${status}`),
  createProduct: (product: Record<string, unknown>, imageFile?: File) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    if (imageFile) form.append("file", imageFile);
    return api.post("/user/products", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  createProductWithFacebook: (
    product: Record<string, unknown>,
    imageFile: File | undefined,
    facebookPageId: string,
    facebookMessage?: string
  ) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    if (imageFile) form.append("file", imageFile);
    
    let url = `/api/user/products?publishToFacebook=true&facebookPageId=${encodeURIComponent(facebookPageId)}`;
    if (facebookMessage) {
      url += `&message=${encodeURIComponent(facebookMessage)}`;
    }
    
    return api.post(url, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

// ─── Notifications ───
export const notificationApi = {
  getAll: (page = 0, size = 20) => api.get(`/notifications?page=${page}&size=${size}`),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post("/notifications/read-all"),
};

// ─── Vouchers ───
export const voucherApi = {
  getAvailable: () => api.get("/vouchers/available"),
  validate: (code: string, orderAmount: number) =>
    api.post(`/vouchers/validate?code=${encodeURIComponent(code)}&orderAmount=${orderAmount}`),
  create: (data: { code: string; description: string; discountType: string; discountValue: number; minOrderAmount?: number; maxDiscount?: number; usageLimit?: number; startDate?: string; endDate?: string }) =>
    api.post("/vouchers", data),
  getMyVouchers: () => api.get("/vouchers/my-vouchers"),
  delete: (id: number) => api.delete(`/vouchers/${id}`),
};

// ─── Wishlist ───
export const wishlistApi = {
  getAll: () => api.get("/wishlist"),
  add: (productId: number) => api.post(`/wishlist/${productId}`),
  remove: (productId: number) => api.delete(`/wishlist/${productId}`),
  check: (productId: number) => api.get(`/wishlist/check/${productId}`),
};

// ─── Shop (Seller Public Profile) ───
export const shopApi = {
  getProfile: (sellerId: number) => api.get(`/shop/${sellerId}`),
};

// ─── Messages ───
export const messageApi = {
  getConversations: () => api.get("/messages/conversations"),
  getOrCreateConversation: (otherUserId: number) =>
    api.post(`/messages/conversations/${otherUserId}`),
  getMessages: (conversationId: number, page = 0, size = 50) =>
    api.get(`/messages/conversations/${conversationId}/messages?page=${page}&size=${size}`),
  sendMessage: (conversationId: number, content: string) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { content }),
  deleteConversation: (conversationId: number) =>
    api.delete(`/messages/conversations/${conversationId}`),
};

// ─── AgriCoin ───
export const coinApi = {
  getBalance: () => api.get("/coins/balance"),
  getHistory: (page = 0, size = 20) =>
    api.get(`/coins/history?page=${page}&size=${size}`),
};

// ─── Stories ───
export const storyApi = {
  getAll: (page = 0, size = 20) => api.get(`/stories?page=${page}&size=${size}`),
  getBySeller: (sellerId: number) => api.get(`/stories/seller/${sellerId}`),
  getMyStories: () => api.get("/stories/my-stories"),
  create: (data: { title: string; content: string; imageUrl?: string; videoUrl?: string; batchId?: string; farmingLogId?: string; activityType?: string }) =>
    api.post("/stories", data),
  delete: (id: number) => api.delete(`/stories/${id}`),
};

// ─── Admin Analytics ───
export const adminAnalyticsApi = {
  getOverview: () => api.get("/admin/analytics/overview"),
  getTopProducts: () => api.get("/admin/analytics/top-products"),
  getTopSellers: () => api.get("/admin/analytics/top-sellers"),
};

export default api;

