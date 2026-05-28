# RiceHub Manager

Ứng dụng mobile quản lí bán gạo, gồm app Expo/React Native, backend Express và database SQLite thật.

## Chức năng

- Thêm, sửa, xóa mặt hàng gạo.
- Quản lí tồn kho, giá bán, giá vốn và cảnh báo sắp hết hàng.
- Thêm, sửa, xóa khách hàng.
- Theo dõi công nợ và ghi nhận thu nợ.
- Tạo đơn bán hàng, tự trừ kho và tự cộng công nợ nếu chưa thu đủ.
- Báo cáo doanh thu, công nợ, tồn kho và đơn bán gần đây.

Database được lưu tại `backend/data/ricehub.sqlite`. Ban đầu database trống, không có dữ liệu mẫu.

## Chạy backend

```bash
npm run api
```

Backend chạy tại:

```text
http://localhost:4000
```

Web admin cũng chạy tại:

```text
http://localhost:4000
```

## Chạy mobile app

Mở terminal thứ hai:

```bash
npm run start -- --lan
```

Mở Expo Go trên điện thoại và quét QR code. Điện thoại và máy tính cần cùng Wi-Fi.

Nếu app không kết nối được backend, bấm biểu tượng máy chủ ở góc phải trên app và nhập địa chỉ API theo IP máy tính, ví dụ:

```text
http://192.168.1.10:4000
```

## Deploy

Xem hướng dẫn chi tiết trong `DEPLOYMENT.md`.
