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

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("hqs_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Clear stale token on 401/403
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== "undefined" && (err.response?.status === 401 || err.response?.status === 403)) {
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
  generatePost: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    return api.post("/api/ai/generate-post", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
  },
  createProduct: (
    product: { productName: string; price: number; quantity: number; category: string; description: string },
    imageFile: File
  ) => {
    const form = new FormData();
    form.append("products", new Blob([JSON.stringify(product)], { type: "application/json" }));
    form.append("file", imageFile);
    return api.post("/api/user/products", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
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

// ─── Shipping ───
export const shippingApi = {
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
  create: (paymentMethod = 1) =>
    api.post(`/api/orders/create?paymentMethod=${paymentMethod}`),
  delete: (id: number) => api.delete(`/api/orders/${id}`),
};

// ─── User Profile ───
export const userApi = {
  getProfile: () => api.get("/api/user/profile"),
  update: (id: number, data: { fullName?: string; phone?: string; address?: string }) =>
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

// ─── Reviews ───
export const reviewApi = {
  getByProduct: (productId: number) => api.get(`/api/reviews/products/${productId}`),
  create: (productId: number, data: { rating: number; comment: string }) =>
    api.post(`/api/reviews/products/${productId}`, data),
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
};

// ─── User Interactions ───
export const interactionApi = {
  record: (productId: number) => api.post(`/api/interactions/record?productId=${productId}`),
  getRecommendations: () => api.get("/api/interactions/my-recommendations"),
};

export default api;
