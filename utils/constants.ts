/**
 * Confirmed selectors and routes, re-verified directly against the current
 * ShampanPOSUI source at STEP 4 implementation time (not just STEP 1 notes —
 * several details below were corrected during that re-verification; see each
 * comment for what changed and why).
 */

export const routes = {
  /**
   * STEP 13 remediation: this is a URL-matching PATTERN (consumed via
   * `new RegExp(routes.login.replace(...))` by every assertion site — see
   * STEP 13 report), not a navigation target — use `routes.loginEntry` for
   * `page.goto()`. Confirmed from source (RouteConfig.cs's default route
   * `controller="Login", action="Index"` + LoginController.cs) that "back at
   * login" resolves to one of two real forms depending on mechanism:
   *   1. `[Authorize]` Forms-Auth redirect → literal `/Login/Index?ReturnUrl=...`
   *      (LoginUrl config, not MVC URL-generation) — the `Login/Index`
   *      alternative below.
   *   2. LoginController's own same-controller `RedirectToAction("Index")`
   *      (failed-login POST, and LogOff()) → MVC's default-segment-omission
   *      collapses this to the bare site root `/` — the anchored
   *      `^https?://[^/]+/$` alternative below matches only that exact form,
   *      not just any URL containing a slash.
   */
  login: '^https?://[^/]+/$|Login/Index',
  /** Direct navigation target for the login page (STEP 13: split out from
   * `login` above, which is now an assertion pattern, not a goto target). */
  loginEntry: '/Login/Index',
  logout: '/Login/LogOff',
  /** STEP 13: corrected from '/Common/Home/Index' — confirmed from source
   * (Areas/Common/CommonAreaRegistration.cs's `action` defaulting to
   * "Index") that MVC's RedirectToAction always collapses the generated URL
   * to '/Common/Home' (no explicit /Index segment); confirmed live across
   * 2 runs (`/Common/Home?branchChange=False`). '/Common/Home/Index' remains
   * a separately valid route to request directly, but the app never leaves
   * a browser sitting on that exact URL after any redirect. */
  dashboard: '/Common/Home',
  changeBranch: '/Common/Home/Index?branchChange=true',

  /** Confirmed anonymous-reachable controllers (no [Authorize]) — for a later
   * security-focused implementation step, not STEP 4's scope. */
  openBranchCreate: '/DMS/BranchCreate/Index',
  openMasterSupplierProduct: '/DMS/MasterSupplierProduct/Index',
  openReplaceReceive: '/DMS/ReplaceReceive/Index',

  /** Re-confirmed at STEP 4: TableSectionController carries class-level
   * [Authorize] + [RouteArea("DMS")], Index() takes no params — a safe,
   * simple target for unauthenticated/post-logout access-control checks. */
  confirmedProtectedPage: '/DMS/TableSection/Index',

  dms: (controller: string, action = 'Index') => `/DMS/${controller}/${action}`,
  setup: (controller: string, action = 'Index') => `/SetUp/${controller}/${action}`,
};

/**
 * Login form — Views/Login/Index.cshtml + ShampanPOS.Models/LoginResource.cs,
 * re-read directly at STEP 4 (not assumed from STEP 1 notes).
 */
export const loginSelectors = {
  username: '#UserName',
  password: '#Password',
  submitButton: '.login-btn',
  passwordToggle: '.togglePassword',
  errorAlert: '.custom-error-alert',
  /** @Html.ValidationMessageFor(m => m.UserName, "", new { @class = "text-danger" })
   * → <span data-valmsg-for="UserName" class="text-danger">. Confirmed by direct
   * view source read, not guessed. */
  usernameValidationMessage: '[data-valmsg-for="UserName"]',
  /** Same pattern for Password. */
  passwordValidationMessage: '[data-valmsg-for="Password"]',
};

/**
 * Exact validation message strings, confirmed directly from
 * ShampanPOS.Models/LoginResource.cs DataAnnotations — corrected from the
 * STEP 1/STEP 2 assumption of "The User Name field is required." (that
 * generic MVC default is NOT what this model uses; UserName has a custom
 * ErrorMessage).
 */
export const loginValidationMessages = {
  usernameRequired: 'User Name is required',
  /** Password has [Required] with NO custom ErrorMessage, so the standard
   * MVC default applies: "The Password field is required." Password ALSO
   * carries [MinLength(6, ErrorMessage = "The password must be at least 6
   * characters long.")] — for a genuinely empty password, jQuery Unobtrusive
   * Validation's actual precedence between the "required" and "minlength"
   * rules on the same empty field was not independently confirmed against a
   * live render; tests assert the validation span becomes non-empty rather
   * than pinning one exact string for the empty-password case, and note this
   * as a live-verification-pending detail. */
  passwordRequiredDefault: 'The Password field is required.',
  invalidCredentials: 'Wrong user name or password!',
};

/**
 * Conditional branch-selection UI — Areas/Common/Views/Home/Index.cshtml +
 * Content/js/app/Controllers/DashController.js, read directly at STEP 4.
 *
 * MAJOR CORRECTION from the STEP 1-era BranchSelectPage guess: there is no
 * separate "branch selection page." It is a Bootstrap modal (#branchProfiles)
 * overlaid on the SAME dashboard page, populated via an async GET to
 * /Common/Home/LoadBranchProfiles. A single active branch triggers a full
 * page redirect (window.location.href) with NO modal shown at all; multiple
 * branches populate a DataTable inside the modal and require a
 * **double-click** on a row's <td> (not a button click) to submit a hidden
 * form to /Common/Home/AssignBranch.
 */
export const branchSelectSelectors = {
  modal: '#branchProfiles',
  modalTitle: '.modal-title',
  table: '#tBranchProfiles',
  tableBody: '#tbdBranchProfiles',
  changeBranchLink: 'a[href*="branchChange=true"]',
};

/**
 * Logout UI trigger — Views/Shared/_rightNav.cshtml, confirmed present on
 * the shared authenticated layout (not specific to the dashboard page):
 * <a title="User Logout" href="/Login/LogOff">...Logout</a>
 */
export const logoutSelectors = {
  link: '.LogoutButton a',
  accessibleName: 'User Logout',
  /** STEP 14: Views/Shared/_rightNav.cshtml — the Logout link lives inside
   * `#Rnav.rnav`, which is `visibility: hidden` by default and only becomes
   * visible via the `.active` class. That class is toggled by a click
   * handler on `.rnavmain` (the user-avatar container), confirmed directly
   * from the view's own inline `<script>`: `$(".rnavmain").click(function
   * (e) { e.stopPropagation(); $(".rnav").toggleClass("active"); });`. A
   * real user must click the avatar to open this menu before Logout is
   * reachable — the automation now does the same, no force-click needed. */
  menuTrigger: '.rnavmain',
  menu: '#Rnav',
};

/** Standard CRUD form pattern shared by nearly all DMS/SetUp modules */
export const commonFormSelectors = {
  form: '#frmEntry',
  saveButton: '.btnsave.sslSave',
  updateButton: '.btnsave.sslUpdate',
  newButton: '.NewButton.addNewButton',
  postButton: '.btnPost.sslPost',
  alreadyPostedIndicator: '.sslPush',
  backButton: '#btnBack',
  auditToggle: '.auditshow',
  auditPanel: '.auditcard',
};

/** Kendo Grid list pages render into an empty container div, not a static <table id> */
export const gridContainerSelectors = {
  default: '#GridDataList',
};

/**
 * Product/Customer/Supplier — Create/Edit form fields, re-confirmed directly
 * from Areas/DMS/Views/{Product,Customer,Supplier}/Create.cshtml and their
 * JS controllers at STEP 5 implementation time. All three share the single
 * #frmEntry form pattern; ProductGroupId/UOMId/CustomerGroupId/
 * SupplierGroupId are plain <input> elements progressively enhanced into a
 * Kendo MultiColumnComboBox client-side (KendoMultiColumnComboBox targets
 * them by their original field id).
 */
export const productFormSelectors = {
  name: '#Name',
  productGroupId: 'ProductGroupId',
  uomId: 'UOMId',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  /** Confirmed present (Create.cshtml) but exact populated text for the
   * Kendo-combo-backed dropdown requireds was not independently confirmed
   * against a live render — see ProductPage's negative-test assertions. */
  productGroupDropdownError: '#titleError1',
  uomDropdownError: '#titleError2',
  /** Only rendered on Create, absent on Edit (Product/Create.cshtml conditional). */
  productStock: '#ProductStock',
  /**
   * VAT-LIFECYCLE-PHASE-2 addition — confirmed real, plain (non-Kendo)
   * numeric `<input>`s on `Product/Create.cshtml`
   * (`@Html.TextBoxFor(model => model.VATRate/SDRate, ...)`), rendered on
   * both Create AND Edit (`ProductController.Edit()` reuses the `Create`
   * view unconditionally, unlike `productStock` above). This is the
   * per-product DEFAULT rate — confirmed from source
   * (`PurchaseController.js`'s `ApplyProductSelection()` /
   * `SaleController.js`'s `AddProductToGrid()`) to auto-populate a
   * Purchase/Sale line item's own SD Rate/VAT Rate cell when this Product
   * is selected, though those cells remain independently manually-editable
   * too.
   */
  vatRate: '#VATRate',
  sdRate: '#SDRate',
};

