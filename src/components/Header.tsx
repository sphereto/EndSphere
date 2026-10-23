const LINKS: ReadonlyArray<readonly [string, string]> = [
  ['#home', 'Home.'],
  ['#about', 'About.'],
  ['#faq', 'FAQ.'],
  ['#browse', 'Browse.'],
]

interface Props {
  open: boolean
  onToggle: () => void
}

export default function Header({ open, onToggle }: Props) {
  return (
    <>
      <header>
        <a href="#home" className="lg">
          <b>E</b>
          <i />
          EndSphere.
        </a>
        <button className="bg" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mn" onClick={onToggle}>
          <i />
          <i />
        </button>
      </header>
      <nav className="mn" id="mn" hidden={!open} aria-label="Main">
        {LINKS.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </nav>
    </>
  )
}
