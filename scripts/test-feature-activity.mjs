// Kiểm thử logic ghi nhận chức năng (assets/js/feature-activity.js) bằng môi trường giả lập.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const code = readFileSync(new URL("../assets/js/feature-activity.js", import.meta.url), "utf8");
function env({ token = "tok", fetchImpl, brokenStorage = false } = {}) {
  const data = new Map(token ? [["fasttrack_staff_pin_session_v1", JSON.stringify({ token })]] : []);
  const calls = [];
  const localStorage = brokenStorage ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }
    : { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)) };
  const win = { localStorage, crypto: { randomUUID: () => "00000000-0000-4000-8000-" + String(calls.length + Math.floor(Math.random()*1e6)).padStart(12, "0") },
    addEventListener() {}, setTimeout: () => 0,
    fetch: async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return fetchImpl ? fetchImpl(url, init) : { ok: true, status: 200 }; } };
  win.window = win; vm.createContext(win); vm.runInContext(code, win);
  return { win, FT: win.FTActivity, calls, data, queue: () => JSON.parse(data.get("fasttrack_feature_activity_queue_v1") || "[]") };
}
const tick = () => new Promise(r => setTimeout(r, 5));
let passed = 0; const t = async (name, fn) => { await fn(); passed++; console.log("ok -", name); };

await t("không gửi gì khi chưa gọi record (mở trang, tải lại, flush rỗng)", async () => {
  const e = env(); await e.FT.flush(); await tick(); assert.equal(e.calls.length, 0);
});
await t("record gửi đúng chức năng, mã sự kiện và phiên đăng nhập", async () => {
  const e = env(); const id = e.FT.record("soan_booking", { kind: "phan_tich" }); await tick();
  assert.equal(e.calls.length, 1);
  assert.equal(e.calls[0].body.action, "record_feature_access");
  assert.equal(e.calls[0].body.feature, "soan_booking");
  assert.equal(e.calls[0].body.event_id, id);
  assert.equal(e.calls[0].init.headers.Authorization, "Bearer tok");
  assert.equal(e.queue().length, 0);
});
await t("chức năng không hợp lệ bị bỏ qua", async () => {
  const e = env(); assert.equal(e.FT.record("khong_co"), null); await tick(); assert.equal(e.calls.length, 0);
});
await t("không có phiên đăng nhập thì không ghi nhận", async () => {
  const e = env({ token: "" }); assert.equal(e.FT.record("xep_lich"), null); await tick(); assert.equal(e.calls.length, 0); assert.equal(e.queue().length, 0);
});
await t("chống bấm lặp trong khoảng chặn cùng loại, khác loại vẫn tính", async () => {
  const e = env(); e.FT.record("doi_soat", { kind: "tra_cuu", minIntervalMs: 30000 }); e.FT.record("doi_soat", { kind: "tra_cuu", minIntervalMs: 30000 }); e.FT.record("doi_soat", { kind: "xoa_booking" });
  await tick(); assert.equal(e.calls.length, 2);
});
await t("mất mạng: giữ hàng đợi rồi gửi lại cùng mã sự kiện, không nhân đôi", async () => {
  let fail = true; const e = env({ fetchImpl: () => { if (fail) throw new Error("offline"); return { ok: true, status: 200 }; } });
  const id = e.FT.record("don_khach", { kind: "nhap_danh_sach" }); await tick();
  assert.equal(e.queue().length, 1);
  fail = false; await e.FT.flush(); await tick();
  assert.equal(e.queue().length, 0);
  const sent = e.calls.filter(c => c.body.event_id === id); assert.equal(sent.length, 2);
  await e.FT.flush(); assert.equal(e.calls.length, 2, "không gửi lại sau khi đã xóa khỏi hàng đợi");
});
await t("lỗi 4xx (ví dụ API chưa có) thì bỏ sự kiện, không thử lại vô hạn", async () => {
  const e = env({ fetchImpl: () => ({ ok: false, status: 400 }) }); e.FT.record("ung_don_khach", { kind: "eta" }); await tick();
  assert.equal(e.queue().length, 0);
});
await t("lỗi 5xx giữ lại để gửi sau", async () => {
  const e = env({ fetchImpl: () => ({ ok: false, status: 503 }) }); e.FT.record("ung_don_khach", { kind: "eta" }); await tick();
  assert.equal(e.queue().length, 1);
});
await t("sự kiện trong hàng đợi quá 24 giờ bị loại bỏ", async () => {
  const e = env(); e.data.set("fasttrack_feature_activity_queue_v1", JSON.stringify([{ feature: "xep_lich", event_id: "11111111-1111-4111-8111-111111111111", occurred_at: new Date(Date.now() - 25 * 3600e3).toISOString() }]));
  await e.FT.flush(); await tick(); assert.equal(e.calls.length, 0); assert.equal(e.queue().length, 0);
});
await t("localStorage bị chặn vẫn không gây lỗi", async () => {
  const e = env({ brokenStorage: true }); assert.doesNotThrow(() => e.FT.record("xep_lich")); await tick();
});
console.log(`\n${passed} kiểm thử đạt.`);