export const productValidationMessages = {
  /** ProductVM.cs: [Required(ErrorMessage = "Product Name is required.")] */
  nameRequired: 'Product Name is required.',
};

export const customerFormSelectors = {
  name: '#Name',
  customerGroupId: 'CustomerGroupId',
  telephoneNo: '#TelephoneNo',
  email: '#Email',
  address: '#Address',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  telephoneValidationMessage: '[data-valmsg-for="TelephoneNo"]',
  emailValidationMessage: '[data-valmsg-for="Email"]',
  customerGroupDropdownError: '#titleError1',
};

export const customerValidationMessages = {
  /** CustomerVM.cs: [Required(ErrorMessage = "Telephone No. is required.")] */
  telephoneRequired: 'Telephone No. is required.',
  /** CustomerController.js save(): ShowNotification(3, 'Phone Number is Required.')
   * — a second, JS-level check that duplicates the DataAnnotation above with
   * different wording; only reachable if form.valid()/CheckValidation somehow
   * pass with an empty TelephoneNo, which was not confirmed to actually
   * happen live — kept as a fallback match, not the primary assertion. */
  telephoneRequiredJsFallback: 'Phone Number is Required.',
  /** CustomerVM.cs: [RegularExpression(..., ErrorMessage = "Invalid email format")] */
  invalidEmailFormat: 'Invalid email format',
  /** CustomerController.js save(): ShowNotification(3, 'Customer Group is Required.') */
  customerGroupRequiredJsFallback: 'Customer Group is Required.',
};

export const supplierFormSelectors = {
  name: '#Name',
  supplierGroupId: 'SupplierGroupId',
  address: '#Address',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  addressValidationMessage: '[data-valmsg-for="Address"]',
  supplierGroupDropdownError: '#titleError1',
};

export const supplierValidationMessages = {
  /** SupplierVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
  /** SupplierVM.cs: [Required(ErrorMessage = "Address is required.")] */
  addressRequired: 'Address is required.',
};

/**
 * STEP 6 — Purchase/PurchaseOrder/PurchaseReturn/Sale/SaleOrder/SaleReturn.
 * Confirmed directly from source (Areas/DMS/Views/{module}/Create.cshtml +
 * their JS controllers) at STEP 6 implementation time. All six share the
 * Draft->Posted workflow (`.btnPost.sslPost` / `.sslPush`, already generic
 * in commonFormSelectors) and the incell-edit Kendo line-item grid pattern
 * (see components/common-grid/KendoLineItemGrid.ts) — only the grid
 * container id and unit-price field name actually differ per module.
 */
export const transactionGridContainers = {
  /** Sale is the ONLY one of the six that uses this id. */
  sale: '#saleDetails',
  /** Purchase, PurchaseOrder, PurchaseReturn, SaleOrder, SaleReturn all share this id. */
  shared: '#saleOrderDetails',
};

export const purchaseFormSelectors = {
  supplierId: 'SupplierId',
  /** Hand-rolled span, NOT a standard data-valmsg-for span (confirmed — Supplier/Customer dropdowns never use the MVC-standard span in any of the 6 modules). */
  supplierDropdownError: '#titleError2',
  invoiceDateTime: '#InvoiceDateTime',
  purchaseDate: '#PurchaseDate',
  beNumber: '#BENumber',
  /** Also hand-rolled, not data-valmsg-for — confirmed via source (Purchase/Create.cshtml). */
  beNumberError: '#titleError1',
};

export const purchaseOrderFormSelectors = {
  supplierId: 'SupplierId',
  supplierDropdownError: '#titleError2',
  orderDate: '#OrderDate',
  orderDateValidationMessage: '[data-valmsg-for="OrderDate"]',
  deliveryDateTime: '#DeliveryDateTime',
};

export const purchaseOrderValidationMessages = {
  /** PurchaseOrderVM.cs: [Required(ErrorMessage = "Order Date is required")] */
  orderDateRequired: 'Order Date is required',
};

export const purchaseReturnFormSelectors = {
  purchaseDate: '#PurchaseDate',
  invoiceDateTime: '#InvoiceDateTime',
  supplierId: 'SupplierId',
  beNumber: '#BENumber',
};

export const saleFormSelectors = {
  customerId: 'CustomerId',
  customerDropdownError: '#titleError1',
  invoiceDateTime: '#InvoiceDateTime',
  /** Payment grid — confirmed to exist and be mandatory (SaleController.js), exact
   * column/toolbar selectors NOT independently confirmed against a live render;
   * see SalePage.ts's own header comment. */
  paymentGrid: '#cardDetails',
};

export const saleOrderFormSelectors = {
  customerId: 'CustomerId',
  customerDropdownError: '#titleError2',
  orderDate: '#OrderDate',
  orderDateValidationMessage: '[data-valmsg-for="OrderDate"]',
  deliveryDate: '#DeliveryDate',
};

export const saleOrderValidationMessages = {
  /** SaleOrderVM.cs: [Required(ErrorMessage = "Order Date is required")] */
  orderDateRequired: 'Order Date is required',
};

export const saleReturnFormSelectors = {
  customerId: 'CustomerId',
  customerDropdownError: '#titleError1',
  invoiceDateTime: '#InvoiceDateTime',
};

/**
 * BankInformation -> BankAccount. Originated in STEP 6 as a Sale-only
 * prerequisite chain; STEP 7 promotes both to first-class modules under
 * test in their own right (PROP-BANK-*). Confirmed at STEP 7: BankAccount
 * has NO `#Code` field (unlike every other module in this app) — its own
 * generated AccountNo/AccountName must be used as the unique identifier
 * instead of BasePage.getCode().
 */
export const bankAccountFormSelectors = {
  bankInformation: {
    name: '#Name',
    telephoneNo: '#TelephoneNo',
    nameValidationMessage: '[data-valmsg-for="Name"]',
    telephoneValidationMessage: '[data-valmsg-for="TelephoneNo"]',
  },
  bankAccount: {
    accountNo: '#AccountNo',
    accountName: '#AccountName',
    bankId: 'BankId',
    branchName: '#BranchName',
  },
};

export const bankInformationValidationMessages = {
  /** BankInformationVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
  /** BankInformationVM.cs: [Required(ErrorMessage = "Telephone No is required.")] (no period before "is") */
  telephoneRequired: 'Telephone No is required.',
};

/**
 * Deposit / Withdrawal — confirmed STEP 7. Both are flat single-record
 * forms (no line-item grid, no working Post workflow). CONFIRMED DEFECT:
 * the From/To Bank Account error spans on both modules share the literal
 * id `titleError2` (a real id collision in the app's own markup) — do not
 * locate by `#titleError2` alone, scope by field position instead (see
 * DepositPage.ts/WithdrawalPage.ts).
 */
export const depositFormSelectors = {
  fromBankAccountId: 'FromBankAccountId',
  toBankAccountId: 'ToBankAccountId',
  /** Confirmed id collision: both From/To error spans literally share id="titleError2" —
   * `:nth-match()` is Playwright's own CSS extension for exactly this (1-indexed). */
  bankAccountErrorFrom: ':nth-match(#titleError2, 1)',
  bankAccountErrorTo: ':nth-match(#titleError2, 2)',
  transactionDate: '#TransactionDate',
  transactionDateValidationMessage: '[data-valmsg-for="TransactionDate"]',
  chequeDate: '#ChequeDate',
  totalAmount: '#TotalDepositAmount',
};

export const depositValidationMessages = {
  /** DepositVM.cs: [Required(ErrorMessage = "Transaction Date is required.")] */
  transactionDateRequired: 'Transaction Date is required.',
};

export const withdrawalFormSelectors = {
  fromBankAccountId: 'FromBankAccountId',
  toBankAccountId: 'ToBankAccountId',
  /** Same confirmed id collision as Deposit: both From/To error spans share id="titleError2". */
  bankAccountErrorFrom: ':nth-match(#titleError2, 1)',
  bankAccountErrorTo: ':nth-match(#titleError2, 2)',
  transactionDate: '#TransactionDate',
  transactionDateValidationMessage: '[data-valmsg-for="TransactionDate"]',
  chequeDate: '#ChequeDate',
  /** WithdrawalVM.cs also reuses the property name TotalDepositAmount (confirmed, not a typo here). */
  totalAmount: '#TotalDepositAmount',
};

export const withdrawalValidationMessages = {
  /** WithdrawalVM.cs: [Required(ErrorMessage = "Transaction Date is required.")] */
  transactionDateRequired: 'Transaction Date is required.',
};

/**
 * Collection / Payment — confirmed STEP 7. Header + multi-line Kendo grid
 * applying against existing Sale/Purchase invoices via a shared popup
 * mechanism (`#poWindow`/`#windowGrid` — see KendoInvoicePickerGrid.ts).
 * CONFIRMED DEFECT: the Customer/Supplier field's error span id
 * `titleError1` is reused a SECOND time for the (optional) BankAccountId
 * field on the same page — do not locate by `#titleError1` alone.
 * CONFIRMED: the visibly-displayed required-field message is a hard-coded
 * "This field is required." from CommonValidationHelper.markInvalid(), NOT
 * the VM's own [Required] ErrorMessage string — so only the generic
 * "becomes visible" assertion is used, not an exact-text one, for these two
 * fields specifically.
 */
