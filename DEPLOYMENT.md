# Triển khai RiceHub Manager

## Backend + Web Admin

Backend Express, API và web admin được đóng chung trong một service.

### Chạy local

```bash
npm run api
```

Mở web admin:

```text
http://localhost:4000
```

### Deploy Render

1. Đẩy repo này lên GitHub.
2. Vào Render, chọn **New Blueprint**.
3. Chọn repo có file `render.yaml`.
4. Render sẽ build Docker image và mount SQLite vào `/app/backend/data`.
5. Sau khi deploy xong, lấy URL dạng:

```text
https://ricehub-manager.onrender.com
```

URL đó dùng cho cả web admin và API.

## Mobile Expo

Khi backend đã deploy, mở app mobile, bấm biểu tượng máy chủ và đổi API URL sang URL Render:

```text
https://ricehub-manager.onrender.com
```

### Build APK bằng EAS

Cần tài khoản Expo và đăng nhập trên máy:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

Nếu muốn đưa lên Google Play:

```bash
eas build -p android --profile production
```

## Lưu ý dữ liệu

SQLite phù hợp bản triển khai nhỏ, một cửa hàng hoặc một đại lý. Khi cần nhiều chi nhánh hoặc nhiều người dùng đồng thời, nên chuyển database sang PostgreSQL.
