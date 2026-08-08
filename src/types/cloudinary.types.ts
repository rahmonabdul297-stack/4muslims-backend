export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  [key: string]: any;
}

export interface CloudinaryUploadResult {
  url: string;
  public_id: string;
}

export interface CloudinaryVideoUploadResult {
  url: string;
  public_id: string;
  duration?: number;
  format?: string;
}