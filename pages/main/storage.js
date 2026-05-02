function getClassList() {
  return wx.getStorageSync('classList') || [];
}
function saveClassList(list) {
  wx.setStorageSync('classList', list);
}
function saveClass(name, data, oldName = null) {
  const list = getClassList();
  if (oldName && oldName !== name) {
    const idx = list.indexOf(oldName);
    if (idx > -1) list.splice(idx, 1);
    wx.removeStorageSync(`class_${oldName}`);
    wx.removeStorageSync(`history_${oldName}`);
  }
  if (!list.includes(name)) list.push(name);
  saveClassList(list);
  wx.setStorageSync(`class_${name}`, JSON.stringify(data));
}
function loadClass(name) {
  const raw = wx.getStorageSync(`class_${name}`);
  return raw ? JSON.parse(raw) : null;
}
function deleteClass(name) {
  const list = getClassList().filter(n => n !== name);
  saveClassList(list);
  wx.removeStorageSync(`class_${name}`);
  wx.removeStorageSync(`history_${name}`);
}
function loadHistory(name) {
  const raw = wx.getStorageSync(`history_${name}`);
  return raw ? JSON.parse(raw) : null;
}
function saveHistory(name, matrix) {
  let hist = loadHistory(name) || [];
  hist.push(matrix);
  if (hist.length > 5) hist.shift();
  wx.setStorageSync(`history_${name}`, JSON.stringify(hist));
}
module.exports = { saveClass, loadClass, deleteClass, loadHistory, saveHistory };