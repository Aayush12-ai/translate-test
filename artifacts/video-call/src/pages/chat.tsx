import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ImageInsightPanel } from "@/components/image-insight-panel";

export function Chat() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-5xl space-y-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span>AI Image Analysis</span>
          </div>
          <h1 className="text-gradient mb-4 text-5xl font-bold">
            AI Chat Assistant
          </h1>
          <p className="text-xl text-muted-foreground">
            Upload images and send queries for instant AI-powered analysis.
          </p>
        </motion.div>

        <ImageInsightPanel />
      </div>
    </div>
  );
}
