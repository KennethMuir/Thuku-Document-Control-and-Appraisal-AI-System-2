"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getOrganizationDashboardSettings,
  saveOrganizationDashboardSettings,
} from "@/lib/api/organizationDashboardSettings";

import { BrandingImageControl } from "@/components/settings/BrandingImageControl";
import {
  DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
} from "@/types/organizationDashboardSettings";

import type {
  CompanyProfile,
  DashboardHeaderStyle,
  DashboardLayout,
  DashboardStatKey,
  DashboardTheme,
  OrganizationDashboardSettings,
} from "@/types/organizationDashboardSettings";

const COLOR_FIELDS = [
  { key: "primaryColor", label: "Primary brand color", description: "Brand identity and primary accents." },
  { key: "accentColor", label: "Accent color", description: "Highlights and visual accents." },
  { key: "backgroundColor", label: "Workspace background", description: "Main application workspace background." },
  { key: "textColor", label: "Default text color", description: "Main workspace text. Defaults to black." },
  { key: "headerBackgroundColor", label: "Header background", description: "Top navigation background." },
  { key: "headerTextColor", label: "Header text", description: "Text displayed in the top navigation." },
  { key: "sidebarBackgroundColor", label: "Sidebar background", description: "Main navigation background." },
  { key: "sidebarTextColor", label: "Sidebar text", description: "Navigation labels and sidebar text." },
  { key: "sidebarActiveColor", label: "Active navigation color", description: "Selected navigation item accent." },
  { key: "footerBackgroundColor", label: "Footer background", description: "Background for footer areas." },
  { key: "footerTextColor", label: "Footer text", description: "Text displayed in footer areas." },
  { key: "surfaceColor", label: "Card and panel background", description: "Cards, panels, and content surfaces." },
  { key: "borderColor", label: "Borders and dividers", description: "Panel borders, input borders, and dividers." },
  { key: "buttonBackgroundColor", label: "Button background", description: "Background color for primary action buttons." },
  { key: "buttonTextColor", label: "Button text", description: "Text color for primary action buttons." },
  { key: "buttonHoverColor", label: "Button hover background", description: "Background color when hovering over primary action buttons." },] as const;

const STAT_FIELDS: {
  key: DashboardStatKey;
  label: string;
  description: string;
}[] = [
  {
    key: "documents",
    label: "Total Documents",
    description: "All stored documents.",
  },
  {
    key: "metadata",
    label: "Metadata Records",
    description: "Registered metadata records.",
  },
  {
    key: "awaiting",
    label: "Awaiting Documents",
    description: "Metadata awaiting a file.",
  },
  {
    key: "review",
    label: "Needs Review",
    description: "Potential matches awaiting review.",
  },
  {
    key: "linked",
    label: "Linked Documents",
    description: "Documents matched to metadata.",
  },
  {
    key: "unlinked",
    label: "Unlinked Documents",
    description: "Documents awaiting appraisal.",
  },
];

