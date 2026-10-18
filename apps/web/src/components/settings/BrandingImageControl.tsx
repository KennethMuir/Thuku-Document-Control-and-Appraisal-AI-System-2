"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import {
  removeOrganizationDashboardBrandingImage,
  uploadOrganizationDashboardBrandingImage,
  type OrganizationBrandingImageSlot,
} from "@/lib/api/organizationDashboardSettings";

type BrandingImageControlProps = {
  slot: OrganizationBrandingImageSlot;
  title: string;
  description: string;
  configured: boolean;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function BrandingImageControl({
  slot,
  title,
  description,
  configured,
}: BrandingImageControlProps) {
  const [hasImage, setHasImage] = useState(configured);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setHasImage(configured);
  }, [configured]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    setPreviewUrl("");

    if (!hasImage) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const response = await apiFetch(
          `/api/organization-dashboard-settings/images/${slot}`,
          { method: "GET" },
        );

        if (!response.ok) {
          throw new Error("The saved image preview could not be loaded.");
        }

        const blob = await response.blob();

        if (!blob.type.startsWith("image/")) {
          throw new Error("The server returned an invalid image response.");
        }

        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setPreviewUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setError("The saved image exists, but its preview could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [hasImage, slot]);

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setNotice("");

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      input.value = "";
      return;
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      setError("Choose an image larger than 0 bytes and no larger than 8 MB.");
      input.value = "";
      return;
    }

    setBusy(true);

    try {
      await uploadOrganizationDashboardBrandingImage(slot, file);
      setHasImage(true);
      setNotice(`${title} image uploaded successfully.`);
      window.dispatchEvent(new Event("organization-dashboard-settings-updated"));
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to upload the image.",
      );
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  async function handleRemove() {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      await removeOrganizationDashboardBrandingImage(slot);
      setHasImage(false);
      setPreviewUrl("");
      setNotice(`${title} image removed.`);
      window.dispatchEvent(new Event("organization-dashboard-settings-updated"));
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to remove the image.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 sm:w-44">
          {previewUrl ? (
            // The URL is a temporary object URL created from the authenticated image response.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${title} preview`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-3 text-center text-xs text-slate-500">
              {hasImage ? "Loading image preview…" : "No image uploaded"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
              {busy ? "Please wait…" : hasImage ? "Replace image" : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => void handleUpload(event)}
                className="sr-only"
                aria-label={`${hasImage ? "Replace" : "Upload"} ${title.toLowerCase()} image`}
              />
            </label>

            {hasImage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemove()}
                className="min-h-10 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            )}

            <span className="text-xs text-slate-500">JPEG, PNG, WebP · Max 8 MB</span>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
          )}
          {notice && (
            <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>
          )}
        </div>
      </div>
    </section>
  );
}