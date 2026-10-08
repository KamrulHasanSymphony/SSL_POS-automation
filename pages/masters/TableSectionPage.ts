import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, tableSectionFormSelectors } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/TableSectionController.cs +
 * Views/TableSection/Create.cshtml, confirmed at STEP 9.2A. Flat lookup
 * master, no dependencies, no `#Code` field. CONFIRMED: no `[Required]`
 * DataAnnotations exist at all on `TableSectionVm` — only a client-side
 * `.required` CSS class check, so negative-test assertions use the generic
 * "indicator becomes visible" helper, not an exact VM message. Delete is
 * confirmed NOT SUPPORTED: no server action exists at all (stronger
 * absence than the usual "button commented out" pattern) — no delete
 * method here.
 */
export class TableSectionPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('TableSection', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('TableSection', 'Create'));
  }

  async fillSectionName(name: string): Promise<void> {
    await this.page.locator(tableSectionFormSelectors.sectionName).fill(name);
  }

  async createTableSection(name: string): Promise<void> {
    await this.gotoCreate();
    await this.fillSectionName(name);
    await this.clickSave();
    await this.toastr.expectSuccess();
  }

  async openEditFor(name: string): Promise<void> {
    await this.goto();
    await this.grid.search(name);
    await this.grid.clickRowAction(name, /edit/i);
    await this.page.waitForURL(/\/DMS\/TableSection\/Edit/i);
  }

  async updateSectionName(newName: string): Promise<void> {
    await this.fillSectionName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectSectionNameRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(tableSectionFormSelectors.sectionNameValidationMessage);
  }
}
