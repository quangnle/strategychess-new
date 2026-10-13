const STORAGE_KEY = 'sc_lang';

const STRINGS = {
    vi: {
        'site.title': 'Strategy Chess',
        'nav.rules': 'Luật chơi',
        'nav.close': 'Đóng',
        'nav.back': '← Trang chủ',
        'about.footer': 'Legos 2026',
        'about.title': 'Legos',
        'about.body': 'Đây là một sản phẩm của Legos.',
        'about.passion': 'Legos là một lập trình viên với đam mê rất lớn dành cho khoa học máy tính, lập trình và toán học.',
        'about.visit': 'Ghé thăm trang web của anh ấy',
        'about.link': 'quangle.cloud',
        'home.play': 'Chơi',
        'home.playAi': 'Chơi với AI',
        'home.playAiHint': 'Luyện tập 1 người, chọn đội rồi đánh',
        'home.challenge': 'Thách đấu',
        'home.challengeFriends': 'Thách đấu với bạn',
        'home.matchName': 'Tên trận...',
        'home.create': 'Tạo trận',
        'home.join': 'Tham gia trận đang chờ',
        'home.loadingMatches': 'Đang tải trận...',
        'home.refresh': 'Làm mới',
        'home.noMatches': 'Chưa có trận nào đang chờ',
        'home.createdBy': 'Tạo bởi {name}',
        'home.players': 'Người chơi: {cur}/{max}',
        'home.createdAt': 'Tạo lúc: {time}',
        'home.joinBtn': 'Vào trận',
        'home.chat': 'Chat',
        'home.onlineUsers': 'Đang online',
        'home.noUsers': 'Chưa có ai online',
        'home.welcomeChat': 'Chào mừng đến Strategy Chess! Hãy chat...',
        'home.typeMessage': 'Nhập tin nhắn...',
        'home.send': 'Gửi',
        'home.online': 'Online: {n}',
        'home.footer': 'Legos 2026',
        'home.waitConnection': 'Đợi kết nối máy chủ rồi thử lại',
        'home.createError': 'Không tạo được trận. Thử lại.',
        'home.joinError': 'Không vào được trận. Thử lại.',
        'home.loadError': 'Không tải được danh sách trận',
        'home.matchPossessive': 'Trận của {name}',
        'chat.connected': 'Đã kết nối chat',
        'chat.welcome': 'Chào mừng vào phòng chat!',
        'chat.joined': '{name} đã vào chat',
        'chat.left': '{name} đã rời chat',
        'chat.disconnected': 'Mất kết nối chat',
        'chat.error': 'Lỗi: {msg}',
        'chat.loading': 'Đang tải tin nhắn...',

        'ai.start': 'Bắt đầu trận',
        'ai.none': 'Không AI',
        'ai.red': 'Đỏ',
        'ai.blue': 'Xanh',
        'ai.both': 'AI vs AI',
        'ai.hotkeys': 'Trong trận: a auto, d 1 nước',
        'ai.hero': 'Hero',
        'ai.regular': 'Quân thường',
        'ai.noHero': 'Chưa chọn hero',
        'ai.maxUnits': 'Chỉ được chọn {n} quân thường!',
        'ai.loadingHeroes': 'Đang tải hero...',
        'ai.loadingUnits': 'Đang tải quân...',
        'ai.liveChat': 'Chat',
        'ai.back': 'Quay lại',
        'ai.auto': 'Auto',
        'ai.autoOn': 'Auto BẬT',
        'ai.step': 'Từng nước',
        'ai.end': 'Kết thúc',
        'ai.ready': 'AI: sẵn sàng',
        'ai.off': 'AI: tắt',
        'ai.sideBoth': 'AI vs AI',
        'ai.sideBlue': 'AI cầm XANH',
        'ai.sideRed': 'AI cầm ĐỎ',
        'ai.thinking': '{side} — đang nghĩ...',
        'ai.idle': '{side} — sẵn sàng',
        'ai.stats': '{side} — sâu {depth}  điểm {score}  {sec}s  {nodes}k node',
        'ai.turn': 'LƯỢT',
        'ai.priority': 'Ưu tiên',
        'ai.round': 'round {n}',
        'ai.acted': 'đã đi',
        'ai.lock': 'LOCK',
        'ai.noAttack': 'Cấm đánh',
        'ai.dash': 'Dash',
        'ai.current': 'QUÂN ĐANG CHỌN',
        'ai.tapDeselect': '(bấm để bỏ chọn)',
        'ai.noUnitCompact': 'Chưa chọn quân — bấm ảnh hoặc ô trên bàn',
        'ai.noUnit': 'Chưa chọn — bấm quân trên bàn hoặc danh sách',
        'ai.deselectTitle': 'Bấm để bỏ chọn quân',

        'end.gameEnd': 'Hết trận',
        'end.blueWins': 'Xanh thắng!',
        'end.redWins': 'Đỏ thắng!',
        'end.draw': 'Hòa!',
        'end.victory': 'THẮNG!',
        'end.defeat': 'THUA!',
        'end.drawCaps': 'HÒA!',

        'lobby.title': 'Strategy Chess — Phòng chờ',
        'lobby.players': 'Người chơi',
        'lobby.selectTeam': 'Chọn đội của bạn',
        'lobby.heroList': 'Danh sách hero',
        'lobby.regularUnits': 'Quân thường (cần 5)',
        'lobby.selectedUnits': 'Quân đã chọn:',
        'lobby.mp': 'Điểm di chuyển:',
        'lobby.mpHint': 'Tổng tốc độ hero và quân đã chọn',
        'lobby.ready': 'Sẵn sàng',
        'lobby.notReady': 'Hủy sẵn sàng',
        'lobby.selectFirst': 'Hãy chọn đội trước',
        'lobby.waitOpponent': 'Đang chờ đối thủ...',
        'lobby.chat': 'Chat phòng chờ',
        'lobby.toggleChat': 'Hiện/ẩn chat',
        'lobby.back': '← Về trang chủ',
        'lobby.starting': 'Đang vào trận...',
        'lobby.allReady': 'Mọi người đã sẵn sàng!',
        'lobby.empty': 'Trống',
        'lobby.status': 'Trạng thái: {status}',
        'lobby.creator': 'Chủ phòng',
        'lobby.you': 'Bạn',
        'lobby.team': 'Đội: {state}',
        'lobby.teamYes': 'Đã chọn',
        'lobby.teamNo': 'Chưa chọn',
        'lobby.readyLabel': 'Sẵn sàng: {state}',
        'lobby.yes': 'Có',
        'lobby.no': 'Không',
        'lobby.needTeam': 'Hãy chọn 1 hero và 5 quân trước',
        'lobby.needOpponent': 'Đang chờ đối thủ vào phòng',
        'lobby.leaveConfirm': 'Bạn chắc muốn rời phòng chờ?',
        'lobby.noMatch': 'Thiếu mã trận',
        'lobby.noUser': 'Không có dữ liệu người chơi. Hãy về trang chủ.',
        'lobby.disconnected': 'Mất kết nối phòng chờ',

        'play.you': 'BẠN',
        'play.opponent': 'ĐỐI THỦ',
        'play.gameInfo': 'Thông tin trận',
        'play.round': 'Round:',
        'play.turn': 'Lượt:',
        'play.time': 'Thời gian:',
        'play.skip': 'Bỏ lượt',
        'play.leave': 'Rời trận',
        'play.selectHint': 'Chọn một quân để xem hành động',
        'play.loading': 'Đang tải trận...',
        'play.gameChat': 'Chat trận',
        'play.gameLog': 'Nhật ký',
        'play.logEmpty': 'Nhật ký sẽ hiện ở đây',
        'play.chatConnected': 'Đã kết nối chat',
        'play.gameOver': 'Hết trận!',
        'play.playAgain': 'Chơi lại',
        'play.backMenu': 'Về trang chủ',
        'play.connLost': 'Mất kết nối',
        'play.connLostBody': 'Mất kết nối máy chủ. Đang thử kết nối lại...',
        'play.noUnit': 'Chưa chọn quân',
        'play.victory': 'Chiến thắng!',
        'play.defeat': 'Thua cuộc',
        'play.draw': 'Hòa!',
        'play.drawBody': 'Trận đấu kết thúc hòa',
        'play.oppDisc': 'Đối thủ mất kết nối!',
        'play.youDisc': 'Bạn đã mất kết nối',
        'play.oppLeft': 'Đối thủ đã rời trận!',
        'play.youLeft': 'Bạn đã rời trận',
        'play.oppForfeit': 'Đối thủ bỏ cuộc!',
        'play.youForfeit': 'Bạn đã bỏ cuộc',
        'play.destroyed': '{name} đã phá căn cứ địch!',
        'play.youName': 'Bạn',
        'play.oppName': 'Đối thủ',
        'play.loadingUser': 'Đang tải...',
    },
    en: {
        'site.title': 'Strategy Chess',
        'nav.rules': 'Rules',
        'nav.close': 'Close',
        'nav.back': '← Home',
        'about.footer': 'Legos 2026',
        'about.title': 'Legos',
        'about.body': 'This is a product of Legos.',
        'about.passion': 'Legos is a programmer with a deep passion for computer science, programming, and mathematics.',
        'about.visit': 'Visit his website',
        'about.link': 'quangle.cloud',
        'home.play': 'Play',
        'home.playAi': 'Play with AI',
        'home.playAiHint': 'Solo practice: pick teams, then fight',
        'home.challenge': 'Challenge',
        'home.challengeFriends': 'Challenge With Friends',
        'home.matchName': 'Match name...',
        'home.create': 'Create',
        'home.join': 'Join Existing Matches',
        'home.loadingMatches': 'Loading matches...',
        'home.refresh': 'Refresh',
        'home.noMatches': 'No waiting matches available',
        'home.createdBy': 'Created by {name}',
        'home.players': 'Players: {cur}/{max}',
        'home.createdAt': 'Created: {time}',
        'home.joinBtn': 'Join',
        'home.chat': 'Chat',
        'home.onlineUsers': 'Online Users',
        'home.noUsers': 'No users online',
        'home.welcomeChat': 'Welcome to Strategy Chess! Start chatting...',
        'home.typeMessage': 'Type your message...',
        'home.send': 'Send',
        'home.online': 'Online: {n}',
        'home.footer': 'Legos 2026',
        'home.waitConnection': 'Please wait for connection to establish',
        'home.createError': 'Failed to create match. Please try again.',
        'home.joinError': 'Failed to join match. Please try again.',
        'home.loadError': 'Failed to load matches',
        'home.matchPossessive': "{name}'s Match",
        'chat.connected': 'Connected to chat server',
        'chat.welcome': 'Welcome to the chat!',
        'chat.joined': '{name} joined the chat',
        'chat.left': '{name} left the chat',
        'chat.disconnected': 'Disconnected from chat server',
        'chat.error': 'Error: {msg}',
        'chat.loading': 'Loading messages...',

        'ai.start': 'Start Battle',
        'ai.none': 'No AI',
        'ai.red': 'Red',
        'ai.blue': 'Blue',
        'ai.both': 'AI vs AI',
        'ai.hotkeys': 'In battle: a auto, d one move',
        'ai.hero': 'Hero',
        'ai.regular': 'Regular units',
        'ai.noHero': 'No hero selected',
        'ai.maxUnits': 'You can only select {n} regular units!',
        'ai.loadingHeroes': 'Loading heroes...',
        'ai.loadingUnits': 'Loading units...',
        'ai.liveChat': 'Live Chat',
        'ai.back': 'Back',
        'ai.auto': 'Auto',
        'ai.autoOn': 'Auto ON',
        'ai.step': 'Step',
        'ai.end': 'End',
        'ai.ready': 'AI: ready',
        'ai.off': 'AI: off',
        'ai.sideBoth': 'AI vs AI',
        'ai.sideBlue': 'AI plays BLUE',
        'ai.sideRed': 'AI plays RED',
        'ai.thinking': '{side} — thinking...',
        'ai.idle': '{side} — ready',
        'ai.stats': '{side} — depth {depth}  score {score}  {sec}s  {nodes}k nodes',
        'ai.turn': 'TURN',
        'ai.priority': 'Priority',
        'ai.round': 'round {n}',
        'ai.acted': 'acted',
        'ai.lock': 'LOCK',
        'ai.noAttack': 'No attack',
        'ai.dash': 'Dash',
        'ai.current': 'CURRENT UNIT',
        'ai.tapDeselect': '(tap to deselect)',
        'ai.noUnitCompact': 'No unit — tap a portrait or a board square',
        'ai.noUnit': 'None selected — tap the board or the list',
        'ai.deselectTitle': 'Tap to deselect',

        'end.gameEnd': 'Game End',
        'end.blueWins': 'Blue wins!',
        'end.redWins': 'Red wins!',
        'end.draw': 'Draw!',
        'end.victory': 'VICTORY!',
        'end.defeat': 'DEFEAT!',
        'end.drawCaps': 'DRAW!',

        'lobby.title': 'Strategy Chess — Lobby',
        'lobby.players': 'Players Status',
        'lobby.selectTeam': 'Select Your Team',
        'lobby.heroList': 'Hero List',
        'lobby.regularUnits': 'Regular Units (5 required)',
        'lobby.selectedUnits': 'Selected Units:',
        'lobby.mp': 'Movement Point:',
        'lobby.mpHint': 'Total speed of selected hero and units',
        'lobby.ready': 'Ready',
        'lobby.notReady': 'Not Ready',
        'lobby.selectFirst': 'Select Team First',
        'lobby.waitOpponent': 'Waiting for Opponent...',
        'lobby.chat': 'Lobby Chat',
        'lobby.toggleChat': 'Toggle Chat',
        'lobby.back': '← Back to Main Menu',
        'lobby.starting': 'Starting Game...',
        'lobby.allReady': 'All players are ready!',
        'lobby.empty': 'Empty',
        'lobby.status': 'Status: {status}',
        'lobby.creator': 'Creator',
        'lobby.you': 'You',
        'lobby.team': 'Team: {state}',
        'lobby.teamYes': 'Selected',
        'lobby.teamNo': 'Not Selected',
        'lobby.readyLabel': 'Ready: {state}',
        'lobby.yes': 'Yes',
        'lobby.no': 'No',
        'lobby.needTeam': 'Please select a hero and 5 units first',
        'lobby.needOpponent': 'Waiting for opponent to join the lobby',
        'lobby.leaveConfirm': 'Are you sure you want to leave the lobby?',
        'lobby.noMatch': 'No match ID provided',
        'lobby.noUser': 'No user data found. Please go back to main menu.',
        'lobby.disconnected': 'Disconnected from lobby server',

        'play.you': 'YOU',
        'play.opponent': 'OPPONENT',
        'play.gameInfo': 'Game Info',
        'play.round': 'Round:',
        'play.turn': 'Turn:',
        'play.time': 'Time:',
        'play.skip': 'Skip Turn',
        'play.leave': 'Leave',
        'play.selectHint': 'Select a unit to see available actions',
        'play.loading': 'Loading Game...',
        'play.gameChat': 'Game Chat',
        'play.gameLog': 'Game Log',
        'play.logEmpty': 'Game log will appear here',
        'play.chatConnected': 'Chat connected',
        'play.gameOver': 'Game Over!',
        'play.playAgain': 'Play Again',
        'play.backMenu': 'Back to Main Menu',
        'play.connLost': 'Connection Lost',
        'play.connLostBody': 'Connection to the game server was lost. Attempting to reconnect...',
        'play.noUnit': 'No unit selected',
        'play.victory': 'Victory!',
        'play.defeat': 'Defeat',
        'play.draw': 'Draw!',
        'play.drawBody': 'The game ended in a draw',
        'play.oppDisc': 'Your opponent disconnected!',
        'play.youDisc': 'You disconnected from the game',
        'play.oppLeft': 'Your opponent left the game!',
        'play.youLeft': 'You left the game',
        'play.oppForfeit': 'Your opponent forfeited!',
        'play.youForfeit': 'You forfeited',
        'play.destroyed': '{name} destroyed the enemy base!',
        'play.youName': 'You',
        'play.oppName': 'Your opponent',
        'play.loadingUser': 'Loading...',
    }
};

