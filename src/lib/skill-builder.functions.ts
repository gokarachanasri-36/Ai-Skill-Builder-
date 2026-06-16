import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const PlanInput = z.object({
  skill: z.string().min(1).max(100),
  language: z.enum(["English", "Hindi", "Telugu"]),
});

// NOTE: keep this schema FLAT and free of string formats / min-max bounds.
// Gemini structured output compiles the schema into a constrained-decoding
// state machine and rejects schemas with too many states (.url(), .min(),
// .max(), enums on free fields, etc). Validate stricter rules in code/prompt.
const PlanSchema = z.object({
  roadmap: z.object({
    beginner: z.array(z.string()),
    intermediate: z.array(z.string()),
    advanced: z.array(z.string()),
  }),
  youtubeSearchQueries: z.array(z.string()),
  practiceSites: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      description: z.string(),
      whyUseful: z.string(),
    }),
  ),
  project: z.object({
    title: z.string(),
    difficulty: z.string(),
    description: z.string(),
    skillsLearned: z.array(z.string()),
    expectedOutcome: z.string(),
  }),
  freeCourses: z.array(
    z.object({
      title: z.string(),
      provider: z.string(),
      url: z.string(),
      description: z.string(),
    }),
  ),
  problemOfTheDay: z.object({
    statement: z.string(),
    difficulty: z.string(),
    learningObjective: z.string(),
  }),
});

export type SkillPlan = z.infer<typeof PlanSchema>;

export const generateSkillPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are an expert curriculum designer and learning mentor.
Build a complete free learning plan for the skill: "${data.skill}".
The student prefers content in: ${data.language}.

Requirements:
- Roadmap must be practical, industry-relevant, and ordered (basics first).
- For youtubeSearchQueries: produce 3-5 search queries that will surface the SINGLE BEST tutorial videos from trusted educational channels (e.g. for Python think "Corey Schafer Python tutorial", "freeCodeCamp Python full course", "Programming with Mosh Python"). Prefer queries that include the names of trusted instructors/channels in the relevant language when known. For Hindi prefer channels like CodeWithHarry, Apna College. For Telugu include "in Telugu". Avoid generic clickbait queries.
- freeCourses: 2-3 real, fully-free structured courses with REAL working URLs (freeCodeCamp.org, CS50 on edX, Coursera free audit, Khan Academy, MIT OpenCourseWare, Google/Microsoft Learn, official tutorials). Do NOT invent URLs.
- Practice websites must be REAL, well-known, free-to-use sites with WORKING urls.
- Project should be portfolio-worthy and apply the roadmap.
- Problem of the day should reinforce a core concept.

Return ONLY structured JSON matching the schema.`;

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema: PlanSchema,
      prompt,
    });

    return object;
  });

const YouTubeInput = z.object({
  queries: z.array(z.string()).min(1).max(5),
  skill: z.string(),
});

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  url: string;
}

interface YTSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
}

interface YTStatsItem {
  id: string;
  statistics: { viewCount?: string };
  contentDetails: { duration: string };
  snippet: { publishedAt: string };
}

// Parse ISO8601 duration to seconds
function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

export const fetchYouTubeResources = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => YouTubeInput.parse(input))
  .handler(async ({ data }): Promise<YouTubeVideo[]> => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      throw new Error("Missing YOUTUBE_API_KEY");
    }

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const publishedAfter = threeYearsAgo.toISOString();

    // For each query, run TWO searches: recent (last 3y) and all-time. Merge and rank.
    const runSearch = async (q: string, onlyRecent: boolean) => {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", q);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", onlyRecent ? "6" : "4");
      url.searchParams.set("order", "relevance");
      url.searchParams.set("relevanceLanguage", "en");
      url.searchParams.set("videoEmbeddable", "true");
      if (onlyRecent) url.searchParams.set("publishedAfter", publishedAfter);
      url.searchParams.set("key", key);
      const res = await fetch(url.toString());
      if (!res.ok) return [] as YTSearchItem[];
      const json = (await res.json()) as { items?: YTSearchItem[] };
      return json.items ?? [];
    };

    const searchResults = await Promise.all(
      data.queries.flatMap((q) => [runSearch(q, true), runSearch(q, false)]),
    );

    // Dedupe by videoId
    const byId = new Map<string, YTSearchItem>();
    for (const items of searchResults) {
      for (const item of items) {
        if (item.id?.videoId && !byId.has(item.id.videoId)) {
          byId.set(item.id.videoId, item);
        }
      }
    }
    const candidates = Array.from(byId.values());
    if (candidates.length === 0) return [];

    // Fetch statistics for ranking (in chunks of 50)
    const ids = candidates.map((c) => c.id.videoId);
    const statsMap = new Map<string, YTStatsItem>();
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "statistics,contentDetails,snippet");
      url.searchParams.set("id", chunk.join(","));
      url.searchParams.set("key", key);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const json = (await res.json()) as { items?: YTStatsItem[] };
      for (const it of json.items ?? []) statsMap.set(it.id, it);
    }

    // Score candidates
    const now = Date.now();
    const scored = candidates
      .map((c) => {
        const stats = statsMap.get(c.id.videoId);
        const views = stats ? parseInt(stats.statistics.viewCount ?? "0", 10) : 0;
        const duration = stats ? isoDurationToSeconds(stats.contentDetails.duration) : 0;
        const ageDays =
          (now - new Date(c.snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
        // Filter: drop shorts (<3min) and ultra long (>10h)
        if (duration < 180 || duration > 36000) return null;
        // Score: log views (strong), recency bonus (favor recent but don't exclude classics),
        // length bonus (real tutorials), legend bonus (huge view counts win even when old)
        const viewScore = Math.log10(Math.max(views, 1));
        const recencyScore = Math.max(0, 1.5 - ageDays / (365 * 3)); // up to 1.5 if very recent
        const lengthBonus = duration >= 1200 ? 0.5 : 0;
        const legendBonus = views >= 1_000_000 ? 0.75 : 0;
        return {
          item: c,
          stats,
          views,
          duration,
          score: viewScore + recencyScore + lengthBonus + legendBonus,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score);

    // Diversify by channel — max 1 per channel
    const chosen: typeof scored = [];
    const seenChannels = new Set<string>();
    for (const s of scored) {
      const ch = s.item.snippet.channelTitle;
      if (seenChannels.has(ch)) continue;
      seenChannels.add(ch);
      chosen.push(s);
      if (chosen.length >= 4) break;
    }

    return chosen.map((s) => ({
      id: s.item.id.videoId,
      title: s.item.snippet.title,
      channel: s.item.snippet.channelTitle,
      thumbnail:
        s.item.snippet.thumbnails.high?.url ??
        s.item.snippet.thumbnails.medium?.url ??
        s.item.snippet.thumbnails.default?.url ??
        "",
      publishedAt: s.item.snippet.publishedAt,
      viewCount: s.views,
      url: `https://www.youtube.com/watch?v=${s.item.id.videoId}`,
    }));
  });
