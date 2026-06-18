import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const PlanInput = z.object({
  skill: z.string().min(1).max(100),
  language: z.enum(["English", "Hindi", "Telugu"]),
});

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

function extractJson(text: string): unknown {
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const endChar = cleaned[start] === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(endChar);
  if (end === -1) throw new Error("No JSON found in model output");
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    return JSON.parse(cleaned);
  }
}

export const generateSkillPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are an expert curriculum designer and learning mentor.
Build a complete free learning plan for the skill: "${data.skill}".

LANGUAGE RULE (very important):
- ALL TEXT in the JSON must be in ENGLISH — roadmap, practice sites, project, problem, courses. EVERYTHING English.
- The ONLY exception is "youtubeSearchQueries": tailor those to the learner's preferred language: ${data.language}.
  - English: normal English queries.
  - Hindi: queries surfacing Hindi tutorials (CodeWithHarry, Apna College, etc). Include the word "Hindi".
  - Telugu: queries surfacing Telugu tutorials. Include the word "Telugu".

CRITICAL: Every single youtubeSearchQuery MUST contain the exact skill name "${data.skill}" (or its standard abbreviation). Do NOT produce queries about unrelated topics. Example: for "Data Structures" output queries like "Data Structures and Algorithms tutorial", NOT "machine learning models".

Return ONLY a single valid JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "roadmap": { "beginner": [string,...], "intermediate": [string,...], "advanced": [string,...] },
  "youtubeSearchQueries": [string,...],
  "practiceSites": [{ "name": string, "url": string, "description": string, "whyUseful": string }],
  "project": { "title": string, "difficulty": string, "description": string, "skillsLearned": [string,...], "expectedOutcome": string },
  "freeCourses": [{ "title": string, "provider": string, "url": string, "description": string }],
  "problemOfTheDay": { "statement": string, "difficulty": string, "learningObjective": string }
}

Rules:
- Roadmap: 3-4 items per level (concise topic names).
- youtubeSearchQueries: 3-5 queries, each MUST mention "${data.skill}".
- freeCourses: 2-3 REAL free courses with WORKING URLs.
- practiceSites: 2-3 REAL well-known free sites.
- project: ONE portfolio-worthy project.
- problemOfTheDay: ONE problem.

