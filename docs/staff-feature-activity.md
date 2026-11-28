# Theo dõi chức năng nhân viên đã sử dụng

Tài liệu này mô tả hợp đồng giữa trình duyệt và Edge Function `staff-admin`, và những gì còn phải triển khai ở phía Supabase.

## Trình duyệt (đã có trong repo)

- `assets/js/feature-activity.js` cung cấp `FTActivity.record(feature, {kind, minIntervalMs})`.
- Chỉ gọi sau khi một thao tác của nhân viên đã thành công. Không gọi khi mở trang, tải lại hoặc đồng bộ tự động.
- Mỗi lượt có `event_id` (UUID) riêng. Nếu mất mạng, sự kiện được giữ trong hàng đợi trình duyệt (tối đa 50 mục, 24 giờ) và gửi lại với cùng `event_id`.
- Lỗi ghi nhận không bao giờ làm gián đoạn chức năng đang dùng.

| Khóa chức năng | Tên hiển thị | Thời điểm ghi nhận |
|---|---|---|
| `soan_booking` | Soạn Booking | Phân tích xong và tạo kết quả booking |
| `doi_soat` | Đối soát | Tra cứu (lọc) lịch sử đã lưu, lưu giờ dự kiến, xóa booking đã lưu |
| `don_khach` | Đón khách | Nhập hoặc thêm danh sách khách, đổi nhân viên phụ trách thành công |
| `ung_don_khach` | Ứng dụng đón khách | Lưu ETA, sửa booking (gồm ống/bãi), hoàn tất, rà soát nguồn, tải ảnh minh chứng |
| `xep_lich` | Xếp lịch | Tạo lịch tự động, lưu lịch, chỉnh sửa ca |
| `quan_ly_tai_khoan` | Quản lý tài khoản | Cấp tài khoản, đặt lại PIN, khóa/mở khóa, xóa quyền đăng nhập |

## API cần có trong `staff-admin`

Tất cả gửi `POST` với `apikey` (khóa publishable) và `Authorization: Bearer <token phiên>`. Máy chủ xác định nhân viên từ phiên, không tin dữ liệu nhân viên do trình duyệt gửi.

### `record_feature_access`
Yêu cầu: `{ "action": "record_feature_access", "feature": "soan_booking", "event_id": "<uuid>", "occurred_at": "<ISO, tùy chọn>" }`

- Mọi tài khoản đang hoạt động đều được gọi.
- Từ chối (400) nếu `feature` không thuộc danh sách hoặc `event_id` không phải UUID.
- Dùng `occurred_at` của trình duyệt chỉ khi nằm trong 24 giờ gần nhất và không ở tương lai; ngược lại dùng `now()`.
- Chèn với `on conflict (event_id) do nothing`. Trả `{ "ok": true, "duplicate": false|true }`.

### `feature_activity_summary` (chỉ Admin và Quản lý)
Trả `{ "summary": [ { "staff_id": "<staff_members.id>", "features": [ { "feature": "soan_booking", "count": 15 } ], "total": 15, "last_used_at": "<ISO>", "last_feature": "soan_booking" } ] }`. Nguồn dữ liệu: `select * from staff_feature_activity_summary()`.

### `feature_activity_history` (chỉ Admin và Quản lý)
Yêu cầu: `{ staff_id, feature|null, date_from|null, date_to|null, limit (≤100), offset }`. Trả `{ "history": [ { "id", "feature", "event_id", "occurred_at" } ], "total": <số dòng phù hợp> }`, sắp xếp `occurred_at` giảm dần. Nhân viên thường nhận 403. Không có API sửa hoặc xóa lịch sử.

## Mẫu xử lý (cần ghép vào mã staff-admin hiện có)

Mã `staff-admin` hiện không nằm trong repo nên không thể ghép tự động. Thay `requireSession` và `isManager` bằng hàm xác thực phiên có sẵn.

```ts
const FEATURES = ["soan_booking","doi_soat","don_khach","ung_don_khach","xep_lich","quan_ly_tai_khoan"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

case "record_feature_access": {
  const session = await requireSession(req);                       // 401 nếu phiên không hợp lệ
  if (!FEATURES.includes(body.feature) || !UUID.test(body.event_id ?? "")) return json({ error: "Dữ liệu không hợp lệ." }, 400);
  const t = Date.parse(body.occurred_at ?? "");
  const now = Date.now();
  const occurred = Number.isFinite(t) && t <= now + 60_000 && t >= now - 86_400_000 ? new Date(t).toISOString() : new Date(now).toISOString();
  const { data, error } = await db.from("staff_feature_activity")
    .upsert({ account_id: session.account_id, staff_member_id: session.staff_member_id, feature: body.feature, event_id: body.event_id, occurred_at: occurred },
            { onConflict: "event_id", ignoreDuplicates: true }).select("id");
  if (error) return json({ error: "Không thể ghi nhận hoạt động." }, 500);
  return json({ ok: true, duplicate: (data ?? []).length === 0 });
}

case "feature_activity_summary": {
  const session = await requireSession(req);
  if (!(await isManager(session))) return json({ error: "Chỉ Quản lý hoặc Quản trị viên được xem." }, 403);
  const { data, error } = await db.rpc("staff_feature_activity_summary");
  if (error) return json({ error: "Không thể tải thống kê." }, 500);
  const byStaff = new Map();
  for (const r of data ?? []) {
    const e = byStaff.get(r.staff_member_id) ?? { staff_id: r.staff_member_id, features: [], total: 0, last_used_at: null, last_feature: null };
    e.features.push({ feature: r.feature, count: Number(r.uses) });
    e.total += Number(r.uses);
    if (!e.last_used_at || r.last_used_at > e.last_used_at) { e.last_used_at = r.last_used_at; e.last_feature = r.feature; }
    byStaff.set(r.staff_member_id, e);
  }
  return json({ summary: [...byStaff.values()] });
}

case "feature_activity_history": {
  const session = await requireSession(req);
  if (!(await isManager(session))) return json({ error: "Chỉ Quản lý hoặc Quản trị viên được xem." }, 403);
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100), offset = Math.max(Number(body.offset) || 0, 0);
  let q = db.from("staff_feature_activity").select("id,feature,event_id,occurred_at", { count: "exact" }).eq("staff_member_id", body.staff_id);
  if (body.feature && FEATURES.includes(body.feature)) q = q.eq("feature", body.feature);
  if (body.date_from) q = q.gte("occurred_at", body.date_from);
  if (body.date_to) q = q.lte("occurred_at", body.date_to);
  const { data, error, count } = await q.order("occurred_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: "Không thể tải lịch sử." }, 500);
  return json({ history: data ?? [], total: count ?? 0 });
}
```

## Kiểm tra sau khi triển khai backend

1. Chạy migration `supabase/migrations/20261128120000_staff_feature_activity.sql` (an toàn khi bảng đã tồn tại).
2. Đăng nhập bằng tài khoản nhân viên thường, dùng một chức năng, rồi kiểm tra bảng có đúng một dòng mới.
3. Gửi lại cùng `event_id` và xác nhận không tạo dòng thứ hai.
4. Gọi `feature_activity_summary` và `feature_activity_history` bằng tài khoản nhân viên thường và xác nhận bị từ chối (403).
5. Mở Quản lý tài khoản bằng tài khoản quản lý và đối chiếu số lượt với bảng.
