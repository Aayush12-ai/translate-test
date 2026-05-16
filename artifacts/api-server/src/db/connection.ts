import mongoose from "mongoose";
import { logger } from "../lib/logger";

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    return;
  }

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/translate-test";

  try {
    await mongoose.connect(mongoUri);
    isConnected = true;
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error}`);
    process.exit(1);
  }
}

export async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("Disconnected from MongoDB");
  }
}
