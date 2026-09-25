import { describe, expect, it } from 'vitest';
import { buildQuestions } from '@/lib/jev-triage';

describe('jev-triage buildQuestions', () => {
  it('includes project criteria from settings', () => {
    const questions = buildQuestions({
      interests: ['AI'],
      projects: [
        { name: 'proj1', description: 'Project One', url: '' },
        { name: 'proj2', description: 'Project Two', url: '' },
      ],
    });

    const projectCriteria = questions.project_match.criteria;
    expect(projectCriteria).toHaveProperty('none');
    expect(projectCriteria).toHaveProperty('project_0');
    expect(projectCriteria).toHaveProperty('project_1');
    expect(Object.keys(projectCriteria)).toHaveLength(3);
  });

  it('handles empty projects list', () => {
    const questions = buildQuestions({
      interests: ['AI'],
      projects: [],
    });

    const projectCriteria = questions.project_match.criteria;
    expect(projectCriteria).toEqual({ none: 'Not relevant to any listed project' });
  });

  it('joins interests with comma', () => {
    const questions = buildQuestions({
      interests: ['AI', 'Web Dev', 'DevOps'],
      projects: [],
    });

    const qualityInstructions = questions.quality.instructions;
    expect(qualityInstructions).toContain('AI, Web Dev, DevOps');
  });

  it('uses fallback interests when empty', () => {
    const questions = buildQuestions({
      interests: [],
      projects: [],
    });

    const qualityInstructions = questions.quality.instructions;
    expect(qualityInstructions).toContain('software engineering and AI');
  });

  it('quality criteria has 5 levels', () => {
    const questions = buildQuestions({
      interests: ['AI'],
      projects: [],
    });

    const qualityCriteria = questions.quality.criteria;
    expect(Array.isArray(qualityCriteria)).toBe(true);
    expect(qualityCriteria).toHaveLength(5);
  });
});
