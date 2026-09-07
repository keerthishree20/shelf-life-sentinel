export interface Product {
  id: number;
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  mfg_date: string | null;
  expiry_date: string | null;
  batch_number: string | null;
  image_url: string | null;
  source: string;
  status: string;
  days_until_expiry: number | null;
  created_at: string | null;
}

export interface ScanResult {
  scan_id: number;
  product: {
    id: number | null;
    barcode: string;
    name: string | null;
    brand: string | null;
    category: string | null;
    image_url: string | null;
    mfg_date: string | null;
    expiry_date: string | null;
    batch_number: string | null;
  };
  status: string;
  days_until_expiry: number | null;
  confidence: number | null;
}

export interface BarcodeLookupResult {
  found: boolean;
  barcode: string;
  product?: {
    id: number;
    barcode: string;
    name: string;
    brand: string | null;
    category: string | null;
    image_url: string | null;
    source: string;
  };
  gs1?: {
    is_gs1: boolean;
    gtin: string | null;
    barcode: string | null;
    mfg_date: string | null;
    expiry_date: string | null;
    best_before_date: string | null;
    batch_number: string | null;
    serial_number: string | null;
    raw_data: string;
  } | null;
}

export interface OCRResult {
  mfg_date: string | null;
  expiry_date: string | null;
  best_before_months: number | null;
  raw_text: string;
  confidence: number;
  labels_found: string[];
}

export interface DashboardStats {
  total_products: number;
  expired_count: number;
  expiring_soon_count: number;
  fresh_count: number;
  scans_today: number;
  scans_this_week: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  expired: number;
  expiring_soon: number;
  fresh: number;
}

export interface Alert {
  id: number;
  product_id: number;
  alert_type: string;
  message: string;
  is_read: boolean;
  days_until_expiry: number | null;
  created_at: string | null;
}

export interface ScanLog {
  id: number;
  product_id: number | null;
  product_name: string | null;
  barcode: string | null;
  scan_type: string;
  result_status: string;
  expiry_date_scanned: string | null;
  confidence: number | null;
  scanned_at: string | null;
}
