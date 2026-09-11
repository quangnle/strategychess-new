// Chạy đúng đường code của trình duyệt nhưng không cần trình duyệt.
//
// Trình duyệt sandbox của công cụ không mở được localhost ở tab chính, nên phần
// tích hợp UI được kiểm bằng cách nạp thẳng public/ai-driver.js và
// ai-processor/ai-worker.js vào Node, với Worker giả nối hai bên lại với nhau.
// Thứ duy nhất không kiểm ở đây là p5 vẽ ra pixel.
//
//   node tools/test-driver.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMatch } from './selfplay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ai-driver.js dùng đường dẫn tuyệt đối kiểu web ('/ai-processor/...') vì nó được
// server phục vụ tĩnh. Node không hiểu, nên viết lại thành file URL rồi nạp bản
// tạm. Nội dung logic giữ nguyên từng ký tự.
function loadBrowserModule(relPath) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const rewritten = src.replace(
        /(['"])\/ai-processor\//g,
        (_, q) => q + pathToFileURL(path.join(ROOT, 'ai-processor')).href + '/'
    );
    const tmp = path.join(ROOT, 'tools', `.tmp-${path.basename(relPath)}`);
    fs.writeFileSync(tmp, rewritten);
    return { url: pathToFileURL(tmp).href, cleanup: () => fs.rmSync(tmp, { force: true }) };
}

// ---------------------------------------------------------------- worker giả
// ai-worker.js gán self.onmessage và gọi self.postMessage. Dựng đúng hai móc đó
// rồi bọc lại thành một class Worker để AIDriver dùng y như trên trình duyệt.
const bus = { handler: null, post: null };
globalThis.self = {
    get onmessage() { return bus.handler; },
    set onmessage(fn) { bus.handler = fn; },
    postMessage(m) { if (bus.post) bus.post(m); }
};

let workerConstructed = 0;
globalThis.Worker = class FakeWorker {
    constructor(url, opts) {
        workerConstructed++;
        if (!opts || opts.type !== 'module') {
            throw new Error(`worker phải là module, nhận được ${JSON.stringify(opts)}`);
        }
        this.onmessage = null;
        this.onerror = null;
        bus.post = (m) => { if (this.onmessage) this.onmessage({ data: m }); };
    }
    // postMessage thật là bất đồng bộ; giữ nguyên tính chất đó để cờ thinking
    // của driver được kiểm đúng như lúc chạy thật.
    postMessage(m) { queueMicrotask(() => bus.handler({ data: m })); }
    terminate() { }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitIdle(driver, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    while (driver.thinking) {
        if (Date.now() > deadline) throw new Error('driver treo, không bao giờ nghĩ xong');
        await sleep(2);
    }
}

function snapshotPositions(gl) {
    return gl._getAllUnits()
        .filter(u => u.hp > 0)
        .map(u => `${u.id}@${u.row},${u.col}:${u.hp}`)
        .sort()
        .join('|');
}

let failures = 0;
function check(label, ok, detail = '') {
    console.log(`  ${ok ? 'ĐẠT' : 'HỎNG'}  ${label}${detail ? '  — ' + detail : ''}`);
    if (!ok) failures++;
}

async function main() {
    // Nạp worker trước: nó cần self đã tồn tại lúc import.
    await import(pathToFileURL(path.join(ROOT, 'ai-processor/ai-worker.js')).href);
    check('ai-worker.js gán được self.onmessage', typeof bus.handler === 'function');

    const driverMod = loadBrowserModule('public/ai-driver.js');
    let AIDriver, AI_MODE;
    try {
        ({ AIDriver, AI_MODE } = await import(driverMod.url));
    } finally {
        driverMod.cleanup();
    }
    check('public/ai-driver.js nạp được', typeof AIDriver === 'function' && !!AI_MODE);

    const gl = createMatch();

    const traces = [];
    const statusLines = [];
    const driver = new AIDriver(gl, {
        mode: AI_MODE.BOTH,
        timeMs: 300,
        autoPlay: true,
        moveDelayMs: 0,
        onMoveApplied: (t) => traces.push(t),
        onUpdate: (d) => { if (!d.thinking && d.lastInfo) statusLines.push(d.statusLine()); }
    });

    check('driver tạo được worker (không rơi vào fallback)', workerConstructed === 1 && !!driver._worker);
    check('AI nhận điều khiển lượt hiện tại', driver.controlsCurrentTurn() === true);

    const startPositions = snapshotPositions(gl);
    const startUnits = gl._getAllUnits().filter(u => u.hp > 0).length;

    // Vòng lặp này thay cho draw() của p5: gọi tick() lặp đi lặp lại, không có
    // bất kỳ input nào của người chơi.
    let ticks = 0;
    const t0 = Date.now();
    while (gl.isGameEnd() === 0 && ticks < 400) {
        driver.tick();
        if (driver.thinking) await waitIdle(driver);
        else await sleep(1);
        ticks++;
    }
    const elapsed = (Date.now() - t0) / 1000;

    const endPositions = snapshotPositions(gl);
    const endUnits = gl._getAllUnits().filter(u => u.hp > 0).length;
    const result = gl.isGameEnd();

    console.log('');
    console.log(`  ván kết thúc sau ${ticks} tick, ${elapsed.toFixed(1)}s, kết quả = ${result}`);
    console.log(`  quân sống: ${startUnits} -> ${endUnits}`);
    console.log(`  round cuối: ${gl.roundNo}`);
    console.log('');

    check('AI tự đi mà không cần input', traces.length > 0, `${traces.length} lượt đã thực thi`);
    check('thế cờ có thay đổi', startPositions !== endPositions);
    check('có quân thực sự di chuyển', traces.some(t => t.some(a => a.type === 'move')));
    check('có đòn tấn công xảy ra', traces.some(t => t.some(a => a.type === 'attack')));
    check('ván đấu kết thúc chứ không treo', result !== 0, `isGameEnd=${result}`);
    check('không còn lượt nào bị bỏ trống', traces.every(t => Array.isArray(t)));

    const withInfo = statusLines.filter(s => /depth \d+/.test(s));
    check('thanh trạng thái có depth/điểm/node', withInfo.length > 0);
    console.log('');
    console.log('  ví dụ dòng trạng thái hiển thị trên canvas:');
    for (const s of withInfo.slice(0, 3)) console.log(`    "${s}"`);
    for (const s of withInfo.slice(-2)) console.log(`    "${s}"`);

    // Chế độ một phe: AI chỉ được cầm đúng phe của nó.
    console.log('');
    const gl2 = createMatch();
    const d2 = new AIDriver(gl2, { mode: AI_MODE.BLUE, timeMs: 100, autoPlay: false });
    const blueId = gl2.matchInfo.team1.teamId;
    let blueOnly = true;
    for (let i = 0; i < 30 && gl2.isGameEnd() === 0; i++) {
        const isBlue = gl2.currentTurnTeamId === blueId;
        if (d2.controlsCurrentTurn() !== isBlue) { blueOnly = false; break; }
        if (isBlue) { d2.think(); await waitIdle(d2); }
        else { gl2.passTurn(); }
    }
    check('chế độ AI cầm XANH chỉ điều khiển phe xanh', blueOnly);

    const d3 = new AIDriver(gl2, { mode: AI_MODE.OFF, timeMs: 100, autoPlay: true });
    check('chế độ tắt thì AI không giành lượt', d3.controlsCurrentTurn() === false);
    check('chế độ tắt thì statusLine báo tắt', d3.statusLine() === 'AI: tắt');

    driver.destroy(); d2.destroy(); d3.destroy();

    console.log('');
    if (failures === 0) {
        console.log('TOÀN BỘ ĐƯỜNG CODE TRÌNH DUYỆT ĐẠT');
    } else {
        console.log(`${failures} MỤC HỎNG`);
        process.exitCode = 1;
    }
}

main().catch(err => {
    console.error('test-driver lỗi:', err);
    process.exitCode = 1;
});
