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
