// Canvas-based shareable card composition — a plain, functional first pass
// (per the refocus plan: habit-loop validation matters more right now than
// card aesthetics; branded polish is a later upgrade). Produces a PNG Blob
// that ResultsScreen-style navigator.share({ files }) calls can attach.
//
// Item photos come from mixed sources (Firebase Storage, Pexels, user
// uploads) with inconsistent CORS support — a failed/tainted image must never
// break the whole card, so each photo draw is isolated and falls back to a
// plain color swatch on any failure.

const CARD_WIDTH  = 1080
const CARD_HEIGHT = 1350 // 4:5 — safe for IG feed and Stories crop
const BG_TOP    = '#1a1410'
const BG_BOTTOM = '#0c0a08'
const ACCENT    = '#B8956A'

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Draws a photo cover-fit into a rounded square; on any failure (missing
// URL, CORS block, 404), draws a plain accent-tinted placeholder instead.
async function drawPhotoTile(ctx, url, x, y, size, fallbackEmoji = '') {
  roundRect(ctx, x, y, size, size, 20)
  try {
    if (!url) throw new Error('no url')
    const img = await loadImage(url)
    ctx.save()
    ctx.clip()
    const scale = Math.max(size / img.width, size / img.height)
    const dw = img.width * scale, dh = img.height * scale
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
    ctx.restore()
  } catch {
    ctx.save()
    ctx.clip()
    ctx.fillStyle = 'rgba(184,149,106,0.18)'
    ctx.fillRect(x, y, size, size)
    if (fallbackEmoji) {
      ctx.font = `${Math.round(size * 0.4)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(fallbackEmoji, x + size / 2, y + size / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()
  }
}

function newCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width  = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  grad.addColorStop(0, BG_TOP)
  grad.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  return { canvas, ctx }
}

function drawWordmark(ctx) {
  ctx.fillStyle = ACCENT
  ctx.font = '700 30px Georgia, serif'
  ctx.fillText('SARTIMA', 64, 84)
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
  return cy + lineHeight
}

async function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92))
}

/** Renders today's outfit as a shareable PNG blob. */
export async function generateOutfitShareCard({ items, reasoning, occasionTag }) {
  const { canvas, ctx } = newCanvas()
  drawWordmark(ctx)

  ctx.fillStyle = '#ffffff'
  ctx.font = '600 52px Georgia, serif'
  ctx.fillText("Today's Look", 64, 172)

  if (occasionTag) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 24px Georgia, serif'
    ctx.fillText(occasionTag[0].toUpperCase() + occasionTag.slice(1), 64, 210)
  }

  const photoItems = (items ?? []).slice(0, 4)
  const cols = photoItems.length > 2 ? 2 : Math.max(1, photoItems.length)
  const gap = 24
  const gridX = 64
  const gridY = 260
  const gridW = CARD_WIDTH - gridX * 2
  const tileSize = Math.floor((gridW - gap * (cols - 1)) / cols)

  await Promise.all(photoItems.map((item, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = gridX + col * (tileSize + gap)
    const y = gridY + row * (tileSize + gap)
    const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
    return drawPhotoTile(ctx, photoUrl, x, y, tileSize, '👕')
  }))

  const rows = Math.ceil(photoItems.length / cols) || 1
  let textY = gridY + rows * tileSize + (rows - 1) * gap + 80

  if (reasoning) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '400 28px Georgia, serif'
    textY = wrapText(ctx, reasoning, 64, textY, CARD_WIDTH - 128, 38)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '400 20px Georgia, serif'
  ctx.fillText('sartima.app', 64, CARD_HEIGHT - 48)

  return canvasToPngBlob(canvas)
}

/** Renders a monthly wardrobe recap as a shareable PNG blob. */
export async function generateRecapShareCard(recap, monthName) {
  const { canvas, ctx } = newCanvas()
  drawWordmark(ctx)

  ctx.fillStyle = ACCENT
  ctx.font = '700 22px Georgia, serif'
  ctx.fillText(`${monthName.toUpperCase()} RECAP`, 64, 150)

  ctx.fillStyle = '#ffffff'
  ctx.font = '600 48px Georgia, serif'
  ctx.fillText('My wardrobe', 64, 210)
  ctx.fillText('this month', 64, 268)

  const photoUrl = recap.mostWornItem
    ? (recap.mostWornItem.prettifiedUrl ?? recap.mostWornItem.imageUrl ?? recap.mostWornItem.thumbnailUrl)
    : null
  const tileSize = 420
  const tileX = (CARD_WIDTH - tileSize) / 2
  const tileY = 320
  await drawPhotoTile(ctx, photoUrl, tileX, tileY, tileSize, '✦')

  if (recap.mostWornItem) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '400 24px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Most worn: ${recap.mostWornItem.name} (${recap.mostWornCount}×)`, CARD_WIDTH / 2, tileY + tileSize + 48)
    ctx.textAlign = 'left'
  }

  const stats = [
    [String(recap.outfitsLogged), 'outfits logged'],
    [`${recap.uniqueItemsWorn}/${recap.totalClosetItems}`, 'pieces worn'],
    [`${recap.repeatRate}%`, 'repeat rate'],
  ]
  const statY = tileY + tileSize + 130
  const statW = (CARD_WIDTH - 128) / stats.length
  ctx.textAlign = 'center'
  stats.forEach(([value, label], i) => {
    const cx = 64 + statW * i + statW / 2
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 44px Georgia, serif'
    ctx.fillText(value, cx, statY)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 20px Georgia, serif'
    ctx.fillText(label, cx, statY + 34)
  })
  ctx.textAlign = 'left'

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '400 20px Georgia, serif'
  ctx.fillText('sartima.app', 64, CARD_HEIGHT - 48)

  return canvasToPngBlob(canvas)
}

/**
 * Shares a PNG blob via the Web Share API (with image attachment) when
 * supported, falling back to a text+link share, then to clipboard-copy of
 * the text — the same three-tier fallback ResultsScreen already uses.
 */
export async function shareCardBlob(blob, { title, text, fileName }) {
  if (blob && navigator.canShare) {
    const file = new File([blob], fileName, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, text, files: [file] })
        return 'shared'
      } catch {
        // user cancelled or share failed — fall through to link share
      }
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
