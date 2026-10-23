import { NavLink } from '../router'

interface Props {
  open: boolean
  onToggle: () => void
  onClose: () => void
}

export default function Header({ open, onToggle, onClose }: Props) {
  return (
    <>
      <header>
        <NavLink to="home" className="lg">EndSphere</NavLink>
        <button className="bg" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mn" onClick={onToggle}>
          <i />
          <i />
        </button>
      </header>
      <nav className={`mn${open ? ' open' : ''}`} id="mn" aria-label="Main" onClick={onClose}>
        <NavLink to="home">Home.</NavLink>
        <NavLink to="home" section="about">About.</NavLink>
        <NavLink to="home" section="faq">FAQ.</NavLink>
        <NavLink to="browse">Browse.</NavLink>
      </nav>
    </>
  )
}
