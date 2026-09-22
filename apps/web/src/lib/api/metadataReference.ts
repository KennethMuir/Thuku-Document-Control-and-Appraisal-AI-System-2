const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function getNextMetadataReferenceCode(
  departmentId: string | number
): Promise<string> {
  const response = await fetch(
    `${API_URL}/api/metadata/next-reference/${encodeURIComponent(
      String(departmentId)
    )}`,
    {
      credentials: "include",
    }
  );

  const data = await response.json().catch(() => null);

  if (
    !response.ok ||
    !data?.success ||
    typeof data.referenceCode !== "string" ||
    !data.referenceCode.trim()
  ) {
    throw new Error(
      data?.error ??
        "Unable to determine the next metadata reference code."
    );
  }

  return data.referenceCode.trim();
}
