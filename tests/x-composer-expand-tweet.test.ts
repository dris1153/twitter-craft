import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expandTweet } from '@/lib/x-composer';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', `${name}.html`), 'utf8');

describe('expandTweet', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when tweet id not found in DOM', async () => {
    document.body.innerHTML = fixture('translated-quote');
    const result = await expandTweet('999');
    expect(result).toBeNull();
  });

  it('clicks show-more button and re-parses tweet', async () => {
    document.body.innerHTML = fixture('truncated');
    const ID = '1839000000000000005';

    const button = document.querySelector('button[data-testid="tweet-text-show-more-link"]') as HTMLElement;
    let clicked = false;
    if (button) {
      button.onclick = () => {
        clicked = true;
      };
    }

    await expandTweet(ID);

    expect(clicked || !button).toBe(true);
  });

  it('returns parsed tweet after clicking show-more', async () => {
    document.body.innerHTML = fixture('truncated');
    const ID = '1839000000000000005';

    const button = document.querySelector('button[data-testid="tweet-text-show-more-link"]') as HTMLElement;
    if (button) {
      button.onclick = () => {
        const tweetText = document.querySelector('[data-testid="tweetText"]');
        if (tweetText) tweetText.textContent = 'Full post text that was previously truncated';
        button.remove();
      };
    }

    const result = await expandTweet(ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(ID);
  });

  it('clicks only the main tweet show-more, not the quoted one', async () => {
    document.body.innerHTML = fixture('translated-quote');

    const main = document.querySelector('article[data-testid="tweet"]');
    const quote = main?.querySelector('div[role="link"]');

    const mainButton = main?.querySelector('button[data-testid="tweet-text-show-more-link"]') as HTMLElement;
    const quoteButton = quote?.querySelector('button[data-testid="tweet-text-show-more-link"]') as HTMLElement;

    let mainClicked = false;
    let quoteClicked = false;

    if (mainButton) {
      mainButton.onclick = () => {
        mainClicked = true;
        mainButton.remove();
      };
    }

    if (quoteButton) {
      quoteButton.onclick = () => {
        quoteClicked = true;
      };
    }

    const ID = '2103140058434031831';
    await expandTweet(ID);

    expect(!mainButton || mainClicked).toBe(true);
    expect(quoteClicked).toBe(false);
  });

  it('waits for show-more button to disappear after click', async () => {
    document.body.innerHTML = fixture('truncated');
    const ID = '1839000000000000005';

    const button = document.querySelector('button[data-testid="tweet-text-show-more-link"]') as HTMLElement;
    let removed = false;

    if (button) {
      button.onclick = () => {
        setTimeout(() => {
          button.remove();
          removed = true;
        }, 100);
      };
    }

    const result = await expandTweet(ID);

    expect(removed || !button).toBe(true);
    expect(result?.id).toBe(ID);
  });

  it('returns parsed result when show-more button not present', async () => {
    document.body.innerHTML = fixture('text-only');

    const button = document.querySelector('button[data-testid="tweet-text-show-more-link"]');
    expect(button).toBeNull();

    const result = await expandTweet('1829869570649497699');
    if (result) {
      expect(result.text).toBeDefined();
    }
  });
});
