// Emits real HTML files for each route so GitHub Pages can serve /browse/ directly, with the right <title>.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
mkdirSync('dist/browse', { recursive: true })
writeFileSync('dist/browse/index.html', html.replace(/<title>.*?<\/title>/, '<title>Browse — EndSphere</title>'))
writeFileSync('dist/404.html', html) // unknown paths still load the app
