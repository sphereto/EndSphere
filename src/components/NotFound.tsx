import { NavLink } from '../router'

export default function NotFound() {
  return (
    <main id="browse">
      <div className="w">
        <span className="mo" style={{ color: 'var(--ac)' }}>404</span>
        <h1>Not found.</h1>
        <p style={{ color: 'var(--mut)', maxWidth: '44ch', margin: '16px 0 32px' }}>That page doesn’t exist. Head back and pick a plugin.</p>
        <NavLink to="home" className="btn">Back to home</NavLink>
      </div>
    </main>
  )
}