export const collectionFormSelectors = {
  customerId: 'CustomerId',
  /** Confirmed id collision: id="titleError1" is reused for BankAccountId lower on the same
   * page — CustomerId's span is the first (1-indexed) DOM occurrence. */
  customerDropdownError: ':nth-match(#titleError1, 1)',
  transactionDate: '#TransactionDate',
  detailsGrid: '#CollectionDetailsGrid',
  totalCollectAmount: '#TotalCollectAmount',
};

export const paymentFormSelectors = {
  supplierId: 'SupplierId',
  /** Same confirmed id collision as Collection: id="titleError1" reused for BankAccountId. */
  supplierDropdownError: ':nth-match(#titleError1, 1)',
  transactionDate: '#TransactionDate',
  detailsGrid: '#PaymentDetailsGrid',
  totalPaymentAmount: '#TotalPaymentAmount',
};

/**
 * STEP 8 — exact confirmed ShampanPOS_Api (Web API) response strings for
 * the independent API-level checks. All confirmed at STEP 8.2 source
 * verification directly from the Service-layer C# source (not the UI) —
 * every one of these is returned in the JSON body's `Message` field with
 * `Status:"Fail"` and HTTP 200 (none of these endpoints use an explicit
 * non-200 status code on business-rule rejection).
 */
export const apiMessages = {
  /** ProductService.cs / SupplierService.cs — identical string, both Name-based, global (not company-scoped) duplicate checks. */
  duplicateDataExists: 'Data Already Exist!',
  /** CollectionService.cs:78 — exact throw message. */
  collectionExceedsDue: 'Collection amount cannot be greater than due.',
  /** PaymentService.cs:162 — exact throw message. */
  paymentExceedsDue: 'Payment amount cannot be greater than due.',
};

/**
 * STEP 9 Phase A — BusinessType, PaymentType, TableSection, TableInfo,
 * IncomeExpenseCategory, OverHead, MasterItemGroup, MasterSupplierGroup,
 * MasterSupplier. All confirmed directly from source at STEP 9.2A
 * implementation time.
 *
 * CONFIRMED DEVIATION from the established pattern: BusinessType and
 * PaymentType each render their Save/Update button ONLY ONCE (no top+bottom
 * duplication) — harmless for `BasePage.clickSave()`'s `.first()` (works
 * correctly against either 1 or 2 matches), noted here for accuracy only.
 */
export const businessTypeFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const businessTypeValidationMessages = {
  /** BusinessTypeVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
};

export const paymentTypeFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const paymentTypeValidationMessages = {
  /** PaymentTypeVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
};

/**
 * TableSection / TableInfo — confirmed NO `[Required]` DataAnnotations
 * exist on either VM at all; the hand-rolled validation span DOES carry a
 * real `data-valmsg-for` attribute (unlike Collection/Payment's colliding
 * `#titleErrorN` pattern), but since there's no VM ErrorMessage, only a
 * generic "becomes visible" assertion is used, not exact text.
 */
export const tableSectionFormSelectors = {
  sectionName: '#SectionName',
  sectionNameValidationMessage: '[data-valmsg-for="SectionName"]',
};

export const tableInfoFormSelectors = {
  tableNumber: '#TableNumber',
  tableNumberValidationMessage: '[data-valmsg-for="TableNumber"]',
  /** Kendo MultiColumnComboBox, sourced from /Common/Common/GetSectionList. */
  sectionId: 'SectionId',
};

/**
 * IncomeExpenseCategory — confirmed single-page Bootstrap modal
 * (`#categoryModal`), reused for both Create and Edit. Type is a plain
 * `<select>` (NOT a Kendo combo). Confirmed NO inline validation spans
 * exist for Name/Type at all — the only visible signal on an empty
 * submission is a Toastr error with these exact JS-literal strings (not
 * VM ErrorMessage text, since neither field has a custom one).
 */
export const incomeExpenseCategoryModalSelectors = {
  modal: '#categoryModal',
  newButton: '#btnNew',
  name: '#Name',
  type: '#Type',
  saveButton: '#btnSave',
};
export const incomeExpenseCategoryMessages = {
  /** IncomeExpenseCategoryController.js: ShowNotification(3, "Name is required.") */
  nameRequired: 'Name is required.',
  /** IncomeExpenseCategoryController.js: ShowNotification(3, "Type is required.") */
  typeRequired: 'Type is required.',
};

export const overHeadFormSelectors = {
  overHead: '#OverHead',
  overHeadValidationMessage: '[data-valmsg-for="OverHead"]',
};
export const overHeadValidationMessages = {
  /** OverHeadVM.cs: [Required(ErrorMessage = "Over Head is required.")] */
  overHeadRequired: 'Over Head is required.',
};

export const masterItemGroupFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const masterItemGroupValidationMessages = {
  /** MasterItemGroupVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
};

export const masterSupplierGroupFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const masterSupplierGroupValidationMessages = {
  /** MasterSupplierGroupVM.cs: [Required(ErrorMessage = "Supplier Group Name is required.")] */
  nameRequired: 'Supplier Group Name is required.',
};

export const masterSupplierFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  masterSupplierGroupId: 'MasterSupplierGroupId',
  /** Hand-rolled span, confirmed NO id collision on this page (unlike Purchase/Collection's titleError1/2 pattern). */
  masterSupplierGroupError: '#titleError1',
  address: '#Address',
  addressValidationMessage: '[data-valmsg-for="Address"]',
};
export const masterSupplierValidationMessages = {
  /** MasterSupplierVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
  /** MasterSupplierVM.cs: [Required(ErrorMessage = "Address is required.")] */
  addressRequired: 'Address is required.',
};

/**
 * STEP 9 Phase B module: BranchProfile, confirmed at STEP 9.2B against
 * Areas/DMS/Views/BranchProfile/Create.cshtml + BranchProfileVM.cs.
 *
 * CONFIRMED DEFECT (documented, not worked around): `Name` renders TWICE —
 * `@Html.HiddenFor(model => model.Name)` (line 121) AND a second, real
 * `@Html.TextBoxFor(model => model.Name, ...)` (line 146), both with
 * `id="Name"`. `.locator('#Name')` resolves to 2 elements; `.last()` is the
 * real, visible input (matches the established `.first()`-for-duplicate-
 * button precedent in BasePage — pick the one live element, don't guess).
 *
 * CONFIRMED LIMITATION (preserved per SQA instruction, not silently
 * changed): `AreaId` has `[Required]` on BranchProfileVM.cs but its input is
 * fully commented out in Create.cshtml (no HiddenFor either) — the client
 * never submits `AreaId` at all. `CreateEdit` in BranchProfileController.cs
 * calls `_repo.Insert(model)` directly with no `ModelState.IsValid` check,
 * so a POST with AreaId absent is not blocked by any layer this app
 * actually enforces. PROP-BRPF-002 fills only the fields the UI exposes.
 */
export const branchProfileFormSelectors = {
  distributorCode: '#DistributorCode',
  distributorCodeValidationMessage: '[data-valmsg-for="DistributorCode"]',
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  telephoneNo: '#TelephoneNo',
  telephoneNoValidationMessage: '[data-valmsg-for="TelephoneNo"]',
};
export const branchProfileValidationMessages = {
  /** BranchProfileVM.cs: [Required(ErrorMessage = "Distributor Name is required")] */
  nameRequired: 'Distributor Name is required',
  /** BranchProfileVM.cs: [Required(ErrorMessage = "Telephone No. is required.")] */
  telephoneRequired: 'Telephone No. is required.',
  /** BranchProfileVM.cs: [RegularExpression(@"^\+?\d{10,15}$", ErrorMessage = "Invalid Telephone No. format.")] */
  telephoneInvalidFormat: 'Invalid Telephone No. format.',
};

/**
 * STEP 9 Phase B module: FiscalYear, confirmed at STEP 9.2B against
 * Areas/DMS/Views/FiscalYear/{Create,CreateEdit}.cshtml + FiscalYearController.cs
 * + FiscalYearsController.js. `Year` is a `<select>` populated client-side
 * (`generateYearList()`: currentYear-1 .. currentYear+3). `YearStart` is
 * pre-filled server-side from `CompanyProfile.FYearStart` in the `Create()`
 * action — CONFIRMED RISK (not a hard block per SQA instruction): if the
 * signed-in company's `FYearStart` is unset, `fyStart.Value` on a null
 * `DateTime?` throws before the view even renders; this is a genuine
 * environment/test-data precondition, not something source alone can
 * confirm either way. Clicking `#btnFDt` calls `FiscalYearSet` and appends
 * the 12-month breakdown into `#fiscalYearDetails`, which the confirmed
 * `[Required]`-free `FiscalYearVM` has no server validation blocking.
 */
export const fiscalYearFormSelectors = {
  year: '#Year',
  yearStart: '#YearStart',
  yearEnd: '#YearEnd',
  generateDetailsButton: '#btnFDt',
  detailsContainer: '#fiscalYearDetails',
};

