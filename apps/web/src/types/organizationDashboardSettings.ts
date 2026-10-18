export type DashboardStatKey =
  | "documents"
  | "metadata"
  | "awaiting"
  | "review"
  | "linked"
  | "unlinked";

export type DashboardHeaderStyle = "SOLID" | "GRADIENT" | "IMAGE";
export type DashboardTheme = "LIGHT" | "DARK" | "SYSTEM";
export type DashboardLayout = "COMFORTABLE" | "COMPACT";
export type CompanyProfile =
  | "GENERAL"
  | "GOVERNMENT"
  | "HEALTHCARE"
  | "AVIATION"
  | "LEGAL"
  | "EDUCATION"
  | "OTHER";

export type OrganizationDashboardSettings = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  sidebarBackgroundColor: string;
  sidebarTextColor: string;
  sidebarActiveColor: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  surfaceColor: string;
  borderColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonHoverColor: string;
  headerStyle: DashboardHeaderStyle;
  dashboardBackgroundFade: number;
  brandingImages?: Partial<Record<"SIDEBAR" | "DASHBOARD" | "INTRODUCTION", string>>;
  theme: DashboardTheme;
  dashboardLayout: DashboardLayout;
  companyProfile: CompanyProfile;
  showWelcomePanel: boolean;
  visibleStatCards: DashboardStatKey[];
};

export const DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS:
  OrganizationDashboardSettings = {
    primaryColor: "#172554",
    accentColor: "#6366F1",
    backgroundColor: "#F8FAFC",
    textColor: "#000000",
    headerBackgroundColor: "#172554",
    headerTextColor: "#FFFFFF",
    sidebarBackgroundColor: "#FFFFFF",
    sidebarTextColor: "#000000",
    sidebarActiveColor: "#172554",
    footerBackgroundColor: "#FFFFFF",
    footerTextColor: "#000000",
    surfaceColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    buttonBackgroundColor: "#4F46E5",
    buttonTextColor: "#FFFFFF",
    buttonHoverColor: "#4338CA",
    headerStyle: "SOLID",
    dashboardBackgroundFade: 0,
    brandingImages: {},
    theme: "LIGHT",
    dashboardLayout: "COMFORTABLE",
    companyProfile: "GENERAL",
    showWelcomePanel: true,
    visibleStatCards: [
      "documents",
      "metadata",
      "awaiting",
      "review",
      "linked",
      "unlinked",
    ],
  };