const UNIT_IMG = {
    Base: './imgs/base_blue.png',
    Ranger: './imgs/ranger_blue.png',
    Tanker: './imgs/tanker_blue.png',
    Assassin: './imgs/assassin_blue.png',
    Trezdin: './imgs/heroes/trezdin_blue.png',
    Trarex: './imgs/heroes/trarex_blue.png',
    Taki: './imgs/heroes/taki_blue.png',
    Ara: './imgs/heroes/ara_blue.png',
    Nizza: './imgs/heroes/nizza_blue.png',
    Wizzi: './imgs/heroes/wizzi_blue.png'
};

function who(name, size = 24) {
    const src = UNIT_IMG[name];
    if (!src) return name;
    return `<span class="inline-flex items-center gap-1 align-middle whitespace-nowrap"><img src="${src}" alt="${name}" width="${size}" height="${size}" class="inline-block flex-shrink-0" style="width:${size}px;height:${size}px">${name}</span>`;
}

function rulesHtml(lang) {
    const vi = lang === 'vi';
    const u = (n) => who(n, 28);
    const s = (n) => who(n, 20);
    return `
<h3 class="text-yellow-400 font-bold mt-2">${vi ? 'I. Mục tiêu' : 'I. Goal'}</h3>
<p>${vi
        ? `Thắng bằng một trong hai cách: phá ${s('Base')} <strong>Căn cứ</strong> địch (HP về 0), hoặc tiêu diệt <strong>toàn bộ quân lính</strong> (Base không tính là quân lính). Hết <strong>round 20</strong> mà chưa phân thắng bại thì <strong>hòa</strong>.`
        : `Win by destroying the enemy ${s('Base')} <strong>Base</strong> (HP to 0) or wiping out <strong>all enemy units</strong> (the Base does not count as a unit). After <strong>round 20</strong> with no winner, the match is a <strong>draw</strong>.`}</p>
<h3 class="text-yellow-400 font-bold mt-4">${vi ? 'II. Bàn cờ và Căn cứ' : 'II. Board and Base'}</h3>
<p>${vi
        ? `Bàn <strong>12 hàng × 11 cột</strong>. Mỗi bên một ${s('Base')} (HP 7, không đi lượt). Base chiếm ô, chặn đường, là mục tiêu hợp lệ (mỗi đòn −1 HP). Base địch tính là quân sát bên. ${s('Wizzi')} hồi được Base nhà; ${s('Tanker')} sacrifice được cho Base nhà nếu đứng cạnh.`
        : `The board is <strong>12 rows × 11 columns</strong>. Each side has a ${s('Base')} (7 HP, never takes a turn). The Base occupies a square, blocks movement, and is a valid target (1 damage per hit). An enemy Base counts as an adjacent enemy. ${s('Wizzi')} can heal your Base; a ${s('Tanker')} can Sacrifice into your Base if adjacent.`}</p>
<h3 class="text-yellow-400 font-bold mt-4">${vi ? 'III. Chỉ số' : 'III. Stats'}</h3>
<ul class="list-disc pl-5 space-y-1">
<li><strong>HP:</strong> ${vi ? 'mọi đòn gây đúng 1 sát thương. Hồi máu không vượt máu gốc.' : 'every hit deals exactly 1 damage. Healing never exceeds max HP.'}</li>
<li><strong>Speed:</strong> ${vi ? `số bước tối đa (4 hướng). Không đi xuyên quân/Base, trừ ${s('Nizza')}. Ô đích phải trống. Tốc độ .5 của hero dùng cho thứ tự lượt (tổng movement point).` : `max steps (4 directions). You cannot path through units or Bases except ${s('Nizza')}. Destination must be empty. Hero .5 speed is for turn order (movement-point totals).`}</li>
<li><strong>Range:</strong> ${vi ? 'khoảng cách Manhattan ≤ tầm. Không bị chắn.' : 'Manhattan distance ≤ range. Line of sight is never blocked.'}</li>
</ul>
<h3 class="text-yellow-400 font-bold mt-4">${vi ? 'IV. Đội hình' : 'IV. Army'}</h3>
<p>${vi ? `Mỗi bên: <strong>1 hero + 5 quân</strong> (${s('Ranger')} / ${s('Tanker')} / ${s('Assassin')}).` : `Each side: <strong>1 hero + 5 units</strong> (${s('Ranger')} / ${s('Tanker')} / ${s('Assassin')}).`}</p>
<div class="overflow-x-auto my-2"><table class="w-full text-xs border-collapse">
<tr class="text-gray-400"><th class="text-left p-1">${vi ? 'Quân' : 'Unit'}</th><th>HP</th><th>Spd</th><th>Rng</th><th class="text-left">${vi ? 'Ghi chú' : 'Notes'}</th></tr>
<tr><td class="p-1">${u('Ranger')}</td><td>2</td><td>3</td><td>4</td><td>Adjacent Penalty</td></tr>
<tr><td class="p-1">${u('Tanker')}</td><td>5</td><td>2</td><td>1</td><td>Sacrifice</td></tr>
<tr><td class="p-1">${u('Assassin')}</td><td>3</td><td>5</td><td>1</td><td>—</td></tr>
</table></div>
<div class="overflow-x-auto my-2"><table class="w-full text-xs border-collapse">
<tr class="text-gray-400"><th class="text-left p-1">Hero</th><th>HP</th><th>Spd</th><th>Rng</th><th class="text-left">${vi ? 'Kỹ năng' : 'Skill'}</th></tr>
<tr><td class="p-1">${u('Trezdin')}</td><td>7</td><td>2.5</td><td>1</td><td>Berserk</td></tr>
<tr><td class="p-1">${u('Trarex')}</td><td>3</td><td>3.5</td><td>4</td><td>${vi ? 'Bắn xa, không dính Adjacent Penalty' : 'Ranged, no Adjacent Penalty'}</td></tr>
<tr><td class="p-1">${u('Taki')}</td><td>5</td><td>3.5</td><td>1</td><td>Lock</td></tr>
<tr><td class="p-1">${u('Ara')}</td><td>3</td><td>3.5</td><td>5</td><td>${vi ? 'Tầm xa nhất, Adjacent Penalty' : 'Longest range, Adjacent Penalty'}</td></tr>
<tr><td class="p-1">${u('Nizza')}</td><td>3</td><td>5.5</td><td>1</td><td>Wind Walk + Suicide</td></tr>
<tr><td class="p-1">${u('Wizzi')}</td><td>3</td><td>3.5</td><td>3</td><td>${vi ? 'Heal (tầm phép 5)' : 'Heal (magic range 5)'}</td></tr>
</table></div>
<h3 class="text-yellow-400 font-bold mt-4">${vi ? 'V. Thứ tự lượt' : 'V. Turn order'}</h3>
<p>${vi
        ? 'Một round kết thúc khi mọi quân còn sống (trừ Base) đã đi. Mỗi round một bên giữ <strong>ưu tiên</strong>, đổi bên sau round. Bên có <strong>movement point</strong> (tổng tốc độ quân còn sống chưa đi) cao hơn được đi tiếp; hòa thì bên ưu tiên đi.'
        : 'A round ends when every living unit (not the Base) has acted. Each round one side holds <strong>priority</strong>, swapping after the round. The side with higher <strong>movement points</strong> (sum of speed of living units that have not acted) moves next; ties go to the priority side.'}</p>
<h3 class="text-yellow-400 font-bold mt-4">${vi ? 'VI. Một lượt' : 'VI. A turn'}</h3>
<p>${vi
        ? 'Được <strong>di chuyển</strong> và/hoặc <strong>một hành động</strong> (đánh / heal / sacrifice / tự sát). Hành động kết thúc lượt — muốn vừa đi vừa đánh thì <strong>đi trước, đánh sau</strong>. Không đi/không đánh được thì bỏ lượt.'
        : 'A unit may <strong>move</strong> and/or take <strong>one action</strong> (attack / heal / sacrifice / suicide). An action ends the turn — to move and attack, <strong>move first, then act</strong>. If you cannot move or act, you skip.'}</p>
<h3 class="text-yellow-400 font-bold mt-4">${vi ? 'VII. Kỹ năng' : 'VII. Skills'}</h3>
<ul class="list-disc pl-5 space-y-2">
<li><strong>Adjacent Penalty</strong> (${s('Ranger')}, ${s('Ara')}): ${vi ? 'đầu lượt nếu địch (kể cả Base) đứng sát 4 hướng thì mất hết khả năng tấn công cả lượt.' : 'at turn start, an orthogonally adjacent enemy (including Base) removes all attacks for that turn.'}</li>
<li><strong>Lock</strong> (${s('Taki')}): ${vi ? 'mục tiêu không đi được 2 round nhưng vẫn đánh/heal được. Taki nhận Dash +1 tốc độ (tối đa 4.5).' : 'the target cannot move for 2 rounds but can still attack/heal. Taki gains Dash +1 speed (capped at 4.5).'}</li>
<li><strong>Berserk</strong> (${s('Trezdin')}): ${vi ? 'khi còn một mình (không tính Base) thì +1 HP và +1 tốc độ, chỉ một lần.' : 'when Trezdin is your last living unit (Base ignored), +1 HP and +1 speed, once.'}</li>
<li><strong>Wind Walk</strong> (${s('Nizza')}): ${vi ? 'đi xuyên quân, Manhattan ≤ tốc độ, ô đích trống.' : 'walk through units, Manhattan ≤ speed, empty destination.'}</li>
<li><strong>Suicide</strong> (${s('Nizza')}, ${vi ? 'còn 1 HP' : 'at 1 HP'}): ${vi ? 'chết và mọi quân/Base trong 8 ô quanh mất 1 HP.' : 'Nizza dies and every unit/Base in the 8 nearby squares loses 1 HP.'}</li>
<li><strong>Heal</strong> (${s('Wizzi')}): ${vi ? '+1 HP đồng đội hoặc Base nhà trong tầm phép 5 (kể cả bản thân).' : '+1 HP to an ally or your Base within magic range 5 (including self).'}</li>
<li><strong>Sacrifice</strong> (${s('Tanker')}): ${vi ? 'tự −1 HP để hồi +1 cho đồng đội/Base sát 4 hướng (không tự hồi mình).' : 'lose 1 HP to heal +1 an orthogonally adjacent ally/Base (not yourself).'}</li>
</ul>
`;
}