/**
 * STEP 9 Phase B module: Areas, confirmed at STEP 9.2B against
 * Areas/DMS/Views/Areas/{Create,Index}.cshtml + AreasController.cs/.js +
 * AreaVM.cs.
 *
 * CONFIRMED BLOCKER (STOP CONDITION per SQA instruction — reported, not
 * worked around): `CountryId`/`DivisionId`/`DistrictId`/`ThanaId` are Kendo
 * MultiColumnComboBoxes whose datasource all read from
 * `/Common/Common/GetAreaLocationList` (AreasController.js). That action
 * does not exist anywhere in `CommonController.cs` on either the UI or API
 * tier — a confirmed 404 on every cascade, regardless of environment or
 * seed data. `EnumTypeId`'s only creation path is `api/EnumType/Insert`
 * (API-only, no UI screen), out of scope for this UI-only phase. Because no
 * safe, non-guessed way exists to populate these required fields, Create
 * (PROP-AREA-002) and everything that depends on a successfully-created
 * Area (Edit/Delete/Search — PROP-AREA-004/005/006) are NOT implemented
 * this phase.
 *
 * Same duplicate-`#Name` defect as BranchProfile above (HiddenFor + real
 * TextBoxFor both `id="Name"`) — `.last()` for the same reason.
 *
 * PROP-AREA-001 (List) and PROP-AREA-003 (empty-Name negative) do NOT
 * depend on the broken location cascade: `AreasController.js`'s
 * `.kendoMultiColumnComboBox()` calls are synchronous widget registrations
 * (the 404s only surface later, async, on actual data reads), so `.btnsave`
 * still binds normally; and `save()` runs `$("#Areas_Form").validate().form()`
 * (jQuery Unobtrusive, covers `Name`'s `[Required]`) independently of its
 * separate `CommonService.validateDropdown()` calls for the location
 * fields — a blank-Name submit surfaces the Name message regardless of
 * whether the location combos ever loaded.
 */
export const areaFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const areaValidationMessages = {
  /** AreaVM.cs: [Required] on Name with no custom ErrorMessage + Display(Name="Name") -> MVC default. */
  nameRequired: 'The Name field is required.',
};

/**
 * STEP 9 Phase C module: Income, confirmed at STEP 9.2C against
 * Areas/DMS/Views/Income/Create.cshtml + IncomeController.cs/.js +
 * IncomeVM.cs. Transaction-style module (like Purchase/Sale from STEP 6):
 * `TransactionDate` is `[Required]` with NO custom ErrorMessage -> MVC
 * default. Pre-filled via `kendoDatePicker({value: new Date()})` on Create,
 * so the negative test must actively clear it. The detail-line Category
 * picker is a Bootstrap modal (`#categoryModal`) + jQuery DataTables
 * (`#categoryTable`, server-side via `/DMS/IncomeExpenseCategory/_getCategoryData`)
 * — NOT the Kendo-Window-based `KendoLineItemGrid` used by Purchase/Sale,
 * so a dedicated interaction is used here rather than that component.
 * CONFIRMED: Post (`.btnPost`/`MultiplePost`) is a REAL, working workflow —
 * distinct from the dead Post buttons on Collection/Payment/Deposit/
 * Withdrawal. CONFIRMED: posting only hides/shows buttons client-side
 * (`processDone()`); the actual `Visibility(true)` field-locking only runs
 * on page load from the server-rendered `#IsPost` value — a reload after
 * posting is required to observe genuine form locking, not just the
 * Already-Posted indicator.
 */
export const incomeFormSelectors = {
  transactionDate: '#TransactionDate',
  transactionDateValidationMessage: '[data-valmsg-for="TransactionDate"]',
  comments: '#Comments',
  detailsContainer: '#incomeDetails',
  categoryModal: '#categoryModal',
  categoryTable: '#categoryTable',
};
export const incomeValidationMessages = {
  /** IncomeVM.cs: [Required] on TransactionDate, no custom ErrorMessage, Display(Name="Transaction Date") -> MVC default. */
  transactionDateRequired: 'The Transaction Date field is required.',
};

/**
 * STEP 9 Phase C module: Expense — confirmed at STEP 9.2C to be a
 * near-exact structural mirror of Income (same ExpenseController.cs/.js
 * shape, same detail-grid/category-picker mechanism, `CATEGORY_TYPE = 2`
 * vs Income's `1`), differing only in the absent Cash/Bank fields. See
 * incomeFormSelectors' doc comment for the shared Post-workflow and
 * form-locking findings, which apply identically here.
 */
export const expenseFormSelectors = {
  transactionDate: '#TransactionDate',
  transactionDateValidationMessage: '[data-valmsg-for="TransactionDate"]',
  comments: '#Comments',
  detailsContainer: '#expenseDetails',
  categoryModal: '#categoryModal',
  categoryTable: '#categoryTable',
};
export const expenseValidationMessages = {
  /** ExpenseVM.cs: [Required] on TransactionDate, no custom ErrorMessage, Display(Name="Transaction Date") -> MVC default. */
  transactionDateRequired: 'The Transaction Date field is required.',
};

/**
 * STEP 9 Phase C module: MasterItem, confirmed at STEP 9.2C against
 * Areas/DMS/Views/MasterItem/Create.cshtml + MasterItemController.cs/.js +
 * MasterItemVM.cs. `Name`/`MasterItemGroupId`/`UOMId` are all `[Required]`
 * with custom ErrorMessages. `MasterItemGroupId`/`UOMId` are plain
 * `<input>` elements progressively enhanced into Kendo MultiColumnComboBox
 * (same pattern as Product's ProductGroupId/UOMId, STEP 5) reading from the
 * confirmed-existing `/Common/Common/GetMasterItemGroupList` and the UOM
 * dropdown endpoint — NOT broken like Areas' location cascade.
 * `save()` runs `validator.form()` (jQuery Unobtrusive, covers Name)
 * independently of its separate `validateDropdown()` calls for the two
 * combos, so a blank-Name submission surfaces the Name message regardless
 * of dropdown state (same confirmed pattern as Areas — see areaFormSelectors).
 * CONFIRMED: the grid's Edit link has no title/aria-label (icon-only), so
 * KendoGrid.clickRowAction()'s role-based matching does not apply here —
 * MasterItemPage.openEditFor() clicks `a.edit` directly instead.
 */
export const masterItemFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  masterItemGroupId: 'MasterItemGroupId',
  masterItemGroupDropdownError: '#titleError1',
  uomId: 'UOMId',
  uomDropdownError: '#titleError2',
};
export const masterItemValidationMessages = {
  /** MasterItemVM.cs: [Required(ErrorMessage = "Product Name is required.")] */
  nameRequired: 'Product Name is required.',
};

/**
 * STEP 9 Phase C module: MasterSupplierItem, confirmed at STEP 9.2C against
 * Areas/DMS/Views/MasterSupplierItem/Create.cshtml +
 * MasterSupplierItemController.cs/.js + MasterSupplierItemVM.cs.
 * `MasterSupplierId` is `[Required(ErrorMessage = "Supplier is required")]`,
 * a plain `<input class="required">` (no `data-valmsg-for` — no
 * `@Html.ValidationMessageFor` at all) progressively enhanced into a Kendo
 * MultiColumnComboBox reading the confirmed-existing
 * `/Common/Common/GetMasterSupplierList`. `save()` runs
 * `CommonValidationHelper.CheckValidation()` (the same hard-coded "This
 * field is required." indicator mechanism as every other `.required`-classed
 * field in this app — see commonFormSelectors' STEP 5 note) BEFORE the
 * Confirmation dialog, populating `#titleError2` next to MasterSupplierId.
 *
 * Item picking is NOT a modal: selecting `MasterItemGroupId` (its own
 * working Kendo combo, `/Common/Common/GetMasterItemGroupList`) loads a
 * plain Kendo grid (`#departments`, reading `/Common/Common/GetItemList`)
 * of items in that group; each row has an inline "Add" button
 * (`.addToDetails`) that appends it into `#AddedItemGrid` client-side —
 * no popup/window is involved. `saveDone()` shows a HARD-CODED
 * "Save Successfully" / "Save Failed" toastr text, not the server's own
 * message. This VM has NO `Code` property (like FiscalYear) — the
 * DB-assigned `Id` is the only per-record identifier; `MasterSupplierName`
 * is the grid's own search/display key instead (confirmed unique per test
 * since each test creates its own uniquely-named prerequisite Supplier).
 * CONFIRMED: unlike Income/Expense/MasterItem, the grid's Edit link DOES
 * carry `title="Edit Credit Limit"`, so KendoGrid.clickRowAction()'s
 * role-based matching works normally here.
 */
export const masterSupplierItemFormSelectors = {
  masterSupplierId: 'MasterSupplierId',
  masterSupplierDropdownError: '#titleError2',
  masterItemGroupId: 'MasterItemGroupId',
  departmentsGrid: '#departments',
  addedItemGrid: '#AddedItemGrid',
};
export const masterSupplierItemMessages = {
  saveSuccess: 'Save Successfully',
};

