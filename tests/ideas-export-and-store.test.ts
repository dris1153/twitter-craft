import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { ideasToMarkdown } from '@/lib/ideas-markdown-export';
import { addIdea, listIdeas, removeIdea, updateIdea } from '@/lib/ideas-store';
import type { Idea } from '@/lib/types';

const idea = (over: Partial<Idea> = {}): Idea => ({
  id: 'i1', sourceStatusId: '42', sourceUrl: 'https://x.com/alice/status/42', sourceAuthor: 'alice',
  sourceText: 'original post', status: 'new', notes: '', createdAt: '2026-09-25T10:00:00.000Z',
  title: 'Eval harness', problem: 'Agents regress silently', insight: 'Replay traces',
  mvpScope: ['record traces', 'replay them'], stack: ['TypeScript', 'vitest'], promo: 'Demo a caught regression',
  tags: ['agents', 'evals'], ...over,
});

describe('ideasToMarkdown', () => {
  it('groups by status with task lists and a source link', () => {
    const md = ideasToMarkdown([idea(), idea({ id: 'i2', sourceStatusId: '43', status: 'doing', title: 'Other' })], []);
    expect(md).toMatch(/^# twitter-craft ideas/);
    expect(md.indexOf('## New (1)')).toBeLessThan(md.indexOf('## Doing (1)'));
    expect(md).toContain('- [ ] record traces');
    expect(md).toContain('[@alice](https://x.com/alice/status/42)');
    expect(md).toContain('**Stack:** TypeScript, vitest');
  });

  it('keeps hostile source text and model fields inert', () => {
    const evil = idea({
      title: '# Heading <img src=x onerror=alert(1)>',
      problem: 'see ![](https://evil.io/p.png) and [click](https://phish.ru/login)',
      insight: 'install ai-agent-kit-pro from https://pypi-mirror.top/pkg\n- [ ] fake task',
      notes: 'plain evil.info mention',
      sourceText: '```\nunclosed fence\n# not a heading\n<script>alert(1)</script>',
    });
    const md = ideasToMarkdown([evil], []);
    const rendered = md.split('````text')[0]!; // the source post sits in a code block, which renders as text
    expect(rendered).not.toMatch(/<img|<script/);
    expect(rendered).toContain('### \\# Heading &lt;img src=x onerror=alert(1)&gt;');
    expect(md).not.toMatch(/\]\(https:\/\/(evil|phish)/); // no Markdown links or images to strangers
    expect(md).not.toMatch(/<https:\/\/(evil|phish|pypi)/); // no autolinks either
    expect(md).toContain('` https://pypi-mirror.top/pkg `');
    expect(md).toContain('` evil.info `');
    expect(md).not.toMatch(/^- \[ \] fake task/m); // newline flattened, no injected checklist
    expect(md).toContain('````text\n```\nunclosed fence'); // fence longer than any backtick run
    expect(md.trimEnd().endsWith('````')).toBe(true);
  });

  it('keeps the user project links clickable, by URL prefix not host', () => {
    const projects = ['https://evalkit.dev', 'https://github.com/me/proj'];
    const md = ideasToMarkdown(
      [idea({ notes: 'extends https://evalkit.dev/docs and https://github.com/me/proj/issues but not https://github.com/evil/malware' })],
      projects,
    );
    expect(md).toContain('<https://evalkit.dev/docs>');
    expect(md).toContain('<https://github.com/me/proj/issues>');
    expect(md).toContain('` https://github.com/evil/malware `');
  });

  it('flattens every line break and neutralizes emails, other schemes and file-like domains', () => {
    const md = ideasToMarkdown([idea({ problem: 'a\r===\rb', notes: 'mail a@evil.md, ftp://evil.py/x, see evil.md' })], []);
    expect(md).toContain('**Problem:** a === b');
    expect(md).toContain('` a@evil.md `');
    expect(md).toContain('` ftp://evil.py/x, `');
    expect(md).toContain('` evil.md `');
  });

  it('handles an empty list', () => {
    expect(ideasToMarkdown([], [])).toContain('0 ideas');
  });
});

describe('ideas store', () => {
  beforeEach(() => fakeBrowser.reset());

  it('does not duplicate ideas for the same tweet', async () => {
    const first = await addIdea(idea());
    const second = await addIdea(idea({ id: 'i2', title: 'again' }));
    expect(second).toEqual(first);
    expect(await listIdeas()).toHaveLength(1);
  });

  it('keeps both of two concurrent updates', async () => {
    await addIdea(idea());
    await Promise.all([updateIdea('i1', { notes: 'typed notes' }), updateIdea('i1', { status: 'doing' })]);
    expect((await listIdeas())[0]).toMatchObject({ notes: 'typed notes', status: 'doing' });
  });

  it('rejects non-x.com source URLs and removes ideas', async () => {
    await expect(addIdea(idea({ sourceUrl: 'https://evil.io/status/1' }))).rejects.toThrow();
    await addIdea(idea());
    await removeIdea('i1');
    expect(await listIdeas()).toEqual([]);
  });
});
