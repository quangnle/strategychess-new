# Strategy Chess — Luật chơi

> Tài liệu này mô tả đúng luật mà `core-logic/` đang thi hành. Mọi con số ở đây
> đều lấy từ `core-logic/definitions.js` và `core-logic/game-logic.js`.

## I. Mục tiêu

Thắng bằng một trong hai cách:

- Phá huỷ **Căn cứ (Base)** của địch (đưa máu Base về 0), hoặc
- Tiêu diệt **toàn bộ quân lính** của địch (Base không tính là quân lính).

Nếu hết **round 20** mà chưa phân thắng bại thì ván đấu **hoà**.

## II. Bàn cờ và Căn cứ

Bàn cờ là lưới **12 hàng × 11 cột**.

Mỗi bên có một **Base**: máu 7, tốc độ 0, tầm đánh 0. Base **không phải vật trang trí**:

- Base **chiếm một ô** và **chặn đường đi** như mọi quân khác.
- Base là **mục tiêu tấn công hợp lệ**. Đánh vào Base cũng chỉ mất 1 máu mỗi đòn,
  nên phá Base cần đúng 7 đòn.
- Base tính là **quân địch đứng sát bên**. Ranger hay Ara áp sát Base địch sẽ tự
  dính hiệu ứng mất khả năng tấn công của chính mình.
- Base **được hồi máu**: Wizzi heal được cho Base nhà, Tanker sacrifice được cho
  Base nhà nếu đứng cạnh. Đây là luật cố ý, không phải lỗi.
- Base **không đi lượt** và không tính vào movement point.

## III. Chỉ số

Mỗi quân có 3 chỉ số cơ bản.

**Máu (HP).** Mọi đòn đánh trong game đều gây đúng **1 sát thương**, không có
ngoại lệ. Quân về 0 máu bị loại khỏi bàn cờ. Hồi máu không bao giờ vượt quá máu
gốc của loại quân đó.

**Tốc độ (Speed).** Số bước đi tối đa trong một lượt. Mỗi bước là một ô theo 4
hướng trên / dưới / trái / phải. **Không được đi xuyên qua quân nào cả**, kể cả
quân mình và kể cả Base — trừ Nizza (xem Wind Walk). Ô đích luôn phải trống.

**Tầm đánh (Range).** Dùng khoảng cách Manhattan và so sánh **nhỏ hơn hoặc bằng**:

> Quân A ở hàng 3 cột 4 với range 4 đánh được quân B ở hàng 5 cột 5, vì khoảng
> cách là |5−3| + |5−4| = 3, mà 3 ≤ 4.

Tầm đánh **không bị vật cản chắn**. Chỉ cần trong tầm là bắn được.

### Tốc độ lẻ .5 nghĩa là gì

Toàn bộ hero đều có tốc độ lẻ .5. Con số lẻ này phục vụ **thứ tự lượt đi**, vì
movement point là tổng tốc độ nên phần .5 quyết định team nào được đi trước
(xem mục V).

Còn về quãng đường đi thực tế:

- Quân đi bộ bình thường: tốc độ 2.5 đi được **3 bước** (làm tròn lên). Trezdin
  tốc độ 2.5 đi xa đúng bằng Ranger tốc độ 3.
- Nizza (Wind Walk, tính theo Manhattan): tốc độ 5.5 chỉ đi xa **5 ô** (làm tròn xuống).

Hai hướng làm tròn ngược nhau này là do hai nhánh code khác nhau: nhánh BFS mở
rộng khi `d < speed`, còn nhánh Manhattan nhận ô khi `dist <= speed`. Ghi lại ở
đây vì nó ảnh hưởng thật đến thế trận.

## IV. Quân lính và Hero

Mỗi bên chọn **1 hero + 5 quân lính** từ 3 binh chủng.

### Binh chủng

| Quân | Máu | Tốc độ | Tầm | Đặc điểm |
|---|---|---|---|---|
| Ranger | 2 | 3 | 4 | Dính *Adjacent Penalty* |
| Tanker | 5 | 2 | 1 | Có *Sacrifice* |
| Assassin | 3 | 5 | 1 | Không kỹ năng |

### Hero

| Hero | Máu | Tốc độ | Tầm | Tầm phép | Kỹ năng |
|---|---|---|---|---|---|
| Trezdin | 7 | 2.5 | 1 | – | *Berserk* |
| Trarex | 3 | 3.5 | 4 | – | Bắn xa mà **không** dính Adjacent Penalty |
| Taki | 5 | 3.5 | 1 | – | *Lock* |
| Ara | 3 | 3.5 | 5 | – | Tầm xa nhất game, dính *Adjacent Penalty* |
| Nizza | 3 | 5.5 | 1 | – | *Wind Walk* + *Suicide* |
| Wizzi | 3 | 3.5 | 3 | 5 | *Heal* |

## V. Thứ tự lượt đi

Ván đấu chia thành nhiều **round**. Một round kết thúc khi **mọi quân còn sống của
cả hai bên** đã đi xong lượt của mình (Base không tính).

Trong một round, thứ tự từng **lượt (turn)** được quyết định như sau:

1. Mỗi round có một bên giữ **quyền ưu tiên**, và quyền này **đổi bên sau mỗi round**.
2. Tính **movement point** cho mỗi bên = tổng tốc độ hiện tại của những quân **còn
   sống và chưa đi lượt** trong round đó.
3. Bên nào có movement point **cao hơn** thì bên đó được đi lượt tiếp theo.
4. Bằng điểm thì bên đang giữ quyền ưu tiên được đi.

