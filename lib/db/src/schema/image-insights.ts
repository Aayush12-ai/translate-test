import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const imageInsightsTable = pgTable("image_insights", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  imageName: text("image_name"),
  analysisJson: text("analysis_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertImageInsightSchema = createInsertSchema(imageInsightsTable).omit({
  createdAt: true,
});

export type InsertImageInsight = z.infer<typeof insertImageInsightSchema>;
export type ImageInsight = typeof imageInsightsTable.$inferSelect;
