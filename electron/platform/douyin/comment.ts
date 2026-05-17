import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { trySelectors, clickWithFallback } from '../base/selectorUtils';
import { getCookiePath, cookieExists } from './cookie';
import type { CommentContext, CommentResult } from '../base/types';

const logger = new Logger('DouyinComment');

const RATE_LIMIT = { hourly: 10, daily: 50, burst: 3 } as const;
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 8000;

const COMMENT_SELECTORS = {
  commentInput: [
    'textarea[placeholder*="评论"]',
    'textarea[placeholder*="留下你的评论"]',
    'div[contenteditable="true"][class*="comment"]',
    '[class*="comment-input"] textarea',
  ],
  submitBtn: [
    'button:has-text("发送")',
    '[class*="comment"] button[type="submit"]',
    '[class*="send-btn"]',
    '[class*="submit-btn"]',
  ],
  commentItem: '[class*="comment-item"], [class*="CommentItem"]',
  replyBtn: 'button:has-text("回复"), [class*="reply-btn"]',
  replyInput: [
    'textarea[placeholder*="回复"]',
    'textarea[placeholder*="写下你的回复"]',
    '[class*="reply-input"] textarea',
  ],
  deleteBtn: 'button:has-text("删除"), [class*="delete-btn"]',
  deleteConfirmBtn: 'button:has-text("确定"), button:has-text("确认")',
  captchaText: 'text=/验证码|请完成验证/',
  successIndicator: 'text=/评论成功|已发送/',
} as const;

const CHROME_ARGS = [
  '--disable-gpu', '--disable-gpu-sandbox', '--disable-software-rasterizer',
  '--disable-dev-shm-usage', '--disable-extensions', '--no-sandbox',
];

function randomDelay(min = MIN_DELAY_MS, max = MAX_DELAY_MS): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

interface RateTracker { timestamps: number[] }
const rateTracker: RateTracker = { timestamps: [] };

function cleanOldTimestamps(tracker: RateTracker, maxAgeMs: number): void {
  const now = Date.now();
  tracker.timestamps = tracker.timestamps.filter((t) => now - t < maxAgeMs);
}

function checkRateLimit(tracker: RateTracker): boolean {
  cleanOldTimestamps(tracker, 3_600_000);
  if (tracker.timestamps.length >= RATE_LIMIT.hourly) {
    logger.warn(`已达到小时限流上限: ${RATE_LIMIT.hourly}`);
    return false;
  }
  cleanOldTimestamps(tracker, 86_400_000);
  if (tracker.timestamps.length >= RATE_LIMIT.daily) {
    logger.warn(`已达到日限流上限: ${RATE_LIMIT.daily}`);
    return false;
  }
  return true;
}

function recordCall(tracker: RateTracker): void {
  tracker.timestamps.push(Date.now());
}

export function resolveTemplateVariables(template: string, vars?: Record<string, string>): string {
  let content = template;
  const now = new Date();
  const builtins: Record<string, string> = {
    '{{time}}': now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    '{{date}}': now.toLocaleDateString('zh-CN'),
    '{{weekday}}': ['日', '一', '二', '三', '四', '五', '六'][now.getDay()],
    '{{year}}': String(now.getFullYear()),
    '{{month}}': String(now.getMonth() + 1),
    '{{day}}': String(now.getDate()),
    '{{hour}}': String(now.getHours()),
  };
  for (const [key, val] of Object.entries(builtins)) {
    content = content.replaceAll(key, val);
  }
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, val);
    }
  }
  return content;
}

export function pickRandomTemplate(templates: string[]): string {
  if (templates.length === 0) throw new Error('模板列表为空');
  return templates[Math.floor(Math.random() * templates.length)];
}

async function navigateToVideo(page: Page, videoId: string): Promise<boolean> {
  try {
    const videoUrl = `https://www.douyin.com/video/${videoId}`;
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('passport')) {
      logger.error('页面跳转到登录页，cookie 可能已过期');
      return false;
    }
    return true;
  } catch (error) {
    logger.error('导航到视频页面失败', { videoId, error });
    return false;
  }
}

async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaEl = page.locator(String(COMMENT_SELECTORS.captchaText)).first();
  return captchaEl.isVisible().catch(() => false);
}

