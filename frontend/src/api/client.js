import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

export const getDashboardStats   = () => api.get('/dashboard/stats')
export const getBiasOverview     = () => api.get('/dashboard/bias-overview')
export const getRecentArticles   = (limit = 12) => api.get(`/dashboard/recent-articles?limit=${limit}`)
export const getOutlets          = () => api.get('/outlets/')
export const getArticles         = (params = {}) => api.get('/articles/', { params })
export const getArticle          = (id) => api.get(`/articles/${id}`)
export const triggerScrape       = () => api.post('/scrape')

// Story-centric endpoints (Ground News style)
export const getStoryFeed        = (limit = 30, skip = 0, topic = null) =>
  api.get('/stories/', { params: { limit, skip, ...(topic && topic !== 'All' ? { topic } : {}) } })
export const getBlindspotFeed    = (side = null, limit = 20) =>
  api.get('/stories/blindspot', { params: { limit, ...(side ? { side } : {}) } })
export const getStoryDetail      = (id) => api.get(`/stories/${id}`)
export const getTopicTrends      = (days = 7) => api.get(`/dashboard/topic-trends?days=${days}`)
export const summarizeStory      = (id) => api.post(`/stories/${id}/summarize`)
export const expandStory         = (id) => api.post(`/stories/${id}/expand`)

export default api