/**
 * STEP 10 Phase A modules: CustomerGroup, SupplierGroup, ProductGroup —
 * confirmed at STEP 10.3A to share one identical flat-lookup-master shape
 * (same as MasterItemGroup/MasterSupplierGroup/OverHead from STEP 9): a
 * single `Name` field, `#GridDataList` grid, `.btnsave.sslSave`/`.sslUpdate`
 * buttons. Each is genuinely distinct from its similarly-named Master*
 * sibling already covered (separate controller/VM/repo, confirmed at
 * STEP 10.2) — do not conflate `SupplierGroupController` with
 * `MasterSupplierGroupController`, or `ProductGroupController` with
 * `MasterItemGroupController`. CustomerGroup's `Name` field has no
 * `.required` CSS class (validation is purely jQuery Unobtrusive);
 * SupplierGroup's and ProductGroup's `Name` DOES carry `.required` (also
 * checked by `CommonValidationHelper.CheckValidation`) — both paths block
 * the same way via `BasePage.clickSave()`'s existing `acceptIfPresent()`
 * handling, no special-casing needed. All three: Delete button confirmed
 * commented out on Index — no delete method here. Search fields confirmed
 * `["Code", "Name", "Description"]` for all three.
 */
export const customerGroupFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const customerGroupValidationMessages = {
  /** CustomerGroupVM.cs: [Required(ErrorMessage = "Customer Group Name is required.")] */
  nameRequired: 'Customer Group Name is required.',
};

export const supplierGroupFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const supplierGroupValidationMessages = {
  /** SupplierGroupVM.cs: [Required(ErrorMessage = "Supplier Group Name is required.")] */
  nameRequired: 'Supplier Group Name is required.',
};

export const productGroupFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const productGroupValidationMessages = {
  /** ProductGroupVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
};

/**
 * STEP 10 Phase A module: UOM, confirmed at STEP 10.3A against
 * Areas/DMS/Views/UOM/{Create,Index}.cshtml + UOMController.cs/.js +
 * UOMVM.cs. Same flat-master shape as above but with two confirmed
 * differences: (1) `.btnsave` click handler goes STRAIGHT to the
 * Confirmation dialog with no pre-check (`UOMController.js:12-24`) —
 * `form.valid()` only runs inside `save()`, called after the user confirms
 * (`UOMController.js:514-523`). This does not require any special
 * Playwright handling: `BasePage.clickSave()`'s `confirmDialog.acceptIfPresent()`
 * already accepts the dialog whenever it appears, which covers this
 * ordering identically to every other module — the negative test still
 * just calls `clickSave()` and asserts the validation message afterward.
 * (2) Delete has NO button at all on Index.cshtml, not even commented out
 * (stricter than the usual pattern) — no delete method here regardless.
 * Search fields confirmed `["Code", "Name", "Status"]`.
 */
export const uomFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
};
export const uomValidationMessages = {
  /** UOMVM.cs: [Required(ErrorMessage = "Name is required.")] */
  nameRequired: 'Name is required.',
};

/**
 * STEP 10 Phase A module: CompanyProfile, confirmed at STEP 10.3A against
 * Areas/SetUp/Views/CompanyProfile/Create.cshtml + CompanyProfileController.cs/.js
 * + CompanyProfileVM.cs.
 *
 * CONFIRMED CORRECTION to an earlier (STEP 10.2) finding: `FYearStart`/
 * `FYearEnd` are PLAIN, unenhanced text inputs on this Create form — the
 * `$("#FYearStart").kendoDatePicker({...})`/`$("#FYearEnd").kendoDatePicker({...})`
 * calls in `CompanyProfileController.js:12-16` are commented out, and no
 * other script in the solution initializes the `.btnrequisitiondate` class
 * as any widget (grepped — zero JS matches). Fill these with plain
 * `.fill()` in `yyyy-MM-dd` format (matches the grid's own display/parse
 * format, `CompanyProfileController.js:422,429`) — do NOT use the
 * `KendoDatePicker` component for this screen.
 *
 * Same confirm-before-validate ordering as UOM (`CompanyProfileController.js:26-33`
 * goes straight to Confirmation; `save()` validates after) — same
 * `clickSave()` handling applies, no special-casing needed.
 *
 * CONFIRMED: `Delete`'s `param.IDs = vm.IDs` is commented out server-side
 * (`CompanyProfileController.cs`) — a functional no-op — and the button is
 * also commented out on Index. No delete method here, per explicit
 * instruction not to test it.
 *
 * Six `[Required]` fields exist (CompanyName, CompanyLegalName, TelephoneNo,
 * Email, FYearStart, FYearEnd); only CompanyName's negative case is
 * exercised (PROP-COMPPROF-003), matching the approved scenario scope.
 * Search fields confirmed `["Code","CompanyName","TelephoneNo","FYearStart","FYearEnd","Status"]`.
 */
export const companyProfileFormSelectors = {
  companyName: '#CompanyName',
  companyNameValidationMessage: '[data-valmsg-for="CompanyName"]',
  companyLegalName: '#CompanyLegalName',
  telephoneNo: '#TelephoneNo',
  email: '#Email',
  fYearStart: '#FYearStart',
  fYearEnd: '#FYearEnd',
};
export const companyProfileValidationMessages = {
  /** CompanyProfileVM.cs: [Required] on CompanyName, no custom ErrorMessage, DisplayName("Company Name") -> MVC default. */
  companyNameRequired: 'The Company Name field is required.',
};

/**
 * STEP 10 Phase A module: Role (MenuAuthorizationController), confirmed at
 * STEP 10.3A against Areas/SetUp/Views/MenuAuthorization/{Role,RoleCreateEdit}.cshtml
 * + MenuAuthorizationController.cs/.js + UserRoleVM (ShampanPOS.Models/UserMenuAccess.cs).
 *
 * CONFIRMED DIFFERENT save-button class: this screen's Save/Update buttons
 * carry `.btnRoleSave` instead of the generic `.btnsave` every other
 * module in this project uses — `commonFormSelectors.saveButton`
 * (`.btnsave.sslSave`) will NOT match here. RolePage overrides
 * `clickSave()`/`clickUpdate()` rather than reusing BasePage's, mirroring
 * IncomeExpenseCategoryPage's precedent for the same kind of selector
 * divergence. Validation runs before the Confirmation dialog
 * (`MenuAuthorizationController.js:753-761`, standard ordering, unlike UOM/
 * CompanyProfile).
 *
 * CONFIRMED: `UserRoleVM` has NO `Code` property at all (like FiscalYear/
 * MasterSupplierItem) — `Name` (the grid's own confirmed search field) is
 * the per-test unique identifier instead. Grid container is `#RoleIndexDataList`,
 * NOT the default `#GridDataList`. No Delete action exists on the controller
 * at all. Edit link (`MenuAuthorizationController.js:378-382`) is icon-only
 * with no accessible name — `a.edit` clicked directly, same as Income/
 * Expense/MasterItem, not KendoGrid.clickRowAction().
 */
export const roleFormSelectors = {
  name: '#Name',
  nameValidationMessage: '[data-valmsg-for="Name"]',
  saveButton: '.btnRoleSave.sslSave',
  updateButton: '.btnRoleSave.sslUpdate',
};
export const roleValidationMessages = {
  /** UserRoleVM (UserMenuAccess.cs): [Required] on Name, no custom ErrorMessage, Display(Name="Role Name") -> MVC default. */
  nameRequired: 'The Role Name field is required.',
};

/**
 * STEP 10 Phase B module: CustomerAdvance, confirmed at STEP 10.3B against
 * Areas/DMS/Views/CustomerAdvance/{Create,Index}.cshtml +
 * CustomerAdvanceController.cs/.js + CustomerAdvanceVM.cs. Standalone
 * screen reached via `/DMS/CustomerAdvance/Index?id={customerId}` and
 * `/DMS/CustomerAdvance/Create?CustomerId={customerId}` — NOT an embedded
 * tab on Customer/Create.cshtml as originally assumed in STEP 10.1 (that
 * page has zero references to CustomerAdvance; the JS ids it binds to
 * exist nowhere in any view). Requires an existing Customer (STEP 5).
 * `AdvanceAmount` has `[Range(1,double.MaxValue,...)]` — a real,
 * server-enforced negative test. `PaymentEnumTypeId` is a working Kendo
 * MultiColumnComboBox (`/Common/Common/GetCompanyTypeList?value=PaymentType`,
 * confirmed to exist — same action CompanyProfile's CompanyTypeId combo
 * uses, just a different `value` filter); only client-JS-required, not a
 * VM `[Required]`. `MultiplePost` (the Index page's Post button) is
 * confirmed to call a controller action that does not exist — excluded
 * from scope, not converted into a test. No `Code` property on the VM —
 * the Customer's own unique Name is the identifying/search key instead.
 */
export const customerAdvanceFormSelectors = {
  advanceAmount: '#AdvanceAmount',
  advanceAmountValidationMessage: '[data-valmsg-for="AdvanceAmount"]',
  paymentEnumTypeId: 'PaymentEnumTypeId',
};
export const customerAdvanceValidationMessages = {
  /** CustomerAdvanceVM.cs: [Range(1, double.MaxValue, ErrorMessage = "Advance Amount must be greater than zero.")] */
  advanceAmountInvalid: 'Advance Amount must be greater than zero.',
};

