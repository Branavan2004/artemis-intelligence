import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Article {
  id: string
  title: string
  url: string
  news_site: string
  published_at: string
  image_url: string
  summary: string
}

export default function News() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/api/news')
      .then((response) => setArticles(response.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--muted)]">
        Loading news...
      </div>
    )
  }

  const [featuredArticle, ...otherArticles] = articles

  return (
    <div className="page">
      <section className="page-header-split">
        <div className="page-header">
          <p className="section-label">News</p>
          <h1 className="page-title">Coverage and analysis</h1>
          <p className="page-copy">
            A curated editorial view of recent Artemis reporting, with one lead story and a structured grid of supporting coverage below.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-plain p-6">
            <p className="section-label">Stories loaded</p>
            <div className="value-display mt-4">{articles.length}</div>
            <p className="mt-4 text-sm text-[color:var(--muted)]">Recent mission-related articles returned by the news service.</p>
          </div>
          <div className="card-plain p-6">
            <p className="section-label">Coverage mode</p>
            <div className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">Editorial feed</div>
            <p className="mt-4 text-sm text-[color:var(--muted)]">One featured report and a three-column briefing grid.</p>
          </div>
        </div>
      </section>

      {featuredArticle && (
        <section className="card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
            {featuredArticle.image_url && (
              <div className="min-h-[340px] bg-[color:var(--surface-soft)]">
                <img src={featuredArticle.image_url} alt={featuredArticle.title} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="flex flex-col p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted)]">
                <span>{featuredArticle.news_site}</span>
                <span>•</span>
                <span>{new Date(featuredArticle.published_at).toLocaleDateString()}</span>
              </div>

              <h2 className="mt-5 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--text)]">
                {featuredArticle.title}
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--muted)]">{featuredArticle.summary}</p>

              <div className="mt-8 pt-6 border-t border-[color:var(--border)]">
                <a
                  href={featuredArticle.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Read more →
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {otherArticles.map((article) => (
          <article key={article.id} className="card-plain flex flex-col p-6">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <span>{article.news_site}</span>
              <span>•</span>
              <span>{new Date(article.published_at).toLocaleDateString()}</span>
            </div>

            <h2 className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--text)]">
              {article.title}
            </h2>
            <p className="mt-4 flex-1 text-sm leading-7 text-[color:var(--muted)]">{article.summary}</p>

            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Read more →
            </a>
          </article>
        ))}
      </section>
    </div>
  )
}