export async function postComment(
  page: Page,
  videoId: string,
  comment: string
): Promise<CommentResult> {
  try {
    if (!checkRateLimit(rateTracker)) {
      return { success: false, message: '已达到评论限流上限，请稍后再试' };
    }

    if (!(await navigateToVideo(page, videoId))) {
      return { success: false, message: `无法导航到视频页面: ${videoId}` };
    }

    if (await detectCaptcha(page)) {
      return { success: false, message: '检测到风控验证码，请手动处理' };
    }

    const commentInput = await trySelectors(page, [...COMMENT_SELECTORS.commentInput], { timeout: 10000 });
    if (!commentInput) {
      return { success: false, message: '未找到评论输入框' };
    }

    await commentInput.click();
    await randomDelay(500, 1500);
    await commentInput.fill(comment);
    await randomDelay(300, 800);

    if (!(await clickWithFallback(page, [...COMMENT_SELECTORS.submitBtn], { timeout: 5000 }))) {
      return { success: false, message: '未找到发送按钮' };
    }

    await page.waitForTimeout(2000);

    if (await detectCaptcha(page)) {
      return { success: false, message: '评论后触发风控验证码' };
    }

    recordCall(rateTracker);
    logger.info('评论发布成功', { videoId, comment });
    return { success: true, message: '评论发布成功' };
  } catch (error) {
    logger.error('评论发布失败', { videoId, error });
    return { success: false, message: `评论失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function fetchComments(
  page: Page,
  videoId: string,
  maxCount: number = 20
): Promise<Array<{ id: string; content: string; author: string }>> {
  try {
    if (!(await navigateToVideo(page, videoId))) return [];

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('End');
      await page.waitForTimeout(1000);
    }

    const commentItems = await page.locator(COMMENT_SELECTORS.commentItem).all();
    const comments: Array<{ id: string; content: string; author: string }> = [];

    for (let i = 0; i < Math.min(commentItems.length, maxCount); i++) {
      const text = await commentItems[i].textContent().catch(() => null);
      if (text) {
        comments.push({ id: `douyin_cmt_${i}_${Date.now()}`, content: text.trim(), author: '' });
      }
    }

    logger.info(`获取到 ${comments.length} 条评论`, { videoId });
    return comments;
  } catch (error) {
    logger.error('获取评论列表失败', { videoId, error });
    return [];
  }
}

export async function replyComment(
  page: Page,
  videoId: string,
  _commentId: string,
  content: string
): Promise<CommentResult> {
  try {
    if (!checkRateLimit(rateTracker)) {
      return { success: false, message: '已达到评论限流上限' };
    }
    if (!(await navigateToVideo(page, videoId))) {
      return { success: false, message: `无法导航到视频页面: ${videoId}` };
    }

    const replyButtons = await page.locator(COMMENT_SELECTORS.replyBtn).all();
    if (replyButtons.length === 0) {
      return { success: false, message: '未找到回复按钮，评论可能尚未加载' };
    }

    await replyButtons[0].scrollIntoViewIfNeeded();
    await randomDelay(300, 800);
    await replyButtons[0].click();
    await randomDelay(500, 1000);

    const replyInput = await trySelectors(page, [...COMMENT_SELECTORS.replyInput], { timeout: 5000 });
    if (!replyInput) {
      return { success: false, message: '未找到回复输入框' };
    }

    await replyInput.click();
    await randomDelay(300, 600);
    await replyInput.fill(content);
    await randomDelay(300, 800);

    if (!(await clickWithFallback(page, [...COMMENT_SELECTORS.submitBtn], { timeout: 5000 }))) {
      return { success: false, message: '未找到发送按钮' };
    }

    await page.waitForTimeout(2000);
    recordCall(rateTracker);
    logger.info('回复评论成功', { videoId, content });
    return { success: true, message: '回复评论成功' };
  } catch (error) {
    logger.error('回复评论失败', { videoId, error });
    return { success: false, message: `回复失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function deleteComment(
  page: Page,
  videoId: string,
  _commentId: string
): Promise<CommentResult> {
  try {
    if (!(await navigateToVideo(page, videoId))) {
      return { success: false, message: `无法导航到视频页面: ${videoId}` };
    }

    const deleteBtn = page.locator(COMMENT_SELECTORS.deleteBtn).first();
    if (!(await deleteBtn.isVisible().catch(() => false))) {
      return { success: false, message: '未找到删除按钮' };
    }

    await deleteBtn.click();
    await page.waitForTimeout(1000);

    const confirmBtn = page.locator(COMMENT_SELECTORS.deleteConfirmBtn).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    logger.info('评论已删除', { videoId });
    return { success: true, message: '评论已删除' };
  } catch (error) {
    logger.error('删除评论失败', { videoId, error });
    return { success: false, message: `删除失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function postCommentWithRetry(
  page: Page,
  context: CommentContext,
  maxRetries: number = 3
): Promise<CommentResult> {
  let lastResult: CommentResult = { success: false, message: '未执行' };

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      const backoff = Math.min(3000 * Math.pow(2, i - 1), 30000);
      logger.info(`第 ${i + 1} 次重试，等待 ${backoff}ms`);
      await page.waitForTimeout(backoff);
    }
    lastResult = await postComment(page, context.videoId, context.comment);
    if (lastResult.success) return lastResult;
  }

  return { ...lastResult, message: `评论发布失败，已重试 ${maxRetries} 次: ${lastResult.message}` };
}

export async function postCommentFull(
  accountId: string,
  videoId: string,
  comment: string
): Promise<CommentResult> {
  const cookiePath = getCookiePath(accountId);
  if (!cookieExists(cookiePath)) {
    return { success: false, message: `Cookie 文件不存在: ${cookiePath}` };
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: CHROME_ARGS });
  const context = await browser.newContext({ storageState: cookiePath });

  try {
    const page = await context.newPage();
    return await postCommentWithRetry(page, { accountId, videoId, comment });
  } catch (error) {
    return { success: false, message: `评论出错: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    await context.close();
    await browser.close();
  }
}