function detectLang() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'vi' || saved === 'en') return saved;
    } catch (_) { /* ignore */ }
    const nav = (typeof navigator !== 'undefined' && (navigator.language || '')).toLowerCase();
    return nav.startsWith('vi') ? 'vi' : 'en';
}

let currentLang = detectLang();

export function getLang() {
    return currentLang;
}

export function t(key, vars) {
    const table = STRINGS[currentLang] || STRINGS.en;
    let s = table[key] || STRINGS.en[key] || key;
    if (vars) {
        Object.keys(vars).forEach(k => {
            s = s.split(`{${k}}`).join(String(vars[k]));
        });
    }
    return s;
}

export function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    const html = document.documentElement;
    if (html) html.setAttribute('lang', currentLang);
    const rulesBody = document.getElementById('rules-body');
    if (rulesBody) rulesBody.innerHTML = rulesHtml(currentLang);
    document.querySelectorAll('[data-lang-set]').forEach(btn => {
        const on = btn.getAttribute('data-lang-set') === currentLang;
        btn.classList.toggle('bg-yellow-500', on);
        btn.classList.toggle('text-gray-900', on);
        btn.classList.toggle('bg-gray-700', !on);
        btn.classList.toggle('text-white', !on);
    });
}

export function setLang(lang) {
    if (lang !== 'vi' && lang !== 'en') return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
    applyI18n();
    window.dispatchEvent(new CustomEvent('sc:lang', { detail: { lang } }));
}