Vì movement point giảm dần khi quân lần lượt đi xong, hai bên **đan lượt** vào
nhau, và **một bên hoàn toàn có thể đi liền mấy lượt** nếu quân của họ nhanh hơn.

Hết round, các hiệu ứng có thời hạn giảm 1, danh sách "đã đi" được xoá, quyền ưu
tiên đổi bên.

## VI. Luật của một lượt

Trong lượt của mình, một quân được **di chuyển** và/hoặc thực hiện **một hành động**
(đánh / heal / sacrifice / tự sát). Ràng buộc:

- **Hành động là dấu chấm hết của lượt.** Đã đánh (hoặc heal / sacrifice / tự sát)
  thì **không được di chuyển nữa**. Muốn vừa đi vừa đánh thì phải **đi trước, đánh sau**.
- Mỗi lượt chỉ được di chuyển **một lần** và làm **một hành động**.
- Di chuyển xong mà không đánh gì cũng được, lượt kết thúc.
- Quân bị vây kín, không có ô nào để đi và cũng không có mục tiêu nào để đánh thì
  **bỏ lượt**.

## VII. Hiệu ứng và kỹ năng

### Adjacent Penalty — Ranger, Ara

Quân có kỹ năng này bị **mất hoàn toàn khả năng tấn công trong lượt đó** nếu có
**quân địch đứng sát** ở một trong 4 ô trên / dưới / trái / phải. Base địch cũng tính.

**Chạy đi chỗ khác cũng không cứu được**: hiệu ứng được chấm vào đầu lượt, nên đã
dính là mất đòn cả lượt. Hiệu ứng chỉ được gỡ ở lượt sau, khi quân đó không còn
đứng cạnh địch nữa.

Đây là lý do Assassin và Nizza khắc chế Ranger: chỉ cần **áp sát**, không cần giết.

### Lock — Taki

Khi Taki đánh trúng một mục tiêu còn sống:

- Mục tiêu dính **Lock 2 round** (phần còn lại của round hiện tại, rồi hết hẳn khi round sau kết thúc). Duration = 0 thì effect bị gỡ ngay, không treo thêm round.
- Taki nhận **Dash**: +1 tốc độ trong 2 round, nhưng tốc độ tối đa bị chặn ở **4.5**
  (Taki 3.5 + 1 = 4.5 vừa chạm trần).

**Lock chỉ cấm DI CHUYỂN, không cấm tấn công.** Quân bị lock vẫn bắn, vẫn heal,
vẫn sacrifice bình thường — nó chỉ bị đóng đinh tại chỗ.

Vì thế Lock đặc biệt hiệu quả với những quân **sống nhờ chạy**: Ranger và Ara bị
lock cạnh một quân cận chiến thì vừa không chạy được, vừa dính Adjacent Penalty,
tức là đứng yên chịu đòn. Ngược lại, lock một Tanker gần như vô nghĩa.

### Berserk — Trezdin

Khi Trezdin trở thành **quân duy nhất còn sống** của phe mình (Base không tính):

- Hồi **+1 máu** (không vượt quá 7).
- **+1 tốc độ** vĩnh viễn: 2.5 → 3.5.
- Kỹ năng bị gỡ khỏi Trezdin ngay sau đó, nên **chỉ kích hoạt đúng một lần**.

### Wind Walk — Nizza

Nizza **đi xuyên qua mọi quân cản**, tầm đi tính bằng khoảng cách Manhattan ≤ tốc độ.
Ô đích vẫn phải trống. Không có bức tường nào chặn được Nizza.

### Suicide — Nizza

Khi Nizza còn **đúng 1 máu**, nó được quyền tự sát:

- Nizza chết.
- **Tất cả các quân trong 8 ô xung quanh mất 1 máu** — **địch, đồng đội, và cả
  Base của hai bên, không phân biệt**. Đây là đòn sát thương diện rộng vô tri,
  dùng sai là tự thiệt.

### Heal — Wizzi

Wizzi hồi **+1 máu** cho một mục tiêu **cùng phe** trong **tầm phép 5**:

- Hồi được cho **chính mình**.
- Hồi được cho **Base nhà**.
- Không hồi vượt quá máu gốc của mục tiêu.

Lưu ý tầm phép (5) khác tầm đánh (3): Wizzi đỡ được đồng đội từ xa hơn khoảng cách
mà nó bắn tới.

### Sacrifice — Tanker

Tanker **tự trừ 1 máu của mình** để hồi **+1 máu** cho một quân **cùng phe** đứng ở
một trong **4 ô sát bên**:

- Hồi được cho **Base nhà**, nếu Tanker đứng cạnh Base. Đây là luật cố ý.
- **Không** tự sacrifice cho chính mình.
- Mục tiêu phải đang thiếu máu.

Với 5 máu và tầm 1, Tanker vừa là bức tường chắn đường vừa là bình máu di động.

## VIII. Tam giác khắc chế

Ba binh chủng tạo thành một vòng khắc chế khép kín:

- **Ranger khắc Tanker** — tầm 4 với tốc độ 3 thì bắn rồi lùi, Tanker tốc độ 2 tầm 1
  không bao giờ đuổi kịp.
- **Tanker khắc Assassin** — 5 máu chịu được 5 đòn, trong khi Assassin chỉ có 3 máu
  và cùng tầm 1, đôi công là Assassin chết trước.
- **Assassin khắc Ranger** — tốc độ 5 áp sát trong một lượt, và Ranger dính Adjacent
  Penalty là mất đòn ngay cả khi cố chạy.

Hero là những quân **bẻ gãy vòng tròn này**: Trarex bắn xa mà miễn nhiễm Adjacent
Penalty, Taki khoá chân quân chạy, Nizza xuyên tường nên không thể bị chặn đường.
