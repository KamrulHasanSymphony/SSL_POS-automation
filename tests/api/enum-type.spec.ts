import { test, expect } from '../../fixtures/base.fixture';
import { ApiClient } from '../../utils/api-helper';
import { assertEnvReady } from '../../utils/env';
import { uniqueCode } from '../../utils/random-data';
import { readProp } from '../../utils/test-data-setup';
import { tags } from '../../config/tags';

/**
 * STEP 10 Phase A module: api/EnumType (PROP-API-010..011), approved
 * exactly as documented in STEP 10.2/10.3A. Confirmed directly from
 * SSL_POS_Api source (`EnumTypeController.cs`): no UI screen anywhere in
 * ShampanPOSUI calls any `api/EnumType/*` route (fresh full-solution grep,
 * zero matches), and the controller carries no `[Authorize]` attribute —
 * genuinely API-only, testable only here.
 *
 * `EnumTypeVM` has NO `[Required]`/validation attributes at all, and
 * `EnumTypeRepository.Insert` accepts a null/empty Name with no rejection
 * — no negative/duplicate scenario is code-supported (confirmed: `Insert`
 * does no pre-check `SELECT`, unlike Product/Customer/etc.).
 *
 * `Delete` is confirmed broken (`EnumTypeRepository.Delete` targets the
 * `Areas` table with an unbound `@Ids` parameter, not `EnumTypes`) — not
 * implemented here per explicit instruction; no cleanup mechanism exists
 * for this module, so records created by this suite rely on unique naming
 * only (matching this project's established rule for modules with no
 * reliable delete path).
 *
 * CONFIRMED RISK, not silently assumed: `EnumTypeController.List` ignores
 * its own filter parameters and always calls the repo's `Dropdown()`
 * method (`EnumTypeService.List` -> `_repo.Dropdown()`), which runs
 * `SELECT Id, Name FROM EnumTypes WHERE IsActive = 1`. `EnumTypeVM` has no
 * `IsActive` property at all, so `Insert` never sets that column — whether
 * a newly-inserted row defaults to IsActive=1 (and therefore appears in
 * List) depends entirely on the database column's own default constraint,
 * which is not visible from source. PROP-API-011 asserts the row appears;
 * if this fails on a real environment, that is a database-schema question,
 * not an automation defect — do not "fix" this test by weakening the
 * assertion without re-confirming the schema.
 */
test.describe('Independent API checks — EnumType', () => {
  test(`PROP-API-010 EnumType Insert succeeds ${tags.regression} ${tags.p1}`, async () => {
    assertEnvReady('apiBaseUrl');

    const client = await ApiClient.create();
    const name = uniqueCode('ENUMTYPE');
    const response = await client.post('/api/EnumType/Insert', {
      Name: name,
      EnumType: 'Automation',
      CreatedBy: 'automation',
      CreatedFrom: 'API',
      LastModifiedBy: 'automation',
      LastUpdateFrom: 'API',
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(readProp(body, 'Status')).toBe('Success');
    expect(readProp(body, 'Id')).toBeTruthy();
    expect(Number(readProp(body, 'Id'))).toBeGreaterThan(0);

    await client.dispose();
  });

  test(`PROP-API-011 EnumType List reflects the inserted record ${tags.regression} ${tags.p2}`, async () => {
    assertEnvReady('apiBaseUrl');

    const client = await ApiClient.create();
    const name = uniqueCode('ENUMTYPE');
    const insertResponse = await client.post('/api/EnumType/Insert', {
      Name: name,
      EnumType: 'Automation',
      CreatedBy: 'automation',
      CreatedFrom: 'API',
      LastModifiedBy: 'automation',
      LastUpdateFrom: 'API',
    });
    const insertBody = await insertResponse.json();
    expect(readProp(insertBody, 'Status')).toBe('Success');

    const listResponse = await client.post('/api/EnumType/List', { Id: readProp(insertBody, 'Id') });
    const listBody = await listResponse.json();

    expect(listResponse.status()).toBe(200);
    expect(readProp(listBody, 'Status')).toBe('Success');
    const items: Array<Record<string, unknown>> = readProp(listBody, 'DataVM') ?? [];
    expect(items.some((item) => readProp(item, 'Name') === name)).toBe(true);

    await client.dispose();
  });
});
