/* Ghi nhận chức năng nhân viên đã sử dụng (Fast Track SGN).
 *
 * Chỉ gọi FTActivity.record() SAU KHI một thao tác của nhân viên đã thành công.
 * Không gọi khi mở trang, tải lại trang hoặc đồng bộ tự động.
 * Máy chủ xác định nhân viên từ phiên đăng nhập; trình duyệt chỉ gửi chức năng và mã sự kiện.
 * Mọi lỗi đều bị bỏ qua để không ảnh hưởng chức năng đang dùng.
 */
(function (root) {
  "use strict";
  var ENDPOINT = "https://xyhvgttywjleirsiabve.supabase.co/functions/v1/staff-admin";
  var API_KEY = "sb_publishable_mM4JKOVatzvH8dfNHA92lw_s1Z-OMrP"; // khóa publishable, được phép công khai
  var TOKEN_KEY = "fasttrack_staff_pin_session_v1";
  var QUEUE_KEY = "fasttrack_feature_activity_queue_v1";
  var MAX_QUEUE = 50;
  var MAX_AGE_MS = 24 * 60 * 60 * 1000;

  var FEATURES = {
    soan_booking: "Soạn Booking",
    doi_soat: "Đối soát",
    don_khach: "Đón khách",
    ung_don_khach: "Ứng dụng đón khách",
    xep_lich: "Xếp lịch",
    quan_ly_tai_khoan: "Quản lý tài khoản"
  };

  var memQueue = [];          // dùng khi localStorage không khả dụng
  var inflight = {};          // event_id đang gửi
  var lastByKind = {};        // chống ghi nhận lặp do bấm liên tiếp
  var flushing = false;

  function now() { return Date.now(); }
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }

  function uuid() {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) {}
    var s = "";
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, 8) + "-" + s.slice(8, 12) + "-4" + s.slice(13, 16) + "-a" + s.slice(17, 20) + "-" + s.slice(20, 32);
  }

  function token() {
    var st = store();
    if (!st) return "";
    try { return (JSON.parse(st.getItem(TOKEN_KEY) || "null") || {}).token || ""; } catch (e) { return ""; }
  }

  function readQueue() {
    var st = store();
    if (!st) return memQueue.slice();
    try {
      var q = JSON.parse(st.getItem(QUEUE_KEY) || "[]");
      return Array.isArray(q) ? q : [];
    } catch (e) { return []; }
  }
  function writeQueue(q) {
    q = q.slice(-MAX_QUEUE);
    var st = store();
    if (!st) { memQueue = q; return; }
    try { st.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { memQueue = q; }
  }
  function removeFromQueue(eventId) { writeQueue(readQueue().filter(function (x) { return x.event_id !== eventId; })); }
  function addToQueue(item) {
    var q = readQueue();
    if (q.some(function (x) { return x.event_id === item.event_id; })) return;
    q.push(item);
    writeQueue(q);
  }

  // Trả về true khi sự kiện đã được máy chủ xử lý (thành công hoặc bị từ chối vĩnh viễn) và có thể bỏ khỏi hàng đợi.
  function send(item) {
    var t = token();
    if (!t) return Promise.resolve(false);              // chưa đăng nhập: giữ lại, thử sau
    if (inflight[item.event_id]) return Promise.resolve(false);
    inflight[item.event_id] = true;
    return root.fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": API_KEY, "Authorization": "Bearer " + t },
      body: JSON.stringify({ action: "record_feature_access", feature: item.feature, event_id: item.event_id, occurred_at: item.occurred_at })
    }).then(function (r) {
      delete inflight[item.event_id];
      if (r.ok) return true;
      return r.status >= 400 && r.status < 500;         // lỗi 4xx không thể tự khỏi: bỏ, không thử lại mãi
    }, function () {
      delete inflight[item.event_id];
      return false;                                     // lỗi mạng: giữ trong hàng đợi
    });
  }

  function flush() {
    if (flushing) return Promise.resolve();
    flushing = true;
    var cutoff = now() - MAX_AGE_MS;
    var items = readQueue().filter(function (x) { return Date.parse(x.occurred_at) >= cutoff; });
    writeQueue(items);
    var chain = Promise.resolve();
    items.forEach(function (item) {
      chain = chain.then(function () {
        return send(item).then(function (done) { if (done) removeFromQueue(item.event_id); });
      });
    });
    return chain.then(function () { flushing = false; }, function () { flushing = false; });
  }

  /**
   * @param {string} feature  khóa chức năng trong FEATURES
   * @param {{kind?:string, minIntervalMs?:number}} [opts]  kind: loại thao tác; minIntervalMs: chặn lặp cùng loại
   */
  function record(feature, opts) {
    try {
      if (!FEATURES[feature]) return null;
      opts = opts || {};
      var kind = feature + ":" + (opts.kind || "");
      var gap = typeof opts.minIntervalMs === "number" ? opts.minIntervalMs : 1500;
      var t = now();
      if (lastByKind[kind] && t - lastByKind[kind] < gap) return null;
      lastByKind[kind] = t;
      if (!token()) return null;                        // không có phiên đăng nhập thì không ghi nhận
      var item = { feature: feature, event_id: uuid(), occurred_at: new Date(t).toISOString() };
      addToQueue(item);
      send(item).then(function (done) { if (done) removeFromQueue(item.event_id); });
      return item.event_id;
    } catch (e) { return null; }
  }

  var api = {
    FEATURES: FEATURES,
    record: record,
    flush: flush,
    _internals: { readQueue: readQueue, writeQueue: writeQueue, reset: function () { memQueue = []; inflight = {}; lastByKind = {}; flushing = false; } }
  };
  root.FTActivity = api;

  // Gửi lại các sự kiện thật chưa gửi được (mất mạng trước đó). Không tạo thêm sự kiện mới.
  try {
    if (root.addEventListener) root.addEventListener("online", function () { flush(); });
    if (root.setTimeout) root.setTimeout(function () { flush(); }, 4000);
  } catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
