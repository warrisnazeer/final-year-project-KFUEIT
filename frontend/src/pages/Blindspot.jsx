import { useEffect, useState } from 'react'
import { getBlindspotFeed } from '../api/client'
import StoryFeedCard from '../components/StoryFeedCard'

export default function Blindspot() {
  const [leftStories,  setLeftStories]  = useState([])
  const [rightStories, setRightStories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [leftRes, rightRes] = await Promise.all([
          getBlindspotFeed('Left',  20),
          getBlindspotFeed('Right', 20),
        ])
        setLeftStories(leftRes.data)
        setRightStories(rightRes.data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">

      {/* Header */}
      <div className="bg-orange-900/20 border-b border-orange-800/30 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">&#x26A0;</span>
            <h1 className="text-2xl font-bold text-white">Blindspot</h1>
          </div>
          <p className="text-sm text-orange-300 max-w-2xl">
            Stories covered heavily by only one side of the political spectrum.
            These are the stories your usual sources might be ignoring.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Missing from Left */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="text-base font-semibold text-white">Missing from Left</h2>
              <span className="text-xs text-slate-500 ml-1">
                Stories with little left-leaning coverage
              </span>
            </div>
            {leftStories.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-8 text-center text-slate-500 text-sm">
                No blindspot stories detected yet. Run the scraper to collect more articles.
              </div>
            ) : (
              <div className="space-y-3">
                {leftStories.map(story => (
                  <StoryFeedCard key={story.story_id} story={story} />
                ))}
              </div>
            )}
          </div>

          {/* Missing from Right */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h2 className="text-base font-semibold text-white">Missing from Right</h2>
              <span className="text-xs text-slate-500 ml-1">
                Stories with little right-leaning coverage
              </span>
            </div>
            {rightStories.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-8 text-center text-slate-500 text-sm">
                No blindspot stories detected yet. Run the scraper to collect more articles.
              </div>
            ) : (
              <div className="space-y-3">
                {rightStories.map(story => (
                  <StoryFeedCard key={story.story_id} story={story} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
