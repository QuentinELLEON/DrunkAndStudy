// A. Ensembles parallèles (Parallel Sets)   [Quentin ELLEON]
// Conteneur : #viz-parallel-sets   ·   Doc : docs/visualisations.md#a-ensembles-parallèles
//
// Un segment par catégorie et par axe (hauteur proportionnelle au nombre d'élèves), des rubans entre axes voisins
// (largeur proportionnelle au nombre d'élèves), bleu = réussite, orange = échec. Le dernier axe est toujours « reussite ».
//
// Données : derived.selection (elle inclut les zooms posés ici : le diagramme est réétalonné sur les élèves gardés),
//           state.psetAxes, state.psetPreset, derived.selected (chemin de l'élève).
// Écrit   : toggleDrill(dim, value, 'pset') au clic sur un segment ; setState({ psetAxes, psetPreset }) pour les axes ;
//           le fil d'Ariane retire les zooms 'pset' les plus récents.

import { DIMS, PSET_PRESETS, PSET_ADDABLE, PSET_MAX_AXES, PSET_MIN_AXES, SMALL_N, DATASETS, dimLabel, valueName } from '../meta.js'
import { setState, toggleDrill } from '../state.js'
import { pct, plural, showTip, moveTip, hideTip, makeActionable, widthOf, prepareContainer } from '../utils.js'

const LAST = 'reussite' // dernier axe, toujours présent
const BAR = 12 // largeur d'un segment (px)
const GAP = 10 // espace entre deux catégories d'un même axe (px)

let crumbs, chart, note, table // éléments de la carte (sélections d3)
let state, derived // copies de ce que reçoit update(), utilisées par les fonctions ci-dessous

// appelée une fois, après le chargement des données
export function init(container) {
    const box = d3.select(prepareContainer(container))

    crumbs = box.append('nav').attr('class', 'pset-crumbs').attr('aria-label', "Fil d'Ariane des zooms")
    chart = box.append('div').attr('class', 'pset-chart')
    note = box.append('p').attr('class', 'note')
    table = box.append('details').attr('class', 'pset-table')

    // les trois questions proposées (chaque bouton fixe un jeu d'axes)
    d3.selectAll('#presetSeg button').on('click', function () {
        const key = this.dataset.preset
        setState({ psetPreset: key, psetAxes: PSET_PRESETS[key].axes.slice() })
    })

    // « Ajouter un axe » : le nouvel axe se place juste avant « reussite »
    d3.select('#addAxis').on('change', function () {
        const dim = this.value
        this.value = ''
        const axes = normalizeAxes(state.psetAxes)
        if (!dim || axes.length >= PSET_MAX_AXES || axes.includes(dim)) return
        setState({ psetAxes: axes.slice(0, -1).concat([dim, LAST]) })
    })
}

// axes affichés : dimensions connues, sans doublon, « reussite » en dernier, 5 au maximum
export function normalizeAxes(axes) {
    const head = axes.filter((a, i) => a !== LAST && DIMS[a] && axes.indexOf(a) === i).slice(0, PSET_MAX_AXES - 1)
    return head.concat([LAST])
}

/* calcul des segments et des rubans (pas de dessin ici : c'est testé avec Node) */

// rows = élèves, axes = dimensions. Les élèves sans valeur sur un axe (non évalués) sont écartés (dropped).
// Retourne { axes, N, segments: { dim: [{ value, n, ok }] }, bands: [{ a, b, va, vb, res, n }], dropped }
export function computeParallelSets(rows, axes) {
    const usable = rows.filter(r => axes.every(a => r[a] !== null && r[a] !== undefined))

    // un segment par valeur de chaque axe
    const segments = {}
    axes.forEach(a => {
        const found = {}
        usable.forEach(r => {
            const v = String(r[a])
            if (!found[v]) found[v] = { value: v, n: 0, ok: 0 }
            found[v].n++
            if (r.reussite === 'oui') found[v].ok++
        })
        segments[a] = DIMS[a].order
            .map(String)
            .filter(v => found[v])
            .map(v => found[v])
    })

    // un ruban par couple de valeurs de deux axes voisins et par résultat
    const bands = []
    for (let i = 0; i < axes.length - 1; i++) {
        const a = axes[i]
        const b = axes[i + 1]
        const found = {}
        usable.forEach(r => {
            const key = `${r[a]}|${r[b]}|${r.reussite}`
            if (!found[key]) found[key] = { a: a, b: b, va: String(r[a]), vb: String(r[b]), res: r.reussite, n: 0 }
            found[key].n++
        })
        Object.keys(found).forEach(key => bands.push(found[key]))
    }

    return { axes: axes, N: usable.length, segments: segments, bands: bands, dropped: rows.length - usable.length }
}

