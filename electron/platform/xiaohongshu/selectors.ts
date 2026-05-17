/**
 * 小红书平台选择器配置
 *
 * 注意：这些选择器基于小红书创作者中心页面结构，可能随平台更新而变化。
 * 如果操作失败，需要重新验证并更新选择器。
 */

export const XHS_URLS = {
  creatorHome: 'https://creator.xiaohongshu.com/',
  publish: 'https://creator.xiaohongshu.com/publish/publish',
  contentManage: 'https://creator.xiaohongshu.com/content/manage',
  loginPage: 'https://creator.xiaohongshu.com/',
  statsOverview: 'https://creator.xiaohongshu.com/datacenter/overview',
  statsContent: 'https://creator.xiaohongshu.com/datacenter/content',
} as const;

// ---- 登录相关选择器 ----
export const LOGIN_SELECTORS = {
  // 扫码登录 tab
  scanLoginTab: 'get_by_text("扫码登录", exact=true).first',
  // 二维码图片
  qrCodeImage: '.qrcode-img img, .login-qrcode img, img[src*="qrcode"]',
  // 二维码容器（用于截图）
  qrCodeContainer: '.qrcode-img, .login-qrcode',
  // 登录状态检测 —— 出现这些说明未登录
  phoneLoginText: 'get_by_text("手机登录")',
  scanLoginText: 'get_by_text("扫码登录")',
  // 二维码过期提示
  qrExpiredText: 'get_by_text("二维码已失效")',
  qrRefreshBtn: '.qrcode-refresh, button:has-text("点击刷新")',
  // 登录成功后页面标识
  avatarIndicator: '.user-avatar, .avatar, [class*="avatar"]',
  usernameText: '.user-name, .nickname, [class*="username"]',
} as const;

// ---- 上传/发布相关选择器 ----
export const UPLOAD_SELECTORS = {
  // 视频上传入口
  videoUploadBtn: 'get_by_text("上传视频", exact=false).first',
  // 文件 input
  videoFileInput: 'input[type="file"][accept*="video"], input[type="file"]',
  // 图片 input（图文发布）
  imageFileInput: 'input[type="file"][accept*="image"]',
  // 上传进度
  uploadProgress: '.upload-progress, [class*="progress"]',
  uploadSuccessText: 'get_by_text("上传成功", exact=false)',
  uploadFailedText: 'get_by_text("上传失败", exact=false)',

  // 标题
  titleInput: 'input[placeholder*="标题"], input[placeholder*="填写标题"], #title-textarea',
  titleInputFallback: '.title-input input, [class*="title"] input',

  // 描述/正文
  descEditor: '.ql-editor, [contenteditable="true"], .desc-input, [class*="description"]',
  descEditorFallback: '.c_input_box, .input-box textarea',

  // 话题
  topicInput: 'input[placeholder*="话题"], input[placeholder*="搜索话题"], [class*="topic"] input',
  topicSuggestion: '.topic-item, [class*="topic"] li, [class*="suggest"] li',
  topicTag: '.topic-tag, [class*="tag"] span',

  // @提及
  mentionInput: 'input[placeholder*="@"], input[placeholder*="提及"]',
  mentionSuggestion: '.mention-item, [class*="user-list"] li',

  // 封面
  coverSelectBtn: 'get_by_text("设置封面", exact=false), button:has-text("封面")',
  coverModal: '.cover-modal, [class*="cover-modal"], [class*="cover-dialog"]',
  coverUploadInput: 'input[type="file"][accept*="image"]',
  coverConfirmBtn: 'button:has-text("确定"), button:has-text("完成")',
  coverAutoSelect: '.cover-auto, [class*="auto-cover"]',

  // 发布按钮
  publishButton: 'button:has-text("发布"), button:has-text("发表")',
  publishButtonPrimary: 'button.publishBtn, [class*="publish-btn"], [class*="submit-btn"]',

  // 发布结果提示
  publishSuccessToast: 'get_by_text("发布成功", exact=false)',
  publishFailedToast: 'get_by_text("发布失败", exact=false)',
  publishDraftToast: 'get_by_text("已保存草稿", exact=false)',

  // 定时发布（小红书不支持服务端定时，但保留检测）
  scheduleOption: '[class*="schedule"], [class*="timer"]',
} as const;

// ---- 数据统计选择器 ----
export const STATS_SELECTORS = {
  // 概览页
  totalPlayCount: '[class*="play-count"], [class*="playCount"]',
  totalLikeCount: '[class*="like-count"], [class*="likeCount"]',
  totalCommentCount: '[class*="comment-count"], [class*="commentCount"]',
  totalShareCount: '[class*="share-count"], [class*="shareCount"]',
  totalCollectCount: '[class*="collect-count"], [class*="collectCount"]',
  totalFanCount: '[class*="fan-count"], [class*="fanCount"]',
  // 数据卡片
  statCard: '.stat-card, [class*="data-card"], [class*="stat-item"]',
  // 时间筛选
  dateRangePicker: '.date-range, [class*="date-picker"]',
  dateRangeOptions: '.date-option, [class*="date"] li',
} as const;

// ---- URL 模式匹配 ----
export const PUBLISH_URL_PATTERNS = {
  publishPage: '/publish/publish',
  contentManage: '/content/manage',
  dataCenter: '/datacenter/',
} as const;
