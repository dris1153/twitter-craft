// Every x.com selector lives here. When X changes its DOM, this file and x-locale-keywords.ts are the fix points.
export const SEL = {
  tweet: 'article[data-testid="tweet"]',
  userName: '[data-testid="User-Name"]',
  tweetText: '[data-testid="tweetText"]',
  showMore: 'button[data-testid="tweet-text-show-more-link"]',
  permalink: 'a[href*="/status/"]',
  time: 'time[datetime]',
  photo: '[data-testid="tweetPhoto"] img',
  video: '[data-testid="videoPlayer"], [data-testid="videoComponent"]',
  // Quoted post is a div[role="link"] inside the parent article, not a nested article.
  quoteCandidate: 'div[role="link"]',
  actionBar: '[role="group"]',
  // Action buttons; their aria-label also carries the exact count.
  reply: '[data-testid="reply"]',
  repost: '[data-testid="retweet"], [data-testid="unretweet"]',
  like: '[data-testid="like"], [data-testid="unlike"]',
  viewsLink: 'a[href$="/analytics"]',
  countText: '[data-testid="app-text-transition-container"]',
  lockIcon: '[data-testid="icon-lock"]',
  // Composer. tweetTextarea_0 also exists outside dialogs (home "What's happening", status-page inline reply):
  // always scope these to the reply/quote dialog.
  dialog: '[role="dialog"]',
  composer: '[data-testid="tweetTextarea_0"]',
  postButton: '[data-testid="tweetButton"]',
  quoteMenuItem: 'a[href*="/compose/"][role="menuitem"]',
  menuItem: '[role="menuitem"]',
} as const;

export const BADGE_ATTR = 'data-twitter-craft';
