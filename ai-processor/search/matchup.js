// Mô hình khắc chế, suy ra từ chỉ số chứ không hard-code bảng.
//
// Người thiết kế game cố ý cài một vòng khắc chế: Ranger khắc Tanker, Tanker khắc
// Assassin, Assassin khắc Ranger. Nếu ta chép vòng đó thành một bảng cứng thì bảng
// sẽ sai ngay khi chỉ số được cân bằng lại, và nó cũng không nói được gì về 6 hero.
//
// Thay vào đó ta mô hình hoá NGUYÊN NHÂN sinh ra vòng khắc chế. Chỉ cần ba đại
// lượng (range, speed, hp) cộng với hai luật đặc thù của game:
//
//   1. "Đánh là hết lượt": đã đánh thì không di chuyển tiếp được nữa. Cho nên
//      hit-and-run là bất khả thi, nhưng move-then-attack thì được. Đó là lý do
//      quân vừa xa tầm vừa nhanh chân có thể bắn mãi mà không bị đánh trả.
//   2. ADJACENT_PENALTY: cung thủ bị áp sát thì tê liệt hoàn toàn.
//
// Từ hai luật đó, năm trường hợp dưới đây rơi ra một cách tự nhiên, và vòng khắc
// chế xuất hiện như hệ quả chứ không phải như giả định.

import { AB_ADJACENT_PENALTY, AB_LOCK, AB_WIND_WALK } from './search-state.js';

export const KITE = 0;      // xa hơn VÀ nhanh hơn: bắn tự do, địch không bao giờ chạm được
export const POKE = 1;      // xa hơn nhưng chậm hơn: được vài phát rồi bị áp sát
export const SLUG = 2;      // cùng tầm: thuần đấu máu, ai nhiều máu hơn thì thắng
export const DIVE = 3;      // gần hơn nhưng nhanh hơn: lao vào áp sát được
export const HELPLESS = 4;  // vừa gần hơn vừa chậm hơn: không làm gì được

export const CASE_NAMES = ['KITE', 'POKE', 'SLUG', 'DIVE', 'HELPLESS'];

// Phân loại thế đối đầu của quân a khi nhắm vào quân d.
// Trả về một trong năm hằng số trên.
export function classify(state, a, d) {
    const rangeA = state.range[a];
    const rangeD = state.range[d];

    let speedA = state.currentSpeedX2(a);
    let speedD = state.currentSpeedX2(d);

    // LOCK biến địch thành bia đứng yên. Đây chính là cách Taki bẻ gãy lối kite
    // của cung thủ: kite bắt buộc phải di chuyển, khoá được là kite sụp đổ.
    if (state.abilities[a] & AB_LOCK) speedD = 0;
    if (state.abilities[d] & AB_LOCK) speedA = Math.max(0, speedA - 2);

    const dr = rangeA - rangeD;

    if (dr > 0) return speedA > speedD ? KITE : POKE;
    if (dr === 0) return SLUG;
    return speedA > speedD ? DIVE : HELPLESS;
}

// Mức liên quan của một cặp: hai quân ở xa nhau thì thế đối đầu giữa chúng gần
// như không nói lên điều gì về thế trận hiện tại.
//
// pathDist là khoảng cách ĐƯỜNG ĐI có trọng số, không phải Manhattan. Đó chính là
// chỗ chặn đường phát huy tác dụng: dựng tường làm pathDist tăng, mức liên quan
// giảm, và toàn bộ ưu thế đối đầu của địch bị vô hiệu hoá mà không cần luật riêng.
export function duelProximity(state, W, a, d, pathDist) {
    const reach = state.currentSpeedX2(a) / 2 + state.range[a];
    return 1 / (1 + Math.max(0, pathDist - reach) / W.engagementFalloff);
}

// Điểm đối đầu thô của cặp (a tấn công d), nhìn từ phía a, CHƯA nhân mức liên quan.
// Người gọi tự nhân với duelProximity rồi lấy trung bình có trọng số, để một quân
// bị nhiều địch vây không bị cộng dồn thành con số vô nghĩa.
//
//   escape: tỉ lệ ô a lùi được mà vẫn tăng khoảng cách với d (0..1).
//           Kite chỉ có giá trị khi còn đất lùi; bị ép vào mép bàn là hết bài.
export function duelRaw(state, W, a, d, escape) {
    const kind = classify(state, a, d);

    let score = 0;

    switch (kind) {
        case KITE:
            // Giá trị tỉ lệ thuận với đất lùi còn lại. Không còn đất thì kite thành slug.
            score = W.duelKite * (0.35 + 0.65 * escape);
            break;

        case POKE:
            // Bắn được vài phát trước khi bị áp sát, nhưng rồi sẽ bị áp sát.
            score = -W.duelPoke * (0.6 - 0.5 * escape);
            break;

        case SLUG: {
            const hpEdge = (state.hp[a] - state.hp[d]) / Math.max(state.maxHp[a], state.maxHp[d]);
            score = W.duelSlug * hpEdge * 2;
            break;
        }

        case DIVE: {
            let mult = 1;
            if (state.abilities[d] & AB_ADJACENT_PENALTY) {
                // Lao vào cung thủ có nhược điểm cận chiến: nó tê liệt hoàn toàn.
                mult += W.diveVsPenaltyBonus;
            } else if (state.range[d] > 1) {
                // Trarex bắn xa mà không dính penalty, lao vào lời ít hơn nhiều.
                mult -= W.diveVsStableRangedPenalty;
            }
            // Nizza xuyên vật cản nên không ai chặn được cú lao của nó.
            if (state.abilities[a] & AB_WIND_WALK) mult += 0.25;
            score = W.duelDive * mult;
            break;
        }

        case HELPLESS:
            score = -W.duelHelpless * (0.5 + 0.5 * (1 - escape));
            break;
    }

    return score;
}

// Tiện ích cho test và gỡ lỗi: điểm đã nhân sẵn mức liên quan.
export function duelScore(state, W, a, d, escape, pathDist) {
    return duelRaw(state, W, a, d, escape) * duelProximity(state, W, a, d, pathDist);
}

// Số lượt ước tính để a chạm được vào d. Vô cực nếu a không bao giờ bắt kịp.
export function turnsToEngage(state, a, d, pathDist) {
    const gap = pathDist - state.range[a];
    if (gap <= 0) return 0;

    const speedA = state.currentSpeedX2(a) / 2;
    let speedD = state.currentSpeedX2(d) / 2;
    if (state.abilities[a] & AB_LOCK) speedD = 0;

    const closing = speedA - speedD;
    if (closing <= 0) return Infinity;
    return gap / closing;
}
