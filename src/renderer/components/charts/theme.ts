import { ref } from 'vue';

/** 深色模式状态（可由外部同步 Element Plus 的 isDark） */
export const isDark = ref(false);

/** 平台品牌色映射 */
export const PLATFORM_COLORS: Record<string, string> = {
  '抖音': '#000000',
  'douyin': '#000000',
  '小红书': '#FF2442',
  'xiaohongshu': '#FF2442',
  '视频号': '#07C160',
  'weixin': '#07C160',
  '快手': '#FF4906',
  'kuaishou': '#FF4906',
};
