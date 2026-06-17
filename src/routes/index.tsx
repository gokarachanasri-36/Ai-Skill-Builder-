import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  generateSkillPlan,
  fetchYouTubeResources,
  type SkillPlan,
  type YouTubeVideo,
} from "@/lib/skill-builder.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Skill Builder — Learn anything with the best free resources" },
      {
        name: "description",
        content:
          "Pick a skill. Get an AI-curated learning roadmap, the best free YouTube tutorials, top practice sites, a real project, and a daily problem.",
      },
    ],
  }),
  component: Index,
});

const TRENDING_SKILLS = [
  "Python",
  "Web Development",
  "React",
  "Data Structures",
  "AI / ML",
  "Cybersecurity",
  "UI / UX Design",
  "Cloud Computing",
  "Data Analytics",
  "Blender",
];

type Language = "English" | "Hindi" | "Telugu";
const LANGUAGES: Language[] = ["English", "Hindi", "Telugu"];

type Stage = "select" | "loading" | "results" | "error";

function Index() {
  const [skill, setSkill] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("English");
  const [stage, setStage] = useState<Stage>("select");
  const [plan, setPlan] = useState<SkillPlan | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const generatePlan = useServerFn(generateSkillPlan);
  const fetchVideos = useServerFn(fetchYouTubeResources);

  const pickSkill = (s: string) => {
    setSelectedSkill(s);
    setSkill(s);
    setTimeout(() => {
      document.getElementById("lang-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = skill.trim();
    if (!trimmed) return;
    pickSkill(trimmed);
  };

  const start = async () => {
    if (!selectedSkill) return;
    setStage("loading");
    setErrorMsg("");
    setLoadingStep(0);
    try {
      const stepTimer = setInterval(() => {
        setLoadingStep((s) => Math.min(s + 1, 3));
      }, 1600);
      const planResult = await generatePlan({ data: { skill: selectedSkill, language } });
      setPlan(planResult);
      const vids = await fetchVideos({
        data: { queries: planResult.youtubeSearchQueries, skill: selectedSkill },
      });
      clearInterval(stepTimer);
      setVideos(vids);
      setStage("results");
      setTimeout(() => {
        document.getElementById("results-top")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setStage("error");
    }
  };

  const reset = () => {
    setStage("select");
    setSelectedSkill(null);
    setSkill("");
    setPlan(null);
    setVideos([]);
    setErrorMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-hero">
      <Header onLogoClick={reset} />

      {stage !== "results" && (
        <SkillSelector
          skill={skill}
          setSkill={setSkill}
          selectedSkill={selectedSkill}
          pickSkill={pickSkill}
          onSearchSubmit={onSearchSubmit}
          language={language}
          setLanguage={setLanguage}
          onStart={start}
          loading={stage === "loading"}
        />
      )}

      {stage === "loading" && <LoadingState skill={selectedSkill ?? ""} step={loadingStep} />}

      {stage === "error" && (
        <ErrorBlock message={errorMsg} onRetry={() => setStage("select")} />
      )}

      {stage === "results" && plan && selectedSkill && (
        <Results
          skill={selectedSkill}
          language={language}
          plan={plan}
          videos={videos}
          onReset={reset}
        />
      )}

      <footer className="mx-auto mt-20 max-w-6xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Built with care · AI Skill Builder learns from public resources to recommend free,
        high-quality content
      </footer>
    </main>
  );
}

function Header({ onLogoClick }: { onLogoClick: () => void }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
      <button
        onClick={onLogoClick}
        className="group flex items-center gap-2.5 text-left"
        aria-label="AI Skill Builder home"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow transition-transform group-hover:scale-105">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"
              fill="oklch(0.18 0.04 240)"
            />
          </svg>
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">
          AI Skill Builder
        </span>
      </button>
      <span className="hidden text-xs text-muted-foreground sm:block">
        Free · Curated · For students
      </span>
    </header>
  );
}

function SkillSelector(props: {
  skill: string;
  setSkill: (s: string) => void;
  selectedSkill: string | null;
  pickSkill: (s: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  onStart: () => void;
  loading: boolean;
}) {
  const {
    skill,
    setSkill,
    selectedSkill,
    pickSkill,
    onSearchSubmit,
    language,
    setLanguage,
    onStart,
    loading,
  } = props;

  return (
    <section className="mx-auto max-w-3xl px-6 pt-14 pb-10 sm:pt-20">
      <div className="text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse-glow" />
          Your personal AI learning mentor
        </div>
        <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
          Learn any skill with the <span className="text-gradient-brand">best free</span>
          <br className="hidden sm:block" /> resources on the internet
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Tell us what you want to learn. Get a roadmap, hand-picked YouTube tutorials,
          practice sites, and a real project — in minutes.
        </p>
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="mx-auto mt-10 flex max-w-2xl flex-col gap-2 sm:flex-row"
      >
        <div className="glass relative flex flex-1 items-center rounded-2xl px-4 shadow-card">
          <svg
            className="h-5 w-5 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="e.g. Python, React, Cybersecurity…"
            className="w-full bg-transparent px-3 py-4 text-base outline-none placeholder:text-muted-foreground sm:text-lg"
            aria-label="Skill to learn"
          />
        </div>
        <button
          type="submit"
          disabled={!skill.trim()}
          className="rounded-2xl bg-surface-elevated px-6 py-4 text-sm font-semibold text-foreground transition hover:bg-surface disabled:opacity-40"
        >
          Select
        </button>
      </form>

      <div className="mt-10">
        <p className="mb-3 text-center text-xs uppercase tracking-widest text-muted-foreground">
          Top 10 trending skills
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {TRENDING_SKILLS.map((t) => {
            const active = selectedSkill === t;
            return (
              <button
                key={t}
                onClick={() => pickSkill(t)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-transparent bg-gradient-brand text-brand-foreground shadow-glow"
                    : "border-border bg-surface/60 text-foreground hover:border-brand/40 hover:bg-surface"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSkill && (
        <div
          id="lang-section"
          className="mt-12 animate-float-up rounded-3xl border border-border bg-card-gradient p-6 shadow-card sm:p-8"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Selected skill
              </p>
              <p className="font-display text-2xl font-semibold">{selectedSkill}</p>
            </div>
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Step 2 · Pick a language
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => {
              const active = language === l;
              return (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-surface/40 text-foreground hover:border-brand/40"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>

          <button
            onClick={onStart}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-gradient-brand px-6 py-5 font-display text-base font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] hover:shadow-[0_0_60px_-5px_oklch(0.78_0.16_195/0.7)] disabled:cursor-wait disabled:opacity-70 sm:text-lg"
          >
            {loading ? "Finding your resources…" : "Find My Free Resources →"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Takes about 15–25 seconds. We rank tutorials by quality, not by chance.
          </p>
        </div>
      )}
    </section>
  );
}

function LoadingState({ skill, step }: { skill: string; step: number }) {
  const steps = [
    "Designing your learning roadmap",
    "Scanning top YouTube channels",
    "Ranking the best tutorials",
    "Curating practice sites & a project",
  ];
  return (
    <section className="mx-auto max-w-2xl px-6 pb-16">
      <div className="rounded-3xl border border-border bg-card-gradient p-8 text-center shadow-card">
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
        <h2 className="font-display text-xl font-semibold">
          Building your plan for <span className="text-gradient-brand">{skill}</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Our AI mentor is searching the best free resources for you.
        </p>
        <ul className="mx-auto mt-7 max-w-sm space-y-2.5 text-left">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold ${
                    done
                      ? "border-brand bg-brand text-brand-foreground"
                      : active
                        ? "animate-pulse-glow border-brand bg-brand/20 text-brand"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
                  {s}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="mx-auto max-w-xl px-6 pb-16">
      <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center">
        <h2 className="font-display text-lg font-semibold">Couldn't build your plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-surface-elevated px-5 py-2.5 text-sm font-medium hover:bg-surface"
        >
          Try again
        </button>
      </div>
    </section>
  );
}

function Results({
  skill,
  language,
  plan,
  videos,
  onReset,
}: {
  skill: string;
  language: Language;
  plan: SkillPlan;
  videos: YouTubeVideo[];
  onReset: () => void;
}) {
  return (
    <section id="results-top" className="mx-auto max-w-5xl px-6 pt-10 pb-10 sm:pt-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Your learning plan · {language}
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">
            <span className="text-gradient-brand">{skill}</span>
          </h1>
        </div>
        <button
          onClick={onReset}
          className="rounded-xl border border-border bg-surface/60 px-4 py-2 text-sm font-medium hover:border-brand/40"
        >
          ← Start over
        </button>
      </div>

      <VideosSection videos={videos} />
      <PracticeSection sites={plan.practiceSites.slice(0, 3)} />
      <ProjectSection project={plan.project} />
      <ProblemSection problem={plan.problemOfTheDay} />
      <RoadmapSummary roadmap={plan.roadmap} />
    </section>
  );
}

function SectionHeader({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 font-display text-sm font-bold text-brand">
        {index}
      </span>
      <div>
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function RoadmapSummary({ roadmap }: { roadmap: SkillPlan["roadmap"] }) {
  const rows: { label: string; items: string[] }[] = [
    { label: "Beginner", items: roadmap.beginner.slice(0, 4) },
    { label: "Intermediate", items: roadmap.intermediate.slice(0, 4) },
    { label: "Advanced", items: roadmap.advanced.slice(0, 4) },
  ];
  return (
    <div className="mb-6 animate-float-up">
      <SectionHeader index={5} title="Roadmap Summary" hint="A quick map. Follow in order." />
      <div className="rounded-2xl border border-border bg-card-gradient p-5 shadow-card">
        <ul className="space-y-2.5 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-wrap gap-x-2">
              <span className="font-semibold text-brand">{r.label}:</span>
              <span className="text-foreground/90">{r.items.join(", ")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


function VideosSection({ videos }: { videos: YouTubeVideo[] }) {
  return (
    <div className="mb-14 animate-float-up">
      <SectionHeader
        index={1}
        title="Best Free YouTube Resources"
        hint="Ranked by quality, channel credibility, and freshness."
      />
      {videos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card-gradient p-6 text-sm text-muted-foreground">
          No videos could be loaded right now. Try again in a moment.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {videos.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-2xl border border-border bg-card-gradient shadow-card transition hover:border-brand/50 hover:shadow-glow"
            >
              <div className="relative aspect-video overflow-hidden bg-surface">
                {v.thumbnail && (
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-brand shadow-glow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="oklch(0.18 0.04 240)">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug">
                  {v.title}
                </h3>
                <p className="mt-1.5 text-sm text-brand">{v.channel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatViews(v.viewCount)} views · {formatDate(v.publishedAt)}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CoursesSection({ courses }: { courses: SkillPlan["freeCourses"] }) {
  return (
    <div className="mb-14 animate-float-up">
      <SectionHeader
        index={3}
        title="Free Structured Courses"
        hint="Full courses from trusted platforms — free to take."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((c) => (
          <a
            key={c.url}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-border bg-card-gradient p-5 shadow-card transition hover:border-brand/50"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                {c.provider}
              </span>
              <span className="text-brand transition group-hover:translate-x-0.5">→</span>
            </div>
            <h3 className="font-display text-lg font-semibold leading-snug">{c.title}</h3>
            <p className="mt-2 text-sm text-foreground/85">{c.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function PracticeSection({ sites }: { sites: SkillPlan["practiceSites"] }) {
  return (
    <div className="mb-14 animate-float-up">
      <SectionHeader index={2} title="Practice Websites" hint="Where to actually do the work." />
      <div className="grid gap-4 sm:grid-cols-2">
        {sites.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-border bg-card-gradient p-5 shadow-card transition hover:border-brand/50"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">{s.name}</h3>
              <span className="text-brand transition group-hover:translate-x-0.5">→</span>
            </div>
            <p className="mt-2 text-sm text-foreground/85">{s.description}</p>
            <p className="mt-3 rounded-lg bg-surface/60 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-brand">Why useful: </span>
              {s.whyUseful}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

function ProjectSection({ project }: { project: SkillPlan["project"] }) {
  return (
    <div className="mb-14 animate-float-up">
      <SectionHeader index={3} title="Recommended Project" hint="Apply what you learned." />
      <div className="rounded-2xl border border-border bg-card-gradient p-6 shadow-card sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-display text-2xl font-semibold">{project.title}</h3>
          <Badge variant="brand">{project.difficulty}</Badge>
        </div>
        <p className="mt-3 text-sm text-foreground/90">{project.description}</p>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Skills you'll learn
          </p>
          <div className="flex flex-wrap gap-2">
            {project.skillsLearned.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Expected outcome
          </p>
          <p className="mt-1.5 text-sm text-foreground/90">{project.expectedOutcome}</p>
        </div>
      </div>
    </div>
  );
}

function ProblemSection({ problem }: { problem: SkillPlan["problemOfTheDay"] }) {
  return (
    <div className="mb-6 animate-float-up">
      <SectionHeader index={4} title="Problem of the Day" hint="Reinforce a key concept." />
      <div className="rounded-2xl border border-border bg-card-gradient p-6 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="warm">{problem.difficulty}</Badge>
          <span className="text-xs text-muted-foreground">
            Objective: {problem.learningObjective}
          </span>
        </div>
        <p className="text-base leading-relaxed text-foreground/95">{problem.statement}</p>
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "brand",
}: {
  children: React.ReactNode;
  variant?: "brand" | "warm";
}) {
  const cls =
    variant === "brand"
      ? "bg-brand/15 text-brand border-brand/30"
      : "bg-accent-warm/15 text-accent-warm border-accent-warm/30";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  } catch {
    return "";
  }
}
