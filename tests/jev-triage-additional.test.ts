import { describe, expect, it } from 'vitest';
import { mapAnswers, type JevAnswers } from '@/lib/jev-triage';

describe('jev-triage mapAnswers edge cases', () => {
    it('clamps quality score above 1', () => {
      const answers: JevAnswers = {
        quality: { score: 10 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 2 },
        project_match: { choice: 'none' },
        build_idea: { probability: 1.5 },
        bot_instructions: { probability: 0.8 },
      };

      const triage = mapAnswers('123', answers, undefined, []);

      expect(triage.quality).toBe(1);
      expect(triage.replyOpening).toBe(1);
      expect(triage.buildIdea).toBe(1);
    });

    it('clamps negative scores to 0', () => {
      const answers: JevAnswers = {
        quality: { score: -1 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: -0.5 },
        project_match: { choice: 'none' },
        build_idea: { probability: -0.1 },
        bot_instructions: { probability: 0 },
      };

      const triage = mapAnswers('123', answers, undefined, []);

      expect(triage.quality).toBe(0);
      expect(triage.replyOpening).toBe(0);
      expect(triage.buildIdea).toBe(0);
    });

    it('normalizes quality score 0-4 to 0-1', () => {
      // If there are 5 levels (0-4), score of 2 should be 0.5
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'none' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0 },
      };

      const triage = mapAnswers('123', answers, undefined, []);

      // Score 2 out of 4 = 0.5
      expect(triage.quality).toBe(0.5);
    });

    it('falls back to skip on unknown action choice', () => {
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'unknown_action' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'none' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0 },
      };

      const triage = mapAnswers('123', answers, undefined, []);

      expect(triage.action).toBe('skip');
    });

    it('falls back to off_topic on unknown topic choice', () => {
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'reply' },
        topic: { choice: 'unknown_topic' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'none' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0 },
      };

      const triage = mapAnswers('123', answers, undefined, []);

      expect(triage.topic).toBe('off_topic');
    });

    it('drops project match when bot_instructions > 0.5', () => {
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'project_0' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0.51 }, // Just above 0.5
      };

      const projects = [{ name: 'proj1', description: 'desc', url: '' }];
      const triage = mapAnswers('123', answers, undefined, projects);

      expect(triage.projectMatch).toBe('none');
    });

    it('allows project match when bot_instructions <= 0.5', () => {
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'project_0' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0.5 }, // At threshold
      };

      const projects = [{ name: 'proj1', description: 'desc', url: '' }];
      const triage = mapAnswers('123', answers, undefined, projects);

      expect(triage.projectMatch).toBe('proj1');
    });

    it('marks uncertain when quality confidence < 0.6', () => {
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'none' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0 },
      };

      const triage = mapAnswers('123', answers, { quality: 0.59 }, []);

      expect(triage.uncertain).toBe(true);
    });

    it('ignores topic confidence for uncertain flag', () => {
      const answers: JevAnswers = {
        quality: { score: 2 },
        action: { choice: 'reply' },
        topic: { choice: 'ai_ml' },
        reply_opening: { probability: 0.5 },
        project_match: { choice: 'none' },
        build_idea: { probability: 0 },
        bot_instructions: { probability: 0 },
      };

      const triage = mapAnswers('123', answers, { topic: 0.1 }, []);

      expect(triage.uncertain).toBe(false);
    });
});
