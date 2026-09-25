import { describe, expect, it } from 'vitest';
import { isMostlyVisible } from '@/lib/visibility-gate';
import { isOverlayRoute, isTriageRoute, routeKey, triageMode } from '@/lib/x-routes';

describe('isMostlyVisible', () => {
  const vh = 800;
  it.each([
    ['fully visible', { top: 100, bottom: 400, height: 300 }, true],
    ['exactly half', { top: 650, bottom: 950, height: 300 }, true],
    ['sliver at bottom', { top: 760, bottom: 1060, height: 300 }, false],
    ['scrolled mostly off the top', { top: -250, bottom: 50, height: 300 }, false],
    ['tall tweet covering the viewport', { top: -500, bottom: 2500, height: 3000 }, true],
    ['tall tweet mostly below', { top: 600, bottom: 3600, height: 3000 }, false],
    ['collapsed', { top: 0, bottom: 0, height: 0 }, false],
  ])('%s', (_, rect, expected) => expect(isMostlyVisible(rect, vh)).toBe(expected));
});

describe('isTriageRoute', () => {
  it.each([
    ['/home', true],
    ['/search', true],
    ['/i/lists/123456', true],
    ['/karpathy', true],
    ['/karpathy/status/1839000000000000001', true],
    ['/karpathy/status/1839000000000000001/photo/1', true],
    ['/karpathy/with_replies', true],
    ['/notifications', false],
    ['/explore', false],
    ['/messages/123', false],
    ['/settings/account', false],
    ['/i/bookmarks', false],
    ['/compose/post', false],
    ['/karpathy/likes', false],
  ])('%s → %s', (path, expected) => expect(isTriageRoute(path)).toBe(expected));
});

describe('triageMode', () => {
  const post = { id: '100', authorHandle: 'Karpathy', isAd: false, isProtected: false, quoted: null };

  it('scores every post outside a post page', () => {
    expect(triageMode({ ...post, id: '5', authorHandle: 'someone' }, '/home')).toBe('triage');
    expect(triageMode(post, '/karpathy')).toBe('triage');
  });

  it('on a post page, scores the post and its author thread but not other people replies', () => {
    const path = '/karpathy/status/100';
    expect(triageMode(post, path)).toBe('triage');
    expect(triageMode({ ...post, id: '101' }, path)).toBe('triage'); // thread 2/5 by the author, any handle case
    expect(triageMode({ ...post, id: '102', authorHandle: 'commenter' }, path)).toBe('manual');
    expect(triageMode({ ...post, id: '102', authorHandle: 'commenter' }, `${path}/photo/1`)).toBe('manual');
  });

  it('keeps skipping ads and protected posts everywhere', () => {
    expect(triageMode({ ...post, isAd: true }, '/karpathy/status/100')).toBe('skip');
    expect(triageMode({ ...post, quoted: { authorHandle: 'p', text: '', isProtected: true } }, '/home')).toBe('skip');
  });

  it('routeKey changes with the post being viewed', () => {
    expect(routeKey('/home')).toBe('');
    expect(routeKey('/karpathy/status/100')).toBe('100');
    expect(routeKey('/karpathy/status/100/photo/1')).toBe('100');
  });
});

describe('overlay routes', () => {
  it.each([
    ['/compose/post', true],
    ['/karpathy/status/100/photo/1', true],
    ['/karpathy/status/100/video/1', true],
    ['/home', false],
    ['/karpathy/status/100', false],
    ['/karpathy/status/100/quotes', false],
  ])('%s → %s', (path, expected) => expect(isOverlayRoute(path)).toBe(expected));

  it('scores quote lists like a feed', () => {
    const quoter = { id: '7', authorHandle: 'someone', isAd: false, isProtected: false, quoted: null };
    expect(routeKey('/karpathy/status/100/quotes')).toBe('');
    expect(triageMode(quoter, '/karpathy/status/100/quotes')).toBe('triage');
  });
});
