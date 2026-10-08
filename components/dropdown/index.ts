/**
 * Canonical dropdown API for test/page-object code. Confirmed STEP 1 finding:
 * this app uses Kendo ComboBox/MultiColumnComboBox for enhanced dropdowns
 * (not native <select>, and select2 assets are loaded globally but not
 * observed in use on any sampled form). Re-exported here under a
 * library-neutral name so call sites don't hard-couple to "Kendo" — if a
 * genuine native <select> or select2 field is confirmed on a module during
 * later implementation, add a sibling class here rather than reusing these.
 */
export { KendoComboBox as ComboBox } from '../kendo/KendoComboBox';
export { KendoMultiColumnComboBox as MultiColumnComboBox } from '../kendo/KendoMultiColumnComboBox';
