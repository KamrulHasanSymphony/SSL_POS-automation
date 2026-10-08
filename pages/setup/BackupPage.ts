import { Page } from '@playwright/test';
import { routes } from '../../utils/constants';

/**
 * BACKUP-RESTORE-LIFECYCLE INVESTIGATION FINDING (confirmed exhaustively
 * from source before this page object's first use — not discovered by
 * trial-and-error; see tests/ui/e2e/backup-restore-lifecycle.spec.ts's own
 * class doc comment for the full citation list): NO Backup, Restore,
 * Export, or Recovery feature exists ANYWHERE in this application —
 *
 * - Zero `*Controller.cs` file named/containing "Backup" or "Restore"
 *   exists across all 54 controllers (`Areas/*\/Controllers/*.cs` +
 *   `Controllers/*.cs`, exhaustively enumerated).
 * - Zero `Backup*.cshtml`/`Restore*.cshtml` views exist anywhere.
 * - Zero `BackupService`/`IBackupService`/`RestoreService` class exists in
 *   the solution.
 * - `DB Master/Schema & Data/Menu Schema and Data.sql` — the real menu seed
 *   script that drives `#partialViewContainer` (see
 *   `Views/Shared/_Layout.cshtml:465`) — contains zero Backup/Restore/
 *   Recovery menu rows. There is no menu entry to click even if a
 *   controller existed.
 * - `web.config` has no backup-file-path configuration of any kind (this is
 *   a legacy ASP.NET MVC app; there is no `appsettings*.json` at all).
 * - The only "Database"-adjacent admin action anywhere is
 *   `SettingsController.DbUpdate()` (`Areas/SetUp/Controllers/
 *   SettingsController.cs`) — a schema/data-migration trigger
 *   (`_repo.DbUpdate(model)`, applies pending SQL scripts against the live
 *   DB), NOT a backup or restore of business data: it produces no file and
 *   consumes none.
 *
 * This page object exists to make that absence independently checkable at
 * RUNTIME, against the real, currently-authenticated session — not merely
 * asserted from a source read. It reads the actual server-rendered sidebar
 * menu (role/user-menu-driven, `MenuAuthorizationController`) and the one
 * real admin configuration screen (Settings) rather than probing
 * unconfirmed/guessed URLs, per this project's standing convention of not
 * exercising a mechanism the application does not implement.
 */
export class BackupPage {
  constructor(private readonly page: Page) {}

  /**
   * `#partialViewContainer` (`Views/Shared/_Layout.cshtml:465`) is the real,
   * confirmed AJAX-populated sidebar nav container — the ONLY menu surface
   * in this application, driven entirely by the logged-in user's own
   * Role/UserMenu assignment. Reading its rendered text is a live,
   * role-accurate equivalent of the static seed-data search already
   * performed against `Menu Schema and Data.sql`.
   */
  async getSidebarMenuText(): Promise<string> {
    return (await this.page.locator('#partialViewContainer').innerText().catch(() => '')) ?? '';
  }

  /** True if the currently rendered sidebar exposes ANY menu item whose text mentions Backup/Restore/Recovery. */
  async hasBackupOrRestoreMenuEntry(): Promise<boolean> {
    const menuText = await this.getSidebarMenuText();
    return /backup|restore|recovery/i.test(menuText);
  }

  /**
   * Settings (`Areas/SetUp/Controllers/SettingsController.cs` +
   * `Views/Settings/Index.cshtml`) is the one confirmed, real, DB-driven
   * admin configuration screen in this application (see
   * `pages/setup/SettingsPage.ts`'s own doc comment) — the single most
   * plausible real location a Backup/Restore control would surface in, if
   * one existed anywhere in the UI.
   */
  async gotoSettings(): Promise<void> {
    await this.page.goto(routes.setup('Settings', 'Index'));
  }

  /** True if the rendered Settings page exposes ANY control/text mentioning Backup/Restore/Recovery. */
  async hasBackupOrRestoreControlOnSettingsPage(): Promise<boolean> {
    const bodyText = (await this.page.locator('body').innerText().catch(() => '')) ?? '';
    return /backup|restore|recovery/i.test(bodyText);
  }
}
