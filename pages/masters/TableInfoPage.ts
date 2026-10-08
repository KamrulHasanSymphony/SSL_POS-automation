import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { KendoMultiColumnComboBox } from '../../components/kendo/KendoMultiColumnComboBox';
import { routes, gridContainerSelectors, tableInfoFormSelectors } from '../../utils/constants';

export interface TableInfoCreateData {
  tableNumber: string;
  /** Unique SectionName of an already-created TableSection (STEP 9.2A prerequisite). */
  sectionName: string;
}

/**
 * Areas/DMS/Controllers/TableInfoController.cs +
 * Views/TableInfo/Create.cshtml, confirmed at STEP 9.2A. Requires an
 * existing TableSection (confirmed FK — `SectionId`, Kendo
 * MultiColumnComboBox sourced from `/Common/Common/GetSectionList`).
 * Same as TableSection: no `[Required]` DataAnnotations exist at all, so
 * negative-test assertions use the generic "indicator becomes visible"
 * helper. Delete is confirmed NOT SUPPORTED: no server action exists.
 */
export class TableInfoPage extends BasePage {
  readonly grid: KendoGrid;
  private readonly sectionCombo: KendoMultiColumnComboBox;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
    this.sectionCombo = new KendoMultiColumnComboBox(page, tableInfoFormSelectors.sectionId);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('TableInfo', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('TableInfo', 'Create'));
  }

  async fillTableNumber(tableNumber: string): Promise<void> {
    await this.page.locator(tableInfoFormSelectors.tableNumber).fill(tableNumber);
  }

  async selectSection(uniqueSectionName: string): Promise<void> {
    await this.sectionCombo.typeAndSelectFirst(uniqueSectionName);
  }

  async createTableInfo(data: TableInfoCreateData): Promise<string> {
    await this.gotoCreate();
    await this.fillTableNumber(data.tableNumber);
    await this.selectSection(data.sectionName);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/TableInfo\/Edit/i);
  }

  async updateTableNumber(newTableNumber: string): Promise<void> {
    await this.fillTableNumber(newTableNumber);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectTableNumberRequiredIndicated(): Promise<void> {
    await this.expectRequiredIndicatorVisible(tableInfoFormSelectors.tableNumberValidationMessage);
  }
}
