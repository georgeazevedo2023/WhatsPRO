// Gera os PNGs-fonte dos ícones/splash a partir de SVG (rodar 1x; saída commitada).
// Uso: node assets/make-icons.mjs  (de dentro de mobile/; sharp vem do @capacitor/assets)
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const G1 = '#209852', G2 = '#218362' // --gradient-primary do painel (hsl 145/160)

// Balão de chat com "W" — desenhado no viewBox 0 0 512 512, centrado.
const bubble = (fill, stroke) => `
  <g>
    <path d="M256 96c-88 0-160 60-160 134 0 42 24 80 62 104l-14 60c-2 9 7 16 15 11l68-40c9 1 19 2 29 2 88 0 160-60 160-137S344 96 256 96z"
          fill="${fill}"/>
    <text x="256" y="262" text-anchor="middle" dominant-baseline="middle"
          font-family="Arial, Helvetica, sans-serif" font-weight="bold"
          font-size="150" fill="${stroke}">W</text>
  </g>`

const gradientDefs = `
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${G1}"/>
      <stop offset="100%" stop-color="${G2}"/>
    </linearGradient>
  </defs>`

// icon-only: quadrado 1024 gradiente + balão (o launcher aplica a máscara)
const iconOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  ${gradientDefs}
  <rect width="512" height="512" fill="url(#g)"/>
  ${bubble('#ffffff', G1)}
</svg>`

// icon-foreground: transparente, balão na zona segura (66% central do adaptive icon)
const iconFg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(0.62) translate(-256 -256)">
    ${bubble('#ffffff', G1)}
  </g>
</svg>`

const iconBg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  ${gradientDefs}
  <rect width="512" height="512" fill="url(#g)"/>
</svg>`

const splash = (bg, bubbleFill, letter) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 512 512">
  ${gradientDefs}
  <rect width="512" height="512" fill="${bg}"/>
  <g transform="translate(256 256) scale(0.5) translate(-256 -256)">
    ${bubble(bubbleFill, letter)}
  </g>
</svg>`

const jobs = [
  ['icon-only.png', iconOnly],
  ['icon-foreground.png', iconFg],
  ['icon-background.png', iconBg],
  ['splash.png', splash('#ffffff', 'url(#g)', '#ffffff')],
  ['splash-dark.png', splash('#0b1220', 'url(#g)', '#ffffff')],
]

for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(new URL(`./${name}`, import.meta.url).pathname.slice(1))
  console.log('ok', name)
}
