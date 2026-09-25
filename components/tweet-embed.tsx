import type { Tweet } from '@/lib/types';

// The post being answered, framed like an embed. Third-party text uses Inter (DESIGN.md: mono is for our UI).
export function TweetEmbed({ tweet, note }: { tweet: Tweet; note: string | null }) {
  return (
    <section className="space-y-1.5 rounded-sm border-[1.5px] border-ink bg-surface p-3">
      <a href={tweet.url} target="_blank" rel="noreferrer" className="flex items-baseline gap-1.5 font-mono text-xs hover:underline">
        <span className="font-semibold text-ink">{tweet.authorName}</span>
        <span className="text-ink-muted">@{tweet.authorHandle}</span>
      </a>
      <p className="line-clamp-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{tweet.text || tweet.quoted?.text}</p>
      {note && <p className="font-mono text-[11px] text-ink-muted">{note}</p>}
    </section>
  );
}
