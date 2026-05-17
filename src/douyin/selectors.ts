// ============================================================
// 抖音创作者平台选择器
// 提取自 dreammis/social-auto-upload/uploader/douyin_uploader/main.py
// ============================================================

export const DOUYIN_URLS = {
  creatorHome: 'https://creator.douyin.com/creator-micro/home',
  upload: 'https://creator.douyin.com/creator-micro/content/upload',
  publishV1:
    'https://creator.douyin.com/creator-micro/content/publish?enter_from=publish_page',
  publishV2:
    'https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page',
  contentManage:
    'https://creator.douyin.com/creator-micro/content/manage',
  loginPage: 'https://creator.douyin.com/',
} as const;

// -----------------------------------------------------------
// 登录页选择器
// -----------------------------------------------------------
export const LOGIN_SELECTORS = {
  // 扫码登录标签
  scanLoginTab: 'get_by_text("扫码登录", exact=true).first',
  // 二维码图片
  qrCodeImage: 'get_by_role("img", name="二维码").first',
  // 登录检测标记（如果可见说明未登录）
  phoneLoginText: 'get_by_text("手机号登录")',
  scanLoginText: 'get_by_text("扫码登录")',
  qrExpiredText: 'get_by_text("二维码失效")',
  // 二维码过期刷新
  qrExpiredBox:
    'get_by_text("二维码失效", exact=true).locator("..").first',
} as const;

// -----------------------------------------------------------
// 上传页选择器
// -----------------------------------------------------------
export const UPLOAD_SELECTORS = {
  // 视频文件输入
  videoFileInput: "div[class^='container'] input",
  // 图片文件输入（图文模式）
  imageFileInput: "div[class^='container'] input[accept*='image']",
  // 作品描述区域
  descriptionSection:
    'get_by_text("作品描述", exact=true).locator("xpath=ancestor::div[2]").locator("xpath=following-sibling::div[1]")',
  // 标题输入
  titleInput: 'input[type="text"]',
  // 描述编辑器
  descriptionEditor: '.zone-container[contenteditable="true"]',
  // 上传进度
  uploadRetryBtn: 'div.progress-div [class^="upload-btn-input"]',
  uploadFailedText: 'div.progress-div > div:has-text("上传失败")',
  reUploadText: '[class^="long-card"] div:has-text("重新上传")',
  // 发布按钮
  publishButton: 'get_by_role("button", name="发布", exact=true)',
  // 封面
  coverButton: 'text="选择封面"',
  coverModal: 'div[id*="creator-content-modal"]',
  coverUploadInput:
    "div[class^='semi-upload upload'] >> input.semi-upload-hidden-input",
  coverConfirmBtn: 'button:visible:has-text("完成")',
  autoCoverConfirm:
    'get_by_text("是否确认应用此封面？").first',
  autoCoverOkBtn: 'get_by_role("button", name="确定")',
  setCoverFirstText:
    'get_by_text("请设置封面后再发布").first',
  recommendCover: '[class^="recommendCover-"].first',
  // 定时发布
  scheduleRadio: "[class^='radio']:has-text('定时发布')",
  scheduleDatePicker: '.semi-input[placeholder="日期和时间"]',
  // 第三方开关（允许第三方转载）
  thirdPartySwitch:
    '[class^="info"] > [class^="first-part"] div div.semi-switch',
  thirdPartySwitchInput: 'input.semi-switch-native-control',
  // 地理位置
  locationInput:
    'div.semi-select span:has-text("输入地理位置")',
  locationOption: 'div[role="listbox"] [role="option"]',
  // 标签
  addTagDropdown:
    'get_by_text("添加标签").locator("..").locator("..").locator("..").locator(".semi-select").first',
  tagOption: '[role="option"]',
  // 图文模式
  publishNoteTab: 'get_by_text("发布图文", exact=true)',
  notePublishPage: '**/creator-micro/content/post/image?**',
  // 商品链接
  productLinkInput: 'input[placeholder="粘贴商品链接"]',
  addLinkBtn: 'span:has-text("添加链接")',
  productTitleInput: 'input[placeholder="请输入商品短标题"]',
  finishEditBtn: 'button:has-text("完成编辑")',
} as const;

// -----------------------------------------------------------
// 发布页 URL 版本模式（用于判断加载了哪个版本的发布页）
// -----------------------------------------------------------
export const PUBLISH_URL_PATTERNS = {
  version1: '/content/publish?enter_from=publish_page',
  version2: '/content/post/video?enter_from=publish_page',
  contentManage: '/content/manage',
} as const;
