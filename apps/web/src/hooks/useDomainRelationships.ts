"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createDomainRelationship,
  deleteDomainRelationship,
  getMetadataDomainRelationships,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";

import { getDomainRegistry } from "@/lib/api/domainRegistry";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

type DomainRelationshipApiItem =
  Record<string, unknown>;

export function useDomainRelationships(
  authUser: unknown
) {
  const [
    domainRelationshipDomains,
    setDomainRelationshipDomains,
  ] = useState<DomainRelationshipDomain[]>([]);

  const [
    domainRelationshipTypes,
    setDomainRelationshipTypes,
  ] = useState<DomainRelationshipType[]>([]);

  const [
    metadataDomainRelationships,
    setMetadataDomainRelationships,
  ] = useState<DomainRelationshipSelection[]>([]);

  const [
    appraisalDomainRelationships,
    setAppraisalDomainRelationships,
  ] = useState<DomainRelationshipSelection[]>([]);

  const [
    domainRelationshipsLoading,
    setDomainRelationshipsLoading,
  ] = useState(false);

  const [
    domainRelationshipsError,
    setDomainRelationshipsError,
  ] = useState("");

  const extractRelationshipSelections =
    useCallback(
      (
        data: Record<string, unknown>
      ): DomainRelationshipSelection[] => {
        const relationships =
          Array.isArray(data.relationships)
            ? data.relationships
            : [];

        return relationships
          .map(
            (
              relationship: unknown
            ) => {
              if (
                !relationship ||
                typeof relationship !== "object"
              ) {
                return null;
              }

              const item =
                relationship as DomainRelationshipApiItem;

              const domainId = Number(
                item.domain_id ??
                  item.domainId ??
                  (
                    item.domain &&
                    typeof item.domain === "object"
                      ? (
                          item.domain as Record<
                            string,
                            unknown
                          >
                        ).id
                      : undefined
                  )
              );

              const relationshipType =
                String(
                  item.relationship_type ??
                    item.relationshipType ??
                    ""
                ).trim();

              if (
                !Number.isInteger(domainId) ||
                domainId <= 0 ||
                !relationshipType
              ) {
                return null;
              }

              return {
                domainId,
                relationshipType,
              };
            }
          )
          .filter(
            (
              relationship
            ): relationship is DomainRelationshipSelection =>
              relationship !== null
          );
      },
      []
    );

  const loadDomainRelationshipDefinitions =
    useCallback(
      async () => {
        if (!authUser) {
          return;
        }

        try {
          setDomainRelationshipsLoading(true);
          setDomainRelationshipsError("");

          const [
            domainsResponse,
            relationshipTypesResponse,
          ] = await Promise.all([
            getDomainRegistry(),
            getRelationshipTypes(),
          ]);

          const [
            domainsData,
            relationshipTypesData,
          ] = await Promise.all([
            domainsResponse.json(),
            relationshipTypesResponse.json(),
          ]);

          if (
            !domainsResponse.ok ||
            !domainsData.success
          ) {
            throw new Error(
              domainsData.error ||
                "Unable to load the domain registry."
            );
          }

          if (
            !relationshipTypesResponse.ok ||
            !relationshipTypesData.success
          ) {
            throw new Error(
              relationshipTypesData.error ||
                "Unable to load domain relationship types."
            );
          }

          const rawDomains =
            Array.isArray(domainsData.domains)
              ? domainsData.domains
              : [];

          const normalizedDomains =
            rawDomains
              .map(
                (
                  domain: Record<string, unknown>
                ) => {
                  const id = Number(domain.id);

                  const domainKey =
                    String(
                      domain.domain_key ??
                        domain.domainKey ??
                        ""
                    ).trim();

                  const displayName =
                    String(
                      domain.display_name ??
                        domain.displayName ??
                        domainKey
                    ).trim();

                  if (
                    !Number.isInteger(id) ||
                    id <= 0 ||
                    !domainKey
                  ) {
                    return null;
                  }

                  return {
                    id,
                    domain_key: domainKey,
                    display_name: displayName,
                    description:
                      domain.description == null
                        ? null
                        : String(
                            domain.description
                          ),
                    domain_family:
                      domain.domain_family == null
                        ? null
                        : String(
                            domain.domain_family
                          ),
                  };
                }
              )
              .filter(
                (
                  domain: unknown
                ): domain is DomainRelationshipDomain =>
                  domain !== null
              );

          const rawTypes =
            Array.isArray(
              relationshipTypesData.relationshipTypes
            )
              ? relationshipTypesData.relationshipTypes
              : Array.isArray(
                  relationshipTypesData.types
                )
                ? relationshipTypesData.types
                : [];

          const normalizedTypes =
            rawTypes
              .map(
                (
                  relationshipType: unknown
                ) => {
                  if (
                    typeof relationshipType ===
                    "string"
                  ) {
                    return {
                      value: relationshipType,
                      label: relationshipType,
                    };
                  }

                  if (
                    !relationshipType ||
                    typeof relationshipType !==
                      "object"
                  ) {
                    return null;
                  }

                  const item =
                    relationshipType as Record<
                      string,
                      unknown
                    >;

                  const value =
                    String(
                      item.value ??
                        item.relationship_type ??
                        item.relationshipType ??
                        item.key ??
                        ""
                    ).trim();

                  if (!value) {
                    return null;
                  }

                  return {
                    value,
                    label:
                      String(
                        item.label ??
                          item.display_name ??
                          item.displayName ??
                          value
                      ).trim() || value,
                  };
                }
              )
              .filter(
                (
                  relationshipType: unknown
                ): relationshipType is DomainRelationshipType =>
                  relationshipType !== null
              );

          setDomainRelationshipDomains(
            normalizedDomains
          );

          setDomainRelationshipTypes(
            normalizedTypes
          );
        } catch (error) {
          console.error(
            "Unable to load domain relationship definitions:",
            error
          );

          setDomainRelationshipsError(
            error instanceof Error
              ? error.message
              : "Unable to load domain relationships."
          );
        } finally {
          setDomainRelationshipsLoading(false);
        }
      },
      [authUser]
    );

  const loadMetadataDomainRelationships =
    useCallback(
      async (
        metadataRecordId:
          | string
          | number
          | null
          | undefined
      ) => {
        if (
          metadataRecordId === null ||
          metadataRecordId === undefined ||
          String(metadataRecordId).trim() === ""
        ) {
          setMetadataDomainRelationships([]);
          setAppraisalDomainRelationships([]);
          return;
        }

        try {
          setDomainRelationshipsLoading(true);
          setDomainRelationshipsError("");

          const response =
            await getMetadataDomainRelationships(
              metadataRecordId
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "Unable to load metadata domain relationships."
            );
          }

          const selections =
            extractRelationshipSelections(data);

          setMetadataDomainRelationships(
            selections
          );

          setAppraisalDomainRelationships(
            selections
          );
        } catch (error) {
          console.error(
            "Unable to load metadata domain relationships:",
            error
          );

          setMetadataDomainRelationships([]);
          setAppraisalDomainRelationships([]);

          setDomainRelationshipsError(
            error instanceof Error
              ? error.message
              : "Unable to load metadata domain relationships."
          );
        } finally {
          setDomainRelationshipsLoading(false);
        }
      },
      [extractRelationshipSelections]
    );

  const saveMetadataDomainRelationships =
    useCallback(
      async (
        metadataRecordId:
          | string
          | number,
        desiredRelationships:
          DomainRelationshipSelection[]
      ) => {
        const numericMetadataId =
          Number(metadataRecordId);

        if (
          !Number.isInteger(numericMetadataId) ||
          numericMetadataId <= 0
        ) {
          throw new Error(
            "A valid metadata record is required before domain relationships can be saved."
          );
        }

        setDomainRelationshipsLoading(true);
        setDomainRelationshipsError("");

        try {
          const currentResponse =
            await getMetadataDomainRelationships(
              numericMetadataId
            );

          const currentData =
            await currentResponse.json();

          if (
            !currentResponse.ok ||
            !currentData.success
          ) {
            throw new Error(
              currentData.error ||
                "Unable to retrieve the current metadata domain relationships."
            );
          }

          const currentRelationships =
            Array.isArray(
              currentData.relationships
            )
              ? currentData.relationships
              : [];

          const currentSelections =
            extractRelationshipSelections(
              currentData
            );

          const keyFor = (
            relationship: DomainRelationshipSelection
          ) =>
            `${relationship.domainId}:${relationship.relationshipType}`;

          const desiredKeys =
            new Set(
              desiredRelationships.map(keyFor)
            );

          const currentKeys =
            new Set(
              currentSelections.map(keyFor)
            );

          for (
            const relationship of currentRelationships
          ) {
            if (
              !relationship ||
              typeof relationship !== "object"
            ) {
              continue;
            }

            const item =
              relationship as Record<
                string,
                unknown
              >;

            const relationshipId =
              Number(item.id);

            const domainId =
              Number(
                item.domain_id ??
                  item.domainId
              );

            const relationshipType =
              String(
                item.relationship_type ??
                  item.relationshipType ??
                  ""
              ).trim();

            if (
              !Number.isInteger(
                relationshipId
              ) ||
              relationshipId <= 0 ||
              !Number.isInteger(domainId) ||
              domainId <= 0 ||
              !relationshipType
            ) {
              continue;
            }

            const key =
              `${domainId}:${relationshipType}`;

            if (!desiredKeys.has(key)) {
              const response =
                await deleteDomainRelationship(
                  relationshipId
                );

              const data =
                await response.json();

              if (
                !response.ok ||
                !data.success
              ) {
                throw new Error(
                  data.error ||
                    "Unable to remove a metadata domain relationship."
                );
              }
            }
          }

          for (
            const relationship of desiredRelationships
          ) {
            const key =
              keyFor(relationship);

            if (currentKeys.has(key)) {
              continue;
            }

            const response =
              await createDomainRelationship({
                metadata_record_id:
                  numericMetadataId,
                domain_id:
                  relationship.domainId,
                relationship_type:
                  relationship.relationshipType,
              });

            const data =
              await response.json();

            if (
              !response.ok ||
              !data.success
            ) {
              throw new Error(
                data.error ||
                  "Unable to create a metadata domain relationship."
              );
            }
          }

          const finalResponse =
            await getMetadataDomainRelationships(
              numericMetadataId
            );

          const finalData =
            await finalResponse.json();

          if (
            !finalResponse.ok ||
            !finalData.success
          ) {
            throw new Error(
              finalData.error ||
                "Domain relationships were saved but could not be reloaded."
            );
          }

          const finalSelections =
            extractRelationshipSelections(
              finalData
            );

          setMetadataDomainRelationships(
            finalSelections
          );

          setAppraisalDomainRelationships(
            finalSelections
          );

          return finalSelections;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to save metadata domain relationships.";

          setDomainRelationshipsError(message);

          throw error;
        } finally {
          setDomainRelationshipsLoading(false);
        }
      },
      [extractRelationshipSelections]
    );

  const clearMetadataDomainRelationships =
    useCallback(() => {
      setMetadataDomainRelationships([]);
      setDomainRelationshipsError("");
    }, []);

  const clearAppraisalDomainRelationships =
    useCallback(() => {
      setAppraisalDomainRelationships([]);
      setDomainRelationshipsError("");
    }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    void loadDomainRelationshipDefinitions();
  }, [
    authUser,
    loadDomainRelationshipDefinitions,
  ]);

  return {
    domainRelationshipDomains,
    domainRelationshipTypes,

    metadataDomainRelationships,
    appraisalDomainRelationships,

    domainRelationshipsLoading,
    domainRelationshipsError,

    setMetadataDomainRelationships,
    setAppraisalDomainRelationships,

    loadDomainRelationshipDefinitions,
    loadMetadataDomainRelationships,
    saveMetadataDomainRelationships,

    clearMetadataDomainRelationships,
    clearAppraisalDomainRelationships,

    setDomainRelationshipsError,
  };
}
