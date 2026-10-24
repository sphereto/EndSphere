import { plugins } from '../data/plugins'
import { NavLink } from '../router'
import DotField from './DotField'

const FAQ: ReadonlyArray<readonly [string, string]> = [
  ['How do I install a plugin?', 'Download the latest release from the plugin’s GitHub page and drop it into your server’s plugins folder, then restart. Each README has the exact steps.'],
  ['Are the plugins free?', 'Yes. Every plugin is free and open source. The licence is listed on each GitHub repository.'],
  ['Where do downloads come from?', 'Straight from each plugin’s GitHub releases. EndSphere only previews them, so you always get the newest version.'],
  ['Which Endstone versions are supported?', 'Each release says which version it targets. Check the plugin’s page before updating your server.'],
  ['I found a bug. What now?', 'Open an issue on that plugin’s GitHub repository.'],
  ['How can I get in touch?', 'Message @sphereto on Discord, or open an issue on GitHub.'],
]

const Heading = ({ title, sub }: { title: string; sub: string }) => (
  <div className="hd2 rv">
    <h2>{title}</h2>
    <p><i />{sub}<i /></p>
  </div>
)

export default function Home() {
  return (
    <main id="home">
      <DotField />
      <section className="hero">
        <div className="w">
          <h1>EndSphere.</h1>
          <div className="sub"><i />Free plugins for Endstone servers.</div>
        </div>
      </section>

      <section className="sec side" id="plugins">
        <div className="w">
          <Heading title="Plugins." sub="the library" />
          <div className="rv">
            {plugins.slice(0, 3).map((p, i) => (
              <div className="row" key={p.name}>
                <span className="mo">0{i + 1}</span>
                <span>{p.name}<small>{p.tagline}</small></span>
                <NavLink to="browse" className="mo">{p.version} ↗</NavLink>
              </div>
            ))}
          </div>
          <div className="cta rv"><NavLink to="browse" className="btn">Browse all plugins →</NavLink></div>
        </div>
      </section>

      <section className="sec side" id="about">
        <div className="big" aria-hidden="true">ENDSPHERE</div>
        <div className="w">
          <Heading title="About." sub="what this is" />
          <div className="ab rv">
            <div><h3>The library</h3><p>EndSphere is a small, free collection of plugins for Endstone, the Bedrock server software. Everything is open source.</p></div>
            <div><h3>The work</h3><p>[What I build — e.g. admin tools, utilities, gameplay]. Written in C++ and Python.</p></div>
            <div><h3>The maker</h3><p>An independent developer who’d rather let the code speak. Reach out through the contact below.</p></div>
          </div>
        </div>
      </section>

      <section className="sec" id="faq">
        <div className="w" style={{ maxWidth: 860 }}>
          <Heading title="FAQ." sub="good to know" />
          <div className="rv">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="close side" id="closing">
        <div className="w">
          <h2 className="rv">Run your <em>server</em> your way.</h2>
          <NavLink to="browse" className="btn">Browse plugins</NavLink>
        </div>
      </section>

      <footer className="ftr">
        <div className="w">
          <div className="fc">
            <div><span className="mo">Navigate</span><NavLink to="home">Home</NavLink><NavLink to="home" section="about">About</NavLink><NavLink to="home" section="faq">FAQ</NavLink><NavLink to="browse">Browse</NavLink></div>
            <div><span className="mo">Elsewhere</span><a href="https://github.com/sphereto">GitHub</a><NavLink to="home" section="faq">Discord: @sphereto</NavLink></div>
            <div><span className="mo">Stack</span><span>Endstone</span><span>C++ · Python</span></div>
            <div><span className="mo">Legal</span><span>Not affiliated with Mojang or Microsoft.</span></div>
          </div>
          <div className="leg mo">© 2026 EndSphere. All rights reserved.</div>
        </div>
      </footer>
    </main>
  )
}
