import { useState } from 'react'
import { letterOf, plugins, type Lang } from '../data/plugins'

const LANGS: ReadonlyArray<'All' | Lang> = ['All', 'C++', 'Python']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function Browse() {
  const [q, setQ] = useState('')
  const [lang, setLang] = useState<'All' | Lang>('All')
  const [letter, setLetter] = useState('')
  const shown = plugins.filter(
    (p) => (lang === 'All' || p.lang === lang) && (!letter || letterOf(p) === letter) && p.name.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <main id="browse">
      <div className="w">
        <span className="mo" style={{ color: 'var(--ac)' }}>Library</span>
        <h1>Browse.</h1>
        <div className="tools">
          <label className="mo" htmlFor="q">Search</label>
          <input id="q" type="search" placeholder="Search plugins…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {LANGS.map((l) => (
              <button key={l} className={`chip${lang === l ? ' on' : ''}`} onClick={() => setLang(l)}>{l}</button>
            ))}
          </div>
          <div className="az" aria-label="A to Z">
            {LETTERS.map((c) => (
              <button key={c} className={letter === c ? 'on' : ''} disabled={!plugins.some((p) => letterOf(p) === c)} onClick={() => setLetter(letter === c ? '' : c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="mo">{shown.length} {shown.length === 1 ? 'plugin' : 'plugins'}</div>
        <div className="grid">
          {shown.length === 0 && (
            <div>
              <p className="mo" style={{ marginBottom: 16 }}>No plugins match.</p>
              <button className="chip" onClick={() => { setQ(''); setLang('All'); setLetter('') }}>Clear filters</button>
            </div>
          )}
          {shown.map((p) => (
            <article className="card" key={p.name}>
              <div className="th" aria-hidden="true">{letterOf(p)}</div>
              <div className="cb">
                <h3>{p.name}</h3>
                <p>{p.tagline}</p>
                <div className="cf">
                  <span className="mo">{p.version} · {p.lang}</span>
                  <a className="mo" href={`${p.repo}/releases/latest`} target="_blank" rel="noopener noreferrer">Download ↗</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
