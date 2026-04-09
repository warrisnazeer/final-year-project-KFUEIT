import { Link } from 'react-router-dom'

const BIAS_COLORS = {
  'Far Left':   { bg: 'bg-blue-950', text: 'text-blue-200', label: 'Far Left' },
  'Lean Left':  { bg: 'bg-blue-800', text: 'text-blue-100', label: 'Lean Left' },
  'Center':     { bg: 'bg-slate-600', text: 'text-slate-200', label: 'Center' },
  'Lean Right': { bg: 'bg-red-900',  text: 'text-red-100',  label: 'Lean Right' },
  'Far Right':  { bg: 'bg-red-950',  text: 'text-red-200',  label: 'Far Right' },
}

function Section({ icon, title, children }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-800/60 border border-slate-700/40 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-slate-800/40 border-b border-slate-700/40 py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            Methodology
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">How NewsNarrative Works</h1>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            An AI-powered platform that aggregates Pakistani news from 18 outlets, detects political bias,
            and shows you how the same story is framed across the spectrum.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-12">

        {/* Step 1: Scraping */}
        <Section icon="📡" title="Step 1 — News Collection">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              NewsNarrative monitors RSS feeds from <strong className="text-white">18 major Pakistani English-language
              news outlets</strong>, scraping up to 15 headlines per outlet every hour. For each article,
              we extract the headline, publication date, and a content snippet. When possible,
              the full article body is fetched using <strong className="text-white">trafilatura</strong> — a
              state-of-the-art web scraping library — for higher-quality text analysis.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                'Dawn', 'Geo News', 'ARY News', 'Express Tribune',
                'The News International', 'Samaa News', 'Dunya News', 'BOL News',
                'Pakistan Today', 'The Nation', 'Business Recorder', 'Naya Daur',
                'Aaj News', 'Hum News', 'Daily Times', 'The Friday Times',
                '92 News HD', 'Pakistan Observer'
              ].map(name => (
                <div key={name} className="bg-slate-700/40 border border-slate-600/40 rounded-lg px-3 py-2 text-slate-300">
                  {name}
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Step 2: Story Grouping */}
        <Section icon="🧩" title="Step 2 — Story Grouping">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed">
              Articles covering the same event are automatically clustered into a single
              <strong className="text-white"> Story</strong> using TF-IDF vectorization and cosine
              similarity. Articles with a similarity score above <strong className="text-white">0.30</strong> are
              grouped together. This means if Dawn, ARY News, and Geo all report on the same press
              conference, they appear as one story — letting you see how each outlet frames it differently.
            </p>
          </Card>
        </Section>

        {/* Step 3: Bias Classification */}
        <Section icon="⚖️" title="Step 3 — Bias Classification">
          <Card className="mb-4">
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Each article's political bias is scored on a continuous scale from
              <strong className="text-blue-400"> −1.0 (Far Left)</strong> to
              <strong className="text-red-400"> +1.0 (Far Right)</strong> using a three-component hybrid model:
            </p>
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-violet-300">Zero-Shot Classification (60%)</span>
                  <span className="text-xs text-slate-500 font-mono">HuggingFace BART</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Facebook's BART large model (trained on MNLI) classifies each article against
                  "liberal / progressive policy" vs "conservative / traditional policy" labels via
                  zero-shot inference. This is the primary signal.
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-emerald-300">Keyword Analysis (30%)</span>
                  <span className="text-xs text-slate-500 font-mono">Custom lexicon</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A curated lexicon of politically charged terms, contextualised for Pakistani
                  political discourse (PTI, PMLN, establishment, crackdown, accountability, subsidies, etc.)
                  contributes a directional signal.
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-orange-300">Outlet Prior (10%)</span>
                  <span className="text-xs text-slate-500 font-mono">Historical calibration</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Each outlet has a manually calibrated prior score based on editorial history,
                  ownership structure, and known political alignment. For example, Naya Daur (−0.35)
                  leans liberal while BOL News (+0.30) leans conservative.
                </p>
              </div>
            </div>
          </Card>

          {/* Bias scale visual */}
          <Card>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Bias Scale</p>
            <div className="flex rounded overflow-hidden h-8 text-[10px] font-bold mb-2">
              {Object.entries(BIAS_COLORS).map(([label, c]) => (
                <div key={label} className={`${c.bg} ${c.text} flex items-center justify-center flex-1 text-center leading-tight px-1`}>
                  {label}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>−1.0</span>
              <span>−0.45</span>
              <span>−0.15 / +0.15</span>
              <span>+0.45</span>
              <span>+1.0</span>
            </div>
          </Card>
        </Section>

        {/* Step 4: Sentiment Analysis */}
        <Section icon="💬" title="Step 4 — Framing & Sentiment">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed">
              Alongside bias, each article's <strong className="text-white">framing tone</strong> is
              detected using DistilBERT sentiment analysis (distilbert-base-uncased-finetuned-sst-2-english)
              via the HuggingFace Inference API. Articles are labelled
              <strong className="text-emerald-400"> Positive</strong>,
              <strong className="text-slate-400"> Neutral</strong>, or
              <strong className="text-red-400"> Negative</strong> based on how they frame events — the
              same bombing can be "militants neutralised" (positive framing) or "civilians killed" (negative framing).
            </p>
          </Card>
        </Section>

        {/* Step 5: AI Summary */}
        <Section icon="✨" title="Step 5 — AI Story Analysis">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Each story cluster is analyzed by <strong className="text-white">Google Gemini 1.5 Flash</strong>,
              which reads all the headlines and content snippets and produces a structured 7-field analysis:
            </p>
            <div className="space-y-2">
              {[
                ['Story Title',      'A neutral, factual headline (8–14 words) with no political spin'],
                ['What Happened',    '3–4 sentence core event overview: what, who, when/where, outcome'],
                ['Key Facts',        '6–8 pipe-separated factual bullets covering background, reactions, and implications'],
                ['Key Actors',       'Main people, parties, and organisations involved'],
                ['Why It Matters',   '2–3 sentences on the significance for Pakistan'],
                ['Left Framing',     'How progressive/liberal outlets interpret and emphasise this story'],
                ['Right Framing',    'How conservative/establishment outlets interpret and emphasise this story'],
              ].map(([field, desc]) => (
                <div key={field} className="flex gap-3 text-xs">
                  <span className="text-violet-400 font-semibold w-28 shrink-0">{field}</span>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Step 6: Factuality */}
        <Section icon="✅" title="Factuality Ratings">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Each outlet carries a <strong className="text-white">factuality rating</strong> based on
              their historical record of accuracy, correction policies, and editorial standards:
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'High',  color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/50', outlets: 'Dawn, Express Tribune, The News International, Business Recorder, Daily Times, The Friday Times' },
                { label: 'Mixed', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',   outlets: 'Geo News, ARY News, Samaa, Dunya, BOL News, Naya Daur, and others' },
              ].map(r => (
                <div key={r.label} className={`border rounded-xl p-4 flex-1 min-w-[200px] ${r.color.split(' ').slice(1).join(' ')}`}>
                  <span className={`text-sm font-bold ${r.color.split(' ')[0]}`}>{r.label} Factuality</span>
                  <p className="text-xs text-slate-400 mt-1">{r.outlets}</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Step 7: Blindspot */}
        <Section icon="🔍" title="Blindspot Detection">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed">
              A story is flagged as a <strong className="text-orange-400">Blindspot</strong> when more than
              <strong className="text-white"> 70%</strong> of its coverage comes from one political side.
              This means the other half of the audience may never see that story in their usual media diet.
              Blindspot feed — inspired by Ground News — surfaces these stories so readers get the full picture.
            </p>
          </Card>
        </Section>

        {/* Reading Diversity */}
        <Section icon="📊" title="Reading Diversity Score">
          <Card>
            <p className="text-slate-300 text-sm leading-relaxed">
              NewsNarrative tracks which stories you read locally (no account needed) and computes
              your <strong className="text-white">Reading Diversity Score</strong> — the percentage of
              left-leaning, center, and right-leaning article exposure in your reading history.
              Visible in the Dashboard sidebar. A balanced score means you are consuming a healthy
              range of political perspectives.
            </p>
          </Card>
        </Section>

        {/* Back */}
        <div className="text-center pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            &larr; Back to Stories
          </Link>
        </div>
      </div>
    </div>
  )
}
