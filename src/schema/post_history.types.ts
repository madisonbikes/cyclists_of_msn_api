import { Document, Model, ObjectId } from "mongoose";

export interface PostHistory {
  image_id: ObjectId,
  timestamp: Date
}

export interface PostHistoryDocument extends PostHistory, Document {}
export type PostHistoryModel = Model<PostHistoryDocument>