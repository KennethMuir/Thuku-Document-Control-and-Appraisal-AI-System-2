import type {
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

/*
 * M24E canonical relationship catalogue
 *
 * Relationship applicability is no longer domain-specific.
 *
 * Every canonical relationship type supplied by the API catalogue is
 * available for every available domain. The domain remains important
 * for classification and scope, but it does not restrict the relationship
 * vocabulary.
 *
 * Keep these helpers for compatibility with existing callers.
 */

export function getApplicableRelationshipTypes(
  _domain: DomainRelationshipDomain,
  relationshipTypes: DomainRelationshipType[]
): DomainRelationshipType[] {
  return relationshipTypes;
}

export function isRelationshipApplicableToDomain(
  _domain: DomainRelationshipDomain,
  relationshipType: string
): boolean {
  return typeof relationshipType === "string" &&
    relationshipType.trim().length > 0;
}

/*
 * Retained as a compatibility export for any future or historical caller.
 *
 * M24E no longer uses a domain-specific applicability matrix.
 */
const RELATIONSHIP_GROUPS: Record<
  string,
  readonly string[]
> = {};

export { RELATIONSHIP_GROUPS };
