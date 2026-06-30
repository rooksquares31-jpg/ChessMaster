import jsPDF from 'jspdf'
import { format } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════════════════
   COLOUR PALETTE — clean white / professional print
═══════════════════════════════════════════════════════════════════════════ */
const C = {
  // Page & structure
  bg:           [255, 255, 255],   // white page
  headerBg:     [255, 255, 255],    // white header
  headerText:   [22,  31,  53],
  cardBg:       [255, 255, 255],   // white card
  cardBorder:   [220, 224, 234],
  sectionBg:    [255, 255, 255],   // white section tint
  tableBg:      [255, 255, 255],
  tableAlt:     [248, 249, 252],   // alternating row

  // Text
  textPrimary:  [22,  31,  53],    // near-black
  textSecond:   [80,  95,  130],   // medium grey-blue
  textMuted:    [150, 160, 185],
  textWhite:    [255, 255, 255],

  // Brand accent
  accent:       [15,  80,  180],   // deep blue
  accentLight:  [230, 239, 255],   // very light blue tint

  // Status — vibrant on white
  green:        [22,  163, 74],    // #16a34a
  greenLight:   [220, 252, 231],   // #dcfce7
  greenBorder:  [134, 239, 172],   // #86efac

  red:          [220, 38,  38],    // #dc2626
  redLight:     [254, 226, 226],   // #fee2e2
  redBorder:    [252, 165, 165],   // #fca5a5

  yellow:       [161, 98,  7],     // amber #a16207
  yellowLight:  [254, 243, 199],   // #fef3c7
  yellowBorder: [252, 211, 77],    // #fcd34d

  grey:         [107, 114, 128],   // #6b7280
  greyLight:    [243, 244, 246],   // #f3f4f6
  greyBorder:   [209, 213, 219],   // #d1d5db

  // Grade colours
  gradeA:       [22,  163, 74],
  gradeB:       [37,  99,  235],
  gradeC:       [161, 98,  7],
  gradeD:       [234, 88,  12],
  gradeF:       [220, 38,  38],
}

/* ── Tiny helpers ─────────────────────────────────────────────────────────── */
function fill(doc, col)  { doc.setFillColor(...col) }
function draw(doc, col)  { doc.setDrawColor(...col) }
function tc(doc, col)    { doc.setTextColor(...col) }

function fr(doc, x, y, w, h, col, r = 0) {
  fill(doc, col)
  r ? doc.roundedRect(x, y, w, h, r, r, 'F')
    : doc.rect(x, y, w, h, 'F')
}
function sr(doc, x, y, w, h, col, lw = 0.3, r = 0) {
  draw(doc, col); doc.setLineWidth(lw)
  r ? doc.roundedRect(x, y, w, h, r, r, 'S')
    : doc.rect(x, y, w, h, 'S')
}
function line(doc, x1, y1, x2, y2, col, lw = 0.25) {
  draw(doc, col); doc.setLineWidth(lw)
  doc.line(x1, y1, x2, y2)
}

/* ── Status colour map ──────────────────────────────────────────────────── */
function sp(status) {
  switch (status) {
    case 'correct':   return { bg: [255, 255, 255],  border: C.green,  icon: '✓', label: 'Correct',    col: C.green  }
    case 'wrong':     return { bg: [255, 255, 255],    border: C.red,    icon: '✗', label: 'Wrong',      col: C.red    }
    case 'review':    return { bg: [255, 255, 255], border: C.yellow, icon: '?', label: 'Review',     col: C.yellow }
    default:          return { bg: [255, 255, 255],   border: C.grey,   icon: '·', label: 'Not Marked', col: C.grey   }
  }
}

/* ── Watermark ──────────────────────────────────────────────────────────── */
function drawWatermark(doc, pageW, pageH) {
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.12 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(45)
  tc(doc, [120, 130, 140])
  doc.text('ROOK SQUARES CHESS ACADEMY', pageW / 2, pageH / 2, { angle: 45, align: 'center', baseline: 'middle' })
  doc.restoreGraphicsState()
}

/* ── New page ─────────────────────────────────────────────────────────── */
function newPage(doc, pageW, pageH) {
  doc.addPage()
  fr(doc, 0, 0, pageW, pageH, C.bg)
  drawWatermark(doc, pageW, pageH)
  return 18
}

