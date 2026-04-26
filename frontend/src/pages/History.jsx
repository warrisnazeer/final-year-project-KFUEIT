import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getBookmarks, getSummaryHistory } from '../api/client'

export default function History() {
  const [activeTab, setActiveTab] = useState('Bookmarks')
  const [bookmarks, setBookmarks] = useState([])
  const [summaryHistory, setSummaryHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [bookmarkRes, summaryRes] = await Promise.all([
          getBookmarks(),
          getSummaryHistory(50)
        ])
        setBookmarks(bookmarkRes.data)
        setSummaryHistory(summaryRes.data)
      } catch (err) {
        console.error("Failed to load history", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const renderStoryList = (stories, dateKey) => {
    if (loading) {
      return (
        <div className="space-y-4 animate-pulse">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-24" />
          ))}
        </div>
      )
    }

    if (stories.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <p className="text-4xl mb-4 opacity-50">📂</p>
          <p className="text-lg font-bold text-slate-600">No stories found here yet.</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {stories.map((s, idx) => {
          const dateStr = s[dateKey] ? new Date(s[dateKey]).toLocaleString() : 'Unknown date'
          return (
            <Link 
              key={`${s.story_id}-${idx}`}
              to={`/stories/${s.story_id}`}
              className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-sky-300 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500 mb-1.5 flex items-center gap-2">
                    {s.topic_tag} <span className="text-slate-300">&bull;</span> <span className="text-slate-400">{dateStr}</span>
                    {s.generated_by && (
                       <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] ml-2">
                         {s.generated_by === 'groq' ? 'AI Deep Bias' : 'AI Summary'}
                       </span>
                    )}
                  </p>
                  <h3 className="text-base font-bold text-slate-800 group-hover:text-sky-700 leading-snug transition-colors">
                    {s.story_title}
                  </h3>
                </div>
                
                {/* Bias context for read history */}
                {s.left_count !== undefined && (
                  <div className="shrink-0 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mt-2 md:mt-0">
                     {s.left_count > 0 && <span className="text-[10px] font-bold text-blue-600">{s.left_count} L</span>}
                     {s.center_count > 0 && <span className="text-[10px] font-bold text-teal-600">{s.center_count} C</span>}
                     {s.right_count > 0 && <span className="text-[10px] font-bold text-red-600">{s.right_count} R</span>}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg py-8">
      <div className="max-w-4xl mx-auto px-4 nn-reveal">
        
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-800 mb-2">My Account</h1>
          <p className="text-sm text-slate-500 font-medium">Your personal reading history, bookmarks, and AI analysis timeline.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-brand-border mb-6 overflow-x-auto hide-scrollbar">
          {['Bookmarks', 'AI Analysis'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors cursor-pointer relative ${
                activeTab === tab 
                  ? 'text-sky-600' 
                  : 'text-brand-muted hover:text-slate-700'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'Bookmarks' && renderStoryList(bookmarks, 'bookmarked_at')}
        {activeTab === 'AI Analysis' && renderStoryList(summaryHistory, 'analyzed_at')}

      </div>
    </div>
  )
}