const PROFILE_OPTIONS: {
  value: CompanyProfile;
  label: string;
}[] = [
  { value: "GENERAL", label: "General organization" },
  { value: "GOVERNMENT", label: "Government / Public sector" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "AVIATION", label: "Aviation" },
  { value: "LEGAL", label: "Legal" },
  { value: "EDUCATION", label: "Education" },
  { value: "OTHER", label: "Other" },
];

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export function DashboardCustomization() {
  const [settings, setSettings] =
    useState<OrganizationDashboardSettings>(
      DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
    );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    let requestVersion = 0;

    const reloadSettings = async () => {
      const version = ++requestVersion;

      try {
        const result = await getOrganizationDashboardSettings();

        if (active && version === requestVersion && result.settings) {
          setSettings({
            ...DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
            ...result.settings,
          });
        }
      } catch (cause: unknown) {
        if (active && version === requestVersion) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load dashboard settings.",
          );
        }
      } finally {
        if (active && version === requestVersion) {
          setLoading(false);
        }
      }
    };

    const handleSettingsUpdated = () => {
      void reloadSettings();
    };

    void reloadSettings();

    window.addEventListener(
      "organization-dashboard-settings-updated",
      handleSettingsUpdated,
    );
    window.addEventListener(
      "organization-selection-changed",
      handleSettingsUpdated,
    );

    return () => {
      active = false;
      window.removeEventListener(
        "organization-dashboard-settings-updated",
        handleSettingsUpdated,
      );
      window.removeEventListener(
        "organization-selection-changed",
        handleSettingsUpdated,
      );
    };
  }, []);

  function updateSetting<K extends keyof OrganizationDashboardSettings>(
    key: K,
    value: OrganizationDashboardSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
    setNotice("");
  }

  function updateColor(
    key: (typeof COLOR_FIELDS)[number]["key"],
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
    setNotice("");
  }

  function toggleStatCard(key: DashboardStatKey, checked: boolean) {
    setSettings((current) => ({
      ...current,
      visibleStatCards: checked
        ? [...current.visibleStatCards, key]
        : current.visibleStatCards.filter((item) => item !== key),
    }));
    setError("");
    setNotice("");
  }

  async function handleSave() {
    setError("");
    setNotice("");

    const colorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const invalidColor = COLOR_FIELDS.find(
      (field) => !colorPattern.test(settings[field.key]),
    );

    if (invalidColor) {
      setError(`${invalidColor.label} must be a valid HEX color, such as #172554.`);
      return;
    }

    setSaving(true);

    try {
      const result = await saveOrganizationDashboardSettings(settings);

      if (!result.settings) {
        throw new Error("The server did not return saved dashboard settings.");
      }

      setSettings({
        ...DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
        ...result.settings,
      });
      setNotice("Dashboard settings saved successfully.");
      window.dispatchEvent(new Event("organization-dashboard-settings-updated"));
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save dashboard settings. Your edits are still available.",
      );
    } finally {
      setSaving(false);
    }
  }

  const previewCards = STAT_FIELDS.filter(
    (field) => settings.visibleStatCards.includes(field.key),
  );

  const headerBackground =
    settings.headerStyle === "GRADIENT"
      ? `linear-gradient(120deg, ${settings.primaryColor}, ${settings.accentColor})`
      : settings.headerBackgroundColor;

  const darkMode = settings.theme === "DARK";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">
          Organization personalization
        </p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">
          Company Branding &amp; Dashboard
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Personalize your organization&apos;s dashboard, brand colors,
          workspace density, and the information displayed to your team.
          Changes take effect on the dashboard after you save.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading your organization&apos;s dashboard settings...
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <SettingsSection
              title="Brand colors"
              description="Use the color picker or enter a HEX value. The preview updates as you edit."
            >
              {COLOR_FIELDS.map((field) => {
                const color = settings[field.key];
                const validColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);

                return (
                  <div
                    key={field.key}
                    className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                  >
                    <div
                      className="h-12 w-12 shrink-0 rounded-xl border border-slate-200"
                      style={{ backgroundColor: validColor ? color : "#FFFFFF" }}
                    />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`color-${field.key}`}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        {field.label}
                      </label>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {field.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <input
                          type="color"
                          aria-label={`${field.label} color picker`}
                          value={validColor ? color : "#172554"}
                          onChange={(event) =>
                            updateColor(field.key, event.target.value.toUpperCase())
                          }
                          className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                        />
                        <input
                          id={`color-${field.key}`}
                          type="text"
                          value={color}
                          maxLength={7}
                          spellCheck={false}
                          onChange={(event) =>
                            updateColor(field.key, event.target.value)
                          }
                          placeholder="#172554"
                          className="w-32 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </SettingsSection>

            <SettingsSection
              title="Dashboard appearance"
              description="Choose a presentation style suited to your organization."
            >
              <div>
                <label htmlFor="company-profile" className="mb-2 block text-sm font-semibold text-slate-800">
                  Organization profile
                </label>
                <select
                  id="company-profile"
                  value={settings.companyProfile}
                  onChange={(event) =>
                    updateSetting("companyProfile", event.target.value as CompanyProfile)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {PROFILE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="header-style" className="mb-2 block text-sm font-semibold text-slate-800">
                  Header style
                </label>
                <select
                  id="header-style"
                  value={settings.headerStyle}
                  onChange={(event) =>
                    updateSetting("headerStyle", event.target.value as DashboardHeaderStyle)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="SOLID">Solid brand color</option>
                  <option value="GRADIENT">Brand gradient</option>
                  <option value="IMAGE">Image header (upload support is a separate milestone)</option>
                </select>
              </div>

              <div>
                <label htmlFor="dashboard-theme" className="mb-2 block text-sm font-semibold text-slate-800">
                  Theme
                </label>
                <select
                  id="dashboard-theme"
                  value={settings.theme}
                  onChange={(event) =>
                    updateSetting("theme", event.target.value as DashboardTheme)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="LIGHT">Light</option>
                  <option value="DARK">Dark</option>
                  <option value="SYSTEM">System default</option>
                </select>
              </div>

              <div>
                <label htmlFor="dashboard-layout" className="mb-2 block text-sm font-semibold text-slate-800">
                  Dashboard density
                </label>
                <select
                  id="dashboard-layout"
                  value={settings.dashboardLayout}
                  onChange={(event) =>
                    updateSetting("dashboardLayout", event.target.value as DashboardLayout)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="COMFORTABLE">Comfortable spacing</option>
                  <option value="COMPACT">Compact spacing</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Welcome panel
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Show or hide the dashboard introduction.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.showWelcomePanel}
                  onChange={(event) =>
                    updateSetting("showWelcomePanel", event.target.checked)
                  }
                  className="h-5 w-5 accent-indigo-600"
                />
              </label>
            </SettingsSection>
          </div>

          <SettingsSection
            title="Organization images"
            description="Upload separate images for the navigation sidebar, dashboard workspace, and welcome panel. Images are saved for the currently selected organization."
          >
            <div className="space-y-4">
              <BrandingImageControl
                slot="SIDEBAR"
                title="Sidebar background"
                description="Background image for the left navigation sidebar."
                configured={Boolean(settings.brandingImages?.SIDEBAR)}
              />
              <BrandingImageControl
                slot="DASHBOARD"
                title="Dashboard workspace background"
                description="Background image behind the dashboard content. The fade slider will be available in the rendering milestone."
                configured={Boolean(settings.brandingImages?.DASHBOARD)}
              />
              <BrandingImageControl
                slot="INTRODUCTION"
                title="Welcome panel background"
                description="Background image for the dashboard introduction panel."
                configured={Boolean(settings.brandingImages?.INTRODUCTION)}
              />
            </div>
          </SettingsSection>
          <SettingsSection
            title="Dashboard information"
            description="Select which statistic cards appear on your dashboard. At least one card may be hidden; your document data is not changed."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {STAT_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <input
                    type="checkbox"
                    checked={settings.visibleStatCards.includes(field.key)}
                    onChange={(event) =>
                      toggleStatCard(field.key, event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-indigo-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {field.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {field.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            title="Live preview"
            description="Preview the selected colors, header style, theme, and visible statistic cards."
          >
            <div
              className="overflow-hidden rounded-2xl border border-slate-200"
              style={{
                backgroundColor: settings.backgroundColor,
                color: settings.textColor,
              }}
            >
              {settings.showWelcomePanel && (
                <div
                  className="p-5 sm:p-7"
                  style={{
                    background: settings.headerStyle === "GRADIENT"
                      ? headerBackground
                      : settings.headerBackgroundColor,
                    color: settings.headerTextColor,
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                    {settings.companyProfile.replaceAll("_", " ")} workspace
                  </p>
                  <h4 className="mt-2 text-xl font-bold sm:text-2xl">
                    Records Intelligence
                  </h4>
                  <p className="mt-2 max-w-xl text-sm leading-6 opacity-85">
                    Your organization&apos;s documents, metadata, and appraisal activity in one place.
                  </p>
                </div>
              )}

              <div
                className={`grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 ${
                  settings.dashboardLayout === "COMPACT" ? "gap-2" : ""
                }`}
              >
                {previewCards.length === 0 ? (
                  <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-5 text-sm">
                    No statistic cards selected. Choose cards above to display them.
                  </p>
                ) : (
                  previewCards.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-xl border p-4"
                      style={{
                        color: settings.textColor,
                        backgroundColor: settings.surfaceColor,
                        borderColor: settings.borderColor,
                        borderTopWidth: "3px",
                        borderTopColor: settings.accentColor,
                      }}
                    >
                      <p className="text-xs opacity-70">{field.label}</p>
                      <p className="mt-2 text-xl font-bold">—</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            {settings.headerStyle === "IMAGE" && (
              <p className="text-xs leading-5 text-amber-700">
                Image header is selectable, but image upload and storage will be enabled in a later milestone.
              </p>
            )}
          </SettingsSection>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              Settings apply to the currently selected organization.
            </p>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving settings..." : "Save dashboard settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
