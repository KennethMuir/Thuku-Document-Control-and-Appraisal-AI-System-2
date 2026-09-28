"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { deleteDocument } from "@/lib/api/documents";

import DocumentDomainAssignment from "./DocumentDomainAssignment";

type DocumentActionsMenuProps = {
  documentId: string | number;
  metadataRecordId: string | number | null;
  canManageDocuments: boolean;
  canManageDomains: boolean;
  onDeleted: () => Promise<void> | void;
  onDomainChanged: () => Promise<void> | void;
};

export default function DocumentActionsMenu({
  documentId,
  metadataRecordId,
  canManageDocuments,
  canManageDomains,
  onDeleted,
  onDomainChanged,
}: DocumentActionsMenuProps) {
  const [open, setOpen] =
    useState(false);

  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const [showDomainAssignment, setShowDomainAssignment] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (
      event: MouseEvent
    ) => {
      const target = event.target;

      if (
        target instanceof Node &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [open]);

  const handleDelete = async (): Promise<void> => {
    if (
      !canManageDocuments ||
      deleting
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response =
        await deleteDocument(
          Number(documentId)
        );

      let payload: unknown = null;

      try {
        payload =
          await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (
            payload as {
              error?: unknown;
            }
          ).error === "string"
            ? (
                payload as {
                  error: string;
                }
              ).error
            : "Unable to delete document.";

        throw new Error(message);
      }

      setConfirmDelete(false);
      setOpen(false);

      await onDeleted();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete document."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!canManageDocuments) {
    return null;
  }

  return (
    <>
      <div
        ref={menuRef}
        className="relative inline-flex"
      >
        <button
          type="button"
          aria-label="Document actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() =>
            setOpen(
              (current) => !current
            )
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold leading-none text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          ⋮
        </button>

        {open &&
          !confirmDelete && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-40 min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setShowDomainAssignment(
                    true
                  );
                }}
                className="flex w-full items-center px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              >
                Add Domain
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setError(null);
                  setConfirmDelete(
                    true
                  );
                }}
                className="flex w-full items-center px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}

        {open &&
          confirmDelete && (
            <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-red-200 bg-white p-4 shadow-xl">
              <p className="text-sm font-semibold text-slate-900">
                Delete document?
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Are you sure you want to
                delete this document?
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                This removes the document
                record and its stored file.
                Existing metadata is preserved.
              </p>

              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setConfirmDelete(
                      false
                    );
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    void handleDelete();
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting
                    ? "Deleting..."
                    : "Delete Document"}
                </button>
              </div>
            </div>
          )}
      </div>

      <DocumentDomainAssignment
        metadataRecordId={
          metadataRecordId === null
            ? null
            : Number(
                metadataRecordId
              )
        }
        canManageDomains={
          canManageDomains
        }
        open={
          showDomainAssignment
        }
        onClose={() =>
          setShowDomainAssignment(
            false
          )
        }
        onAssigned={
          onDomainChanged
        }
      />
    </>
  );
}
