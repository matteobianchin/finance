import type { NewsArticle } from "@/types/openbb";

interface Props {
  articles: NewsArticle[];
}

export default function NewsFeed({ articles }: Props) {
  if (!articles.length) return <p className="text-muted text-sm">Nessuna news disponibile.</p>;

  return (
    <ul className="space-y-3">
      {articles.map((article, i) => (
        <li key={i} className="border-b border-border/50 pb-3 last:border-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-accent text-sm font-medium leading-snug"
          >
            {article.title}
          </a>
          <p className="text-muted text-xs mt-1">
            {article.source ?? "Fonte sconosciuta"} ·{" "}
            {new Date(article.date).toLocaleDateString("it-IT")}
          </p>
        </li>
      ))}
    </ul>
  );
}