/* mise à jour : appelée à chaque changement d'état */

export function update(st, d) {
    state = st
    derived = d

    const axes = normalizeAxes(state.psetAxes)
    const rows = derived.selection
    const model = computeParallelSets(rows, axes)

    setControls(axes)
    setCrumbs(derived.base.length, rows.length)
    setTable(model)

    note.text(model.dropped ? `${plural(model.dropped, 'élève non placé', 'élèves non placés')} : dossier non évalué, sans valeur pour un des axes.` : '')

    chart.html('')
    if (!model.N) {
        chart.append('p').attr('class', 'empty').text('Aucun élève ne correspond à cette sélection. Retirez un zoom ou un filtre dans le panneau Sélection.')
        return
    }
    drawChart(model)
}

// titre de la carte, boutons des questions, liste « Ajouter un axe »
function setControls(axes) {
    const preset = PSET_PRESETS[state.psetPreset]
    d3.select('#a-q').text(preset ? preset.q : 'Comment les élèves se répartissent-ils selon ces catégories ?')

    d3.selectAll('#presetSeg button').attr('aria-pressed', function () {
        const p = PSET_PRESETS[this.dataset.preset]
        return String(this.dataset.preset === state.psetPreset && p.axes.join() === axes.join())
    })

    const full = axes.length >= PSET_MAX_AXES
    const options = [''].concat(full ? [] : PSET_ADDABLE.filter(a => !axes.includes(a)))
    const select = d3.select('#addAxis')
    select
        .selectAll('option')
        .data(options)
        .join('option')
        .attr('value', d => d)
        .text(d => (d ? dimLabel(d) : full ? `${PSET_MAX_AXES} axes au maximum` : 'Choisir'))
    select.property('value', '').property('disabled', full)
}

// fil d'Ariane : « Tous (N) › Dimension : valeur (n) », un clic revient à l'étape choisie
function setCrumbs(nTotal, nNow) {
    const mine = state.drill.filter(f => f.src === 'pset')
    crumbs.html('').attr('hidden', mine.length ? null : true)
    if (!mine.length) return

    // garde les k premiers zooms de A et retire les suivants
    function goTo(k) {
        setState({ drill: state.drill.filter(f => f.src !== 'pset').concat(mine.slice(0, k)) })
    }

    crumbs
        .append('button')
        .attr('type', 'button')
        .attr('class', 'chip')
        .text(`Tous (${nTotal})`)
        .on('click', () => goTo(0))

    mine.forEach((f, i) => {
        const label = `${dimLabel(f.dim)} : ${valueName(f.dim, f.value)}`
        crumbs.append('span').attr('class', 'pset-sep').attr('aria-hidden', 'true').text('›')

        if (i === mine.length - 1) {
            crumbs.append('span').attr('class', 'chip pset-crumb-current').attr('aria-current', 'true').text(`${label} (${nNow})`)
        } else {
            crumbs
                .append('button')
                .attr('type', 'button')
                .attr('class', 'chip')
                .text(label)
                .on('click', () => goTo(i + 1))
        }
    })
}

/* dessin du diagramme */