/* ── Section title ──────────────────────────────────────────────────────── */
function sectionTitle(doc, text, x, y, endX) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  tc(doc, C.textSecond)
  doc.text(text.toUpperCase(), x, y)
  line(doc, x, y + 1.5, endX, y + 1.5, C.cardBorder, 0.3)
  return y + 6
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════════════════ */
export function generateCorrectionPDF({
  student, homework, positions, feedback,
  score, grade, correctedAt, correctedBy, positionOffset = 0
}) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M     = 14             // margin
  const cW    = pageW - M * 2  // content width  (≈ 182 mm)
  let   y     = 0

  const correctCount   = positions.filter(p => p === 'correct').length
  const wrongCount     = positions.filter(p => p === 'wrong').length
  const reviewCount    = positions.filter(p => p === 'review').length
  const uncheckedCount = positions.filter(p => !p || p === 'unchecked').length
  const total          = positions.length

  /* ── WHITE PAGE BACKGROUND ── */
  fr(doc, 0, 0, pageW, pageH, C.bg)
  drawWatermark(doc, pageW, pageH)

  /* ══════════════════════════════════════════════════════════════════════
     ① HEADER — deep navy banner
  ══════════════════════════════════════════════════════════════════════ */
  fr(doc, 0, 0, pageW, 36, C.headerBg)
  line(doc, 0, 36, pageW, 36, C.cardBorder, 0.5)

  // Chess logo box
  fr(doc, M, 6, 22, 22, [240, 242, 248], 3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
  tc(doc, C.accent)
  doc.text('♟', M + 4.5, 21)

  // Academy name + subtitle
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  tc(doc, C.headerText)
  doc.text('ROOK SQUARES CHESS ACADEMY', M + 30, 14)

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  tc(doc, C.textSecond)
  doc.text('Student Performance Report  ·  Homework Correction', M + 30, 20)
  doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`, M + 30, 26)

  // Gold badge top-right
  fr(doc, pageW - M - 36, 10, 36, 14, [255, 200, 50], 2)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
  tc(doc, [80, 50, 0])
  doc.text('OFFICIAL REPORT', pageW - M - 33, 15)
  doc.text('CORRECTION RECORD', pageW - M - 33, 21)

  y = 44

  /* ══════════════════════════════════════════════════════════════════════
     ② STUDENT + HOMEWORK INFO  (two-column card)
  ══════════════════════════════════════════════════════════════════════ */
  fr(doc, M, y, cW, 32, C.cardBg, 3)
  sr(doc, M, y, cW, 32, C.cardBorder, 0.3, 3)

  // Blue left stripe
  fr(doc, M, y, 4, 32, C.accent, 2)

  // Avatar circle
  doc.setFillColor(...C.accent)
  doc.circle(M + 16, y + 16, 8, 'F')
  const ini = ((student.firstName?.[0] || '') + (student.lastName?.[0] || student.username?.[0] || '')).toUpperCase() || '?'
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); tc(doc, C.textWhite)
  doc.text(ini, M + 16, y + 19, { align: 'center' })

  // Student details
  const sName = student.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : student.username
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); tc(doc, C.textPrimary)
  doc.text(sName, M + 28, y + 12)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); tc(doc, C.textSecond)
  doc.text(`@${student.username}  ·  ${student.email}`, M + 28, y + 18)
  if (student.grade) {
    doc.setFontSize(7.5)
    doc.text(`Class / Grade: ${student.grade}`, M + 28, y + 24)
  }

  // Right column — homework + corrected by
  const rxStart = M + cW * 0.55
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); tc(doc, C.textPrimary)
  doc.text(homework.title || 'Untitled', rxStart, y + 12, { maxWidth: cW * 0.42 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); tc(doc, C.textSecond)
  const hwMetaRight = [
    homework.category   && homework.category,
    homework.difficulty && homework.difficulty,
  ].filter(Boolean).join('  ·  ')
  doc.text(hwMetaRight, rxStart, y + 18)

  const corrByName = correctedBy?.firstName
    ? `${correctedBy.firstName} ${correctedBy.lastName || ''}`.trim()
    : correctedBy?.username || 'Coach'
  doc.setFontSize(7); tc(doc, C.textMuted)
  doc.text(`Corrected by: ${corrByName}`, rxStart, y + 24)
  if (correctedAt) doc.text(`Date: ${format(new Date(correctedAt), 'dd MMM yyyy')}`, rxStart, y + 30)

  y += 40

  /* ══════════════════════════════════════════════════════════════════════
     ③ SCORE SUMMARY  — 4 stat boxes on white
  ══════════════════════════════════════════════════════════════════════ */
  const bW  = (cW - 9) / 4
  const bH  = 26
  const statBoxes = [
    { label: 'CORRECT',  value: correctCount,       col: C.green,  bg: C.greenLight,  border: C.greenBorder,  icon: '✓' },
    { label: 'WRONG',    value: wrongCount,          col: C.red,    bg: C.redLight,    border: C.redBorder,    icon: '✗' },
    { label: 'REVIEW',   value: reviewCount,         col: C.yellow, bg: C.yellowLight, border: C.yellowBorder, icon: '?' },
    {
      label: 'FINAL SCORE',
      value: `${score}%`,
      col:    score >= 80 ? C.green  : score >= 60 ? C.yellow : C.red,
      bg:     score >= 80 ? C.greenLight : score >= 60 ? C.yellowLight : C.redLight,
      border: score >= 80 ? C.greenBorder : score >= 60 ? C.yellowBorder : C.redBorder,
      icon:  `Grade ${grade}`,
    },
  ]

  statBoxes.forEach((b, i) => {
    const bx = M + i * (bW + 3)
    fr(doc, bx, y, bW, bH, b.bg, 3)
    sr(doc, bx, y, bW, bH, b.border, 0.4, 3)
    // Top colour stripe
    fr(doc, bx, y, bW, 3, b.col, 3)

    // Icon / value at top
    doc.setFont('helvetica', 'bold'); doc.setFontSize(i === 3 ? 7 : 14)
    tc(doc, b.col)
    doc.text(b.icon, bx + bW / 2, i === 3 ? y + 10 : y + 13, { align: 'center' })

    // Count / score
    doc.setFont('helvetica', 'bold'); doc.setFontSize(i === 3 ? 14 : 12)
    tc(doc, b.col)
    doc.text(String(b.value), bx + bW / 2, y + 19, { align: 'center' })

    // Label
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6)
    tc(doc, C.textMuted)
    doc.text(b.label, bx + bW / 2, y + 24, { align: 'center' })
  })
  y += bH + 6

  /* ══════════════════════════════════════════════════════════════════════
     ④ ACCURACY BAR
  ══════════════════════════════════════════════════════════════════════ */
  const barCol  = score >= 80 ? C.green : score >= 60 ? C.yellow : C.red
  const barFill = Math.max(0, Math.min(cW, (score / 100) * cW))

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); tc(doc, C.textSecond)
  doc.text('ACCURACY', M, y + 4)
  doc.text(`${score}%`, pageW - M, y + 4, { align: 'right' })
  y += 6

  fr(doc, M, y, cW, 5, C.greyLight, 2)
  if (barFill > 0) fr(doc, M, y, barFill, 5, barCol, 2)
  sr(doc, M, y, cW, 5, C.cardBorder, 0.2, 2)
  y += 10

  /* ══════════════════════════════════════════════════════════════════════
     ⑤ TWO COLUMN LAYOUT: LEFT = POSITIONS, RIGHT = SUMMARY & FEEDBACK
  ══════════════════════════════════════════════════════════════════════ */
  const leftW  = cW * 0.48
  const rightW = cW * 0.48
  const rightX = M + cW - rightW

  let leftY = sectionTitle(doc, `Position Results (${total})`, M, y, M + leftW)

  const cSize  = 13    // cell width  mm
  const cHgt   = 12.5  // cell height mm
  const cGap   = 1.5   // gap         mm

  const rowsPerCol = 10
  const maxColsPerPage = Math.floor((leftW + cGap) / (cSize + cGap))
  const itemsPerPage = rowsPerCol * maxColsPerPage

  positions.forEach((status, i) => {
    const pageIndex = Math.floor(i / itemsPerPage)
    const indexOnPage = i % itemsPerPage
    const colIndex = Math.floor(indexOnPage / rowsPerCol)
    const rowIndex = indexOnPage % rowsPerCol

    let startY = leftY
    if (indexOnPage === 0 && pageIndex > 0) {
      startY = newPage(doc, pageW, pageH)
      leftY = startY
    }

    const cx = M + colIndex * (cSize + cGap)
    const cy = startY + rowIndex * (cHgt + cGap)

    const p = sp(status)
    fr(doc, cx, cy, cSize, cHgt, p.bg, 2)
    fr(doc, cx, cy, cSize, 2.5, p.border, 2)
    sr(doc, cx, cy, cSize, cHgt, p.border, 0.4, 2)

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); tc(doc, C.textPrimary)
    doc.text(String(i + 1 + positionOffset), cx + cSize / 2, cy + 6.5, { align: 'center' })

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); tc(doc, p.col)
    doc.text(p.icon, cx + cSize / 2, cy + 11.5, { align: 'center' })
  })

  const totalItemsOnLastPage = positions.length === 0 ? 0 : ((positions.length - 1) % itemsPerPage) + 1
  const actualRowsOnLastPage = Math.min(rowsPerCol, totalItemsOnLastPage)
  
  let legendY = leftY + actualRowsOnLastPage * (cHgt + cGap) + 4
  const legends = [
    { col: C.green,  label: '✓ Correct' },
    { col: C.red,    label: '✗ Wrong' },
    { col: C.yellow, label: '? Review' },
    { col: C.grey,   label: '· Not Marked' },
  ]
  let lx = M
  legends.forEach(({ col, label }) => {
    fr(doc, lx, legendY, 3, 3, col, 0.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); tc(doc, C.textSecond)
    doc.text(label, lx + 4.5, legendY + 2.5)
    lx += doc.getTextWidth(label) + 8
    if (lx > M + leftW - 20) {
      lx = M
      legendY += 5
    }
  })

  /* ══════════════════════════════════════════════════════════════════════
     ⑥ RIGHT COLUMN — SUMMARY TABLE
  ══════════════════════════════════════════════════════════════════════ */
  let rightY = y
  rightY = sectionTitle(doc, 'Summary Breakdown', rightX, rightY, rightX + rightW)

  fr(doc, rightX, rightY, rightW, 6, C.sectionBg, 0)
  sr(doc, rightX, rightY, rightW, 6, C.cardBorder, 0.25, 0)
  const colX = [0, rightW * 0.35, rightW * 0.55, rightW * 0.75]
  const hd   = ['Status', 'Count', '%', 'Dist']
  hd.forEach((h, i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tc(doc, C.textSecond)
    doc.text(h, rightX + colX[i] + 2, rightY + 4)
  })
  rightY += 6

  const tableRows = [
    { status: 'correct',   count: correctCount,   col: C.green,  bg: C.greenLight  },
    { status: 'wrong',     count: wrongCount,      col: C.red,    bg: C.redLight    },
    { status: 'review',    count: reviewCount,     col: C.yellow, bg: C.yellowLight },
    { status: 'unchecked', count: uncheckedCount,  col: C.grey,   bg: C.greyLight   },
  ]

  tableRows.forEach(({ status, count, col, bg }, ri) => {
    const rowH = 7
    const p    = sp(status)
    const pct  = total > 0 ? Math.round((count / total) * 100) : 0
    const rowBg = ri % 2 === 0 ? C.bg : C.tableBg

    fr(doc, rightX, rightY, rightW, rowH, rowBg)
    sr(doc, rightX, rightY, rightW, rowH, C.cardBorder, 0.15)

    fr(doc, rightX + 2, rightY + 2, 3, 3, col, 0.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); tc(doc, col)
    doc.text(p.label, rightX + colX[0] + 6, rightY + 4.8)

    doc.setFontSize(8)
    doc.text(String(count), rightX + colX[1] + 2, rightY + 5)
    doc.text(`${pct}%`, rightX + colX[2] + 2, rightY + 5)

    const mW = rightW * 0.2
    const mFill = (count / (total || 1)) * mW
    fr(doc, rightX + colX[3] + 2, rightY + 2.5, mW, 2.5, C.greyLight, 1)
    if (mFill > 0) fr(doc, rightX + colX[3] + 2, rightY + 2.5, mFill, 2.5, col, 1)
    sr(doc, rightX + colX[3] + 2, rightY + 2.5, mW, 2.5, C.cardBorder, 0.1, 1)

    rightY += rowH
  })
  rightY += 6

  /* ══════════════════════════════════════════════════════════════════════
     ⑦ RIGHT COLUMN — COACH FEEDBACK
  ══════════════════════════════════════════════════════════════════════ */
  if (feedback && feedback.trim()) {
    rightY = sectionTitle(doc, 'Coach Feedback', rightX, rightY, rightX + rightW)

    const lines = doc.splitTextToSize(feedback.trim(), rightW - 8)
    const fH    = lines.length * 4.5 + 8

    fr(doc, rightX, rightY, rightW, fH, C.accentLight, 2)
    fr(doc, rightX, rightY, 3,  fH, C.accent, 1.5)
    sr(doc, rightX, rightY, rightW, fH, C.cardBorder, 0.3, 2)

    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); tc(doc, C.textPrimary)
    lines.forEach((line, i) => doc.text(line, rightX + 6, rightY + 6 + i * 4.5))
    rightY += fH + 8
  }

  /* ══════════════════════════════════════════════════════════════════════
     ⑧ RIGHT COLUMN — FINAL GRADE BADGE
  ══════════════════════════════════════════════════════════════════════ */
  const gradeCol = grade === 'A' ? C.gradeA : grade === 'B' ? C.gradeB
                 : grade === 'C' ? C.gradeC  : grade === 'D' ? C.gradeD : C.gradeF
  const gradeBg  = grade === 'A' ? C.greenLight : grade === 'B' ? C.accentLight
                 : grade === 'C' ? C.yellowLight : C.redLight
  const gradeBdr = grade === 'A' ? C.greenBorder : grade === 'B' ? [147, 197, 253]
                 : grade === 'C' ? C.yellowBorder : C.redBorder

  const bdgW   = rightW
  const bdgH   = 28

  fr(doc,  rightX, rightY, bdgW, bdgH, gradeBg, 4)
  fr(doc,  rightX, rightY, bdgW, 4,  gradeCol, 4)
  sr(doc,  rightX, rightY, bdgW, bdgH, gradeBdr, 0.6, 4)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); tc(doc, C.textSecond)
  doc.text('FINAL GRADE', rightX + bdgW / 2, rightY + 9, { align: 'center' })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); tc(doc, gradeCol)
  doc.text(`${grade}  —  ${score}%`, rightX + bdgW / 2, rightY + 20, { align: 'center' })
  rightY += bdgH + 4

  const msgs = { A: 'Excellent — Outstanding', B: 'Good — Strong understanding',
                 C: 'Average — Satisfactory', D: 'Below Average — Needs work', F: 'Fail — Significant work required' }
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); tc(doc, C.textSecond)
  doc.text(msgs[grade] || '', rightX + bdgW / 2, rightY + 2, { align: 'center' })

  /* ══════════════════════════════════════════════════════════════════════
     FOOTER  (every page)
  ══════════════════════════════════════════════════════════════════════ */
  const totalPages = doc.internal.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    // Thin top border on footer
    line(doc, M, pageH - 11, pageW - M, pageH - 11, C.cardBorder, 0.3)
    fr(doc, 0, pageH - 10, pageW, 10, C.sectionBg)

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); tc(doc, C.textMuted)
    doc.text('Rook Squares Chess Academy  ·  Confidential Student Correction Report', M, pageH - 4)
    doc.text(`Page ${pg} of ${totalPages}`, pageW - M, pageH - 4, { align: 'right' })
  }

  /* ── Save ── */
  const safeName = (student.firstName || student.username || 'student').replace(/\s+/g, '_')
  const safeHw   = (homework.title || 'homework').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28)
  const stamp    = format(new Date(), 'yyyyMMdd')
  doc.save(`${safeName}_${safeHw}_${stamp}.pdf`)
}
