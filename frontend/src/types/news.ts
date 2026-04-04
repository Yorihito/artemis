export interface NewsItem {
  id: string
  title: string
  url: string
  published: string   // ISO-8601 datetime
  source: string
  is_nasa: boolean
}

export interface NewsResponse {
  items: NewsItem[]
  last_crawled: string | null
}
