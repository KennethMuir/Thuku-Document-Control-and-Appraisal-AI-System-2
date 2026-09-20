import type { PoolClient } from "pg";

import type { ExtractedDocument } from "./documentExtraction.js";

function normalizeText(
  value: string | null | undefined
): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparable(
  value: string | null | undefined
): string {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsNormalized(
  source: string,
  value: string | null | undefined
): boolean {
  const normalizedSource =
    normalizeComparable(source);

  const normalizedValue =
    normalizeComparable(value);

  if (!normalizedValue) {
    return false;
  }

  return normalizedSource.includes(
    normalizedValue
  );
}

export type MatchResult = {
  metadataRecordId: number | null;
  matchType:
    | "STRONG_MATCH"
    | "PARTIAL_MATCH"
    | "NO_MATCH";
  confidence: number;
  matchingFields: string[];
  conflictingFields: string[];
};

export type MetadataCandidate = {
  id: number;
  reference_code: string;
  title: string | null;
  document_date: string | null;
  year: number | null;
  person_name: string | null;
  description: string | null;
  section: string | null;
  status: string;
  department_name: string | null;
  department_code: string | null;
  document_type_name: string | null;
};

export function calculateFieldMatch(
  documentText: string,
  extracted: ExtractedDocument,
  candidate: MetadataCandidate
): MatchResult {
  const matchingFields: string[] =
    [];

  const conflictingFields: string[] =
    [];

  let score = 0;
  let availableSignals = 0;

  const normalizedDocument =
    normalizeComparable(
      documentText
    );

  function tokenize(
    value: string
  ): string[] {
    return normalizeComparable(
      value
    )
      .split(/\s+/)
      .filter(Boolean);
  }

  function tokenSimilarity(
    first: string,
    second: string
  ): number {
    const firstTokens =
      tokenize(first);

    const secondTokens =
      tokenize(second);

    if (
      firstTokens.length === 0 ||
      secondTokens.length === 0
    ) {
      return 0;
    }

    const firstSet =
      new Set(firstTokens);

    const secondSet =
      new Set(secondTokens);

    let intersection = 0;

    for (
      const token of firstSet
    ) {
      if (
        secondSet.has(token)
      ) {
        intersection++;
      }
    }

    const union =
      new Set([
        ...firstSet,
        ...secondSet,
      ]).size;

    if (union === 0) {
      return 0;
    }

    return (
      intersection / union
    );
  }

  function titleSimilarity(
    first: string,
    second: string
  ): number {
    const normalizedFirst =
      normalizeComparable(first);

    const normalizedSecond =
      normalizeComparable(second);

    if (
      !normalizedFirst ||
      !normalizedSecond
    ) {
      return 0;
    }

    if (
      normalizedFirst ===
      normalizedSecond
    ) {
      return 1;
    }

    if (
      normalizedFirst.includes(
        normalizedSecond
      ) ||
      normalizedSecond.includes(
        normalizedFirst
      )
    ) {
      return 0.95;
    }

    return tokenSimilarity(
      normalizedFirst,
      normalizedSecond
    );
  }

  /*
   * Reference code
   */
  if (
    candidate.reference_code
  ) {
    availableSignals++;

    const referenceMatches =
      containsNormalized(
        normalizedDocument,
        candidate.reference_code
      ) ||
      normalizeComparable(
        extracted.referenceCode
      ) ===
        normalizeComparable(
          candidate.reference_code
        );

    if (referenceMatches) {
      score += 35;

      matchingFields.push(
        "Reference code"
      );
    }
  }

  /*
   * Person name
   */
  if (
    candidate.person_name
  ) {
    availableSignals++;

    const normalizedCandidatePerson =
      normalizeComparable(
        candidate.person_name
      );

    const normalizedExtractedPerson =
      normalizeComparable(
        extracted.personName
      );

    const personMatches =
      containsNormalized(
        normalizedDocument,
        candidate.person_name
      ) ||
      normalizedExtractedPerson ===
        normalizedCandidatePerson;

    if (personMatches) {
      score += 30;

      matchingFields.push(
        "Person name"
      );
    } else if (
      extracted.personName
    ) {
      conflictingFields.push(
        "Person name"
      );
    }
  }

  /*
   * Title intelligence
   */
  if (
    candidate.title
  ) {
    availableSignals++;

    const similarity =
      titleSimilarity(
        candidate.title,
        extracted.title || ""
      );

    if (
      similarity >= 0.90
    ) {
      score += 50;

      matchingFields.push(
        "Title"
      );
    } else if (
      similarity >= 0.75
    ) {
      score += 45;

      matchingFields.push(
        "Title similarity"
      );
    } else if (
      similarity >= 0.55
    ) {
      score += 35;

      matchingFields.push(
        "Title similarity"
      );
    } else if (
      containsNormalized(
        normalizedDocument,
        candidate.title
      )
    ) {
      score += 40;

      matchingFields.push(
        "Title"
      );
    }
  }

  /*
   * Year
   */
  if (candidate.year) {
    availableSignals++;

    if (
      extracted.year ===
        candidate.year ||
      new RegExp(
        `\\b${candidate.year}\\b`
      ).test(documentText)
    ) {
      score += 20;

      matchingFields.push(
        "Year"
      );
    } else if (
      extracted.year
    ) {
      conflictingFields.push(
        "Year"
      );
    }
  }

  /*
   * Document date
   */
  if (
    candidate.document_date
  ) {
    availableSignals++;

    const candidateDate =
      String(
        candidate.document_date
      ).slice(0, 10);

    if (
      extracted.date ===
      candidateDate
    ) {
      score += 10;

      matchingFields.push(
        "Document date"
      );
    } else if (
      extracted.date
    ) {
      conflictingFields.push(
        "Document date"
      );
    }
  }

  /*
   * Department
   */
  if (
    candidate.department_name
  ) {
    availableSignals++;

    if (
      containsNormalized(
        normalizedDocument,
        candidate.department_name
      )
    ) {
      score += 10;

      matchingFields.push(
        "Department"
      );
    }
  }

  /*
   * Section
   *
   * Sections are part of the metadata
   * registry and may also appear in the
   * document text.
   */
  if (
    candidate.section
  ) {
    availableSignals++;

    if (
      containsNormalized(
        normalizedDocument,
        candidate.section
      )
    ) {
      score += 10;

      matchingFields.push(
        "Section"
      );
    }
  }

  if (
    availableSignals === 0
  ) {
    return {
      metadataRecordId: null,
      matchType: "NO_MATCH",
      confidence: 0,
      matchingFields,
      conflictingFields,
    };
  }

  const boundedScore =
    Math.min(
      100,
      Math.max(0, score)
    );

  let matchType:
    | "STRONG_MATCH"
    | "PARTIAL_MATCH"
    | "NO_MATCH";

  if (
    boundedScore >= 75
  ) {
    matchType =
      "STRONG_MATCH";
  } else if (
    boundedScore >= 35
  ) {
    matchType =
      "PARTIAL_MATCH";
  } else {
    matchType =
      "NO_MATCH";
  }

  /*
   * A score below the partial-match
   * threshold is a real NO_MATCH.
   *
   * Do not return a candidate ID in
   * that situation.
   */
  return {
    metadataRecordId:
      matchType === "NO_MATCH"
        ? null
        : candidate.id,
    matchType,
    confidence: Number(
      boundedScore.toFixed(2)
    ),
    matchingFields,
    conflictingFields,
  };
}

export async function findBestMetadataMatch(
  client: PoolClient,
  extracted: ExtractedDocument,
  organizationId: number
): Promise<MatchResult> {
  const result =
    await client.query<MetadataCandidate>(
      `
        SELECT
          mr.id,
          mr.reference_code,
          mr.title,
          mr.document_date,
          mr.year,
          mr.person_name,
          mr.description,
          mr.section,
          mr.status,

          d.name AS department_name,
          d.code AS department_code,

          dt.name AS document_type_name

        FROM metadata_records mr

        LEFT JOIN departments d
          ON d.id = mr.department_id

        LEFT JOIN document_types dt
          ON dt.id = mr.document_type_id

        WHERE mr.organization_id = $1
          AND mr.status IN (
            'AWAITING_DOCUMENT',
            'DOCUMENT_LINKED'
          )

        ORDER BY mr.created_at DESC
      `,
      [organizationId]
    );

  let bestMatch: MatchResult = {
    metadataRecordId: null,
    matchType: "NO_MATCH",
    confidence: 0,
    matchingFields: [],
    conflictingFields: [],
  };

  for (
    const candidate of result.rows
  ) {
    const match =
      calculateFieldMatch(
        [
          extracted.text,
          extracted.title || "",
          extracted.personName ||
            "",
          extracted.referenceCode ||
            "",
          extracted.year || "",
        ].join("\n"),
        extracted,
        candidate
      );

    if (
      match.confidence >
      bestMatch.confidence
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

