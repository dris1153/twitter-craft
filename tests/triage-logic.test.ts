import { describe, expect, it } from 'vitest';
import { buildQuestions, mapAnswers, type JevAnswers } from '@/lib/jev-triage';
import { triageSettingsHash } from '@/lib/settings-store';
import { computePriority, freshness } from '@/lib/triage-priority';
import { SettingsSchema, type Triage } from '@/lib/types';
import { parseCount } from '@/lib/x-locale-keywords';

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
});

describe('priority', () => {
  const triage: Triage = {
    id: '1', quality: 1, action: 'reply', topic: 'ai_ml', replyOpening: 1,
    projectMatch: 'none', buildIdea: 0, botInstructions: 0, uncertain: false,
  };
  const now = Date.parse('2026-09-25T12:00:00Z');

  it('decays with age', () => {
    expect(freshness(10)).toBe(1);
    expect(freshness(60)).toBe(0.6);
    expect(freshness(600)).toBe(0.3);
    expect(freshness(2000)).toBe(0);
    const fresh = computePriority(triage, { createdAt: '2026-09-25T11:50:00Z', metrics: { replies: 0, reposts: 0, likes: 0, views: 0 } }, now);
    const old = computePriority(triage, { createdAt: '2026-09-23T11:50:00Z', metrics: { replies: 0, reposts: 0, likes: 0, views: 0 } }, now);
    expect(fresh).toBe(100);
    expect(old).toBe(85);
  });

  it('handles a missing timestamp', () => {
    expect(computePriority(triage, { createdAt: '', metrics: { replies: 0, reposts: 0, likes: 0, views: 0 } }, now)).toBe(85);
  });
});

describe('parseCount', () => {
  it.each([
    ['12', 12], ['1.234', 1234], ['1,234', 1234], ['1,2 N', 1200], ['56 N', 56000],
    ['2,5 Tr', 2_500_000], ['1.2K', 1200], ['3.4M', 3_400_000], ['', 0], ['abc', 0],
  ])('%s → %d', (raw, expected) => expect(parseCount(raw)).toBe(expected));
});

describe('triageSettingsHash', () => {
  it('changes only when interests or projects change', () => {
    const base = SettingsSchema.parse({});
    expect(triageSettingsHash({ ...base, persona: 'x' })).toBe(triageSettingsHash(base));
    expect(triageSettingsHash({ ...base, interests: ['Rust'] })).not.toBe(triageSettingsHash(base));
  });
});
