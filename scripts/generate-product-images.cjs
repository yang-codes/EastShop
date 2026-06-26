const fs = require('fs')
const path = require('path')

const root = process.cwd()
const productsPath = path.join(root, 'public/mock/products.json')
const seedPath = path.join(root, 'supabase/seed.sql')
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'))
let seedSql = fs.readFileSync(seedPath, 'utf8')

const palette = [
  { bg: '#eef6ff', primary: '#2563eb', secondary: '#93c5fd', accent: '#0f172a' },
  { bg: '#f3f7ee', primary: '#16a34a', secondary: '#bbf7d0', accent: '#14532d' },
  { bg: '#fff7ed', primary: '#ea580c', secondary: '#fed7aa', accent: '#7c2d12' },
  { bg: '#f8fafc', primary: '#475569', secondary: '#cbd5e1', accent: '#111827' },
  { bg: '#fef2f2', primary: '#dc2626', secondary: '#fecaca', accent: '#7f1d1d' },
  { bg: '#f5f3ff', primary: '#7c3aed', secondary: '#ddd6fe', accent: '#2e1065' },
  { bg: '#ecfeff', primary: '#0891b2', secondary: '#a5f3fc', accent: '#164e63' },
  { bg: '#f7fee7', primary: '#65a30d', secondary: '#d9f99d', accent: '#365314' },
  { bg: '#fafaf9', primary: '#78716c', secondary: '#e7e5e4', accent: '#292524' },
  { bg: '#eff6ff', primary: '#1d4ed8', secondary: '#dbeafe', accent: '#172554' },
]

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function wrapText(text, limit = 26) {
  const source = String(text ?? '').trim()
  if (!source) {
    return ['']
  }

  const words = source.split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > limit && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) {
    lines.push(line)
  }

  return lines.slice(0, 3)
}

function textLines(lines, x, y, size, fill, weight = 600, gap = 1.25) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * size * gap}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`)
    .join('')
}

function specCards(product, colors) {
  return (product.specs ?? []).slice(0, 3).map((spec, index) => {
    const y = 284 + index * 72
    return `<g transform="translate(480 ${y})"><rect width="250" height="54" rx="14" fill="white" opacity="0.92"/><text x="18" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${colors.accent}">${esc(spec.label?.en ?? spec.label?.zh ?? spec.id)}</text><text x="18" y="42" font-family="Arial, sans-serif" font-size="15" fill="#475569">${esc(spec.value?.en ?? spec.value?.zh ?? '')}</text></g>`
  }).join('')
}

function productVisual(product, colors) {
  const id = product.id

  if (id.includes('floor') || id.includes('vinyl') || id.includes('epoxy')) {
    return `<g transform="translate(80 210)"><path d="M0 190 L250 48 L520 125 L270 295 Z" fill="${colors.secondary}" stroke="${colors.accent}" stroke-width="6"/><path d="M72 154 L323 82 M146 230 L394 116 M235 65 L235 259 M340 92 L340 229" stroke="white" stroke-width="6" opacity="0.7"/><circle cx="470" cy="128" r="38" fill="${colors.primary}"/><path d="M452 128h36M470 110v36" stroke="white" stroke-width="9" stroke-linecap="round"/></g>`
  }

  if (id.includes('glove')) {
    return `<g transform="translate(125 150)"><path d="M120 56c48 0 82 38 82 90v180c0 50-34 82-78 82s-72-32-72-82V146c0-52 24-90 68-90z" fill="${colors.primary}"/><path d="M278 56c48 0 82 38 82 90v180c0 50-34 82-78 82s-72-32-72-82V146c0-52 24-90 68-90z" fill="${colors.secondary}"/><path d="M88 198h128M246 198h128" stroke="${colors.accent}" stroke-width="10" stroke-linecap="round" opacity="0.65"/></g>`
  }

  if (id.includes('shield')) {
    return `<g transform="translate(130 130)"><path d="M130 22h280l-36 78H166z" fill="${colors.primary}"/><path d="M116 95h300v220c0 82-68 140-150 140S116 397 116 315z" fill="${colors.secondary}" stroke="${colors.primary}" stroke-width="10" opacity="0.9"/><path d="M170 150h185M170 205h185" stroke="white" stroke-width="12" stroke-linecap="round" opacity="0.75"/></g>`
  }

  if (id.includes('cart')) {
    return `<g transform="translate(90 180)"><rect x="80" y="120" width="370" height="116" rx="20" fill="${colors.primary}"/><path d="M98 120l42-78h330" fill="none" stroke="${colors.accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><circle cx="150" cy="270" r="38" fill="${colors.accent}"/><circle cx="400" cy="270" r="38" fill="${colors.accent}"/><circle cx="150" cy="270" r="16" fill="white"/><circle cx="400" cy="270" r="16" fill="white"/></g>`
  }

  if (id.includes('crate')) {
    return `<g transform="translate(105 185)"><path d="M48 88h430l-46 230H88z" fill="${colors.primary}"/><path d="M88 318h344l-38 54H126z" fill="${colors.accent}" opacity="0.9"/><rect x="130" y="135" width="272" height="84" rx="12" fill="${colors.secondary}"/><path d="M48 88l44-52h392l-6 52" fill="${colors.secondary}"/></g>`
  }

  if (id.includes('light')) {
    return `<g transform="translate(150 130)"><rect x="168" y="92" width="190" height="160" rx="24" fill="${colors.accent}"/><circle cx="263" cy="172" r="64" fill="#fde68a"/><path d="M263 55V10M263 344v-45M150 172h-45M420 172h-45" stroke="${colors.primary}" stroke-width="18" stroke-linecap="round"/><path d="M178 322h170l56 72H122z" fill="${colors.primary}"/></g>`
  }

  if (id.includes('laser')) {
    return `<g transform="translate(185 105)"><rect x="86" y="0" width="224" height="378" rx="32" fill="${colors.accent}"/><rect x="124" y="48" width="148" height="72" rx="10" fill="${colors.secondary}"/><circle cx="198" cy="220" r="56" fill="${colors.primary}"/><path d="M350 72l150-58M352 128h170M350 184l150 58" stroke="#ef4444" stroke-width="10" stroke-linecap="round"/></g>`
  }

  return `<g transform="translate(120 150)"><rect width="420" height="300" rx="36" fill="${colors.primary}"/><circle cx="330" cy="80" r="58" fill="${colors.secondary}"/></g>`
}

