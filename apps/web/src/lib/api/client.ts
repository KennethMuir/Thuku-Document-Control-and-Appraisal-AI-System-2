import { getSelectedOrganizationId } from "@/lib/organization/selection";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export const apiFetch = async (
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> => {
  const {
    json,
    headers,
    ...requestOptions
  } = options;

  const requestHeaders = new Headers(headers);
  const selectedOrganizationId = getSelectedOrganizationId();

  if (selectedOrganizationId !== null) {
    requestHeaders.set(
      "X-Organization-Id",
      String(selectedOrganizationId)
    );
  }

  let body = requestOptions.body;

  if (json !== undefined) {
    requestHeaders.set(
      "Content-Type",
      "application/json"
    );

    body = JSON.stringify(json);
  }

  return fetch(
    `${API_URL}${path}`,
    {
      ...requestOptions,
      body,
      credentials:
        requestOptions.credentials ??
        "include",
      headers: requestHeaders,
    }
  );
};

export const getApiUrl = (): string => {
  return API_URL;
};
