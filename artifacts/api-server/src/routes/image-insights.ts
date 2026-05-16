import { Router, type IRouter } from "express";
import { db, imageInsightsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env["GROQ_API_KEY"]?.trim() ?? "";
const GROQ_VISION_MODEL =
  process.env["GROQ_VISION_MODEL"]?.trim() ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_RECENT_INSIGHTS = 6;

type ImageInsightResponse = {
  extractedText: string;
  visualSummary: string;
  answer: string;
  detectedLanguage: string;
  keywords: string[];
  followUpSuggestions: string[];
};

type StoredImageInsight = {
  id: string;
  query: string;
  imageName: string | null;
  analysisJson: string;
  createdAt: Date;
};

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

const inMemoryImageInsights: StoredImageInsight[] = [];
let ensureImageInsightsTablePromise: Promise<void> | null = null;

const emptyInsight: ImageInsightResponse = {
  extractedText: "",
  visualSummary: "",
  answer: "",
  detectedLanguage: "unknown",
  keywords: [],
  followUpSuggestions: [],
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif|bmp);base64,[a-z0-9+/=]+$/i.test(value.trim());
}

function extractJsonObject(value: string): string {
  const firstBraceIndex = value.indexOf("{");
  const lastBraceIndex = value.lastIndexOf("}");

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    throw new Error("Groq response did not contain a JSON object");
  }

  return value.slice(firstBraceIndex, lastBraceIndex + 1);
}

function normalizeInsight(value: unknown): ImageInsightResponse {
  if (!value || typeof value !== "object") {
    return emptyInsight;
  }

  const candidate = value as Record<string, unknown>;

  return {
    extractedText:
      typeof candidate["extractedText"] === "string" ? candidate["extractedText"].trim() : "",
    visualSummary:
      typeof candidate["visualSummary"] === "string" ? candidate["visualSummary"].trim() : "",
    answer: typeof candidate["answer"] === "string" ? candidate["answer"].trim() : "",
    detectedLanguage:
      typeof candidate["detectedLanguage"] === "string"
        ? candidate["detectedLanguage"].trim()
        : "unknown",
    keywords: normalizeStringArray(candidate["keywords"]),
    followUpSuggestions: normalizeStringArray(candidate["followUpSuggestions"]),
  };
}

function parseStoredInsight(record: StoredImageInsight) {
  let parsedInsight = emptyInsight;

  try {
    parsedInsight = normalizeInsight(JSON.parse(record.analysisJson));
  } catch (err) {
    logger.warn({ err, insightId: record.id }, "Could not parse stored image insight JSON");
  }

  return {
    id: record.id,
    query: record.query,
    imageName: record.imageName,
    createdAt: record.createdAt.toISOString(),
    ...parsedInsight,
  };
}

async function ensureImageInsightsTableExists() {
  if (!db) {
    return;
  }

  if (!ensureImageInsightsTablePromise) {
    ensureImageInsightsTablePromise = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS image_insights (
          id text PRIMARY KEY,
          query text NOT NULL,
          image_name text,
          analysis_json text NOT NULL,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `)
      .then(() => undefined)
      .catch((err) => {
        ensureImageInsightsTablePromise = null;
        throw err;
      });
  }

  await ensureImageInsightsTablePromise;
}

async function storeImageInsight(
  query: string,
  imageName: string | null,
  insight: ImageInsightResponse,
): Promise<StoredImageInsight> {
  const id = uuidv4();
  const analysisJson = JSON.stringify(insight);

  if (db) {
    await ensureImageInsightsTableExists();
    await db.insert(imageInsightsTable).values({
      id,
      query,
      imageName,
      analysisJson,
    });

    const [record] = await db
      .select()
      .from(imageInsightsTable)
      .where(eq(imageInsightsTable.id, id))
      .limit(1);

    if (record) {
      return record;
    }
  }

  const fallbackRecord: StoredImageInsight = {
    id,
    query,
    imageName,
    analysisJson,
    createdAt: new Date(),
  };

  inMemoryImageInsights.unshift(fallbackRecord);
  inMemoryImageInsights.splice(MAX_RECENT_INSIGHTS);
  return fallbackRecord;
}

async function listImageInsights(limit = MAX_RECENT_INSIGHTS): Promise<StoredImageInsight[]> {
  if (db) {
    await ensureImageInsightsTableExists();
    return db
      .select()
      .from(imageInsightsTable)
      .orderBy(desc(imageInsightsTable.createdAt))
      .limit(limit);
  }

  return inMemoryImageInsights.slice(0, limit);
}

async function analyzeWithGroq(query: string, imageDataUrl?: string): Promise<ImageInsightResponse> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured. Add it to .env.local to enable image analysis.");
  }

  const userContent: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image_url";
        image_url: {
          url: string;
        };
      }
  > = [
    {
      type: "text",
      text: [
        "Analyze the user request and the attached image, if one is provided.",
        `User query: ${query || "Summarize the image and extract any visible text."}`,
        "Return one valid JSON object with exactly these keys:",
        "extractedText, visualSummary, answer, detectedLanguage, keywords, followUpSuggestions.",
        "Rules:",
        "- extractedText should contain readable text from the image with clean spacing. Use an empty string if no text is visible.",
        "- visualSummary should describe the image in 1 to 3 concise sentences.",
        "- answer should directly answer the user's query in a helpful way.",
        "- detectedLanguage should be the main language found in the text or scene.",
        "- keywords should contain 3 to 6 short phrases.",
        "- followUpSuggestions should contain 2 to 4 short next-step prompts.",
      ].join("\n"),
    },
  ];

  if (imageDataUrl) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: imageDataUrl,
      },
    });
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      response_format: {
        type: "json_object",
      },
      temperature: 0.2,
      max_completion_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are an image-intelligence assistant for a multilingual banking website. Return valid JSON only.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq ${response.status}: ${body}`);
  }

  const json = (await response.json()) as GroqChatCompletionResponse;

  if (json.error?.message) {
    throw new Error(json.error.message);
  }

  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq did not return any analysis content");
  }

  const parsed = JSON.parse(extractJsonObject(content));
  return normalizeInsight(parsed);
}

router.get("/image-insights", async (_req, res) => {
  try {
    const records = await listImageInsights();
    res.json(records.map(parseStoredInsight));
  } catch (err) {
    logger.error({ err }, "Could not list image insights");
    res.status(500).json({ error: "Could not load saved image insights" });
  }
});

router.post("/image-insights", async (req, res) => {
  const query = isNonEmptyString(req.body?.query) ? req.body.query.trim() : "";
  const imageDataUrl = isNonEmptyString(req.body?.imageDataUrl) ? req.body.imageDataUrl.trim() : "";
  const imageName = isNonEmptyString(req.body?.imageName) ? req.body.imageName.trim() : null;

  if (!query && !imageDataUrl) {
    res.status(400).json({ error: "Add a query or upload an image before analyzing." });
    return;
  }

  if (imageDataUrl && !isImageDataUrl(imageDataUrl)) {
    res.status(400).json({ error: "Unsupported image format. Upload PNG, JPG, WEBP, GIF, or BMP." });
    return;
  }

  try {
    const insight = await analyzeWithGroq(query, imageDataUrl || undefined);
    const record = await storeImageInsight(query || "Image analysis", imageName, insight);

    res.status(201).json(parseStoredInsight(record));
  } catch (err) {
    logger.error({ err }, "Image insight generation failed");

    const message = err instanceof Error ? err.message : "Image analysis failed";
    const statusCode = message.includes("GROQ_API_KEY") ? 503 : 500;
    res.status(statusCode).json({ error: message });
  }
});

export default router;
