import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import MainLayout from '@/renderer/layouts/MainLayout.vue';
import OnboardingLayout from '@/renderer/layouts/OnboardingLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/onboarding',
    component: OnboardingLayout,
    meta: { requiresOnboarding: false },
    children: [
      {
        path: '',
        name: 'Onboarding',
        component: () => import('@/renderer/views/Onboarding.vue'),
        meta: { requiresOnboarding: false },
      },
    ],
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/accounts',
    children: [
      {
        path: 'accounts',
        name: 'Accounts',
        component: () => import('@/renderer/views/Accounts.vue'),
        meta: { title: '账号管理', icon: 'User' },
      },
      {
        path: 'content',
        name: 'Content',
        component: () => import('@/renderer/views/Content.vue'),
        meta: { title: '内容库', icon: 'Folder' },
      },
      {
        path: 'publish',
        name: 'Publish',
        component: () => import('@/renderer/views/Publish.vue'),
        meta: { title: '发布管理', icon: 'Calendar' },
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/renderer/views/Tasks.vue'),
        meta: { title: '任务管理', icon: 'List' },
      },
      {
        path: 'groups',
        name: 'Groups',
        component: () => import('@/renderer/views/Groups.vue'),
        meta: { title: '分组管理', icon: 'Grid' },
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('@/renderer/views/Stats.vue'),
        meta: { title: '数据中心', icon: 'DataLine' },
      },
      {
        path: 'multi-panel',
        name: 'MultiPanel',
        component: () => import('@/renderer/views/MultiPanel.vue'),
        meta: { title: '多开面板', icon: 'Monitor' },
      },
      {
        path: 'drafts',
        name: 'Drafts',
        component: () => import('@/renderer/views/Drafts.vue'),
        meta: { title: '草稿管理', icon: 'Document' },
      },
      {
        path: 'comments',
        name: 'Comments',
        component: () => import('@/renderer/views/Comments.vue'),
        meta: { title: '评论管理', icon: 'ChatDotRound' },
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/renderer/views/Settings.vue'),
        meta: { title: '设置', icon: 'Setting' },
      },

    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

let settingsFetched = false;

router.beforeEach(async (to) => {
  if (to.matched.length === 0) {
    return { name: 'Accounts' };
  }

  if (!window.matrixflow) return;

  if (!settingsFetched) {
    const { useSettingsStore } = await import('@/renderer/stores/settings');
    const settingsStore = useSettingsStore();
    await settingsStore.fetchSettings();
    settingsFetched = true;
  }

  const { useSettingsStore } = await import('@/renderer/stores/settings');
  const settingsStore = useSettingsStore();
  const completed = settingsStore.settings.onboardingCompleted;

  const requiresOnboarding = to.matched.every(
    (r) => r.meta.requiresOnboarding !== false,
  );

  if (!completed && requiresOnboarding) {
    return { name: 'Onboarding' };
  }

  if (completed && to.name === 'Onboarding') {
    return { name: 'Accounts' };
  }
});

export default router;
