// Toàn bộ tham số tune được của engine gom về một chỗ.
// tools/tune.js sẽ perturb chính object này rồi cho self-play để dò trọng số tốt hơn.

export const WEIGHTS = {
    // ---------------------------------------------------------- Khối 1: vật chất
    // V(u) = P[type] * (kappa + (1 - kappa) * hp / maxHp)
    //
    // Mọi đòn đánh trong game đều gây đúng 1 sát thương, nên sức đánh của một quân
    // KHÔNG phụ thuộc máu: Ranger 1/2 máu bắn hệt Ranger 2/2. Vì vậy giá trị chia
    // làm hai phần: phần "còn sống là còn nguy hiểm" (kappa) và phần độ bền.
    // Bậc nhảy tại điểm chết chính là kill bonus, không cần code riêng.
    kappa: 0.4,

    unitValue: {
        Ranger: 100,
        Tanker: 85,
        Assassin: 95,
        Trezdin: 150,
        Taki: 150,
        Trarex: 165,
        Ara: 165,
        Nizza: 135,
        Wizzi: 155
    },

    // ---------------------------------------------------------- Khối 2: Base
    // Lồi: mất máu càng về sau càng đau. Tổng 965 phải lớn hơn giá trị cả đội quân
    // (~625), nếu không AI sẽ vui vẻ để địch đập Base để đi ăn quân.
    baseValueByHp: [0, 260, 460, 615, 735, 830, 905, 965],

    // Máu Base hồi lại được (Wizzi heal, Tanker sacrifice), nên sát thương lên Base
    // không phải mất vĩnh viễn. Chiết khấu khi địch còn phương tiện cứu Base.
    baseRepairDiscount: 0.45,
    baseGuardBonus: 55,      // giữ Wizzi/Tanker trong tầm cứu khi Base mình đang bị rứt

    // ---------------------------------------------------- hệ số tỉ lệ giữa các khối
    // Vật chất là mỏ neo và KHÔNG có hệ số (mặc định 1.0). Bốn khối còn lại đều là
    // gia giảm vị trí, phải nhỏ hơn hẳn. tools/test-eval.js in ra biên độ thực tế
    // của từng khối để kiểm chứng tỉ lệ này không bị lệch.
    duelScale: 0.075,
    protectionScale: 0.18,
    abilityScale: 0.45,
    positionalScale: 0.35,

    // ---------------------------------------------------------- Khối 3: đối đầu
    // Vòng khắc chế suy ra từ (range, speed, hp), không hard-code bảng.
    duelKite: 130,           // outrange + outrun: đánh mà không bị đánh trả
    duelPoke: 95,            // outrange nhưng chậm hơn: sẽ bị áp sát
    duelSlug: 30,            // cùng tầm: bên nhiều máu thắng
    duelDive: 120,           // ngắn tầm hơn nhưng nhanh hơn: lao vào được
    duelHelpless: 110,       // vừa ngắn tầm vừa chậm: bất lực
    diveVsPenaltyBonus: 0.8, // lao vào quân dính ADJACENT_PENALTY thì nó mất khả năng đánh
    diveVsStableRangedPenalty: 0.45, // Trarex không dính penalty nên lao vào kém lời hơn
    engagementFalloff: 9,    // cặp ở xa nhau thì gần như không liên quan

    // ---------------------------------------------------------- Khối 4: bảo vệ
    approachControl: 60,     // kiểm soát trọn vành đai tiếp cận của một quân
    threatPerEnemy: 26,      // mỗi địch chưa đi có thể với tới quân mình
    threatOnLowHp: 55,       // nặng thêm khi quân đó sắp chết
    baseThreatPenalty: 45,   // địch đã áp sát được tới Base
    killableBonus: 70,       // địch 1 máu nằm trong tầm với

    // ---------------------------------------------------------- Khối 5: kỹ năng
    adjacencyLockBonus: 0.5,  // nhân P[type] của cung thủ địch bị ép sát
    lockValue: 34,            // mỗi lượt khoá, nhân với mức phụ thuộc di chuyển
    healPotential: 30,        // Wizzi còn sống và có đồng đội bị thương trong tầm
    sacrificePotential: 12,
    suicideThreat: 26,        // Nizza 1 máu đứng cạnh nhiều địch
    berserkPending: 25,

    // ---------------------------------------------------------- Khối 6: vị trí
    advanceToBase: 3.5,       // sức ép tiến quân, hệ số nhỏ
    kiterStandoff: 6,         // quân tầm xa nên đứng đúng tầm, không dí sát
    tempoPerMovePoint: 1.6,   // chênh lệch movement point còn lại

    // ---------------------------------------------------------- đồng hồ hoà
    // Search sâu 6 ply không bao giờ nhìn thấy round 20, nên phải mã hoá vào eval,
    // nếu không AI đang hơn quân sẽ thủ hoà một cách vô nghĩa.
    baseProgressBase: 12,
    baseProgressPerRound: 3.2,

    // ---------------------------------------------------------- terminal
    winScore: 100000,
    drawScore: 0
};

export function cloneWeights(w = WEIGHTS) {
    return JSON.parse(JSON.stringify(w));
}

// Danh sách khoá số vô hướng có thể perturb khi tune (bỏ qua bảng và mảng).
export const TUNABLE_SCALARS = [
    'kappa',
    'baseRepairDiscount', 'baseGuardBonus',
    'duelKite', 'duelPoke', 'duelSlug', 'duelDive', 'duelHelpless',
    'diveVsPenaltyBonus', 'diveVsStableRangedPenalty', 'engagementFalloff',
    'duelScale', 'protectionScale', 'abilityScale', 'positionalScale',
    'approachControl', 'threatPerEnemy', 'threatOnLowHp', 'baseThreatPenalty', 'killableBonus',
    'adjacencyLockBonus', 'lockValue', 'healPotential', 'sacrificePotential',
    'suicideThreat', 'berserkPending',
    'advanceToBase', 'kiterStandoff', 'tempoPerMovePoint',
    'baseProgressBase', 'baseProgressPerRound'
];
