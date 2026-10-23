import { useSyncExternalStore } from 'react';

export type Language = 'en' | 'zh-CN';
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem('painter-language');
    if (saved === 'en' || saved === 'zh-CN') return saved;
  } catch {
    /* Use device preference when storage is unavailable. */
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
    ? 'zh-CN'
    : 'en';
}
let language = initialLanguage();
const listeners = new Set<() => void>();
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem('painter-language', next);
  } catch {
    /* Session selection still works. */
  }
  document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => language,
  );
}
if (typeof document !== 'undefined') document.documentElement.lang = language;

const zh: Record<string, string> = {
  '· Two fingers to pan & zoom': '· 双指平移和缩放',
  '” will be permanently removed from this device. This cannot be undone.':
    '”将从此设备中永久删除，此操作无法撤销。',
  'A little help': '使用帮助',
  'YOUR LITTLE CREATIVE SPACE': '属于你的创作空间',
  'Make something': '随心描绘',
  'uniquely yours.': '你的独特世界。',
  'A blank canvas. A few good tools. Endless possibilities.': '一张画布，几件工具，无限创意。',
  'New drawing': '新建画作',
  'Your drawings': '我的画作',
  'Saved on this device': '保存在此设备上',
  'Opening your sketchbook…': '正在打开画册…',
  'Start with a blank canvas': '从空白画布开始',
  'See where your imagination goes': '让想象自由延伸',
  'No accounts. No distractions. Just you and your ideas.': '无需账号，没有干扰，尽情创作。',
  'Open ': '打开 ',
  'Delete ': '删除 ',
  'Use ': '使用 ',
  project: '画作',
  'unreadable project': '无法读取的画作',
  'Unreadable project': '无法读取的画作',
  Rename: '重命名',
  'Back to drawings': '返回画册',
  Saved: '已保存',
  Saving: '正在保存',
  'Saving…': '正在保存…',
  'Saving?': '正在保存…',
  'Save failed': '保存失败',
  Draft: '草稿',
  Retry: '重试',
  Undo: '撤销',
  Redo: '重做',
  'Exporting PNG': '正在导出 PNG',
  'Exporting…': '正在导出…',
  Share: '分享',
  'More options': '更多选项',
  'Drawing tools': '绘画工具',
  Pen: '画笔',
  Eraser: '橡皮擦',
  Line: '直线',
  Rectangle: '矩形',
  Ellipse: '椭圆',
  Triangle: '三角形',
  pen: '画笔',
  eraser: '橡皮擦',
  line: '直线',
  rectangle: '矩形',
  ellipse: '椭圆',
  triangle: '三角形',
  'Choose colors': '选择颜色',
  Color: '颜色',
  size: '大小',
  px: '像素',
  'Tool size': '工具大小',
  Style: '样式',
  'Shape style': '形状样式',
  Outline: '轮廓',
  Fill: '填充',
  Both: '轮廓和填充',
  Circle: '正圆',
  Square: '正方形',
  'Dismiss notification': '关闭通知',
  'Find your color': '选择喜欢的颜色',
  'Pen & outline': '画笔与轮廓',
  'Shape fill': '形状填充',
  Opacity: '不透明度',
  'THE ESSENTIALS': '常用颜色',
  'RECENTLY USED': '最近使用',
  'Your canvas': '画布选项',
  'Fit to screen': '适应屏幕',
  'Clear canvas': '清空画布',
  'Drawing tips & storage': '绘画技巧与存储',
  'A fresh start?': '重新开始？',
  'This clears your drawing. You can undo it if you change your mind.':
    '这将清空画作。改变主意后可以撤销。',
  'Keep drawing': '继续绘画',
  'Make your mark.': '开始绘画。',
  'Tap for a dot, drag to draw. Choose a shape and drag from one corner to the other. Pick colors, opacity, and sizes in the toolbar.':
    '轻点画点，拖动画线。选择形状后，从一个角拖到另一个角。在工具栏中调整颜色、不透明度和大小。',
  'Get closer.': '放大细节。',
  'Pinch with two fingers to zoom and pan. Adding a second finger cancels your unfinished stroke. Use Fit to screen to reset the view.':
    '用双指缩放和平移。第二根手指触碰时会取消尚未完成的笔画。选择“适应屏幕”可重置视图。',
  'Make changes.': '修改画作。',
  'The eraser removes ink, including on transparent canvases. Undo restores strokes, shapes, erasing, and clears. Shapes cannot be moved after drawing.':
    '橡皮擦可以擦除笔迹，也支持透明画布。撤销可还原笔画、形状、擦除和清空操作。绘制完成的形状不能移动。',
  'Your work stays here.': '作品保存在本机。',
  'Drawings save automatically on this device. Clearing app data or uninstalling removes them. Share a PNG to keep a picture elsewhere; PNGs cannot restore editable history.':
    '画作会自动保存在此设备上。清除应用数据或卸载应用会删除画作。可分享 PNG 图片另行保存，但 PNG 无法恢复可编辑的历史记录。',
  'Keep it manageable.': '注意画作容量。',
  'Canvas sizes go up to 2048 × 2048. Each project supports up to 5,000 actions, 250,000 points, and 20 MiB of editable data. Abruptly closing the app may lose changes since its last successful save.':
    '画布最大为 2048 × 2048 像素。每幅画作最多支持 5,000 次操作、250,000 个点及 20 MiB 可编辑数据。强制关闭应用可能丢失上次保存之后的修改。',
  'Your changes are not saved': '修改尚未保存',
  'Your last saved version is safe, but leaving now will discard unsaved changes.':
    '上次保存的版本仍然安全，但现在离开会丢弃未保存的修改。',
  'Retry save': '重新保存',
  'Leave without saving': '不保存并离开',
  'Delete this drawing?': '删除这幅画作？',
  'will be permanently removed from this device. This cannot be undone.':
    '将从此设备中永久删除，此操作无法撤销。',
  'Keep it': '保留',
  'Delete drawing': '删除画作',
  'Name your drawing': '为画作命名',
  'Drawing name': '画作名称',
  'Save name': '保存名称',
  'Save your drawing': '保存画作',
  'White background': '白色背景',
  'Save drawing': '保存画作',
  'Discard drawing': '丢弃画作',
  'Discard removes this draft and its automatic backup from this device.':
    '丢弃会删除此设备上的草稿及其自动备份。',
  'Close dialog': '关闭对话框',
  ' picker': '选择器',
  'Drawing canvas. Use one finger to draw and two fingers to pan and zoom.':
    '绘画画布。用单指绘画，双指平移和缩放。',
  'Two fingers to pan & zoom': '双指平移和缩放',
  'Untitled drawing': '未命名画作',
  'Share drawing': '分享画作',
  Drawing: '画作',
  'Could not read projects: ': '无法读取画作：',
  'Could not export: ': '无法导出：',
  'Could not discard drawing: ': '无法丢弃画作：',
  'Your latest changes are still in memory. Retry saving: ': '最新修改仍保留在内存中，请重试保存：',
  'Recovered the last readable version. Some recent changes may be missing. Save to keep this recovered drawing.':
    '已恢复最近可读取的版本，部分修改可能丢失。请保存恢复后的画作。',
  'Stroke limit reached. Try a shorter stroke.': '笔画已达上限，请绘制短一些的笔画。',
  'Project limit reached. Export your drawing or undo to free space.':
    '画作已达容量上限。请导出画作或撤销操作以释放空间。',
  'Could not verify saved project. Please retry.': '无法验证保存的画作，请重试。',
  'This project requires a newer version of Painter.': '此画作需要更新版本的 Painter。',
  'Unsupported project version. The original file has not been changed.':
    '不支持此画作版本，原文件未被更改。',
  'Invalid project metadata.': '画作信息无效。',
  'Invalid canvas settings.': '画布设置无效。',
  'Project operation limit exceeded.': '画作操作数量超过上限。',
  'Invalid drawing operation.': '绘画操作无效。',
  'Invalid geometry.': '图形数据无效。',
  'Invalid point count.': '点数量无效。',
  'Invalid tool settings.': '工具设置无效。',
  'Invalid project identifier.': '画作标识无效。',
  'Project file is missing.': '画作文件缺失。',
  'Project identifier does not match its file.': '画作标识与文件不匹配。',
  'Storage operation interrupted.': '存储操作已中断。',
  'PNG export failed.': 'PNG 导出失败。',
  'Canvas 2D is not supported by this WebView.': '此 WebView 不支持二维画布。',
  'Painter needs a fresh start': 'Painter 需要重新启动',
  'Your previously saved drawings remain on this device. Unsaved edits may be lost if you reload.':
    '之前保存的画作仍在此设备上。重新加载可能丢失未保存的修改。',
  'Reload Painter': '重新加载 Painter',
  'A newer WebView is needed': '需要更新 WebView',
  "Please update Android System WebView to use Painter's drawing canvas.":
    '请更新 Android System WebView 以使用 Painter 画布。',
};
export function t(text: string): string {
  return language === 'zh-CN' ? (zh[text] ?? text) : text;
}
export function message(text: string): string {
  if (language === 'en') return text;
  if (zh[text]) return zh[text];
  for (const prefix of [
    'Could not read projects: ',
    'Could not export: ',
    'Could not discard drawing: ',
    'Your latest changes are still in memory. Retry saving: ',
  ])
    if (text.startsWith(prefix)) return t(prefix) + message(text.slice(prefix.length));
  return text;
}
export function recentColorLabel(color: string, opacity: number) {
  return language === 'zh-CN'
    ? `使用 ${color}，不透明度 ${opacity}%`
    : `Use ${color} at ${opacity} percent`;
}
