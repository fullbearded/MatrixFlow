/**
 * 微信视频号平台选择器配置
 *
 * 视频号创作者中心: https://channels.weixin.qq.com
 * 注意：选择器基于视频号平台页面结构，可能随平台更新而变化。
 * 如果操作失败，需要重新验证并更新选择器。
 */

// ---- URL 常量 ----
export const CHANNELS_URLS = {
  /** 创作者中心首页 / 登录页 */
  creatorHome: 'https://channels.weixin.qq.com/',
  /** 视频发布/上传页 */
  upload: 'https://channels.weixin.qq.com/platform/post/create',
  /** 内容管理页 */
  contentManage: 'https://channels.weixin.qq.com/platform/post/manage',
  /** 数据中心 */
  statsOverview: 'https://channels.weixin.qq.com/platform/dataCenter',
  /** 登录页（与首页相同） */
  loginPage: 'https://channels.weixin.qq.com/',
} as const;

// ---- 登录相关选择器 ----
export const LOGIN_SELECTORS = {
  /**
   * 微信扫码登录的二维码图片
   * 视频号登录页会直接显示微信二维码（不需要切换 tab）
   */
  qrCodeImage: '.login-qr img, .qrcode img, img[src*="qrcode"], img[src*="qr"]',
  /** 二维码容器（用于截图或定位） */
  qrCodeContainer: '.login-qr, .qrcode, [class*="qr-code"], [class*="qrcode"]',
  /** 二维码状态提示文字（如"请使用微信扫描二维码登录"） */
  qrStatusText: '.login-tip, .login-hint, [class*="login-tip"]',
  /** 二维码过期/刷新按钮 */
  qrRefreshBtn: '.qr-refresh, [class*="refresh"], button:has-text("点击刷新")',
  /** 二维码过期提示文字 */
  qrExpiredText: 'get_by_text("二维码已失效", exact=false)',
  qrExpiredContainer: '[class*="expire"], [class*="invalid"]',

  /**
   * 登录成功后的用户信息元素
   * 视频号登录成功后会跳转到创作者中心首页
   */
  avatarIndicator: '.account-avatar, .user-avatar, [class*="avatar"], img[class*="avatar"]',
  usernameText: '.account-name, .user-name, [class*="nickname"], [class*="username"]',

  /**
   * 登录状态检测 —— 出现这些说明未登录
   * 视频号未登录时页面会显示登录二维码
   */
  loginContainer: '.login-container, [class*="login-box"], [class*="login-page"]',
} as const;

// ---- 上传/发布相关选择器 ----
export const UPLOAD_SELECTORS = {
  /** 上传视频入口按钮 */
  videoUploadBtn: 'get_by_text("上传视频", exact=false).first',
  /** 视频文件 input */
  videoFileInput: 'input[type="file"][accept*="video"], input[type="file"]',
  /** 图片文件 input（图文发布） */
  imageFileInput: 'input[type="file"][accept*="image"]',

  /** 上传进度条 */
  uploadProgress: '.upload-progress, [class*="progress"], [class*="upload-progress"]',
  /** 上传成功提示 */
  uploadSuccessText: 'get_by_text("上传成功", exact=false)',
  /** 上传失败提示 */
  uploadFailedText: 'get_by_text("上传失败", exact=false)',
  /** 重新上传按钮 */
  reUploadBtn: '[class*="re-upload"], button:has-text("重新上传")',

  /** 描述/标题输入框（视频号使用单行描述而非标题+描述） */
  descInput: 'textarea[placeholder*="描述"], textarea[placeholder*="输入"], [class*="desc"] textarea, [contenteditable="true"]',
  descInputFallback: 'input[placeholder*="描述"], .desc-input, [class*="description"]',

  /** 话题/标签输入 */
  topicInput: 'input[placeholder*="话题"], input[placeholder*="标签"], [class*="topic"] input',
  topicSuggestion: '.topic-item, [class*="topic"] li, [class*="suggest"] li',
  topicTag: '.topic-tag, [class*="tag"] span',

  /** @提及 */
  mentionInput: 'input[placeholder*="@"], input[placeholder*="提及"]',

  /** 封面设置 */
  coverSelectBtn: 'get_by_text("设置封面", exact=false), button:has-text("封面")',
  coverModal: '[class*="cover-modal"], [class*="cover-dialog"]',
  coverUploadInput: 'input[type="file"][accept*="image"]',
  coverConfirmBtn: 'button:has-text("确定"), button:has-text("完成")',

  /** 定时发布 */
  scheduleToggle: '[class*="schedule"], [class*="timer"], [class*="timing"]',
  scheduleDatePicker: 'input[placeholder*="日期"], input[placeholder*="时间"], .semi-input[placeholder*="日期"]',

  /** 发布按钮 */
  publishButton: 'button:has-text("发表"), button:has-text("发布")',
  publishButtonPrimary: '[class*="publish-btn"], [class*="submit-btn"], [class*="post-btn"]',

  /** 发布结果提示 */
  publishSuccessToast: 'get_by_text("发布成功", exact=false), get_by_text("发表成功", exact=false)',
  publishFailedToast: 'get_by_text("发布失败", exact=false), get_by_text("发表失败", exact=false)',
} as const;

// ---- 数据统计选择器 ----
export const STATS_SELECTORS = {
  /** 概览统计 */
  totalPlayCount: '[class*="play-count"], [class*="playCount"], [class*="pv"]',
  totalLikeCount: '[class*="like-count"], [class*="likeCount"]',
  totalCommentCount: '[class*="comment-count"], [class*="commentCount"]',
  totalShareCount: '[class*="share-count"], [class*="shareCount"]',
  totalFollowCount: '[class*="follow-count"], [class*="followCount"], [class*="fan"]',
  /** 数据卡片 */
  statCard: '.stat-card, [class*="data-card"], [class*="stat-item"]',
  /** 时间筛选 */
  dateRangePicker: '.date-range, [class*="date-picker"], [class*="time-select"]',
} as const;

// ---- URL 模式匹配 ----
export const PUBLISH_URL_PATTERNS = {
  uploadPage: '/platform/post/create',
  contentManage: '/platform/post/manage',
  dataCenter: '/platform/dataCenter',
} as const;
