import { test as masters6FixtureTest, Masters6Fixtures } from './masters6.fixture';
import { SignUpPage } from '../pages/setup/SignUpPage';
import { CompanyCreatePage } from '../pages/setup/CompanyCreatePage';
import { BranchCreatePage } from '../pages/masters/BranchCreatePage';
import { RegistrationPage } from '../pages/setup/RegistrationPage';
import { UserBranchProfilePage } from '../pages/setup/UserBranchProfilePage';
import { SettingsPage } from '../pages/setup/SettingsPage';
import { uniqueCode } from '../utils/random-data';

/**
 * STEP 10 Phase C — page objects for the onboarding chain
 * (SignUp -> CompanyCreate -> BranchCreate), Registration,
 * UserBranchProfile, and Settings. Extends masters6.fixture.ts rather
 * than modifying it, per STEP 10.3C scope.
 */
export interface Masters7Fixtures extends Masters6Fixtures {
  signUpPage: SignUpPage;
  companyCreatePage: CompanyCreatePage;
  branchCreatePage: BranchCreatePage;
  registrationPage: RegistrationPage;
  userBranchProfilePage: UserBranchProfilePage;
  settingsPage: SettingsPage;
  /** Performs a real SignUp and returns the new user's Id — the onboarding chain's entry point. */
  signedUpUserPrerequisite: () => Promise<{ userId: string }>;
  /** Performs SignUp then CompanyCreate, following the app's own confirmed redirect — BranchCreate's prerequisite. */
  companyCreatedPrerequisite: () => Promise<{ companyId: string; userId: string }>;
}

export const test = masters6FixtureTest.extend<Masters7Fixtures>({
  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page));
  },
  companyCreatePage: async ({ page }, use) => {
    await use(new CompanyCreatePage(page));
  },
  branchCreatePage: async ({ page }, use) => {
    await use(new BranchCreatePage(page));
  },
  registrationPage: async ({ page }, use) => {
    await use(new RegistrationPage(page));
  },
  userBranchProfilePage: async ({ page }, use) => {
    await use(new UserBranchProfilePage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },

  signedUpUserPrerequisite: async ({ signUpPage }, use) => {
    await use(async () => {
      const userName = uniqueCode('ONBSIGNUP');
      const userId = await signUpPage.createSignUp({
        userName,
        fullName: `Automation Onboarding ${userName}`,
        email: `${userName.toLowerCase()}@example.com`,
        password: 'Automation@123',
        phoneNumber: '01700000000',
      });
      return { userId };
    });
  },

  companyCreatedPrerequisite: async ({ signedUpUserPrerequisite, companyCreatePage }, use) => {
    await use(async () => {
      const { userId } = await signedUpUserPrerequisite();
      const companyName = uniqueCode('ONBCOMPANY');
      const fYearStart = new Date();
      const fYearEnd = new Date(fYearStart);
      fYearEnd.setFullYear(fYearEnd.getFullYear() + 1);
      fYearEnd.setDate(fYearEnd.getDate() - 1);
      const toIso = (d: Date) => d.toISOString().slice(0, 10);

      const { companyId, userId: resolvedUserId } = await companyCreatePage.createCompany(userId, {
        companyName,
        companyLegalName: `Automation Legal ${uniqueCode('LEGAL')}`,
        telephoneNo: '01700000000',
        email: `${companyName.toLowerCase()}@example.com`,
        fYearStart: toIso(fYearStart),
        fYearEnd: toIso(fYearEnd),
      });
      return { companyId, userId: resolvedUserId };
    });
  },
});

export { expect } from '@playwright/test';