Output the JSON object only.`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt,
    });

    const parsed = extractJson(text);
    return PlanSchema.parse(parsed);
  });

const YouTubeInput = z.object({
  queries: z.array(z.string()).min(1).max(5),
  skill: z.string(),
  language: z.enum(["English", "Hindi", "Telugu"]).default("English"),
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

export interface YouTubeResult {
  videos: YouTubeVideo[];
  languageNote?: string;
}

interface YTSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
}

interface YTStatsItem {
  id: string;
  statistics: { viewCount?: string };
  contentDetails: { duration: string };
  snippet: { publishedAt: string; title: string; description: string; channelTitle: string };
}

function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? "0", 10) * 3600 +
    parseInt(m[2] ?? "0", 10) * 60 +
    parseInt(m[3] ?? "0", 10)
  );
}

// Build skill keyword set used to validate relevance.
function buildSkillKeywords(skill: string): string[] {
  const s = skill.toLowerCase().trim();
  const base = new Set<string>();
  base.add(s);
  // Split tokens of length >=3 (skip generic words)
  const stop = new Set(["and", "the", "for", "with", "of", "in", "to", "a", "an"]);
  for (const tok of s.split(/[\s/&,\-]+/)) {
    if (tok.length >= 3 && !stop.has(tok)) base.add(tok);
  }
  // Manual aliases for common skills
  const aliases: Record<string, string[]> = {
    "data structures": ["dsa", "algorithm", "algorithms", "data structure"],
    "data structures and algorithms": ["dsa", "algorithm", "data structure"],
    dsa: ["data structure", "algorithm"],
    "web development": ["html", "css", "javascript", "frontend", "web dev"],
    "machine learning": ["ml", "machine-learning"],
    "artificial intelligence": ["ai"],
    "ai / ml": ["machine learning", "artificial intelligence", "ml", "ai"],
    "ai/ml": ["machine learning", "artificial intelligence", "ml", "ai"],
    dbms: ["database", "sql"],
    os: ["operating system"],
    networking: ["computer network", "networks"],
    aptitude: ["quantitative", "reasoning"],
    "ui / ux design": ["ui design", "ux design", "figma"],
    "cloud computing": ["aws", "azure", "gcp", "cloud"],
    "data analytics": ["data analysis", "analytics"],
    cybersecurity: ["cyber security", "ethical hacking", "security"],
  };
  const extras = aliases[s];
  if (extras) extras.forEach((e) => base.add(e));
  return Array.from(base);
}

// Make sure every query references the skill and the target language.
function normalizeQueries(queries: string[], skill: string, language: string): string[] {
  const skillLower = skill.toLowerCase();
  const out: string[] = [];
  for (const raw of queries) {
    let q = raw.trim();
    if (!q) continue;
    if (!q.toLowerCase().includes(skillLower)) {
      q = `${skill} ${q}`;
    }
    if (language !== "English" && !new RegExp(`\\b${language}\\b`, "i").test(q)) {
      q = `${q} in ${language}`;
    }
    out.push(q);
  }
  // Always include a guaranteed-relevant baseline query
  const baseline =
    language === "English"
      ? `${skill} full course tutorial`
      : `${skill} tutorial in ${language}`;
  if (!out.some((q) => q.toLowerCase() === baseline.toLowerCase())) out.unshift(baseline);
  return out.slice(0, 5);
}

function matchesSkill(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

export const fetchYouTubeResources = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => YouTubeInput.parse(input))
  .handler(async ({ data }): Promise<YouTubeResult> => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error("Missing YOUTUBE_API_KEY");

    const keywords = buildSkillKeywords(data.skill);
    const queries = normalizeQueries(data.queries, data.skill, data.language);

    const relevanceLanguage =
      data.language === "Hindi" ? "hi" : data.language === "Telugu" ? "te" : "en";

    const runSearch = async (q: string) => {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", q);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "8");
      url.searchParams.set("order", "relevance");
      url.searchParams.set("relevanceLanguage", relevanceLanguage);
      url.searchParams.set("videoEmbeddable", "true");
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("key", key);
      const res = await fetch(url.toString());
      if (!res.ok) return [] as YTSearchItem[];
      const json = (await res.json()) as { items?: YTSearchItem[] };
      return json.items ?? [];
    };

    const searchResults = await Promise.all(queries.map((q) => runSearch(q)));

    // Dedupe
    const byId = new Map<string, YTSearchItem>();
    for (const items of searchResults) {
      for (const item of items) {
        if (item.id?.videoId && !byId.has(item.id.videoId)) {
          byId.set(item.id.videoId, item);
        }
      }
    }
    const candidates = Array.from(byId.values());
    if (candidates.length === 0) {
      return {
        videos: [],
        languageNote:
          data.language === "English"
            ? undefined
            : `We couldn't find ${data.language} videos for "${data.skill}". Try switching to English for more options.`,
      };
    }

    // Strict skill-relevance filter on title+description+channel.
    const relevant = candidates.filter((c) => {
      const blob = `${c.snippet.title} ${c.snippet.description} ${c.snippet.channelTitle}`;
      return matchesSkill(blob, keywords);
    });

    if (relevant.length === 0) {
      return {
        videos: [],
        languageNote: `No high-quality videos directly matching "${data.skill}" were found${
          data.language !== "English" ? ` in ${data.language}` : ""
        }. Try a different skill or switch language.`,
      };
    }

    // Fetch stats
    const ids = relevant.map((c) => c.id.videoId);
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

    const now = Date.now();
    const languageToken =
      data.language === "Hindi" ? "hindi" : data.language === "Telugu" ? "telugu" : null;

    const scored = relevant
      .map((c) => {
        const stats = statsMap.get(c.id.videoId);
        const views = stats ? parseInt(stats.statistics.viewCount ?? "0", 10) : 0;
        const duration = stats ? isoDurationToSeconds(stats.contentDetails.duration) : 0;
        const ageDays =
          (now - new Date(c.snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (duration < 180 || duration > 36000) return null;

        const titleLower = c.snippet.title.toLowerCase();
        const descLower = c.snippet.description.toLowerCase();

        // Skill score: title matches weigh more
        let skillScore = 0;
        for (const k of keywords) {
          if (titleLower.includes(k)) skillScore += 3;
          else if (descLower.includes(k)) skillScore += 1;
        }
        if (skillScore === 0) return null;

        // Language bonus
        let langScore = 0;
        if (languageToken) {
          if (titleLower.includes(languageToken) || descLower.includes(languageToken)) {
            langScore = 4;
          }
        }

        const viewScore = Math.log10(Math.max(views, 1));
        const recencyScore = Math.max(0, 1.5 - ageDays / (365 * 3));
        const lengthBonus = duration >= 1200 ? 0.5 : 0;
        const legendBonus = views >= 1_000_000 ? 0.75 : 0;

        return {
          item: c,
          views,
          duration,
          langMatched: langScore > 0,
          score: skillScore + langScore + viewScore + recencyScore + lengthBonus + legendBonus,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score);

    // Diversify by channel
    const chosen: typeof scored = [];
    const seenChannels = new Set<string>();
    for (const s of scored) {
      const ch = s.item.snippet.channelTitle;
      if (seenChannels.has(ch)) continue;
      seenChannels.add(ch);
      chosen.push(s);
      if (chosen.length >= 3) break;
    }

    let languageNote: string | undefined;
    if (languageToken && chosen.length > 0 && !chosen.some((c) => c.langMatched)) {
      languageNote = `We couldn't find verified ${data.language} videos for "${data.skill}". Showing the best English-language matches instead.`;
    }

    return {
      videos: chosen.map((s) => ({
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
      })),
      languageNote,
    };
  });
