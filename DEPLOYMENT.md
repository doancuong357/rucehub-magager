# Hướng dẫn triển khai RiceHub Manager (Miễn phí 100%)

Tài liệu này hướng dẫn bạn từng bước thiết lập cơ sở dữ liệu **Supabase miễn phí**, đẩy mã nguồn lên **GitHub** và triển khai **miễn phí lên Render**. Giao diện Web Admin mới và hệ thống đã được tối ưu hóa để chạy ở chế độ không trạng thái (stateless) cực kỳ an toàn và ổn định.

---

## BƯỚC 1: Chạy thử nghiệm ở máy local (Với SQLite)

Trước khi đẩy lên mạng, bạn có thể chạy thử hệ thống ngay trên máy tính của mình bằng SQLite cục bộ:

1. Mở Terminal tại thư mục dự án và chạy lệnh sau để khởi động server:
   ```bash
   npm run api
   ```
2. Mở trình duyệt và truy cập:
   ```text
   http://localhost:4000
   ```
3. Giao diện Web Admin mới hiện đại sẽ hiển thị. Bạn có thể thêm thử mặt hàng, khách hàng, tạo đơn hàng để kiểm nghiệm tính năng mượt mà.

---

## BƯỚC 2: Tạo cơ sở dữ liệu Supabase miễn phí (PostgreSQL)

Vì Render gói Free không cho phép lưu file tĩnh vĩnh viễn (sẽ mất file SQLite khi server khởi động lại), chúng ta chuyển sang dùng **Supabase** - nhà cung cấp database PostgreSQL đám mây hàng đầu, có gói **Free hoàn toàn**.

1. Truy cập [https://supabase.com](https://supabase.com) và đăng ký/đăng nhập bằng tài khoản GitHub hoặc Email.
2. Bấm nút **New Project** (Dự án mới) để tạo một cơ sở dữ liệu:
   - **Name**: `ricehub-db`
   - **Database Password**: Nhập mật khẩu của bạn (Hãy lưu mật khẩu này lại!).
   - **Region**: Chọn khu vực gần Việt Nam nhất (Ví dụ: `Singapore` hoặc `Southeast Asia`).
   - **Pricing Plan**: Chọn gói **Free** (Miễn phí).
3. Bấm **Create New Project** và đợi khoảng 1-2 phút để Supabase khởi tạo database cho bạn.
4. Lấy chuỗi kết nối (**Connection String**):
   - Vào mục **Project Settings** (biểu tượng bánh răng ở góc trái dưới) -> chọn tab **Database**.
   - Kéo xuống mục **Connection string** và chọn tab **URI**.
   - Copy chuỗi kết nối có dạng:
     ```text
     postgresql://postgres.[MÃ_DỰ_ÁN]:[MẬT_KHẨU]@aws-0-[VÙNG].pooler.supabase.com:6543/postgres?sslmode=require
     ```
     > [!IMPORTANT]
     > Hãy nhớ thay thế phần `[MẬT_KHẨU]` bằng mật khẩu database thực tế bạn vừa tạo ở bước 2.
     > Hãy lưu chuỗi này lại, đây chính là biến môi trường `DATABASE_URL` của bạn!

---

## BƯỚC 3: Đẩy mã nguồn lên GitHub cá nhân

1. Đăng nhập vào [https://github.com](https://github.com) và bấm nút **New** để tạo một Repository mới:
   - **Repository name**: `ricehub-manager`
   - **Public/Private**: Nên chọn **Private** nếu bạn muốn giữ riêng tư dữ liệu dự án, hoặc **Public** tùy ý.
   - Không chọn khởi tạo README, `.gitignore` hay License (vì dự án của bạn đã có sẵn).
   - Bấm **Create repository**.
2. Mở terminal tại thư mục dự án trên máy tính của bạn và thực hiện các lệnh Git sau:
   ```bash
   # Khởi tạo git (nếu chưa có)
   git init

   # Kiểm tra và thêm toàn bộ file vào git commit
   git add .

   # Ghi nhận phiên bản cập nhật giao diện và cấu hình mới
   git commit -m "feat: upgrade admin UI to premium organic style and configure stateless Supabase/Render free tier"

   # Tạo nhánh chính là main
   git branch -M main

   # Liên kết dự án với Repository GitHub của bạn (thay đường dẫn bằng link của bạn)
   git remote add origin https://github.com/TÊN_GITHUB_CỦA_BẠN/ricehub-manager.git

   # Đẩy mã nguồn lên GitHub
   git push -u origin main
   ```
   *(Nếu terminal báo remote đã tồn tại, hãy chạy `git remote remove origin` trước rồi chạy lại lệnh `git remote add origin`).*

---

## BƯỚC 4: Triển khai miễn phí (Free Deploy) lên Render

Chúng ta sẽ sử dụng tính năng **Blueprint** của Render để tự động đọc file `render.yaml` và cấu hình server cực nhanh.

1. Truy cập [https://render.com](https://render.com) và đăng ký/đăng nhập bằng tài khoản **GitHub**.
2. Tại màn hình Dashboard của Render, bấm nút **New +** ở góc trên cùng bên phải và chọn **Blueprint**.
3. Render sẽ hiển thị danh sách các repo trên GitHub của bạn. Hãy chọn repo `ricehub-manager` vừa đẩy lên.
4. Render sẽ tự động đọc file `render.yaml` trong dự án của bạn và hiển thị cấu hình tạo dịch vụ:
   - **Service Name**: `ricehub-manager` (hoặc tên tùy thích).
   - **Plan**: Sẽ tự động chọn gói **Free** (Miễn phí 100%).
   - **DATABASE_URL (Environment Variable)**: Render sẽ yêu cầu bạn nhập giá trị này. Hãy dán chuỗi kết nối **Supabase URI** mà bạn đã copy ở **Bước 2** vào đây.
5. Bấm nút **Apply** (hoặc Deploy).
6. Render bắt đầu tải mã nguồn từ GitHub, build Docker image và khởi động server. Quá trình này diễn ra tự động khoảng 3-5 phút.
7. Khi thấy trạng thái chuyển sang màu xanh lá **"Live"**, bạn sẽ có một địa chỉ URL miễn phí dạng:
   ```text
   https://ricehub-manager.onrender.com
   ```
8. Mở trình duyệt và truy cập URL trên để thưởng thức giao diện Admin mới hoạt động thời gian thực trên Supabase Cloud!

> [!NOTE]
> Gói dịch vụ miễn phí của Render sẽ tạm thời "ngủ đông" (cold start) nếu không có lượt truy cập nào trong 15-20 phút. Lần truy cập tiếp theo sẽ mất khoảng 40-50 giây để server khởi động lại. Đây là đặc điểm chung của các hosting miễn phí.

---

## BƯỚC 5: Cập nhật Địa chỉ API cho Ứng dụng Di động Expo

Khi backend và cơ sở dữ liệu đã hoạt động trực tuyến trên đám mây:
1. Mở ứng dụng di động RiceHub trên điện thoại của bạn (hoặc qua Expo Go).
2. Tìm nút hoặc biểu tượng **Cấu hình máy chủ / API URL** (thường là biểu tượng bánh răng hoặc máy chủ trên màn hình).
3. Đổi địa chỉ URL kết nối từ IP local cũ thành URL Render của bạn:
   ```text
   https://ricehub-manager.onrender.com
   ```
4. Giờ đây, cả ứng dụng di động Expo và trang Web Admin của bạn đều dùng chung database Supabase, dữ liệu sẽ tự động đồng bộ hóa ngay lập tức!
