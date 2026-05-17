import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface Account {
  id: string;
  platform: string;
  nickname: string;
  avatar?: string;
  status: 'online' | 'offline' | 'expired';
  cookieValid: boolean;
  lastLogin?: string;
  groupId?: string;
  fingerprintId?: string;
  proxyId?: string;
  createdAt: string;
}

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>([]);
  const loading = ref(false);

  const onlineCount = computed(() => accounts.value.filter((a) => a.status === 'online').length);
  const totalCount = computed(() => accounts.value.length);

  async function fetchAccounts() {
    if (!window.matrixflow) return;
    loading.value = true;
    try {
      const list = await window.matrixflow.accounts.list();
      accounts.value = list as Account[];
    } finally {
      loading.value = false;
    }
  }

  async function createAccount(data: Partial<Account>) {
    if (!window.matrixflow) return;
    const account = await window.matrixflow.accounts.create(data);
    accounts.value.push(account as Account);
    return account;
  }

  async function deleteAccount(id: string) {
    if (!window.matrixflow) return;
    await window.matrixflow.accounts.delete(id);
    accounts.value = accounts.value.filter((a) => a.id !== id);
  }

  async function loginAccount(id: string) {
    if (!window.matrixflow) return;
    return window.matrixflow.accounts.login(id);
  }

  async function checkCookie(id: string) {
    if (!window.matrixflow) return false;
    return window.matrixflow.accounts.checkCookie(id);
  }

  async function setFingerprint(accountId: string, fingerprintId: string | null) {
    if (!window.matrixflow) return;
    await window.matrixflow.account.setFingerprint(accountId, fingerprintId);
    const account = accounts.value.find(a => a.id === accountId);
    if (account) {
      account.fingerprintId = fingerprintId || undefined;
    }
  }

  async function setProxy(accountId: string, proxyId: string | null) {
    if (!window.matrixflow) return;
    await window.matrixflow.account.setProxy(accountId, proxyId);
    const account = accounts.value.find(a => a.id === accountId);
    if (account) {
      account.proxyId = proxyId || undefined;
    }
  }

  return {
    accounts,
    loading,
    onlineCount,
    totalCount,
    fetchAccounts,
    createAccount,
    deleteAccount,
    loginAccount,
    checkCookie,
    setFingerprint,
    setProxy,
  };
});
