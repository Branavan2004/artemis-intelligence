import { useEffect, useState } from 'react'
import axios from 'axios'

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
    axios.get('http://localhost:4000/api/news')
      .then(r => setArticles(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-artemis-blue font-mono animate-pulse">Fetching latest space news...</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-black text-white mb-2">MISSION NEWS</h1>
        <p className="text-gray-400">Latest Artemis II coverage from around the world</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map((article) => (
          <div key={article.id} className="bg-space-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-600 transition-all group cursor-pointer" onClick={() => window.open(article.url, '_blank')}>
            {article.image_url && (
              <div className="h-48 overflow-hidden">
                <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-artemis-blue text-xs font-mono uppercase">{article.news_site}</span>
                <span className="text-gray-500 text-xs">{new Date(article.published_at).toLocaleDateString()}</span>
              </div>
              <h2 className="text-white font-semibold text-lg mb-3 leading-snug group-hover:text-artemis-blue transition-colors">
                {article.title}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {article.summary}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