function drawChart(model) {
    const axes = model.axes
    const N = model.N
    const segments = model.segments
    const bands = model.bands

    const width = widthOf(chart.node())
    const height = Math.round(Math.max(330, Math.min(470, width * 0.4)))
    const margin = { top: 34, right: Math.min(170, Math.round(width * 0.17)), bottom: 8, left: 4 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const xScale = d3.scalePoint().domain(axes).range([0, innerW])

    // même échelle (pixels par élève) pour tous les axes, pour que les hauteurs se comparent d'un axe à l'autre
    const pxPerStudent = d3.min(axes, a => (innerH - GAP * (segments[a].length - 1)) / N)

    /* position verticale de chaque segment, centré dans l'axe */

    const blocks = {} // blocks[axe] = { order: [valeurs], byValue: { valeur: segment avec y0 et y1 } }
    axes.forEach(a => {
        const segs = segments[a]
        const total = N * pxPerStudent + GAP * (segs.length - 1)
        let y = (innerH - total) / 2
        const byValue = {}
        segs.forEach(sg => {
            byValue[sg.value] = Object.assign({}, sg, { y0: y, y1: y + sg.n * pxPerStudent })
            y += sg.n * pxPerStudent + GAP
        })
        blocks[a] = { order: segs.map(s => s.value), byValue: byValue }
    })

    /* position des rubans : empilés à la sortie du segment de gauche et à l'entrée du segment de droite */

    const RESULTS = ['oui', 'non']
    const rank = (a, v) => blocks[a].order.indexOf(v)

    for (let i = 0; i < axes.length - 1; i++) {
        const a = axes[i]
        const b = axes[i + 1]
        const list = bands.filter(d => d.a === a && d.b === b)

        const used = {} // hauteur déjà occupée à la sortie de chaque segment de a
        list.slice()
            .sort((p, q) => rank(a, p.va) - rank(a, q.va) || rank(b, p.vb) - rank(b, q.vb) || RESULTS.indexOf(p.res) - RESULTS.indexOf(q.res))
            .forEach(p => {
                const start = used[p.va] || 0
                p.sy0 = blocks[a].byValue[p.va].y0 + start
                p.sy1 = p.sy0 + p.n * pxPerStudent
                used[p.va] = start + p.n * pxPerStudent
            })

        const usedIn = {} // idem à l'entrée de chaque segment de b
        list.slice()
            .sort((p, q) => rank(b, p.vb) - rank(b, q.vb) || rank(a, p.va) - rank(a, q.va) || RESULTS.indexOf(p.res) - RESULTS.indexOf(q.res))
            .forEach(p => {
                const start = usedIn[p.vb] || 0
                p.ty0 = blocks[b].byValue[p.vb].y0 + start
                p.ty1 = p.ty0 + p.n * pxPerStudent
                usedIn[p.vb] = start + p.n * pxPerStudent
            })
    }

    // forme d'un ruban : deux courbes de Bézier entre le segment de gauche et celui de droite
    function ribbon(d) {
        const x0 = xScale(d.a) + BAR
        const x1 = xScale(d.b)
        const xm = (x0 + x1) / 2
        return `M${x0},${d.sy0} C${xm},${d.sy0} ${xm},${d.ty0} ${x1},${d.ty0} L${x1},${d.ty1} C${xm},${d.ty1} ${xm},${d.sy1} ${x0},${d.sy1} Z`
    }

    const svg = chart
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'group')
        .attr('aria-label', `Ensembles parallèles, axes ${axes.map(dimLabel).join(', ')}, ${N} élèves`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    /* rubans */

    const ribbons = g
        .append('g')
        .selectAll('path')
        .data(bands)
        .join('path')
        .attr('class', d => 'rib ' + (d.res === 'oui' ? 'ok' : 'ko'))
        .attr('d', ribbon)
        .on('mouseenter', (e, d) => {
            ribbons.style('opacity', r => (r === d ? 0.95 : 0.12))

            let html = `<b>${plural(d.n, 'élève', 'élèves')}</b><br>`
            html += `${dimLabel(d.a)} : ${valueName(d.a, d.va)}<br>`
            html += `${dimLabel(d.b)} : ${valueName(d.b, d.vb)}<br>`
            html += `Note finale ${d.res === 'oui' ? 'de 10 ou plus' : 'sous 10'}`
            showTip(e, html)
        })
        .on('mousemove', moveTip)
        .on('mouseleave', () => {
            ribbons.style('opacity', null)
            hideTip()
        })

    /* axes : titre, boutons ◂ ▸ ×, segments cliquables, étiquettes */

    axes.forEach((a, ai) => {
        const axisGroup = g.append('g').attr('transform', `translate(${xScale(a)},0)`)

        const title = axisGroup.append('text').attr('class', 'axt').attr('y', -14).text(dimLabel(a))

        // boutons pour déplacer ou retirer l'axe (pas pour « reussite »)
        if (a !== LAST) {
            let bx = title.node().getComputedTextLength() + 6
            const addButton = (glyph, label, onClick) => {
                const t = axisGroup.append('text').attr('class', 'axbtn').attr('x', bx).attr('y', -14).text(glyph)
                makeActionable(t, onClick, label)
                bx += 15
            }
            if (ai > 0) addButton('◂', `Déplacer l'axe ${dimLabel(a)} vers la gauche`, () => moveAxis(axes, ai, -1))
            if (ai < axes.length - 2) addButton('▸', `Déplacer l'axe ${dimLabel(a)} vers la droite`, () => moveAxis(axes, ai, 1))
            if (axes.length > PSET_MIN_AXES) {
                addButton('×', `Retirer l'axe ${dimLabel(a)}`, () => setState({ psetAxes: axes.filter(z => z !== a) }))
            }
        }

        const data = blocks[a].order.map(v => blocks[a].byValue[v])

        const rects = axisGroup
            .selectAll('rect')
            .data(data)
            .join('rect')
            .attr('class', 'blk')
            .classed('small', d => d.n < SMALL_N) // moins de 10 élèves : contour pointillé
            .attr('y', d => d.y0)
            .attr('width', BAR)
            .attr('height', d => Math.max(1.5, d.y1 - d.y0))
            .attr('rx', 2)

        // clic (ou Entrée / Espace) = zoom sur cette catégorie
        makeActionable(
            rects,
            d => toggleDrill(a, d.value, 'pset'),
            d => `${dimLabel(a)}, ${valueName(a, d.value)}, ${plural(d.n, 'élève', 'élèves')}, ${pct(d.ok / d.n)} de réussite. Zoomer`
        )

        rects
            .on('mouseenter', (e, d) => {
                // on estompe les rubans qui ne touchent pas ce segment
                ribbons.style('opacity', r => ((r.a === a && r.va === d.value) || (r.b === a && r.vb === d.value) ? 0.9 : 0.12))

                let html = `<b>${valueName(a, d.value)}</b><br>`
                html += `${plural(d.n, 'élève', 'élèves')}, ${pct(d.ok / d.n)} de réussite`
                if (d.n < SMALL_N) html += '<br>Moins de 10 élèves, à lire avec prudence'
                html += '<br>Cliquez pour zoomer'
                showTip(e, html)
            })
            .on('mousemove', moveTip)
            .on('mouseleave', () => {
                ribbons.style('opacity', null)
                hideTip()
            })

        // étiquette « nom (n) » à droite du segment, sauf s'il est trop petit pour la lire
        axisGroup
            .selectAll('text.lbl')
            .data(data.filter(d => d.y1 - d.y0 >= 11))
            .join('text')
            .attr('class', 'lbl')
            .attr('x', BAR + 6)
            .attr('y', d => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .text(d => `${valueName(a, d.value)} (${d.n})`)
    })

    /* chemin de l'élève sélectionné, s'il fait partie du diagramme */

    const stu = derived.selected
    if (stu) {
        const points = axes.map(a => {
            const block = blocks[a].byValue[String(stu[a])]
            return block ? [xScale(a) + BAR / 2, (block.y0 + block.y1) / 2] : null
        })
        if (points.every(p => p !== null)) {
            g.append('path').attr('class', 'pset-path').attr('d', d3.line().curve(d3.curveMonotoneX)(points))
            g.selectAll('circle.pset-stu')
                .data(points)
                .join('circle')
                .attr('class', 'pset-stu')
                .attr('cx', d => d[0])
                .attr('cy', d => d[1])
                .attr('r', 5)
        }
    }
}

// échange l'axe i avec son voisin (dir = -1 ou 1)
function moveAxis(axes, i, dir) {
    const next = axes.slice()
    const tmp = next[i]
    next[i] = next[i + dir]
    next[i + dir] = tmp
    setState({ psetAxes: next })
}

/* tableau équivalent (alternative non visuelle au diagramme) */

function setTable(model) {
    const wasOpen = table.property('open')
    table.html('')
    table.append('summary').text('Voir les données en tableau')
    if (!model.N) return

    const t = table.append('table').attr('class', 'attr')
    t.append('thead').html('<tr><th>Axe</th><th>Catégorie</th><th>Élèves</th><th>Réussite</th></tr>')

    // une ligne par segment, sauf l'axe « reussite »
    const lines = []
    model.axes
        .filter(a => a !== LAST)
        .forEach(a => {
            model.segments[a].forEach(sg => {
                lines.push([dimLabel(a), valueName(a, sg.value), String(sg.n), pct(sg.ok / sg.n)])
            })
        })
    t.append('tbody')
        .selectAll('tr')
        .data(lines)
        .join('tr')
        .selectAll('td')
        .data(d => d)
        .join('td')
        .text(d => d)

    const okSegment = model.segments[LAST].find(s => s.value === 'oui')
    const nOk = okSegment ? okSegment.n : 0
    table
        .append('p')
        .attr('class', 'note')
        .text(`${model.N} élèves de ${DATASETS[state.ds].name}, ${pct(nOk / model.N)} ont 10 ou plus.`)
    table.property('open', wasOpen)
}
