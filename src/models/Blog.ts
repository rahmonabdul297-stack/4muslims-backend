import { Schema, model } from "mongoose";
interface BlogdataTyps {
  title: string;
  content: string;
  author: string;
  date: Date;
}

const blogPostSchema = new Schema<BlogdataTyps>({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

export const Blog = model<BlogdataTyps>("PostBlogs", blogPostSchema);
