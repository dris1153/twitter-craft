import { describe, expect, it } from 'vitest';
import { buildQuestions, mapAnswers, qualityFrom, type JevAnswers } from '@/lib/jev-triage';
import { triageSettingsHash } from '@/lib/settings-store';
import { computePriority, freshnessBonus, isIdeaWorthy } from '@/lib/triage-priority';
import { SettingsSchema, type Triage } from '@/lib/types';
import { parseCount, translatedFromLang } from '@/lib/x-locale-keywords';

// SDK-shaped answers (ai experimental_evaluate). Replace with a recorded live response once a key is set up.
const answers = (over: Partial<JevAnswers> = {}): JevAnswers => ({
  quality: { score: 3 },
  action: { choice: 'reply' },
  topic: { choice: 'llm_agents' },
  reply_opening: { probability: 0.8 },
  project_match: { choice: 'project_1' },
  build_idea: { probability: 0.3 },
  bot_instructions: { probability: 0.1 },
  ...over,
});
const projects = [
  { name: 'alpha', description: 'a', url: '' },
  { name: 'twitter-craft', description: 'b', url: '' },
];

describe('mapAnswers', () => {
  it('normalizes the 0..4 score to 0..1 and resolves project keys', () => {
    const t = mapAnswers('1', answers(), { quality: 0.9, action: 0.8, project_match: 0.7 }, projects);
    expect(t.quality).toBe(0.75);
    expect(t.projectMatch).toBe('twitter-craft');
    expect(t.uncertain).toBe(false);
  });

  it('marks uncertain on low quality/action/project confidence but ignores topic', () => {
    expect(mapAnswers('1', answers(), { action: 0.4 }, projects).uncertain).toBe(true);
    expect(mapAnswers('1', answers(), { topic: 0.2 }, projects).uncertain).toBe(false);
  });

  it('drops project match on bait and falls back on unknown choices', () => {
    const t = mapAnswers(
      '1',
      answers({ bot_instructions: { probability: 0.9 }, action: { choice: 'dance' }, topic: { choice: '??' } }),
      undefined,
      projects,
    );
    expect(t).toMatchObject({ projectMatch: 'none', action: 'skip', topic: 'off_topic', botInstructions: 0.9 });
  });

  it('builds project criteria from settings', () => {
    const q = buildQuestions({ interests: ['AI'], projects });
    expect(Object.keys(q.project_match.criteria)).toEqual(['none', 'project_0', 'project_1']);
    expect(q.quality.criteria).toHaveLength(5);
  });

  it('tells Jev that sharing a prompt is not bait', () => {
    const q = buildQuestions({ interests: ['AI'], projects: [] });
    expect(q.bot_instructions.criteria.false).toMatch(/share, discuss or quote prompts/);
  });
});

describe('priority', () => {
  const triage: Triage = {
    id: '1', quality: 0.6, action: 'reply', topic: 'ai_ml', replyOpening: 0.4,
    projectMatch: 'none', buildIdea: 0, botInstructions: 0, uncertain: false,
  };
  const now = Date.parse('2026-09-25T12:00:00Z');
  const at = (createdAt: string, likes = 0) => ({ createdAt, metrics: { replies: 0, reposts: 0, likes, views: 0 } });

  it('adds a freshness bonus but never penalizes old posts', () => {
    expect(freshnessBonus(10)).toBe(0.1);
    expect(freshnessBonus(120)).toBe(0.05);
    expect(freshnessBonus(900)).toBe(0);
    expect(computePriority(triage, at('2026-09-25T11:50:00Z'), now)).toBe(65);
    expect(computePriority(triage, at('2026-09-23T11:50:00Z'), now)).toBe(55);
    expect(computePriority(triage, at(''), now)).toBe(55);
  });

  it('treats idea-worthiness separately from reply priority', () => {
    expect(isIdeaWorthy({ ...triage, buildIdea: 0.7 })).toBe(true);
    expect(isIdeaWorthy({ ...triage, buildIdea: 0.4 })).toBe(false);
    expect(isIdeaWorthy({ ...triage, buildIdea: 0.9, botInstructions: 0.8 })).toBe(false);
  });

  it('boosts posts gaining likes fast and caps at 100', () => {
    expect(computePriority(triage, at('2026-09-25T11:50:00Z', 100), now)).toBe(70);
    expect(computePriority({ ...triage, quality: 1, replyOpening: 1 }, at('2026-09-25T11:50:00Z'), now)).toBe(100);
  });
});

describe('qualityFrom', () => {
  it('falls back to the linear score without a distribution', () => {
    expect(qualityFrom({ score: 2 })).toBe(0.5);
  });

  it('spreads bait and substantive posts apart', () => {
    const bait = qualityFrom({ score: 0.7, probabilities: { 0: 0.4, 1: 0.5, 2: 0.1 } });
    const solid = qualityFrom({ score: 3, probabilities: { 2: 0.2, 3: 0.6, 4: 0.2 } });
    expect(bait).toBeCloseTo(0.095);
    expect(solid).toBeCloseTo(0.8);
  });
});

describe('parseCount', () => {
  it.each([
    ['12', 12], ['1.234', 1234], ['1,234', 1234], ['1,2 N', 1200], ['56 N', 56000],
    ['2,5 Tr', 2_500_000], ['1.2K', 1200], ['3.4M', 3_400_000], ['', 0], ['abc', 0],
  ])('%s → %d', (raw, expected) => expect(parseCount(raw)).toBe(expected));
});

describe('translatedFromLang', () => {
  it.each([
    ['Được dịch từ Tiếng Nhật', 'ja'],
    ['Được dịch từ Tiếng Tây Ban Nha', 'es'],
    ['Translated from English', 'en'],
    ['Được dịch từ Tiếng Swahili', 'und'],
    ['Hiện bản gốc', null],
    ['', null],
  ])('%s → %s', (label, expected) => expect(translatedFromLang(label)).toBe(expected));
});

describe('triageSettingsHash', () => {
  it('changes only when interests or projects change', () => {
    const base = SettingsSchema.parse({});
    expect(triageSettingsHash({ ...base, persona: 'x' })).toBe(triageSettingsHash(base));
    expect(triageSettingsHash({ ...base, interests: ['Rust'] })).not.toBe(triageSettingsHash(base));
  });
});
