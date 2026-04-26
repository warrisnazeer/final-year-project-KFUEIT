import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// Restore auth header from localStorage on init
const savedToken = localStorage.getItem('nn_token')
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
}

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
export const runDeepBias         = (id) => api.post(`/stories/${id}/deep-bias`)

// Auth
export const loginUser           = (username, password) => api.post('/auth/login', { username, password })
export const getMe               = () => api.get('/auth/me')

// User — personal tracking
export const markStoryRead       = (id) => api.post(`/user/read/${id}`)
export const getReadingHistory   = (limit = 20) => api.get(`/user/reading-history?limit=${limit}`)
export const toggleBookmark      = (id) => api.post(`/user/bookmarks/${id}`)
export const getBookmarks        = () => api.get('/user/bookmarks')
export const getBookmarkIds      = () => api.get('/user/bookmarks/ids')
export const getDiversity        = () => api.get('/user/diversity')
export const getSummaryHistory   = (limit = 20) => api.get(`/user/summary-history?limit=${limit}`)

export default api
