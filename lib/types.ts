import { z } from 'zod';

const MAX_TEXT = 30_000;
const HANDLE = /^[A-Za-z0-9_]{0,15}$/;

export const TweetSchema = z.object({
  id: z.string().regex(/^\d{1,25}$/),
  url: z.string().regex(/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,25}$/),
  authorHandle: z.string().regex(HANDLE),
  authorName: z.string().max(200),
  isProtected: z.boolean(),
  text: z.string().max(MAX_TEXT),
  truncated: z.boolean(),
  lang: z.string().max(10), // language of the text shown ("vi" when X auto-translated it)
  originalLang: z.string().max(10), // author's language; use this for replies
  quoted: z
    .object({ authorHandle: z.string().regex(HANDLE), text: z.string().max(MAX_TEXT), isProtected: z.boolean() })
    .nullable(),
  hasMedia: z.boolean(),
  mediaUrls: z.array(z.string().startsWith('https://pbs.twimg.com/').max(500)).max(4),
  mediaAlt: z.array(z.string().max(1000)).max(4),
  createdAt: z.string().max(40),
  metrics: z.object({ replies: z.number(), reposts: z.number(), likes: z.number(), views: z.number() }),
  isReply: z.boolean(),
  isAd: z.boolean(),
});
export type Tweet = z.infer<typeof TweetSchema>;

export const TRIAGE_ACTIONS = ['reply', 'quote', 'retweet', 'save_idea', 'skip'] as const;
export const TRIAGE_TOPICS = [
  'ai_ml', 'llm_agents', 'web_dev', 'devops_infra', 'languages', 'career', 'startup', 'off_topic',
] as const;

export const TriageSchema = z.object({
  id: z.string().regex(/^\d{1,25}$/),
  quality: z.number().min(0).max(1),
  action: z.enum(TRIAGE_ACTIONS),
  topic: z.enum(TRIAGE_TOPICS),
  replyOpening: z.number().min(0).max(1),
  projectMatch: z.string().max(80),
  buildIdea: z.number().min(0).max(1),
  botInstructions: z.number().min(0).max(1),
  uncertain: z.boolean(),
});
export type Triage = z.infer<typeof TriageSchema>;

export type TriageError = 'no_key' | 'rate_limited' | 'http' | 'invalid' | 'dropped';

export const ProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  url: z.string().max(300),
});
export type Project = z.infer<typeof ProjectSchema>;

export const SettingsSchema = z.object({
  openaiKey: z.string().default(''),
  jevKey: z.string().default(''),
  draftModel: z.string().default('gpt-5.6-terra'),
  ideaModel: z.string().default('gpt-5.6-luna'),
  handle: z.string().default(''),
  persona: z.string().default(''),
  voiceSamples: z.array(z.string()).default([]),
  interests: z.array(z.string()).default(['AI engineering', 'LLM agents', 'web development', 'developer tools']),
  projects: z.array(ProjectSchema).default([]),
  bannedPhrases: z
    .array(z.string())
    .default(['Great insight', 'Game changer', 'This is huge', 'Couldn\'t agree more', 'Love this']),
  maxReplyChars: z.number().int().min(50).max(25_000).default(280),
  readableLanguages: z.array(z.string()).default(['en', 'vi']),
  ideaLanguage: z.string().default('vi'),
  minQuality: z.number().min(0).max(100).default(40),
  dimLowScore: z.boolean().default(true),
  debug: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DisplayPrefsSchema = SettingsSchema.pick({ minQuality: true, dimLowScore: true, debug: true });
export type DisplayPrefs = z.infer<typeof DisplayPrefsSchema>;

// Casual angles on purpose: "insight"/"practical" pushed the model into lecturing (user feedback).
export const REPLY_ANGLES = ['reaction', 'question', 'take'] as const;

export const CARD_KINDS = ['insight', 'code', 'compare'] as const;

// One flat object instead of a union: OpenAI strict mode wants every key required and no tuples,
// so fields that don't apply to a kind come back empty.
export const CardSchema = z.object({
  kind: z.enum(CARD_KINDS),
  title: z.string(),
  bullets: z.array(z.string()), // insight
  lang: z.string(), // code
  code: z.string(), // code
  columns: z.object({ a: z.string(), b: z.string() }), // compare
  rows: z.array(z.object({ label: z.string(), a: z.string(), b: z.string() })), // compare
});
export type Card = z.infer<typeof CardSchema>;

// OpenAI strict structured outputs: nullable (not optional), no tuples.
export const DraftTextSchema = z.object({
  skipReason: z.string().nullable(),
  replies: z.array(z.object({ angle: z.enum(REPLY_ANGLES), text: z.string() })),
  quote: z.string().nullable(),
  gifQuery: z.string().nullable(),
});
export const DraftSchema = DraftTextSchema.extend({ card: CardSchema.nullable() });
export type Draft = z.infer<typeof DraftSchema>;

export const IDEA_STATUSES = ['new', 'reviewing', 'doing', 'dropped'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const X_STATUS_URL = /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,25}$/;

// Fields the model writes; the user can edit all of them.
export const IdeaDraftSchema = z.object({
  title: z.string(),
  problem: z.string(),
  insight: z.string(),
  mvpScope: z.array(z.string()),
  stack: z.array(z.string()),
  promo: z.string(),
  tags: z.array(z.string()),
});
export type IdeaDraft = z.infer<typeof IdeaDraftSchema>;

export type Idea = IdeaDraft & {
  id: string;
  sourceStatusId: string;
  sourceUrl: string; // always matches X_STATUS_URL
  sourceAuthor: string;
  sourceText: string;
  status: IdeaStatus;
  notes: string;
  createdAt: string;
};