/**
 * STEP 10 Phase B module: SupplierProduct, confirmed at STEP 10.3B against
 * Areas/DMS/Views/SupplierProduct/{Create,Index}.cshtml +
 * SupplierProductController.cs/.js + SupplierProductVM.cs. Standalone
 * screen reached via `/DMS/SupplierProduct/Index` -> New -> Create — NOT
 * an embedded tab on Supplier/Create.cshtml as originally assumed (that
 * page includes SupplierProductController.js but never calls its
 * `init()`; the visible product panel there is driven by separate,
 * duplicate logic inside SupplierController.js). Structurally identical to
 * the already-implemented MasterSupplierItem (STEP 9.2C): `SupplierId`
 * `[Required(ErrorMessage="Supplier is required.")]`, `class="required"`,
 * `#titleError2` indicator; `#departments`/`#AddedItemGrid` item-picker,
 * same two-gate save (`CommonValidationHelper.CheckValidation` +
 * `validateDropdown` on ProductGroupId + detail-count check). No `Code`
 * property on the VM — `SupplierName` (the grid's own confirmed search
 * field) is the identifying key. Edit link confirmed to carry
 * `title="Edit Credit Limit"` — KendoGrid.clickRowAction() applies
 * normally.
 */
export const supplierProductFormSelectors = {
  supplierId: 'SupplierId',
  supplierDropdownError: '#titleError2',
  productGroupId: 'ProductGroupId',
  departmentsGrid: '#departments',
  addedItemGrid: '#AddedItemGrid',
};

/**
 * STEP 10 Phase B modules: MasterItemProduct and MasterSupplierProduct,
 * confirmed at STEP 10.3B. Both are Create-only "convert an existing
 * Master* record into a real Product/Supplier" flows (no Edit/Delete/List
 * grid of their own beyond the picker), reached via a confirmed-live
 * button ("From Master Item" on Product/Index.cshtml; "From Master
 * Supplier" on Supplier/Index.cshtml).
 *
 * CONFIRMED: unlike SupplierProduct/MasterSupplierItem, neither screen's
 * `#departments` item-picker is filtered by a group combo — both
 * `GetProductGroupComboBox()`/`GetSupplierGroupComboBox()` calls are
 * commented out in their respective JS files, so `#departments` loads via
 * `autoBind:true` calling `/Common/Common/GetItemList` /
 * `/Common/Common/GetSupplierListByGroup` with NO filter value — i.e. ALL
 * existing MasterItems / MasterSuppliers in the system, paginated
 * (pageSize 10), with no search box. Finding a freshly-created record
 * requires paging through `#departments` (see MasterItemProductPage/
 * MasterSupplierProductPage's `findAndAddItem()`), not a simple filtered
 * lookup.
 *
 * CONFIRMED SECURITY GAP (source-verified verbatim, not tagged
 * @known-defect without separate approval): `MasterSupplierProductController.cs`
 * has no `[Authorize]`/`[RouteArea]` attribute on the class at all —
 * `public class MasterSupplierProductController : Controller`, unlike
 * every sibling controller including its own `MasterItemProductController`
 * counterpart (which DOES carry both attributes).
 *
 * `saveDone()` on both screens shows the server's own message (parsed for
 * "N added"/"N skipped" to pick a toastr type) — not a hardcoded string
 * like MasterSupplierItem/SupplierProduct — so tests assert only that a
 * non-empty success notification appears, not an exact string. The
 * "Add at least one detail." client-side message IS pinned exactly
 * (confirmed in both JS files).
 */
export const masterItemProductSelectors = {
  departmentsGrid: '#departments',
  addedItemGrid: '#AddedItemGrid',
};
export const masterSupplierProductSelectors = {
  departmentsGrid: '#departments',
  addedItemGrid: '#AddedItemGrid',
};
export const productPickerMessages = {
  atLeastOneDetailRequired: 'Add at least one detail.',
};

/**
 * STEP 10 Phase B module: RoleMenu (MenuAuthorizationController), confirmed
 * at STEP 10.3B against Areas/SetUp/Views/MenuAuthorization/{RoleMenu,RoleMenuCreateEdit}.cshtml.
 * Reached via `/SetUp/MenuAuthorization/RoleMenuEdit/{roleId}?roleName={name}`
 * (NOT the generic `Create()` action, which renders an empty checklist —
 * `RoleMenuEdit` is the real functional entry point despite its name,
 * since a role's menu assignment is inherently edit-an-existing-role's-
 * checklist, not create-a-new-blank-record). Depends on an existing Role
 * (STEP 10.3A). `RoleMenuVM` has NO `[Required]` attributes at all —
 * validation is purely "at least one checkbox checked"
 * (`userMenuSave`-equivalent `roleMenuSave()` in `MenuAuthorizationController.js`).
 * The header `.chkAll` checkbox selects every menu row in one click — used
 * here instead of picking a specific menu item by name, since menu names
 * are seed data this project must not hard-code. Save button is
 * `.btnRoleMenuSave.sslSave` (both top and bottom copies are identical,
 * `.first()` applies per the established double-button pattern). Grid
 * container `#RoleMenuIndexDataList`.
 */
export const roleMenuSelectors = {
  saveButton: '.btnRoleMenuSave.sslSave',
  selectAllCheckbox: '.chkAll',
};
export const roleMenuMessages = {
  /** MenuAuthorizationController.js roleMenuSave(): no checkbox checked. */
  noCheckboxSelected: 'Please Select CheckBox First!',
};

/**
 * STEP 10 Phase B module: UserProfile, confirmed at STEP 10.3B against
 * Areas/SetUp/Views/UserProfile/{Create,Index}.cshtml +
 * UserProfileController.cs/.js + UserProfileVM.cs. Default (new-user)
 * Create mode shows UserName/FullName/Password/ConfirmPassword/Email/
 * PhoneNumber/RoleId. `PhoneNumber` has
 * `[RegularExpression(@"^\d{11}$", ErrorMessage = "Please enter a valid 11-digit phone number.")]`
 * — the negative test target. `RoleId` has no `[Required]` and no
 * dropdown-required JS check found (grepped — none) — genuinely optional,
 * left blank. `Id` is a `string?`, not a numeric `Code` — no `Code`
 * property exists; `UserName` (unique per test) is the identifying key.
 * CONFIRMED: grid toolbar is `["excel","pdf"]` — no `"search"` entry, so
 * `KendoGrid.search()` (which targets `.k-grid-search input`) does not
 * apply here; `filterable: {extra:true}` column-filter menus exist
 * instead, but this phase's List/Edit scenarios avoid needing either by
 * capturing `#Id` directly from the post-save DOM update
 * (`UserProfileController.js` saveDone(): `$("#Id").val(result.Data.Id)`)
 * and/or raising the grid's own page-size selector to reduce pagination
 * risk. Edit action confirmed to have TWO links per row (title="profile
 * update" and title="password change", both class="edit") — this phase
 * only exercises the profile-update one, matched by its accessible title.
 * File upload is confirmed broken (JS posts to a different controller
 * entirely) — excluded from scope, not attempted.
 */
export const userProfileFormSelectors = {
  userName: '#UserName',
  userNameValidationMessage: '[data-valmsg-for="UserName"]',
  fullName: '#FullName',
  password: '#Password',
  confirmPassword: '#ConfirmPassword',
  email: '#Email',
  /** Additive, STEP 10.3C: same field, reused by SignUp (same UserProfileVM). */
  emailValidationMessage: '[data-valmsg-for="Email"]',
  phoneNumber: '#PhoneNumber',
  phoneNumberValidationMessage: '[data-valmsg-for="PhoneNumber"]',
};
export const userProfileValidationMessages = {
  /** UserProfileVM.cs: [RegularExpression(@"^\d{11}$", ErrorMessage = "Please enter a valid 11-digit phone number.")] */
  phoneNumberInvalid: 'Please enter a valid 11-digit phone number.',
  /** UserProfileVM.cs: [EmailAddress(ErrorMessage = "Please enter a valid email address.")] */
  emailInvalid: 'Please enter a valid email address.',
};

