I. Mục tiêu
Tiêu diệt căn cứ địch hoặc toàn bộ quân địch để giành chiến thắng.

II. Gameplay 
1. Bàn cờ
Bàn cờ là lưới ô vuông với kích thước 12 hàng và 11 cột. 
2. Chỉ số quân lính và di chuyển
Mỗi quân lính có 3 chỉ số cơ bản:
- Máu(HP): tượng trưng cho số máu. Mỗi quân cờ khi tấn công sẽ làm đối phương mất 1 Hp. Quân cờ nào có Hp = 0 sẽ bị loại khỏi bàn cờ.
- Tốc độ (Speed): tượng trưng cho số bước đi tối đa có thể thực hiện trong 1 lượt. Quân cờ mỗi bước có thể di chuyển theo 4 hướng là 4 ô bàn cờ: trên / dưới / trái / phải, miễn là không được giẫm lên quân cờ khác kể cả quân mình.
- Tầm đánh (Range): tượng trưng cho tầm đánh, tất cả các quân cờ có tổng khoảng cách về hàng và cột nhỏ hơn Range được xem là nằm trong tầm đánh của quân đội đó. Ví dụ: một quân cờ A nằm ở hàng 3 cột 4 có range là 4 thì một quân cờ B nằm ở hàng 5 cột 5 sẽ nằm trong tầm đánh của quân A vì tổng khoảng cách là (5-3) + (5-4) = 3 (<4).
Một số quân có chỉ số / tính chất đặc biệt khác.

3. Diễn biến trò chơi
Phase 1: 
Mỗi bên chọn 1 tướng và 5 binh lính của 1 trong 3 loại binh chủng: ranger / tanker / assassin để bắt đầu trận đấu.
Bảng mô tả binh chủng:
- Ranger: Máu 2, tốc độ 3, tầm đánh 4. Bị mất khả năng tấn công trong lượt đó nếu có địch tiếp cận sát bên (khoảng cách là 1), kể cả khi di chuyển đi vị trí khác.
- Tanker: Máu 5, tốc độ 2, tầm đánh 1. Có khả năng hy sinh (sacrifice) 1 hp để phục hồi cho ally đứng cạnh bên.
- Assassin: Máu 3, tốc độ 5, tầm đánh 1.
Heroes:
- Trezdin: Máu 7, tốc độ 2, tầm đánh 1. Skill Berserker: khi quân đội ally chết hết, anh ta sẽ tăng speed lên thành 3 và hồi được 1 máu.
- Taki: Máu 5, tốc độ 3, tầm đánh 1. Lock: Có khả năng lock quân thù 2 lượt và tăng speed +1 khi tấn công quân thù
- Trarex : Máu 3, tốc độ 3, tầm đánh 4. Không bị mất khả năng tấn công nếu có địch tiếp cận sát bên.
- Ara: Máu 2, tốc độ 3, tầm đánh 5. Bị mất khả năng tấn công trong lượt đó nếu có địch tiếp cận sát bên (khoảng cách là 1), kể cả khi di chuyển đi vị trí khác.
- Nizzi: Máu 4, tốc độ 5, tầm đánh 1. Có khả năng đi xuyên vật cản (theo Mahattan distance). Khi còn 1 hp, Nizzi có thể tự tử và gây -1hp cho tất cả các quân đội 8 ô chung quanh.
- Wizzi: Máu 3, tốc độ 3, tầm đánh 3, tầm cast phép 5. Có thể heal 1hp cho quân mình.

Phase 2: 
Trò chơi sẽ diễn ra theo nhiều vòng (round), mỗi vòng đấu là tất cả các lượt đi của những quân cờ còn sống trên bàn cờ.
Thứ tự lượt đi (turn) quyết định như sau:
- Mỗi vòng sẽ có 1 người chơi được quyền ưu tiên(*), và luân phiên theo vòng.
- Tính toán movement points cho mỗi đội với movement points được tính là tổng giá trị speed của tất cả các unit chưa đi trong round đó. 
- Team nào có movement point cao hơn thì team ấy được quyền đi
- Trường hợp nếu 2 team có movement point bằng nhau, team nào đang được quyền ưu tiên thì team ấy được đi

Logic mỗi lượt đi của một unit:
+ Nếu không có ô trống nào để di chuyển và cũng không có kẻ thù nào trong tầm đánh và cũng không còn unit nào khác có thể được di chuyển thì kết thúc lượt
+ Nếu thực hiện đánh thì lượt đi kết thúc ngay sau đó, nghĩa là không được di chuyển nữa
+ Nếu di chuyển đến vị trí mới mà không có target nào để đánh thì hết lượt
+ Nếu sau khi di chuyển và vị trí mới có kẻ thù nằm trong tầm đánh thì có thể tấn công hoặc không và kết thúc lượt