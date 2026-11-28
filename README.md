# Fast Track SGN

Ứng dụng nội bộ điều hành đón khách tại sân bay Tân Sơn Nhất. Giao diện dành cho nhân viên sử dụng trên điện thoại; quản lý có thêm chức năng nhập Excel, quản lý tài khoản và xem lịch sử chỉnh sửa.

## Truy cập

- Trang chính: https://taseconhan-ctrl.github.io/fasttrack-sgn/
- Điều hành đón khách: https://taseconhan-ctrl.github.io/fasttrack-sgn/ung-don-khach.html
- Khởi tạo hai tài khoản quản lý lần đầu: https://taseconhan-ctrl.github.io/fasttrack-sgn/bootstrap-managers.html

## Khởi tạo lần đầu

1. Mở Supabase Dashboard của project `xyhvgttywjleirsiabve`.
2. Vào **Edge Functions → Secrets**, thêm secret tên `STAFF_BOOTSTRAP_SECRET`. Giá trị phải là chuỗi ngẫu nhiên tối thiểu 32 ký tự; tạo bằng password manager hoặc trình tạo mật khẩu an toàn. Không dùng PIN nhân viên làm secret.
3. Mở trang **Khởi tạo hai tài khoản quản lý** ở trên. Nhập secret vừa cấu hình, đặt hai PIN khác nhau cho Tuấn Khanh và Minh Khoa, rồi gửi.
4. Khi trang báo thành công, quay lại Supabase Dashboard và xóa `STAFF_BOOTSTRAP_SECRET`. Endpoint tự từ chối khởi tạo lại sau khi hai tài khoản quản lý đã được liên kết.
5. Đăng nhập tại trang Điều hành đón khách bằng username `tuan.khanh` hoặc `minh.khoa`.
6. Trong **Quản lý nhân viên**, tạo tài khoản và đặt PIN riêng cho từng nhân viên còn lại. Không gửi PIN trong nhóm chat chung.

## Tài khoản nhân viên

| Nhân viên | Username | Vai trò ban đầu |
|---|---|---|
| Tuấn Khanh | `tuan.khanh` | Quản lý |
| Minh Khoa | `minh.khoa` | Quản lý |
| Văn Diệp | `van.diep` | Nhân viên |
| Việt Quang | `viet.quang` | Nhân viên |
| Đồng Hưng | `dong.hung` | Nhân viên |
| Lý Ngọc Dũng | `ly.ngoc.dung` | Nhân viên |
| Ngọc Nhân | `ngocnhan` | Nhân viên |
| Thanh Hằng | `thanh.hang` | Nhân viên |
| Nhật Quang | `nhat.quang` | Nhân viên |
| Vũ Văn Bình | `vu.van.binh` | Nhân viên |
| Trung An | `trung.an` | Nhân viên |

## Nghiệp vụ chính

- Nhập danh sách Excel theo thứ tự cột: `Agency`, `Ống/Bãi`, `Giờ dự kiến đáp`, `Flight`, `Name`, `Type`, `Time`, `Order`, `NV thực hiện`.
- `Giờ dự kiến đáp` và `Ống/Bãi` do nhân viên tự cập nhật để theo dõi.
- Danh sách tự đồng bộ giữa các thiết bị khoảng mỗi 12 giây khi ứng dụng đang mở; nút Làm mới vẫn có thể dùng thủ công. Nhận booking dùng cập nhật có điều kiện ở máy chủ nên hai nhân viên không thể nhận trùng cùng một booking.
- Nhân viên phụ trách đánh dấu đã đón hoặc không gặp khách; ảnh minh chứng được lưu trong private Storage bucket.
- Mọi thay đổi booking có nhật ký người sửa và thời điểm; quản lý/quản trị viên xem được lịch sử.
- Vai trò `manager` và `admin` có cùng quyền quản lý. Nhân viên thường không thể tự thay đổi trạng thái hoặc người phụ trách qua chức năng sửa thông tin.

## Kiểm tra trước khi sử dụng

GitHub Actions chạy kiểm tra cú pháp JavaScript của trang điều hành và trang bootstrap trước mỗi lần triển khai GitHub Pages. Kiểm tra cú pháp không thay thế cho kiểm thử đăng nhập và nghiệp vụ thực tế; cần hoàn tất bước tạo tài khoản quản lý và chạy thử với một booking mẫu trước khi đưa vào ca trực.

## Triển khai

Trang tĩnh được triển khai từ nhánh `main` bằng GitHub Actions. Backend chạy trên Supabase project `xyhvgttywjleirsiabve` ở khu vực Singapore.

## Theo dõi chức năng nhân viên đã sử dụng

Các thao tác thành công của nhân viên ở Soạn Booking, Đối soát, Đón khách, Ứng dụng đón khách, Xếp lịch và Quản lý tài khoản được ghi nhận qua `assets/js/feature-activity.js`. Admin và Quản lý xem số lượt, lần dùng gần nhất và lịch sử chi tiết tại **Quản lý tài khoản**. Mở trang, tải lại và đồng bộ tự động không được tính.

Phần backend (bảng, API trong `staff-admin`) cần được triển khai trên Supabase. Xem `docs/staff-feature-activity.md` và `supabase/migrations/20261128120000_staff_feature_activity.sql`. Chạy kiểm thử bằng `node scripts/test-feature-activity.mjs`.