export function openRules() {
    const modal = document.getElementById('rules-modal');
    if (!modal) return;
    const body = document.getElementById('rules-body');
    if (body) body.innerHTML = rulesHtml(currentLang);
    modal.classList.remove('hidden');
}

export function closeRules() {
    const modal = document.getElementById('rules-modal');
    if (modal) modal.classList.add('hidden');
}

export function openAbout() {
    const modal = document.getElementById('about-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const video = document.getElementById('about-video');
    if (video) {
        video.currentTime = 0;
        const play = video.play();
        if (play && play.catch) play.catch(() => {});
    }
}

export function closeAbout() {
    const modal = document.getElementById('about-modal');
    if (modal) modal.classList.add('hidden');
    const video = document.getElementById('about-video');
    if (video) video.pause();
}

function ensureAboutModal() {
    if (document.getElementById('about-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'about-modal';
    wrap.className = 'hidden';
    wrap.innerHTML = `
        <div class="about-card">
            <button type="button" id="about-close" class="about-close" aria-label="Close">×</button>
            <div class="about-grid">
                <div class="about-media">
                    <video id="about-video" src="/imgs/ui/tanker_walking.mp4" autoplay muted loop playsinline></video>
                </div>
                <div class="about-copy">
                    <img src="/imgs/ui/logo.png" alt="Strategy Chess" class="about-logo">
                    <h2 data-i18n="about.title">Legos</h2>
                    <p class="about-lead" data-i18n="about.body"></p>
                    <p data-i18n="about.passion"></p>
                    <a class="about-cta" href="https://quangle.cloud" target="_blank" rel="noopener noreferrer">
                        <span data-i18n="about.visit">Visit his website</span>
                        <span class="about-cta-url" data-i18n="about.link">quangle.cloud</span>
                    </a>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap) closeAbout();
    });
    wrap.querySelector('#about-close').addEventListener('click', closeAbout);
}

function ensureRulesModal() {
    if (document.getElementById('rules-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'rules-modal';
    wrap.className = 'hidden fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4';
    wrap.innerHTML = `
        <div class="bg-gray-800 w-full sm:max-w-2xl sm:rounded-lg border border-gray-600 max-h-[90vh] flex flex-col" style="padding-bottom: env(safe-area-inset-bottom);">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-600">
                <h2 class="text-lg font-bold text-yellow-400" data-i18n="nav.rules">Rules</h2>
                <button type="button" id="rules-close" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm" data-i18n="nav.close">Close</button>
            </div>
            <div id="rules-body" class="px-4 py-3 overflow-y-auto text-sm text-gray-200 leading-relaxed space-y-2"></div>
        </div>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap) closeRules();
    });
    wrap.querySelector('#rules-close').addEventListener('click', closeRules);
}

export function initI18n() {
    ensureRulesModal();
    ensureAboutModal();
    document.querySelectorAll('[data-lang-set]').forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang-set')));
    });
    document.querySelectorAll('[data-open-rules]').forEach(btn => {
        btn.addEventListener('click', openRules);
    });
    document.querySelectorAll('[data-open-about]').forEach(btn => {
        btn.addEventListener('click', openAbout);
    });
    const ogImage = new URL('/imgs/ui/strategy-chess-og-image.png', window.location.origin).href;
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(m => {
        m.setAttribute('content', ogImage);
    });
    applyI18n();
}

window.I18n = { t, getLang, setLang, applyI18n, initI18n, openRules, closeRules, openAbout, closeAbout };
