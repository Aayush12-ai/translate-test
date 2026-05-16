import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { getApiHttpBaseUrl } from "@/lib/utils";

type ImageInsight = {
  id: string;
  query: string;
  imageName: string | null;
  createdAt: string;
  extractedText: string;
  visualSummary: string;
  answer: string;
  detectedLanguage: string;
  keywords: string[];
  followUpSuggestions: string[];
};

type ImageInsightPanelProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

const MAX_UPLOAD_SIZE_BYTES = 2_800_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatInsightDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ImageInsightPanel({
  title = "AI Chat Assistant",
  description = "Upload an image or send a query for instant AI analysis.",
  compact = false,
}: ImageInsightPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [latestInsight, setLatestInsight] = useState<ImageInsight | null>(null);
  const [recentInsights, setRecentInsights] = useState<ImageInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const loadRecentInsights = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch(`${getApiHttpBaseUrl()}/api/image-insights`);
      if (response.ok) {
        setRecentInsights(await response.json());
      }
    } catch {
      setRecentInsights([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadRecentInsights();
  }, []);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast({
        title: "Upload error",
        description: "PNG, JPG, WEBP, GIF, or BMP up to 2.8MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedImageName(file.name);
      setSelectedImagePreview(dataUrl);
      setSelectedImageDataUrl(dataUrl);
    } catch {
      toast({
        title: "Read error",
        description: "Could not read image",
        variant: "destructive",
      });
    }
  };

  const clearImage = () => {
    setSelectedImagePreview(null);
    setSelectedImageDataUrl(null);
    setSelectedImageName(null);
  };

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() && !selectedImageDataUrl) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch(`${getApiHttpBaseUrl()}/api/image-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          imageDataUrl: selectedImageDataUrl,
          imageName: selectedImageName,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Analysis failed");
      }

      const insight = (await response.json()) as ImageInsight;
      setLatestInsight(insight);
      void loadRecentInsights();
      setQuery("");
      clearImage();
      toast({
        title: "Success",
        description: "Analysis complete",
      });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not analyze the query right now.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={compact ? "space-y-6" : "space-y-8"}>
      <Card className="border-blue-100 bg-white shadow-xl shadow-blue-950/5">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-red-50/70">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-700 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl text-slate-950">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div className={compact ? "grid gap-6 lg:grid-cols-[1fr_0.9fr]" : "space-y-6"}>
              <div>
                <label className="mb-2 block text-sm font-medium">Your query</label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Describe your complaint, question, or ask about the uploaded image..."
                  className="h-36 w-full resize-y rounded-2xl border border-blue-100 bg-white p-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-6 text-center transition-colors hover:border-blue-500">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id={compact ? "dashboard-image-upload" : "image-upload"}
                />
                <label
                  htmlFor={compact ? "dashboard-image-upload" : "image-upload"}
                  className="flex cursor-pointer flex-col items-center gap-3"
                >
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-blue-700 ring-1 ring-blue-100">
                    <ImagePlus className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">Upload image</p>
                    <p className="text-sm text-slate-600">
                      PNG, JPG, WEBP, GIF, or BMP up to 2.8MB
                    </p>
                  </div>
                </label>

                <AnimatePresence>
                  {selectedImagePreview && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="mt-6 rounded-2xl border border-blue-100 bg-white p-4 text-left"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {selectedImageName}
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={clearImage}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <img
                        src={selectedImagePreview}
                        alt="Preview"
                        className="max-h-56 w-full rounded-xl object-cover"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full border-blue-700 bg-blue-700 text-base text-white hover:bg-blue-800"
              disabled={isAnalyzing || (!query.trim() && !selectedImageDataUrl)}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Analyze Query
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {latestInsight && (
        <Card className="border-blue-100 bg-white shadow-xl shadow-blue-950/5">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-slate-950">Latest response</CardTitle>
              <Badge className="bg-red-50 text-red-700 hover:bg-red-50">
                {latestInsight.detectedLanguage || "unknown"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="mb-2 font-semibold text-slate-500">Answer</h3>
              <p className="text-base leading-relaxed">{latestInsight.answer}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-slate-500">
                  Visual summary
                </h3>
                <p>{latestInsight.visualSummary || "No image summary returned."}</p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-slate-500">Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {latestInsight.keywords.length > 0 ? (
                    latestInsight.keywords.map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No keywords</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-slate-500">Extracted text</h3>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm">
                {latestInsight.extractedText || "No readable text found."}
              </pre>
            </div>
            {latestInsight.followUpSuggestions.length > 0 && (
              <div>
                <h3 className="mb-3 font-semibold text-slate-500">
                  Suggested follow-ups
                </h3>
                <div className="grid gap-2">
                  {latestInsight.followUpSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="ghost"
                      className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
                      onClick={() => setQuery(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-100 bg-white shadow-lg shadow-blue-950/5">
        <CardHeader>
          <CardTitle className="text-slate-950">Recent insights</CardTitle>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-700" />
              Loading...
            </div>
          ) : recentInsights.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Sparkles className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <p>No insights yet. Analyze an image or query to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInsights.slice(0, compact ? 5 : 10).map((insight) => (
                  <TableRow key={insight.id}>
                    <TableCell className="max-w-md truncate font-medium">
                      {insight.query}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {insight.detectedLanguage || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatInsightDate(insight.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
