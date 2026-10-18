"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { getOrganizationDashboardSettings } from "@/lib/api/organizationDashboardSettings";
import { getSelectedOrganizationId } from "@/lib/organization/selection";
import {
  DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
  type OrganizationDashboardSettings,
} from "@/types/organizationDashboardSettings";

function normalizeHex(value: string, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate)) {
    return fallback;
  }

  const expanded = candidate.length === 4
    ? "#" + candidate.slice(1).split("").map((part) => part + part).join("")
    : candidate;

  return expanded.toUpperCase();
}

function rgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex, "#000000").slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mix(hex: string, other: string, amount: number): string {
  const a = rgb(hex);
  const b = rgb(other);
  const channels = a.map((value, index) =>
    Math.round(value * (1 - amount) + b[index] * amount),
  );

  return "#" + channels.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function isDefault(value: string, defaultValue: string): boolean {
  return normalizeHex(value, defaultValue) === defaultValue;
}

function makeThemeStyle(
  settings: OrganizationDashboardSettings,
  dark: boolean,
): CSSProperties {
  const defaults = DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS;

  const configuredBackground = normalizeHex(settings.backgroundColor, defaults.backgroundColor);
  const background = dark && isDefault(settings.backgroundColor, defaults.backgroundColor)
    ? "#0B1220"
    : configuredBackground;

  const surface = dark && isDefault(settings.surfaceColor, defaults.surfaceColor)
    ? "#151F32"
    : normalizeHex(settings.surfaceColor, defaults.surfaceColor);

  const border = dark && isDefault(settings.borderColor, defaults.borderColor)
    ? "#334155"
    : normalizeHex(settings.borderColor, defaults.borderColor);

  const headerBackground = normalizeHex(settings.headerBackgroundColor, defaults.headerBackgroundColor);

  const sidebarBackground = dark && isDefault(settings.sidebarBackgroundColor, defaults.sidebarBackgroundColor)
    ? surface
    : normalizeHex(settings.sidebarBackgroundColor, defaults.sidebarBackgroundColor);

  const footerBackground = dark && isDefault(settings.footerBackgroundColor, defaults.footerBackgroundColor)
    ? surface
    : normalizeHex(settings.footerBackgroundColor, defaults.footerBackgroundColor);

  const text = normalizeHex(settings.textColor, defaults.textColor);

  const muted = text;


  const sidebarText = dark && isDefault(settings.sidebarTextColor, defaults.sidebarTextColor)
    ? "#F8FAFC"
    : normalizeHex(settings.sidebarTextColor, defaults.sidebarTextColor);

  const footerText = dark && isDefault(settings.footerTextColor, defaults.footerTextColor)
    ? "#F8FAFC"
    : normalizeHex(settings.footerTextColor, defaults.footerTextColor);

  return {
    "--app-primary": normalizeHex(settings.primaryColor, defaults.primaryColor),
    "--app-accent": normalizeHex(settings.accentColor, defaults.accentColor),
    "--app-background": background,
    "--app-text": text,
    "--app-muted": muted,
    "--app-surface": surface,
    "--app-surface-raised": dark
      ? mix(surface, "#FFFFFF", 0.055)
      : mix(surface, "#0F172A", 0.025),
    "--app-border": border,
    "--app-input-background": dark ? mix(background, "#FFFFFF", 0.045) : "#FFFFFF",
    "--app-header-background": headerBackground,
    "--app-header-text": normalizeHex(settings.headerTextColor, defaults.headerTextColor),
    "--app-sidebar-background": sidebarBackground,
    "--app-sidebar-text": sidebarText,
    "--app-sidebar-active": normalizeHex(settings.sidebarActiveColor, defaults.sidebarActiveColor),
      "--app-sidebar-active-text": normalizeHex(settings.sidebarTextColor, defaults.sidebarTextColor),
    "--app-footer-background": footerBackground,
    "--app-footer-text": footerText,
    "--app-focus-ring": normalizeHex(settings.accentColor, defaults.accentColor),
    "--app-button-background": normalizeHex(settings.buttonBackgroundColor, defaults.buttonBackgroundColor),
    "--app-button-text": normalizeHex(settings.buttonTextColor, defaults.buttonTextColor),
    "--app-button-hover": normalizeHex(settings.buttonHoverColor, defaults.buttonHoverColor),  } as CSSProperties;
}
export function OrganizationThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<OrganizationDashboardSettings>(
    DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
  );
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let requestNumber = 0;

    const loadSettings = async (resetFirst: boolean) => {
      const currentRequest = ++requestNumber;

      if (resetFirst) {
        setSettings(DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS);
      }

      try {
        const result = await getOrganizationDashboardSettings();

        if (
          !cancelled &&
          currentRequest === requestNumber &&
          result.settings
        ) {
          setSettings({
            ...DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
            ...result.settings,
          });
        }
      } catch {
        if (!cancelled && currentRequest === requestNumber) {
          setSettings(DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS);
        }
      }
    };

    const onSettingsUpdated = () => {
      void loadSettings(false);
    };

    const onOrganizationChanged = () => {
      void loadSettings(true);
    };

    void loadSettings(true);

    window.addEventListener("organization-dashboard-settings-updated", onSettingsUpdated);
    window.addEventListener("organization-selection-changed", onOrganizationChanged);
    window.addEventListener("storage", onOrganizationChanged);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChanged = () => setSystemDark(media.matches);
    onSystemThemeChanged();
    media.addEventListener("change", onSystemThemeChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("organization-dashboard-settings-updated", onSettingsUpdated);
      window.removeEventListener("organization-selection-changed", onOrganizationChanged);
      window.removeEventListener("storage", onOrganizationChanged);
      media.removeEventListener("change", onSystemThemeChanged);
    };
  }, []);

  const selectedOrganizationId = getSelectedOrganizationId();
  const dark = settings.theme === "DARK" ||
    (settings.theme === "SYSTEM" && systemDark);

  const style = makeThemeStyle(settings, dark);

  return (
    <div
      className="app-theme-scope"
      data-app-theme={dark ? "dark" : "light"}
      data-organization-id={selectedOrganizationId ?? undefined}
      style={style}
    >
      {children}
    </div>
  );
}


