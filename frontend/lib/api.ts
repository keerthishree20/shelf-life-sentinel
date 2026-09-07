import type {
  BarcodeLookupResult,
  OCRResult,
  ScanResult,
  Product,
  DashboardStats,
  CategoryBreakdown,
  Alert,
  ScanLog,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function scanBarcode(barcode: string): Promise<BarcodeLookupResult> {
  return fetchAPI("/scan/barcode", {
    method: "POST",
    body: JSON.stringify({ barcode }),
  });
}

export async function scanOCR(rawText: string): Promise<OCRResult> {
  return fetchAPI("/scan/ocr", {
    method: "POST",
    body: JSON.stringify({ raw_text: rawText }),
  });
}

export async function scanOCRImage(imageFile: File): Promise<OCRResult> {
  const formData = new FormData();
  formData.append("image", imageFile);
  const res = await fetch(`${API_URL}/api/scan/ocr-image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getOCRStatus(): Promise<{ gemini_available: boolean; tesseract_available: boolean }> {
  return fetchAPI("/scan/ocr-status");
}

export async function completeScan(data: {
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  mfg_date?: string;
  expiry_date?: string;
  best_before_months?: number;
  batch_number?: string;
  image_url?: string;
  scan_type?: string;
  confidence?: number;
  raw_ocr_text?: string;
}): Promise<ScanResult> {
  return fetchAPI("/scan/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProducts(
  filter?: string,
  category?: string,
  search?: string
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAPI(`/products${query}`);
}

export async function getProduct(id: number): Promise<Product> {
  return fetchAPI(`/products/${id}`);
}

export async function createProduct(data: Record<string, unknown>): Promise<Product> {
  return fetchAPI("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  return fetchAPI(`/products/${id}`, { method: "DELETE" });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchAPI("/dashboard/stats");
}

export async function getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  return fetchAPI("/dashboard/category-breakdown");
}

export async function getAlerts(includeRead?: boolean): Promise<Alert[]> {
  const query = includeRead ? "?include_read=true" : "";
  return fetchAPI(`/alerts${query}`);
}

export async function markAlertRead(id: number): Promise<Alert> {
  return fetchAPI(`/alerts/${id}/read`, { method: "PATCH" });
}

export async function getHistory(limit = 50, offset = 0): Promise<ScanLog[]> {
  return fetchAPI(`/history?limit=${limit}&offset=${offset}`);
}
