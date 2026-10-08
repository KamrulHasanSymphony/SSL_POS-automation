import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { KendoGrid } from '../../components/common-grid/KendoGrid';
import { routes, gridContainerSelectors, masterSupplierGroupFormSelectors, masterSupplierGroupValidationMessages } from '../../utils/constants';

/**
 * Areas/DMS/Controllers/MasterSupplierGroupController.cs +
 * Views/MasterSupplierGroup/Create.cshtml, confirmed at STEP 9.2A. Flat
 * lookup master, no dependencies. CONFIRMED RISK (not silently worked
 * around): the "add" branch calls `Entity.SetDate()`, which resolves the
 * host's MAC address with no null-check — a plausible unhandled
 * NullReferenceException on a NIC-less deployment. If PROP-MSUPPGRP-002
 * fails for this reason, that is a genuine Application Defect, not an
 * Automation Issue. Delete is confirmed NOT SUPPORTED: action exists,
 * button commented out — no delete method here.
 */
export class MasterSupplierGroupPage extends BasePage {
  readonly grid: KendoGrid;

  constructor(page: Page) {
    super(page);
    this.grid = new KendoGrid(page, gridContainerSelectors.default);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplierGroup', 'Index'));
    await this.grid.waitForLoad();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto(routes.dms('MasterSupplierGroup', 'Create'));
  }

  async fillName(name: string): Promise<void> {
    await this.page.locator(masterSupplierGroupFormSelectors.name).fill(name);
  }

  async createMasterSupplierGroup(name: string): Promise<string> {
    await this.gotoCreate();
    await this.fillName(name);
    await this.clickSave();
    await this.toastr.expectSuccess();
    return this.getCode();
  }

  async openEditFor(code: string): Promise<void> {
    await this.goto();
    await this.grid.search(code);
    await this.grid.clickRowAction(code, /edit/i);
    await this.page.waitForURL(/\/DMS\/MasterSupplierGroup\/Edit/i);
  }

  async updateName(newName: string): Promise<void> {
    await this.fillName(newName);
    await this.clickUpdate();
    await this.toastr.expectSuccess();
  }

  async expectNameRequiredValidation(): Promise<void> {
    await expect(this.page.locator(masterSupplierGroupFormSelectors.nameValidationMessage)).toHaveText(
      masterSupplierGroupValidationMessages.nameRequired
    );
  }
}
