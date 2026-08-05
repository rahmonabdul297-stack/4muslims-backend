export interface sendEmailType {
  subject: string;
  message: string;
  send_to: string;
}

export interface VideoTemplateTypes {
  title: String; // required
  description: String;
  category: String; // e.g. "nature", "abstract", "mosque"
  isPremium: Boolean; // default: false — gates free vs premium access
  cloudinaryPublicId: String; // required — for deletion/reference
  videoUrl: String; // required — Cloudinary secure_url
  thumbnailUrl: String;
  durationSeconds: Number;
  resolution: String; // e.g. "1080x1920"
  tags: [String];
  uploadedBy: ObjectId; // ref: User (admin)
  isActive: Boolean; // default: true — soft delete flag
  createdAt: Date;
  updatedAt: Date;
}
