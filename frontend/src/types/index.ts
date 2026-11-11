export interface Person {
  id?: number;
  position: number;
  given_name_en: string;
  given_name_te: string;
  surname_en: string;
  surname_te: string;
  original_ocr?: string;
  verification_status: 'UNVERIFIED' | 'VERIFIED';
}

export interface Phone {
  id?: number;
  number: string;
  is_primary: boolean;
  verification_status: 'UNVERIFIED' | 'VERIFIED';
}

export interface GothramSearchItem {
  id: number;
  gothram_en: string;
  gothram_te?: string;
  similarity_score: number;
  approval_status: string;
  te_verified: boolean;
}

export interface Receipt {
  id: number;
  receipt_no: string;
  receipt_year?: number;
  receipt_date?: string;
  abhishekam_from?: string;
  abhishekam_to?: string;
  amount?: string;
  gothram_en?: string;
  gothram_te?: string;
  gothram_as_written?: string;
  gothram_master_id?: number;
  address_en?: string;
  address_te?: string;
  pincode?: string;
  status: 'PENDING_VERIFICATION' | 'CONFIRMED' | 'INCOMPLETE';
  book_number?: string;
  image_hash?: string;
  original_image_path: string;
  corrected_image_path?: string;
  handwriting_crop_path?: string;
  processing_cost: number;
  processing_duration: number;
  model_name?: string;
  created_at: string;
  updated_at: string;
  persons: Person[];
  phones: Phone[];
  confidence_data?: Record<string, any>;
  ocr_raw?: Record<string, any>;
}

export interface ReceiptListItem {
  id: number;
  receipt_no: string;
  receipt_year?: number;
  receipt_date?: string;
  gothram_en?: string;
  gothram_te?: string;
  primary_devotee?: string;
  abhishekam_from?: string;
  abhishekam_to?: string;
  status: 'PENDING_VERIFICATION' | 'CONFIRMED' | 'INCOMPLETE';
  book_number?: string;
  is_archived?: boolean;
  archived_at?: string;
  original_image_url?: string;
  created_at: string;
}

export interface StagedReceiptItem {
  id: number;
  filename: string;
  file_size: number;
  preview_url: string;
  book_number?: string;
  device_label?: string;
  status: string;
  created_at: string;
}

export interface BookFolderItem {
  book_number: string;
  display_name: string;
  total: number;
  processed: number;
  pending: number;
}

export interface BooksSummaryResponse {
  total_all: number;
  processed_all: number;
  pending_all: number;
  archived_count?: number;
  folders: BookFolderItem[];
}

export interface QualityAssessment {
  laplacian_variance: number;
  mean_luminance: number;
  std_luminance: number;
  resolution: [number, number];
  verdict: 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'UNUSABLE';
  issues_en: string[];
  issues_te: string[];
  can_proceed: boolean;
}

export interface FieldConfidence {
  field_name: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  score: number;
  reason?: string;
  reasons?: string[];
}

export interface PipelineResult {
  receipt_no?: string;
  receipt_year?: number;
  date?: string;
  abhishekam_from?: string;
  abhishekam_to?: string;
  amount_rupees?: string;
  gothram_final?: any;
  gothram_as_written?: string;
  gothram_in_reference?: boolean;
  gothram_alternatives?: any[];
  people?: any[];
  address?: any;
  address_en?: string;
  address_te?: string;
  pincode?: string;
  geo_metadata?: Record<string, any>;
  phones?: any[];
  needs_human_check?: string[];
  field_confidences?: Record<string, FieldConfidence>;
  overall_confidence?: 'GREEN' | 'AMBER' | 'RED';
  is_duplicate?: boolean;
  duplicate_receipt_id?: number;
  duplicate_warning?: string;
  duplicate_status?: string;
  rotation_applied?: number;
  intermediate_passes?: Record<string, any>;
  token_usage?: Record<string, any>;
  total_cost_usd?: number;
  total_cost_inr?: number;
  duration_seconds?: number;
}

export interface BatchItemResult {
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  result?: PipelineResult;
  error?: string;
  stored_path?: string;
  preview_url?: string;
}
