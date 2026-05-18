# Changelog

## [0.2.0] - 2026-05-18

### Added

#### Onboarding (A9)
- New user onboarding wizard with 4 steps: Welcome → Add Account → Browser Config → Done
- Full-screen OnboardingLayout without sidebar
- Navigation guard redirects to /onboarding until setup is complete
- `onboardingCompleted` setting persisted via settings store

#### Data Export/Import (A10)
- Real backup/restore system replacing mock implementations
- `createBackup()` using SQLite backup API with timestamped filenames
- `listBackups()` / `restoreBackup()` / `deleteBackup()` for backup management
- `clearData()` for logs, cache, and full data cleanup
- `data:*` IPC channels and `window.matrixflow.data` API
- DataManagementSettings.vue now uses real IPC calls

#### Notification Configuration (A11)
- NotificationService subscribing to MonitorService and AnomalyService alerts
- Electron desktop notifications with click-to-focus behavior
- NotificationSettings panel in Settings with: master toggle, sound, source filters, critical-only mode, test button
- `notification:*` IPC channels
- 5 new notification preferences in settings store

#### Platform Adapter Unified Entry (A12)
- `electron/platform/adapter.ts` barrel file re-exporting all 4 platform adapters
- `registerAllAdapters()` helper replacing 4 separate register calls in main.ts
- `PLATFORM_IDS` constant and `PlatformId` type for type-safe platform references
- Simplified main.ts imports

#### Worker Threads (A13)
- `BrowserAutomationWorker` manager for offloading browser automation to Worker threads
- `browser-worker.ts` worker entry with independent Patchright Browser instance
- Typed message protocol (WorkerMessage / WorkerResponse) for main↔worker communication
- Promise-based API with progress callbacks
- Auto-restart on worker crash with configurable max attempts

#### Sentry Integration (A14)
- `@sentry/electron@7.13.0` added as dependency
- Main process Sentry init (SentryInit.ts) with sensitive data scrubbing in beforeSend
- Renderer process Sentry init (src/renderer/utils/sentry.ts)
- Error tracking for both processes with environment/release tagging
- Placeholder DSN for development

#### Previous (Batch 1-8)
- BrowserFactory: three-mode browser factory (embedded/external Chrome/fingerprint browser)
- PublishWizard: 3-step publish wizard component
- Calendar Views: week view, day view, context menu, summary bar with conflict detection
- AI Rule Optimization Banner: smart rule suggestions during publish scheduling
- AI Weekly Report Panel: AI-generated weekly operations report
- Data Monitor Panel: monitoring plans CRUD with alert display
- Task Management Rewrite: three-view (summary/timeline/detail) with retry/skip actions
- Group Rule Templates: aggressive/moderate/conservative publish rule presets
- Browser Configuration Tab in Settings
- TypeScript error fixes: panel.ts loadPanels, env.d.ts File.path type

### Changed
- main.ts: simplified platform adapter imports via registerAllAdapters()
- DataManagementSettings.vue: replaced all mock implementations with real IPC calls
- Settings.vue: added "通知设置" and "浏览器配置" tabs
- Tasks.vue: rewritten with three-view layout
- Publish.vue: integrated wizard, calendar views, AI banner
- Stats.vue: added data monitoring and AI weekly report tabs