/**
 * STEP 10 Phase C — onboarding chain modules, confirmed at STEP 10.3C:
 * SignUp -> CompanyCreate -> BranchCreate. All three controllers carry no
 * `[Authorize]` (by design — pre-login/setup wizard, not a defect, unlike
 * MasterSupplierProductController's gap from STEP 10.3B).
 *
 * SignUp (`Areas/SetUp/Views/SignUp/SignUpCreate.cshtml`): fields
 * UserName/FullName/Email/Password/ConfirmPassword/PhoneNumber. CONFIRMED:
 * PhoneNumber has NO `@Html.ValidationMessageFor` span on this specific
 * view (unlike UserProfile's own Create.cshtml which does) — jQuery
 * Unobtrusive still blocks submission via the `[RegularExpression]` rule,
 * but there is nowhere for the message text to render, so the negative
 * phone test asserts the input gets jQuery Validate's standard
 * `input-validation-error` class and the page does not navigate, not an
 * exact message string. Email DOES have a message span, using the shared
 * `userProfileValidationMessages`/`userProfileFormSelectors` from STEP
 * 10.3B (same VM). No `CompanyName`/`RoleId` fields exist on this specific
 * screen — `SignUpCreateEdit` has no `ModelState.IsValid` check, so this
 * doesn't block Insert.
 *
 * CompanyCreate (`Areas/SetUp/Views/CompanyCreate/CompanyCreate.cshtml`):
 * identical field shape to the already-implemented CompanyProfile (STEP
 * 10.3A) — reuses `companyProfileFormSelectors`/`companyProfileValidationMessages`.
 * Reached via `/SetUp/CompanyCreate/Create?id={userId}` (confirmed exact
 * query param from `SignUpController.js:263`). On save success,
 * unconditionally redirects (800ms delay) to
 * `/DMS/BranchCreate/BranchCreate?companyId={id}&userId={userId}`
 * (`CompanyCreateController.js:484-489`) — `createCompany()` waits for
 * this redirect as its completion signal instead of the toastr, to avoid
 * a race between the assertion and the automatic navigation.
 *
 * BranchCreate (`Areas/DMS/Views/BranchProfile/BranchCreate.cshtml` +
 * `BranchCreateController.cs`): same field shape as the already-implemented
 * BranchProfile (STEP 9.2B) — reuses `branchProfileFormSelectors`/
 * `branchProfileValidationMessages`. Same confirmed duplicate `#Name`
 * defect (HiddenFor + real TextBoxFor) — `.last()`. CONFIRMED: `save()`
 * calls `CommonService.validateDropdown` against `#ParentId`/`#EnumTypeId`/
 * `#AreaId`, none of which exist in this view's DOM (all commented out or
 * absent) — `validateDropdown`'s `$(selector).val()?.trim()` safely
 * returns `undefined` for a nonexistent selector (no throw), so these
 * checks trivially pass; no special handling needed. On success,
 * unconditionally redirects (800ms delay) to `/Login/Index`
 * (`BranchCreateController.js:1038,1049`) — the definitive completion
 * signal for the whole onboarding chain.
 */
export const branchCreateRoute = (companyId: string, userId: string): string =>
  `/DMS/BranchCreate/BranchCreate?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(userId)}`;

/**
 * STEP 10 Phase C module: Registration, confirmed at STEP 10.3C against
 * Areas/SetUp/Views/Registration/RegistrationCreate.cshtml +
 * RegistrationController.cs. Public pre-login screen (`unauthenticated`
 * project), reachable via `Login/Index.cshtml`'s "Create Account" link.
 * `RegistrationCreateEdit` binds `UserProfileVM` (not `RegistrationVM`,
 * despite the view being strongly-typed to `RegistrationVM`) — matching
 * field names (FullName/Password/ConfirmPassword/CompanyName/EmailAsLoginId)
 * bind correctly regardless. CONFIRMED: `PhoneNumber` has no
 * `@Html.ValidationMessageFor` span here either (same gap as SignUp) — the
 * negative scenario targets `CompanyName` instead
 * (`[Required(ErrorMessage="Company Name is required.")]` on
 * `RegistrationVM`, which DOES have a rendered message span), a safely
 * exact-assertable negative case. Save button is standard `.btnsave.sslSave`
 * (`type="submit"`, but `e.preventDefault()` confirmed — no native
 * navigation risk), validated before any confirmation, standard ordering.
 */
export const registrationFormSelectors = {
  fullName: '#FullName',
  emailAsLoginId: '#EmailAsLoginId',
  phoneNumber: '#PhoneNumber',
  password: '#Password',
  confirmPassword: '#ConfirmPassword',
  companyName: '#CompanyName',
  companyNameValidationMessage: '[data-valmsg-for="CompanyName"]',
  companyAddress: '#CompanyAddress',
};
export const registrationValidationMessages = {
  /** RegistrationVM.cs: [Required(ErrorMessage = "Company Name is required.")] */
  companyNameRequired: 'Company Name is required.',
};

/**
 * STEP 10 Phase C module: UserBranchProfile, confirmed at STEP 10.3C
 * against Areas/SetUp/Views/UserBranchProfile/Index.cshtml +
 * Areas/Common/Views/Common/_branchLoading.cshtml +
 * UserBranchProfileController.cs. CONFIRMED CORRECTION: the standalone
 * `/SetUp/UserBranchProfile/Create` page is NOT the real entry point —
 * its `Create()` action never receives/sets a `UserId` at all. The real,
 * working Create mechanism is the `.btnBranch` button on the Index page
 * (reached via `/SetUp/UserBranchProfile/Index/{userId}`), which opens a
 * Bootstrap modal (`#partialModal`) fetched from
 * `/Common/Common/BranchLoading?UserId={userId}` (confirmed to exist and
 * correctly bind UserId) containing a select2 multi-select
 * (`#multiBranchId`, populated from the confirmed-working
 * `/Common/Common/GetBranchList`) and its own `.sslSave` button posting to
 * `/SetUp/UserBranchProfile/CreateEdit`. This screen has no
 * [Required]-validated fields of its own to negative-test — only
 * List/Create/Edit were approved. `UserBranchProfileController` DOES carry
 * `[Authorize]` (unlike the onboarding-chain controllers above — this one
 * is a normal authenticated SetUp screen). No Delete action exists
 * anywhere (UI or API tier) — confirmed at STEP 10.2, unchanged.
 */
export const userBranchProfileSelectors = {
  openModalButton: '.btnBranch',
  branchMultiSelect: '#multiBranchId',
  modalSaveButton: '#partialModal .sslSave',
};

/**
 * STEP 10 Phase C module: Settings, confirmed at STEP 10.3C against
 * Areas/SetUp/Views/Settings/{Index,_Setting}.cshtml + SettingsController.cs.
 * Confirmed singleton (no Create/Delete). Each setting row renders its OWN
 * plain HTML `<form>` (`Html.BeginForm("Edit","Settings")`, NOT AJAX) —
 * submitting reloads the whole Index page via `RedirectToAction("Index")`
 * with the result message in `TempData["UpdateSettings"]`. CONFIRMED RISK:
 * `_Setting.cshtml` is rendered once per row via `@Html.Partial` in a
 * `foreach` loop with no `Html.BeginCollectionItem`-style id-uniquification
 * — every row's `SettingValue` input renders the SAME id
 * (`id="SettingValue"`), so a bare `#SettingValue` selector would be
 * ambiguous across multiple settings rows. `SettingsController.Index()`
 * unconditionally inserts/ensures a `SettingGroup="DMSApiUrl"` row on
 * every load — this is the one row this project can rely on always
 * existing, and is targeted by scoping to the row containing that text
 * rather than a bare id selector.
 */
export const settingsSelectors = {
  settingRowByGroup: (group: string) => `.row:has-text("${group}")`,
};

/**
 * Customer Collection Due report — confirmed directly from source
 * (Areas/DMS/Controllers/SaleController.cs's CustomerCollectionDueIndex()/
 * CustomerCollectionDueList() actions + Areas/DMS/Views/Sale/
 * CustomerCollectionDueIndex.cshtml + Areas/DMS/Views/Sale/Reports/
 * CustomerCollectionDueReport.cshtml), added for the cross-module E2E sales
 * lifecycle flow (Login -> Customer -> Product -> SaleOrder -> Sale ->
 * Collection -> Due -> Report -> Logout). NOT part of the approved
 * 267-test coverage baseline (config/coverage-baseline.ts).
 *
 * CONFIRMED: this report is structurally unlike every other module's grid —
 * the entry screen's Customer picker is a one-off Kendo popup grid (own
 * container ids, not the shared KendoGrid/gridContainerSelectors
 * convention), and the report OUTPUT is a plain, non-Kendo, server-rendered
 * HTML `<table>` with no `data-field` attributes — read by column position
 * in ReportPage.ts, not by KendoGrid. CONFIRMED: the report opens in a NEW
 * browser tab (`window.open(url, "_blank")` in
 * CustomerCollectionDueIndex.cshtml's `PrintCustomerCollectionDue()`),
 * triggered by a plain `<button onclick="...">` with no `id` or
 * distinguishing class — targeted by its accessible role/name instead
 * (`printButtonName`, same pattern as `logoutSelectors.accessibleName`).
 * Exact live-render popup timing and the new-tab open behavior under
 * Playwright automation were NOT independently confirmed against a running
 * instance — see ReportPage.ts's own header comment / the E2E design
 * record's Blocker 1 report.
 */
export const customerCollectionDueSelectors = {
  customerNameInput: '#CustomerName',
  customerIdInput: '#CustomerId',
  customerCodeInput: '#CustomerCode',
  customerSearchButton: '#btnCustomerSearch',
  customerWindow: '#customerWindow',
  customerGrid: '#customerGrid',
  clearCustomerButton: '#btnClearCustomer',
  /** Accessible name only — confirmed no `id`/unique class exists on this button. */
  printButtonName: 'Print',
  /** Confirmed `<div class="table-responsive"><table>...` — the `<table>` itself carries no id/class of its own. */
  reportTable: '.table-responsive table',
};

