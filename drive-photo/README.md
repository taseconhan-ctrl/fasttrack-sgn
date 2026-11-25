# Fast Track SGN – Nhận ảnh vé qua Google Drive

## Thành phần
- `Code.gs`: Google Apps Script backend, tạo thư mục Drive và lưu ảnh theo mã order.
- `Upload.html`: trang điện thoại để chụp/chọn ảnh và gửi trực tiếp bằng `google.script.run`.

## Cài đặt một lần bằng Gmail đang sử dụng
1. Đăng nhập đúng tài khoản Google sở hữu Drive.
2. Mở https://script.google.com/ và tạo dự án mới tên **Fast Track SGN - Ảnh vé**.
3. Thêm tệp `Code.gs`, thay nội dung bằng file cùng tên trong thư mục này.
4. Tạo HTML file tên chính xác `Upload`, dán nội dung từ `Upload.html`.
5. Chọn **Deploy → New deployment → Web app**.
6. Execute as: **Me**. Who has access: **Anyone**. Đây là điều kiện để nhân viên không phải đăng nhập; chỉ triển khai nếu tổ chức cho phép.
7. Bấm Deploy, cấp quyền Google Drive, sao chép URL kết thúc bằng `/exec`.

## URL QR cho mỗi booking
Tạo token ngẫu nhiên riêng cho từng booking (tối thiểu 20 ký tự), sau đó tạo URL:
`WEB_APP_URL?order=ORDER_ID&token=RANDOM_TOKEN`

QR phải giữ nguyên URL này. Không đưa token lên bảng công khai hoặc gửi cho khách. Trang upload không cung cấp quyền xem danh sách ảnh hoặc thư mục Drive.

## Cấu trúc Drive
`Fast Track SGN - Anh ve / ORDER_ID / ORDER_ID_timestamp_staff.jpg`

## Lưu ý bảo mật và giới hạn
- Thư mục Drive giữ chế độ riêng tư; không bật chia sẻ công khai.
- Ai có đường link QR đều có thể gửi ảnh vào đúng mã order đó. Token là mã truy cập dạng bearer, vì vậy không đăng QR công khai.
- Bản này lưu ảnh và thông tin nhân viên/thời gian trong mô tả file. Chưa có dashboard tổng hợp booking thiếu ảnh; phần dashboard sẽ cần danh sách booking đầu vào hoặc Sheet quản lý riêng.
- Giới hạn ảnh 8 MB, chỉ JPG/PNG/WEBP.
- Nếu chính sách Google Workspace chặn quyền truy cập "Anyone", quản trị viên phải cho phép hoặc cần phương án đăng nhập nhân viên.
