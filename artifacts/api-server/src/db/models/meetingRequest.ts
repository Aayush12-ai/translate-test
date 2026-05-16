import mongoose, { Schema, Document } from "mongoose";

export type MeetingStatus = "pending" | "approved" | "rejected" | "completed";

export interface IMeetingRequest extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;
  topic: string;
  description: string;
  requestedDate: Date;
  status: MeetingStatus;
  approvedBy?: mongoose.Types.ObjectId;
  scheduledAt?: Date;
  meetingLink?: string;
  hostMeetingLink?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const meetingRequestSchema = new Schema<IMeetingRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    requestedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    scheduledAt: {
      type: Date,
    },
    meetingLink: {
      type: String,
    },
    hostMeetingLink: {
      type: String,
    },
    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

export const MeetingRequest = mongoose.model<IMeetingRequest>(
  "MeetingRequest",
  meetingRequestSchema,
);
