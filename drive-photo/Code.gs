const ROOT_FOLDER_NAME = 'Fast Track SGN - Anh ve';
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function doGet(e) {
  const order = String((e && e.parameter && e.parameter.order) || '').trim();
  const token = String((e && e.parameter && e.parameter.token) || '').trim();
  if (!/^[A-Za-z0-9_-]{4,30}$/.test(order) || !/^[A-Za-z0-9_-]{20,80}$/.test(token)) {
    return HtmlService.createHtmlOutput('<h3>Liên kết không hợp lệ</h3><p>Vui lòng quét lại QR của booking.</p>');
  }
  const t = HtmlService.createTemplateFromFile('Upload');
  t.order = order;
  t.token = token;
  return t.evaluate().setTitle('Gửi ảnh vé - Fast Track SGN').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function saveTicketPhoto(payload) {
  if (!payload || !payload.order || !payload.token || !payload.dataUrl) throw new Error('Thiếu thông tin ảnh.');
  const order = String(payload.order).trim();
  const token = String(payload.token).trim();
  const staff = String(payload.staff || '').trim().slice(0, 60);
  if (!/^[A-Za-z0-9_-]{4,30}$/.test(order) || !/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw new Error('Mã booking không hợp lệ.');
  if (!staff) throw new Error('Vui lòng nhập tên nhân viên.');
  const match = String(payload.dataUrl).match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('Ảnh vượt quá 8 MB. Vui lòng chọn ảnh nhỏ hơn.');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const orderFolder = getOrCreateChildFolder_(root, order);
  const stamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss');
  const safeStaff = staff.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 30) || 'Nhan_vien';
  const blob = Utilities.newBlob(bytes, 'image/' + match[1], order + '_' + stamp + '_' + safeStaff + '.' + ext);
  const file = orderFolder.createFile(blob);
  file.setDescription('Order: ' + order + '\nNhân viên gửi: ' + staff + '\nThời gian: ' + stamp + ' (GMT+7)');
  return { ok: true, fileName: file.getName(), uploadedAt: stamp };
}

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function getOrCreateChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
