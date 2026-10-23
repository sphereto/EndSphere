export type Lang = 'C++' | 'Python'

export interface Plugin {
  name: string
  lang: Lang
  tagline: string
  version: string
  repo: string // GitHub repository URL; Download links to <repo>/releases/latest
}

// PLACEHOLDER DATA — replace with your real plugins (later: generated from the GitHub API at build time).
export const plugins: Plugin[] = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map((name, i) => ({
  name,
  lang: i % 2 === 0 ? 'C++' : 'Python',
  tagline: '[One-line tagline]',
  version: 'v0.0.0',
  repo: `https://github.com/OWNER/${name.toLowerCase()}`,
}))

export const letterOf = (p: Plugin): string => p.name.charAt(0).toUpperCase()
