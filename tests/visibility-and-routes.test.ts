import { describe, expect, it } from 'vitest';
import { isMostlyVisible } from '@/lib/visibility-gate';
import { isTriageRoute } from '@/lib/x-routes';

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