/**
 * Stock report — confirmed directly from source (Areas/DMS/Controllers/
 * ProductController.cs's StockIndex()/ReportList() actions + Areas/DMS/Views/
 * Product/StockIndex.cshtml + Areas/DMS/Views/Product/Reports/
 * StockSummaryReport.cshtml), added for the Purchase-lifecycle E2E flow.
 *
 * CONFIRMED: there is no dedicated "Stock" controller — this lives on
 * ProductController. The entry screen's Product picker is a one-off Kendo
 * popup grid (`#purchaseDetailsWindow`/`#purchaseDetailsGrid`, reading the
 * same shared `/Common/Common/GetProductModal` endpoint the transaction
 * line-item popups use, but its own container ids — NOT the shared
 * KendoGrid/gridContainerSelectors convention). CONFIRMED: selection is a
 * double-click on the popup grid's `tr` (`$("#purchaseDetailsGrid")
 * .on("dblclick", "tr", ...)`), same interaction shape as every other popup
 * grid in this project. CONFIRMED: Print (`PrintPurchaseReport()`, a plain
 * `<button onclick="...">` with no id/unique class) opens a NEW browser tab
 * via `window.open(url, "_blank")`; the report itself is a plain,
 * server-rendered HTML `<table>` with no `data-field` attributes — read by
 * column position, same pattern as `customerCollectionDueSelectors`/
 * `ReportPage.ts`. `#IsSummary` is a bootstrap-switch toggle (reuse
 * `components/BootstrapSwitch.ts`, not a new helper) — the Summary report's
 * "Closing Stock" column (confirmed bound to `StockVM.StockInHand`) is the
 * current-stock-quantity field this flow verifies.
 */
export const stockReportSelectors = {
  productSearchButton: '#btnProductSearch',
  productWindow: '#purchaseDetailsWindow',
  productGrid: '#purchaseDetailsGrid',
  productNameInput: '#ProductName',
  clearProductButton: '#btnClearProduct',
  isSummaryToggle: 'IsSummary',
  /** Accessible name only — confirmed no `id`/unique class exists on this button. */
  printButtonName: 'Print',
  /** Confirmed `<div class="report-box"><table>` (header) then a second, sibling `<table>` (the data grid) — take `.last()`. */
  reportTable: '.report-box table',
};

/**
 * VAT-LIFECYCLE-PHASE-2 addition — "Purchase Report" (`Areas/DMS/Controllers/
 * PurchaseController.cs`'s `PurchaseIndex()`/`ReportList()` actions +
 * `Views/Purchase/PurchaseIndex.cshtml` + `Views/Purchase/PurchaseListReport.cshtml`).
 * The one report in the whole application confirmed (VAT-lifecycle
 * investigation, Phase 1) to actually surface VAT/SD as real report
 * columns — every other report (Supplier Purchase & Payment, Customer Sale
 * & Collection, Stock) omits them entirely. Structurally near-identical to
 * `stockReportSelectors` above (same product popup ids — `#btnProductSearch`/
 * `#purchaseDetailsWindow`/`#purchaseDetailsGrid`/`#ProductName` — confirmed
 * from source to be the exact same shared popup markup, not a coincidence)
 * plus a `SupplierId` Kendo MultiColumnComboBox this report also exposes
 * (not used by `PurchaseReportPage.ts` — selecting only a Product already
 * satisfies `PrintPurchaseReport()`'s own client-side "must pick at least
 * one filter" validation, confirmed from source).
 *
 * CORRECTION (confirmed live, superseding the `PurchaseListReport.cshtml`
 * source-only reading originally cited here): with a Product filter
 * applied, `ReportList` actually renders a DIFFERENT, simpler template
 * ("Product Wise Details Report") than `PurchaseListReport.cshtml`'s own
 * documented column set — live-confirmed 8 columns: Product, Purchase
 * Order Code (actually the Purchase's own Code, despite the label),
 * Invoice Date, Purchase Date, Quantity, Sub Total, VAT, Total — no
 * separate Unit Price/SD/VAT Rate columns at all (VAT Amount shown
 * directly as "VAT"). See `PurchaseReportPage.getRowValues()`'s own doc
 * comment for the live evidence (a captured screenshot whose values
 * matched this project's own VAT-lifecycle calculations exactly). SD is
 * not represented as a report column in this rendering at all — a real
 * Application Finding, not an automation gap.
 */
export const purchaseReportSelectors = {
  productSearchButton: '#btnProductSearch',
  productWindow: '#purchaseDetailsWindow',
  productGrid: '#purchaseDetailsGrid',
  productNameInput: '#ProductName',
  isSummaryToggle: 'IsSummary',
  /** Accessible name only — confirmed no `id`/unique class exists on this button (`<button onclick="PrintPurchaseReport()">`). */
  printButtonName: 'Print',
  /** Confirmed `<div class="report-box"><table>` (header) then a second, sibling `<table>` (the data grid) — take `.last()`, same convention as every other report page. */
  reportTable: '.report-box table',
};

/**
 * "Supplier Ledger" substitute — CONFIRMED at the Purchase-lifecycle
 * investigation step that no dedicated Supplier Ledger module exists
 * anywhere in this application (no controller action, no view, on
 * SupplierController.cs or elsewhere — exhaustive `ledger`/`Ledger` search
 * across the whole ShampanPOSUI tree found none). The nearest real,
 * functional analog — confirmed directly from source
 * (Areas/DMS/Controllers/PurchaseController.cs's
 * SupplierPurchasePaymentReportIndex()/SupplierPurchasePaymentReportList()
 * actions + Areas/DMS/Views/Purchase/SupplierPurchasePaymentReportIndex.cshtml
 * + Areas/DMS/Views/Purchase/Reports/SupplierPurchasePaymentSummary.cshtml) —
 * is a per-Supplier Purchase-vs-Payment report. Same structural shape as
 * `stockReportSelectors` above: one-off popup picker
 * (`#supplierWindow`/`#supplierGrid`, reading `/Common/Common/GetSupplierModal`,
 * dblclick-to-select), `#IsSummary` bootstrap-switch, Print opens a new tab,
 * plain server-rendered `<table>`. CONFIRMED Summary-mode columns (one row
 * per Supplier): Supplier Name (Code), Total Purchase Amount, Total Payment
 * Amount, Outstanding Amount — `OutstandingAmount` (Purchase − Payment) is
 * this flow's "Correct Balance" verification field.
 */
export const supplierLedgerSelectors = {
  supplierSearchButton: '#btnSupplierSearch',
  supplierWindow: '#supplierWindow',
  supplierGrid: '#supplierGrid',
  supplierNameInput: '#SupplierName',
  /** Hidden input, confirmed from source (`<input type="hidden" id="SupplierId" />`); see SupplierLedgerPage.selectSupplierDirectly()'s doc comment for why this is set directly rather than only through the picker popup. */
  supplierIdInput: '#SupplierId',
  clearSupplierButton: 'ClearSupplier',
  isSummaryToggle: 'IsSummary',
  /** Accessible name only — confirmed no `id`/unique class exists on this button. */
  printButtonName: 'Print',
  /** Same `.report-box table` shape as stockReportSelectors — take `.last()`. */
  reportTable: '.report-box table',
};

/**
 * "Customer Sale & Collection Report" — Areas/DMS/Controllers/SaleController.cs's
 * CustomerSaleCollectionReportIndex()/CustomerSaleCollectionReportList() actions
 * (route: /DMS/Sale/CustomerSaleCollectionReportIndex) +
 * Areas/DMS/Views/Sale/CustomerSaleCollectionReportIndex.cshtml +
 * Areas/DMS/Views/Sale/Reports/CustomerSaleCollectionSummary.cshtml — the
 * Customer-side analog of supplierLedgerSelectors' Supplier Purchase &
 * Payment report, confirmed structurally identical: `#CustomerId`/
 * `#CustomerName` fields read directly by PrintCustomerSaleCollectionReport()
 * (the `#btnCustomerSearch` popup, backed by /Common/Common/GetCustomerModal,
 * is only a UI convenience for populating them, same as supplierLedgerSelectors'
 * own popup — see CustomerSaleCollectionReportPage.selectCustomerDirectly()),
 * `#IsSummary` bootstrap-switch, Print opens a new tab, plain server-rendered
 * `.report-box table`. CONFIRMED Summary-mode columns (one row per Customer):
 * Customer Name (Code), Total Sale Amount, Total Collection Amount,
 * Outstanding Amount.
 */
export const customerSaleCollectionReportSelectors = {
  customerSearchButton: '#btnCustomerSearch',
  customerNameInput: '#CustomerName',
  /** Hidden input, confirmed from source (`<input type="hidden" id="CustomerId" />`). */
  customerIdInput: '#CustomerId',
  isSummaryToggle: 'IsSummary',
  /** Accessible name only — confirmed no `id`/unique class exists on this button. */
  printButtonName: 'Print',
  /** Same `.report-box table` shape as supplierLedgerSelectors — take `.last()`. */
  reportTable: '.report-box table',
};

export type ModuleName =
  | 'Product'
  | 'Customer'
  | 'Supplier'
  | 'PurchaseOrder'
  | 'Purchase'
  | 'PurchaseReturn'
  | 'SaleOrder'
  | 'Sale'
  | 'SaleReturn';
