/** Canvas 2D host: HiDPI sizing, pointer coords in CSS pixels, image load, rAF loop. */

export function rgba(...args) {
    if (args.length === 1 && typeof args[0] === 'string') return args[0];
    if (args.length === 1) {
        const v = args[0];
        return `rgb(${v},${v},${v})`;
    }
    if (args.length === 2) {
        const [v, a] = args;
        return `rgba(${v},${v},${v},${a / 255})`;
    }
    if (args.length === 3) {
        const [r, g, b] = args;
        return `rgb(${r},${g},${b})`;
    }
    const [r, g, b, a] = args;
    return `rgba(${r},${g},${b},${a / 255})`;
}

export function drawImage(ctx, img, x, y, w, h) {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    ctx.drawImage(img, x, y, w, h);
}

export function loadImages(pathMap, onReady) {
    const images = {};
    const keys = Object.keys(pathMap);
    let remaining = keys.length;
    if (remaining === 0) {
        onReady?.(images);
        return images;
    }
    for (const key of keys) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            remaining -= 1;
            if (remaining === 0) onReady?.(images);
        };
        img.onerror = () => {
            remaining -= 1;
            if (remaining === 0) onReady?.(images);
        };
        img.src = pathMap[key];
        images[key] = img;
    }
    return images;
}

export function fillTriangle(ctx, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
}

function traceHeart(ctx, cx, cy, size) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.35);
    ctx.bezierCurveTo(cx, cy + s * 0.12, cx - s * 0.5, cy - s * 0.02, cx - s * 0.5, cy - s * 0.22);
    ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.5, cx - s * 0.15, cy - s * 0.52, cx, cy - s * 0.22);
    ctx.bezierCurveTo(cx + s * 0.15, cy - s * 0.52, cx + s * 0.5, cy - s * 0.5, cx + s * 0.5, cy - s * 0.22);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.02, cx, cy + s * 0.12, cx, cy + s * 0.35);
    ctx.closePath();
}

const HEART_COLORS = {
    blue: {
        fill: '#2563eb',
        stroke: '#1e3a8a',
        emptyFill: 'rgba(15, 23, 42, 0.72)',
        emptyStroke: '#bfdbfe'
    },
    red: {
        fill: '#e11d48',
        stroke: '#881337',
        emptyFill: 'rgba(15, 10, 12, 0.72)',
        emptyStroke: '#fecdd3'
    }
};

/** One heart per max-HP point. Filled hearts are remaining HP; outlined hearts are missing.
 *  side 'blue' is our units (xanh); 'red' is the enemy. */
export function drawHpHearts(ctx, x, y, cellW, cellH, hp, maxHp, side = 'red') {
    const palette = HEART_COLORS[side] || HEART_COLORS.red;
    const max = Math.max(1, Math.round(Number(maxHp) || 1));
    const cur = Math.max(0, Math.min(max, Math.round(Number(hp) || 0)));
    const rows = max > 5 ? 2 : 1;
    const cols = Math.ceil(max / rows);
    const gapX = Math.max(0.5, cellW * 0.01);
    const gapY = Math.max(0.35, cellH * 0.008);
    const size = Math.max(2.4, Math.min(
        cellH * 0.15,
        cellW * 0.15,
        (cellW * 0.72 - gapX * (cols - 1)) / cols
    ));
    const visualH = size * 0.87;
    const blockH = rows * visualH + (rows - 1) * gapY;
    const band = cellH * 0.24;
    const blockTop = y + Math.max(0.6, (band - blockH) / 2);

    for (let i = 0; i < max; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const countInRow = Math.min(cols, max - row * cols);
        const rowW = countInRow * size + (countInRow - 1) * gapX;
        const left = x + (cellW - rowW) / 2;
        const cx = left + col * (size + gapX) + size / 2;
        const cy = blockTop + row * (visualH + gapY) + size * 0.52;
        traceHeart(ctx, cx, cy, size);
        if (i < cur) {
            ctx.fillStyle = palette.fill;
            ctx.fill();
            ctx.lineWidth = Math.max(0.5, size * 0.08);
            ctx.strokeStyle = palette.stroke;
            ctx.stroke();
        } else {
            ctx.fillStyle = palette.emptyFill;
            ctx.fill();
            ctx.lineWidth = Math.max(0.65, size * 0.11);
            ctx.strokeStyle = palette.emptyStroke;
            ctx.stroke();
        }
    }
}

/** Dim overlay plus an amber check, for units that already finished their turn. */
export function drawActedMarker(ctx, x, y, cellW, cellH) {
    const top = Math.min(cellH * 0.28, 14);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.fillRect(x, y + top, cellW, cellH - top);

    const r = Math.max(5, Math.min(9, cellW * 0.16));
    const cx = x + cellW - r - 1;
    const cy = y + cellH - r - 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.96)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.95)';
    ctx.stroke();

    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(1.4, r * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.36);
    ctx.lineTo(cx + r * 0.46, cy - r * 0.36);
    ctx.stroke();
}

export function unitHasActed(gameLogic, unit) {
    if (!gameLogic || !unit) return false;
    if (typeof gameLogic.hasEndedTurn === 'function') return gameLogic.hasEndedTurn(unit);
    const list = gameLogic.alreadyEndedTurnUnits || [];
    return list.some(ended => ended && ended.id === unit.id);
}

export function strokeCircle(ctx, x, y, diameter) {
    ctx.beginPath();
    ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
    ctx.stroke();
}

export function mountCanvas(parentId) {
    const parent = document.getElementById(parentId);
    if (!parent) throw new Error(`Canvas parent #${parentId} not found`);

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.tabIndex = 0;
    parent.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let cssW = 1;
    let cssH = 1;
    let rafId = 0;
    let running = false;

    const host = {
        canvas,
        ctx,
        get cssWidth() { return cssW; },
        get cssHeight() { return cssH; },
        setCssSize(w, h) {
            cssW = Math.max(1, Math.round(w));
            cssH = Math.max(1, Math.round(h));
            const dpr = window.devicePixelRatio || 1;
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${cssH}px`;
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        },
        eventToLocal(e) {
            const rect = canvas.getBoundingClientRect();
            const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
            const x = (src.clientX - rect.left) * (cssW / (rect.width || cssW));
            const y = (src.clientY - rect.top) * (cssH / (rect.height || cssH));
            return { x, y };
        },
        startLoop(onFrame) {
            running = true;
            const frame = () => {
                if (!running) return;
                onFrame();
                rafId = requestAnimationFrame(frame);
            };
            rafId = requestAnimationFrame(frame);
        },
        stopLoop() {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        },
        destroy() {
            host.stopLoop();
            canvas.remove();
        }
    };

    return host;
}
