import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatMissionMet } from '../lib/mission'

interface Article {
  id: string
  title: string
  url: string
  news_site: string
  published_at: string
  image_url: string
  summary: string
}

interface MissionResponse {
  launchDate: string
}

function formatRelativeAge(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recent'
  }

  const diffMs = Date.now() - date.getTime()
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function formatMastheadDate(now: Date) {
  return now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function News() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [launchDate, setLaunchDate] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [hiddenImages, setHiddenImages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api
      .get('/api/news')
      .then((response) => setArticles(response.data))
      .finally(() => setLoading(false))

    api
      .get<MissionResponse>('/api/mission')
      .then((response) => setLaunchDate(response.data.launchDate))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const metElapsed = launchDate ? formatMissionMet(launchDate, now) : '--:--:--'
  const [featuredArticle, ...otherArticles] = articles

  function hasImage(article: Article | undefined) {
    if (!article?.image_url) {
      return false
    }

    return !hiddenImages[article.id]
  }

  return (
    <div className="news-page">
      <section className="news-masthead">
        <div className="news-brandline">Artemis Intelligence</div>
        <h1 className="news-masthead-title">Mission Dispatch</h1>
        <div className="news-masthead-meta">
          {formatMastheadDate(now)} · MET {metElapsed}
        </div>
      </section>

      {loading ? (
        <div className="page-shell" style={{ paddingTop: 16 }}>
          <div className="panel-frame" style={{ minHeight: 240, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <span className="panel-label">Press Desk</span>
              <h2 className="section-title">Loading coverage</h2>
              <p className="section-copy">Gathering the latest Artemis reporting from the current news feed.</p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && featuredArticle ? (
        <section className="news-featured">
          <div className="news-featured-grid">
            <div>
              <div className="news-featured-kicker">Breaking</div>
              <a href={featuredArticle.url} target="_blank" rel="noreferrer">
                <h2 className="news-featured-headline">{featuredArticle.title}</h2>
              </a>
              <p className="news-featured-deck">{featuredArticle.summary}</p>
              <div className="news-featured-meta">
                {featuredArticle.news_site} · {new Date(featuredArticle.published_at).toLocaleString()}
              </div>
            </div>

            <div className={`news-featured-media${hasImage(featuredArticle) ? '' : ' news-featured-media--empty'}`}>
              {hasImage(featuredArticle) ? (
                <img
                  src={featuredArticle.image_url}
                  alt={featuredArticle.title}
                  className="news-featured-image"
                  loading="eager"
                  onError={() => setHiddenImages((current) => ({ ...current, [featuredArticle.id]: true }))}
                />
              ) : (
                <div className="news-featured-fallback">
                  <span>{featuredArticle.news_site}</span>
                </div>
              )}
            </div>
          </div>
          <div className="news-featured-divider" />
        </section>
      ) : null}

      {!loading ? (
        <section className="news-list">
          {otherArticles.map((article, index) => (
            <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className="news-row">
              <div className="news-index">{String(index + 1).padStart(2, '0')}</div>
              <div className={`news-row-thumb${hasImage(article) ? '' : ' news-row-thumb--empty'}`}>
                {hasImage(article) ? (
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="news-row-thumb-image"
                    loading="lazy"
                    onError={() => setHiddenImages((current) => ({ ...current, [article.id]: true }))}
                  />
                ) : (
                  <span className="news-row-thumb-fallback">{article.news_site}</span>
                )}
              </div>
              <div>
                <div className="news-row-headline">{article.title}</div>
                <div className="news-row-deck">
                  {article.news_site} · {article.summary}
                </div>
              </div>
              <div className="news-row-meta">
                <div className="news-row-source">{article.news_site}</div>
                <div className="news-row-time">{formatRelativeAge(article.published_at)}</div>
              </div>
            </a>
          ))}
        </section>
      ) : null}
    </div>
  )
}
