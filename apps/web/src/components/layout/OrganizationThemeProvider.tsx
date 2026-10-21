"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { apiFetch } from "@/lib/api/client";
import { getCurrentUserWithOrganizationRecovery } from "@/lib/api/organization-session";
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

type BrandingImageUrls = {
  SIDEBAR: string;
  DASHBOARD: string;
  INTRODUCTION: string;
};

const EMPTY_BRANDING_IMAGE_URLS: BrandingImageUrls = {
  SIDEBAR: "",
  DASHBOARD: "",
  INTRODUCTION: "",
};

function makeThemeStyle(
  settings: OrganizationDashboardSettings,
  dark: boolean,
  imageUrls: BrandingImageUrls,
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
    "--app-button-hover": normalizeHex(settings.buttonHoverColor, defaults.buttonHoverColor),
    "--app-sidebar-image": imageUrls.SIDEBAR ? `url("${imageUrls.SIDEBAR}")` : "none",
    "--app-dashboard-image": imageUrls.DASHBOARD ? `url("${imageUrls.DASHBOARD}")` : "none",
    "--app-introduction-image": imageUrls.INTRODUCTION ? `url("${imageUrls.INTRODUCTION}")` : "none",
  } as CSSProperties;
}
export function OrganizationThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<OrganizationDashboardSettings>(
    DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS,
  );
  const [systemDark, setSystemDark] = useState(false);
  const [brandingImageUrls, setBrandingImageUrls] = useState<BrandingImageUrls>(
    EMPTY_BRANDING_IMAGE_URLS,
  );
  const previousImageUrlsRef = useRef<BrandingImageUrls>(
    EMPTY_BRANDING_IMAGE_URLS,
  );

  useEffect(() => {
    const previousUrls = previousImageUrlsRef.current;
    const currentUrls = new Set(
      Object.values(brandingImageUrls).filter((url) => url.length > 0),
    );

    for (const url of Object.values(previousUrls)) {
      if (url && !currentUrls.has(url)) {
        URL.revokeObjectURL(url);
      }
    }

    previousImageUrlsRef.current = brandingImageUrls;
  }, [brandingImageUrls]);

  useEffect(() => {
    if (pathname === "/signup") {
      setSettings(DEFAULT_ORGANIZATION_DASHBOARD_SETTINGS);
      return;
    }

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
        // Keep the current settings if a background refresh fails.
        // Organization changes already reset settings before loading.
        if (
          !cancelled &&
          currentRequest === requestNumber &&
          resetFirst
        ) {
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
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let requestNumber = 0;
    let gateRequestNumber = 0;

    const slots: Array<keyof BrandingImageUrls> = [
      "SIDEBAR",
      "DASHBOARD",
      "INTRODUCTION",
    ];

    const loadImages = async (clearFirst = false) => {
      const currentRequest = ++requestNumber;

      if (clearFirst) {
        setBrandingImageUrls(EMPTY_BRANDING_IMAGE_URLS);
      }

      const results = await Promise.all(
        slots.map(async (slot) => {
          try {
            const response = await apiFetch(
              `/api/organization-dashboard-settings/images/${slot}`,
              { method: "GET" },
            );

            if (!response.ok) {
              return {
                slot,
                url: "",
                disposition: response.status === 404 ? "clear" as const : "keep" as const,
              };
            }

            const blob = await response.blob();

            if (!blob.type.startsWith("image/") || blob.size === 0) {
              return { slot, url: "", disposition: "keep" as const };
            }

            return {
              slot,
              url: URL.createObjectURL(blob),
              disposition: "replace" as const,
            };
          } catch {
            return { slot, url: "", disposition: "keep" as const };
          }
        }),
      );

      const loadedUrls = results
        .map((result) => result.url)
        .filter((url) => url.length > 0);

      if (cancelled || currentRequest !== requestNumber) {
        loadedUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setBrandingImageUrls((previous) => {
        const next: BrandingImageUrls = { ...previous };

        for (const result of results) {
          if (result.url) {
            next[result.slot] = result.url;
          } else if (result.disposition === "clear" || clearFirst) {
            next[result.slot] = "";
          }
        }

        return next;
      });
    };

    const initializeImages = async (clearFirst: boolean) => {
      const currentGateRequest = ++gateRequestNumber;
      const isNeutralRoute =
        pathname === "/signup" || pathname === "/verify-company-email";

      if (isNeutralRoute) {
        requestNumber += 1;
        setBrandingImageUrls(EMPTY_BRANDING_IMAGE_URLS);
        return;
      }

      if (pathname === "/login") {
        requestNumber += 1;
        setBrandingImageUrls(EMPTY_BRANDING_IMAGE_URLS);

        try {
          const response = await getCurrentUserWithOrganizationRecovery();

          if (!response.ok) return;

          const data = await response.json() as {
            authenticated?: boolean;
            organization?: { id?: number } | null;
          };

          const organizationId = data.organization?.id;

          if (
            cancelled ||
            currentGateRequest !== gateRequestNumber ||
            data.authenticated !== true ||
            typeof organizationId !== "number" ||
            !Number.isSafeInteger(organizationId) ||
            organizationId <= 0
          ) {
            return;
          }

          await loadImages(true);
        } catch {
          if (!cancelled && currentGateRequest === gateRequestNumber) {
            setBrandingImageUrls(EMPTY_BRANDING_IMAGE_URLS);
          }
        }

        return;
      }

      await loadImages(clearFirst);
    };

    const refreshImages = () => {
      void initializeImages(false);
    };

    const refreshOrganizationImages = () => {
      void initializeImages(true);
    };

    void initializeImages(true);

    window.addEventListener("organization-dashboard-settings-updated", refreshImages);
    window.addEventListener("organization-selection-changed", refreshOrganizationImages);
    window.addEventListener("storage", refreshOrganizationImages);

    return () => {
      cancelled = true;
      requestNumber += 1;
      gateRequestNumber += 1;

      window.removeEventListener("organization-dashboard-settings-updated", refreshImages);
      window.removeEventListener("organization-selection-changed", refreshOrganizationImages);
      window.removeEventListener("storage", refreshOrganizationImages);

      Object.values(previousImageUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [pathname]);

  const selectedOrganizationId = getSelectedOrganizationId();
  const dark = settings.theme === "DARK" ||
    (settings.theme === "SYSTEM" && systemDark);

  const style = makeThemeStyle(settings, dark, brandingImageUrls);

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