function coverSvg(product, index) {
  const colors = palette[index % palette.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="${colors.bg}"/><circle cx="1010" cy="110" r="180" fill="${colors.secondary}" opacity="0.75"/><circle cx="120" cy="760" r="220" fill="white" opacity="0.7"/><rect x="64" y="64" width="1068" height="768" rx="36" fill="white" opacity="0.72"/>${productVisual(product, colors)}<g transform="translate(70 80)"><rect width="180" height="38" rx="19" fill="${colors.primary}"/><text x="24" y="25" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="white">EastShop</text></g>${textLines(wrapText(product.name?.en ?? product.name?.zh, 25), 700, 205, 52, colors.accent, 800, 1.08)}${textLines(wrapText(product.description?.en ?? product.description?.zh, 40), 704, 382, 25, '#475569', 500, 1.35)}${specCards(product, colors)}<text x="74" y="812" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${colors.primary}">${esc(product.tags?.slice(0, 3).join(' / ') ?? 'Industrial supply')}</text></svg>`
}

function detailSvg(product, index, page) {
  const colors = palette[index % palette.length]
  const title = page === 1 ? 'Product details' : 'Specification snapshot'
  const data = page === 1
    ? (product.specs ?? []).slice(0, 4)
    : (product.variants ?? []).filter((variant) => variant.isActive !== false).slice(0, 4)
  const cards = data.map((item, i) => {
    const y = 240 + i * 105
    const label = page === 1 ? (item.label?.en ?? item.label?.zh ?? item.id) : (item.name?.en ?? item.name?.zh ?? item.id)
    const value = page === 1 ? (item.value?.en ?? item.value?.zh ?? '') : `$${Number(item.price ?? 0).toFixed(2)}${item.sku ? ` / ${item.sku}` : ''}`
    return `<g transform="translate(92 ${y})"><rect width="520" height="76" rx="18" fill="white"/><rect width="8" height="76" rx="4" fill="${colors.primary}"/><text x="30" y="31" font-family="Arial, sans-serif" font-size="23" font-weight="800" fill="${colors.accent}">${esc(label)}</text><text x="30" y="58" font-family="Arial, sans-serif" font-size="19" fill="#64748b">${esc(value)}</text></g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="${colors.bg}"/><rect x="58" y="58" width="1084" height="784" rx="34" fill="white" opacity="0.82"/><text x="92" y="132" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${colors.primary}">${esc(title)}</text>${textLines(wrapText(product.name?.en ?? product.name?.zh, 34), 92, 190, 40, colors.accent, 800, 1.12)}${cards}<g transform="translate(690 220) scale(0.72)">${productVisual(product, colors)}</g><rect x="684" y="612" width="420" height="112" rx="22" fill="${colors.secondary}" opacity="0.8"/>${textLines(wrapText(product.detail?.en ?? product.detail?.zh, 54), 714, 650, 22, colors.accent, 600, 1.35)}</svg>`
}

const baseDir = path.join(root, 'public/mock/product-images')
fs.mkdirSync(baseDir, { recursive: true })

for (let i = 0; i < products.length; i += 1) {
  const product = products[i]
  const dir = path.join(baseDir, product.id)
  const coverPath = `/mock/product-images/${product.id}/cover.svg`
  const detailPaths = [
    `/mock/product-images/${product.id}/detail-1.svg`,
    `/mock/product-images/${product.id}/detail-2.svg`,
  ]

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'cover.svg'), coverSvg(product, i))
  fs.writeFileSync(path.join(dir, 'detail-1.svg'), detailSvg(product, i, 1))
  fs.writeFileSync(path.join(dir, 'detail-2.svg'), detailSvg(product, i, 2))
  product.coverImage = coverPath
  product.coverImages = [coverPath]
  product.images = detailPaths

}

let imageGroupIndex = 0
seedSql = seedSql.replace(
  /\n    '\/mock\/[^']+',\n    '\["\/mock\/[^"]+"\]'::jsonb,\n    '\[[^\n]+\]'::jsonb,/g,
  (match) => {
    const product = products[imageGroupIndex]
    imageGroupIndex += 1

    if (!product) {
      return match
    }

    return `\n    '${product.coverImage}',\n    '${JSON.stringify(product.coverImages)}'::jsonb,\n    '${JSON.stringify(product.images)}'::jsonb,`
  },
)

fs.writeFileSync(productsPath, `${JSON.stringify(products, null, 2)}\n`)
fs.writeFileSync(seedPath, seedSql)
console.log(`Generated ${products.length * 3} SVG images for ${products.length} products.`)
