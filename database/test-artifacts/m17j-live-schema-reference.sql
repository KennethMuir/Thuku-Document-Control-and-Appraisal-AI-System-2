--
-- PostgreSQL database dump
--

\restrict sWt4NjlLYjXWwWKeyiyW9cRvlhg6jvxRggAmgsqfljYw3UsuJiPw2ljVklbucG8

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: validate_metadata_domain_relationship_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_metadata_domain_relationship_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    metadata_organization_id BIGINT;
    domain_organization_id BIGINT;
BEGIN
    SELECT mr.organization_id
    INTO metadata_organization_id
    FROM metadata_records mr
    WHERE mr.id = NEW.metadata_record_id;

    IF metadata_organization_id IS NULL THEN
        RAISE EXCEPTION
            'Metadata record % does not exist or has no organization',
            NEW.metadata_record_id;
    END IF;

    IF metadata_organization_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Metadata record % does not belong to organization %',
            NEW.metadata_record_id,
            NEW.organization_id;
    END IF;

    SELECT dr.organization_id
    INTO domain_organization_id
    FROM domain_registry dr
    WHERE dr.id = NEW.domain_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Domain % does not exist',
            NEW.domain_id;
    END IF;

    /*
     * Global/system domains have organization_id NULL and are available
     * to all organizations.
     *
     * Organization-specific domains must belong to the same organization
     * as the metadata relationship.
     */
    IF domain_organization_id IS NOT NULL
       AND domain_organization_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Domain % does not belong to organization %',
            NEW.domain_id,
            NEW.organization_id;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: validate_metadata_value_organization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_metadata_value_organization() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    metadata_org_id BIGINT;
    field_org_id BIGINT;
BEGIN
    SELECT organization_id
    INTO metadata_org_id
    FROM metadata_records
    WHERE id = NEW.metadata_record_id;

    IF metadata_org_id IS NULL THEN
        RAISE EXCEPTION
            'Metadata record % does not exist or has no organization',
            NEW.metadata_record_id;
    END IF;

    IF metadata_org_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Metadata value organization does not match metadata record organization';
    END IF;

    SELECT organization_id
    INTO field_org_id
    FROM field_registry
    WHERE id = NEW.field_registry_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Field registry definition % does not exist or is inactive',
            NEW.field_registry_id;
    END IF;

    IF field_org_id IS NOT NULL
       AND field_org_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Metadata value organization cannot use a field definition belonging to another organization';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: validate_metadata_value_repeatability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_metadata_value_repeatability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    field_is_repeatable BOOLEAN;
    existing_value_id BIGINT;
BEGIN
    SELECT repeatable
    INTO field_is_repeatable
    FROM field_registry
    WHERE id = NEW.field_registry_id
      AND is_active = TRUE;

    IF field_is_repeatable IS NULL THEN
        RAISE EXCEPTION
            'Field registry definition % does not exist or is inactive',
            NEW.field_registry_id;
    END IF;

    IF field_is_repeatable = FALSE THEN
        SELECT id
        INTO existing_value_id
        FROM metadata_values
        WHERE metadata_record_id = NEW.metadata_record_id
          AND field_registry_id = NEW.field_registry_id
          AND id <> COALESCE(NEW.id, 0)
        LIMIT 1;

        IF existing_value_id IS NOT NULL THEN
            RAISE EXCEPTION
                'Field % is not repeatable and already has a value for metadata record %',
                NEW.field_registry_id,
                NEW.metadata_record_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id bigint NOT NULL
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: document_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_audit_logs (
    id bigint NOT NULL,
    document_id bigint,
    metadata_record_id bigint,
    action character varying(100) NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id bigint,
    actor_user_id bigint
);


--
-- Name: document_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_audit_logs_id_seq OWNED BY public.document_audit_logs.id;


--
-- Name: document_extractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_extractions (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    extracted_text text,
    extracted_title character varying(500),
    extracted_date date,
    extracted_year integer,
    extracted_person_name character varying(255),
    extraction_status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    extracted_date_text character varying(150)
);


--
-- Name: document_extractions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_extractions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_extractions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_extractions_id_seq OWNED BY public.document_extractions.id;


--
-- Name: document_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_files (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    original_filename character varying(500) NOT NULL,
    stored_filename character varying(500) NOT NULL,
    storage_path text NOT NULL,
    mime_type character varying(150),
    file_size bigint,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_provider character varying(30) DEFAULT 'LOCAL'::character varying NOT NULL,
    storage_reference text NOT NULL,
    sha256_hash character varying(64),
    CONSTRAINT document_files_storage_provider_valid CHECK (((storage_provider)::text = ANY ((ARRAY['LOCAL'::character varying, 'SERVER'::character varying, 'CLOUD'::character varying])::text[])))
);


--
-- Name: document_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_files_id_seq OWNED BY public.document_files.id;


--
-- Name: document_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_matches (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    metadata_record_id bigint,
    match_type character varying(50) NOT NULL,
    confidence numeric(5,2),
    matching_fields text,
    conflicting_fields text,
    decision character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_matches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_matches_id_seq OWNED BY public.document_matches.id;


--
-- Name: document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_types (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id bigint NOT NULL
);


--
-- Name: document_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_types_id_seq OWNED BY public.document_types.id;


--
-- Name: document_upload_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_upload_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id bigint NOT NULL,
    document_code character varying(100) NOT NULL,
    filename character varying(500) NOT NULL,
    title character varying(500),
    document_date date,
    upload_date timestamp with time zone DEFAULT now() NOT NULL,
    year integer,
    person_name character varying(255),
    file_type character varying(50),
    file_size bigint,
    status character varying(50) DEFAULT 'UNLINKED'::character varying NOT NULL,
    metadata_record_id bigint,
    department_id bigint,
    document_type_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    upload_number bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    review_draft_metadata jsonb,
    organization_id bigint NOT NULL
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: domain_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_registry (
    id bigint NOT NULL,
    domain_key character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    domain_family character varying(100) NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    organization_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    domain_scope character varying(30) NOT NULL,
    specialization_id bigint,
    CONSTRAINT domain_registry_scope_valid CHECK (((((domain_scope)::text = 'UNIVERSAL'::text) AND (organization_id IS NULL) AND (specialization_id IS NULL)) OR (((domain_scope)::text = 'SPECIALIZED'::text) AND (organization_id IS NULL) AND (specialization_id IS NOT NULL)) OR (((domain_scope)::text = 'ORGANIZATION'::text) AND (organization_id IS NOT NULL) AND (specialization_id IS NULL))))
);


--
-- Name: domain_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.domain_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: domain_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.domain_registry_id_seq OWNED BY public.domain_registry.id;


--
-- Name: field_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_registry (
    id bigint NOT NULL,
    field_key character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    data_type character varying(50) NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    repeatable boolean DEFAULT false NOT NULL,
    searchable boolean DEFAULT true NOT NULL,
    filterable boolean DEFAULT true NOT NULL,
    sortable boolean DEFAULT true NOT NULL,
    ai_extractable boolean DEFAULT false NOT NULL,
    user_editable boolean DEFAULT true NOT NULL,
    sensitive boolean DEFAULT false NOT NULL,
    validation_rule jsonb DEFAULT '{}'::jsonb NOT NULL,
    controlled_vocabulary jsonb DEFAULT '{}'::jsonb NOT NULL,
    unit character varying(50),
    default_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    organization_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_registry_category_valid CHECK (((category)::text = ANY ((ARRAY['Identity'::character varying, 'Dates'::character varying, 'People'::character varying, 'Organizations'::character varying, 'Records Management'::character varying, 'Administrative'::character varying, 'Governance'::character varying, 'Subject / Classification'::character varying, 'Legal / Regulatory'::character varying, 'Security'::character varying, 'Compliance'::character varying, 'Risk'::character varying, 'Audit'::character varying, 'Financial'::character varying, 'Procurement'::character varying, 'Contracts'::character varying, 'Human Resources'::character varying, 'Projects'::character varying, 'Operations'::character varying, 'Engineering'::character varying, 'Aviation'::character varying, 'Medical / Healthcare'::character varying, 'Research / Scientific'::character varying, 'Education'::character varying, 'Geographic'::character varying, 'Technical'::character varying, 'Media / Audiovisual'::character varying, 'Archival'::character varying, 'Preservation'::character varying, 'Workflow / Approval'::character varying, 'Relationships'::character varying, 'Environmental'::character varying])::text[]))),
    CONSTRAINT field_registry_data_type_valid CHECK (((data_type)::text = ANY ((ARRAY['text'::character varying, 'integer'::character varying, 'decimal'::character varying, 'boolean'::character varying, 'date'::character varying, 'datetime'::character varying, 'year'::character varying, 'email'::character varying, 'url'::character varying, 'reference'::character varying, 'controlled_vocabulary'::character varying])::text[])))
);


--
-- Name: field_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.field_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: field_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.field_registry_id_seq OWNED BY public.field_registry.id;


--
-- Name: metadata_domain_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_domain_relationships (
    id bigint NOT NULL,
    metadata_record_id bigint NOT NULL,
    domain_id bigint NOT NULL,
    organization_id bigint NOT NULL,
    relationship_type character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metadata_domain_relationships_type_check CHECK (((relationship_type)::text = ANY ((ARRAY['SUBJECT'::character varying, 'RECORD'::character varying, 'PROCESS'::character varying, 'ACTIVITY'::character varying, 'TASK'::character varying, 'SERVICE'::character varying, 'EVENT'::character varying, 'REQUIREMENT'::character varying, 'OBLIGATION'::character varying, 'AUTHORITY'::character varying, 'POLICY'::character varying, 'DECISION'::character varying, 'APPROVAL'::character varying, 'AUTHORIZATION'::character varying, 'AGREEMENT'::character varying, 'PARTY'::character varying, 'TRANSACTION'::character varying, 'PAYMENT'::character varying, 'REQUEST'::character varying, 'SUBMISSION'::character varying, 'NOTICE'::character varying, 'AMENDMENT'::character varying, 'RENEWAL'::character varying, 'TERMINATION'::character varying, 'DISPUTE'::character varying, 'ASSESSMENT'::character varying, 'REVIEW'::character varying, 'INSPECTION'::character varying, 'AUDIT'::character varying, 'EVIDENCE'::character varying, 'FINDING'::character varying, 'RECOMMENDATION'::character varying, 'RISK'::character varying, 'CONTROL'::character varying, 'INCIDENT'::character varying, 'ISSUE'::character varying, 'INVESTIGATION'::character varying, 'CHANGE'::character varying, 'EXCEPTION'::character varying, 'DEPENDENCY'::character varying, 'FOLLOW_UP'::character varying, 'REPORT'::character varying, 'DATA'::character varying, 'ANALYSIS'::character varying, 'RESULT'::character varying, 'ASSET'::character varying, 'RESOURCE'::character varying, 'COST'::character varying, 'FUNDING'::character varying, 'BUDGET'::character varying, 'ACCOUNT'::character varying, 'LICENSE'::character varying, 'PERMIT'::character varying, 'CERTIFICATION'::character varying, 'COMPLIANCE'::character varying, 'CLASSIFICATION'::character varying, 'RETENTION'::character varying, 'ACCESS'::character varying, 'TRANSFER'::character varying, 'CUSTODY'::character varying, 'PRESERVATION'::character varying, 'DISPOSITION'::character varying, 'LEGAL_CONTEXT'::character varying, 'BUSINESS_FUNCTION'::character varying, 'TECHNICAL_CONTEXT'::character varying, 'PURPOSE'::character varying, 'REGULATORY_CONTEXT'::character varying, 'OPERATIONAL_CONTEXT'::character varying, 'FINANCIAL_CONTEXT'::character varying, 'HISTORICAL_CONTEXT'::character varying, 'OWNERSHIP_CONTEXT'::character varying, 'REPORTING_CONTEXT'::character varying, 'RECORDS_CONTEXT'::character varying])::text[])))
);


--
-- Name: metadata_domain_relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_domain_relationships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_domain_relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metadata_domain_relationships_id_seq OWNED BY public.metadata_domain_relationships.id;


--
-- Name: metadata_field_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_field_profiles (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    field_registry_id bigint NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    required boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metadata_field_profiles_display_order_check CHECK ((display_order >= 0))
);


--
-- Name: metadata_field_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_field_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_field_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metadata_field_profiles_id_seq OWNED BY public.metadata_field_profiles.id;


--
-- Name: metadata_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_records (
    id bigint NOT NULL,
    reference_code character varying(100) NOT NULL,
    title character varying(500),
    document_date date,
    year integer,
    person_name character varying(255),
    description text,
    status character varying(50) DEFAULT 'AWAITING_DOCUMENT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_type_id bigint,
    department_id bigint,
    section character varying(255),
    additional_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    organization_id bigint NOT NULL
);


--
-- Name: metadata_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metadata_records_id_seq OWNED BY public.metadata_records.id;


--
-- Name: metadata_reference_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_reference_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_values (
    id bigint NOT NULL,
    metadata_record_id bigint NOT NULL,
    field_registry_id bigint NOT NULL,
    value jsonb NOT NULL,
    source character varying(50) DEFAULT 'USER'::character varying NOT NULL,
    confidence numeric(5,4),
    verification_status character varying(30) DEFAULT 'UNVERIFIED'::character varying NOT NULL,
    organization_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metadata_values_confidence_valid CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))),
    CONSTRAINT metadata_values_source_valid CHECK (((source)::text = ANY ((ARRAY['USER'::character varying, 'AI'::character varying, 'SYSTEM'::character varying, 'IMPORT'::character varying, 'MIGRATION'::character varying])::text[]))),
    CONSTRAINT metadata_values_verification_valid CHECK (((verification_status)::text = ANY ((ARRAY['UNVERIFIED'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: metadata_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_values_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metadata_values_id_seq OWNED BY public.metadata_values.id;


--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_memberships (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role character varying(30) DEFAULT 'VIEWER'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_memberships_role_valid CHECK (((role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'APPRAISER'::character varying, 'VIEWER'::character varying])::text[])))
);


--
-- Name: organization_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_memberships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_memberships_id_seq OWNED BY public.organization_memberships.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(150) NOT NULL,
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    specialization_id bigint,
    CONSTRAINT organizations_status_valid CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'ARCHIVED'::character varying])::text[])))
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash bytea NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: specializations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specializations (
    id bigint NOT NULL,
    specialization_key character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: specializations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.specializations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: specializations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.specializations_id_seq OWNED BY public.specializations.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(320) NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(255),
    role character varying(30) DEFAULT 'VIEWER'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_valid CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'APPRAISER'::character varying, 'VIEWER'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(150) NOT NULL,
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspaces_status_valid CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ARCHIVED'::character varying])::text[])))
);


--
-- Name: workspaces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspaces_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspaces_id_seq OWNED BY public.workspaces.id;


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: document_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.document_audit_logs_id_seq'::regclass);


--
-- Name: document_extractions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_extractions ALTER COLUMN id SET DEFAULT nextval('public.document_extractions_id_seq'::regclass);


--
-- Name: document_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_files ALTER COLUMN id SET DEFAULT nextval('public.document_files_id_seq'::regclass);


--
-- Name: document_matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_matches ALTER COLUMN id SET DEFAULT nextval('public.document_matches_id_seq'::regclass);


--
-- Name: document_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types ALTER COLUMN id SET DEFAULT nextval('public.document_types_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: domain_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_registry ALTER COLUMN id SET DEFAULT nextval('public.domain_registry_id_seq'::regclass);


--
-- Name: field_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_registry ALTER COLUMN id SET DEFAULT nextval('public.field_registry_id_seq'::regclass);


--
-- Name: metadata_domain_relationships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_domain_relationships ALTER COLUMN id SET DEFAULT nextval('public.metadata_domain_relationships_id_seq'::regclass);


--
-- Name: metadata_field_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_profiles ALTER COLUMN id SET DEFAULT nextval('public.metadata_field_profiles_id_seq'::regclass);


--
-- Name: metadata_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_records ALTER COLUMN id SET DEFAULT nextval('public.metadata_records_id_seq'::regclass);


--
-- Name: metadata_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_values ALTER COLUMN id SET DEFAULT nextval('public.metadata_values_id_seq'::regclass);


--
-- Name: organization_memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships ALTER COLUMN id SET DEFAULT nextval('public.organization_memberships_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: specializations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specializations ALTER COLUMN id SET DEFAULT nextval('public.specializations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: workspaces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces ALTER COLUMN id SET DEFAULT nextval('public.workspaces_id_seq'::regclass);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_audit_logs document_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: document_extractions document_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_extractions
    ADD CONSTRAINT document_extractions_pkey PRIMARY KEY (id);


--
-- Name: document_files document_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_files
    ADD CONSTRAINT document_files_pkey PRIMARY KEY (id);


--
-- Name: document_matches document_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_matches
    ADD CONSTRAINT document_matches_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: documents documents_document_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_code_key UNIQUE (document_code);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: domain_registry domain_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_registry
    ADD CONSTRAINT domain_registry_pkey PRIMARY KEY (id);


--
-- Name: field_registry field_registry_key_organization_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_registry
    ADD CONSTRAINT field_registry_key_organization_unique UNIQUE (field_key, organization_id);


--
-- Name: field_registry field_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_registry
    ADD CONSTRAINT field_registry_pkey PRIMARY KEY (id);


--
-- Name: metadata_domain_relationships metadata_domain_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_domain_relationships
    ADD CONSTRAINT metadata_domain_relationships_pkey PRIMARY KEY (id);


--
-- Name: metadata_domain_relationships metadata_domain_relationships_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_domain_relationships
    ADD CONSTRAINT metadata_domain_relationships_unique UNIQUE (metadata_record_id, domain_id, relationship_type);


--
-- Name: metadata_field_profiles metadata_field_profiles_organization_field_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_profiles
    ADD CONSTRAINT metadata_field_profiles_organization_field_unique UNIQUE (organization_id, field_registry_id);


--
-- Name: metadata_field_profiles metadata_field_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_profiles
    ADD CONSTRAINT metadata_field_profiles_pkey PRIMARY KEY (id);


--
-- Name: metadata_records metadata_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_records
    ADD CONSTRAINT metadata_records_pkey PRIMARY KEY (id);


--
-- Name: metadata_values metadata_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_values
    ADD CONSTRAINT metadata_values_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_unique UNIQUE (organization_id, user_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: specializations specializations_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specializations
    ADD CONSTRAINT specializations_key_unique UNIQUE (specialization_key);


--
-- Name: specializations specializations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specializations
    ADD CONSTRAINT specializations_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_organization_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_slug_unique UNIQUE (organization_id, slug);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: departments_organization_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX departments_organization_code_key ON public.departments USING btree (organization_id, lower((code)::text));


--
-- Name: departments_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_organization_idx ON public.departments USING btree (organization_id);


--
-- Name: departments_organization_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX departments_organization_name_key ON public.departments USING btree (organization_id, lower((name)::text));


--
-- Name: document_audit_logs_actor_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_audit_logs_actor_user_idx ON public.document_audit_logs USING btree (actor_user_id);


--
-- Name: document_audit_logs_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_audit_logs_organization_idx ON public.document_audit_logs USING btree (organization_id);


--
-- Name: document_files_storage_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_files_storage_provider_idx ON public.document_files USING btree (storage_provider);


--
-- Name: document_types_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_types_organization_idx ON public.document_types USING btree (organization_id);


--
-- Name: document_types_organization_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_types_organization_name_key ON public.document_types USING btree (organization_id, lower((name)::text));


--
-- Name: documents_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_organization_idx ON public.documents USING btree (organization_id);


--
-- Name: documents_owner_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_owner_user_id_idx ON public.documents USING btree (owner_user_id);


--
-- Name: documents_upload_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_upload_number_key ON public.documents USING btree (upload_number);


--
-- Name: domain_registry_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_registry_active_idx ON public.domain_registry USING btree (is_active);


--
-- Name: domain_registry_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_registry_family_idx ON public.domain_registry USING btree (domain_family);


--
-- Name: domain_registry_organization_domain_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_registry_organization_domain_key_unique ON public.domain_registry USING btree (organization_id, lower((domain_key)::text)) WHERE ((domain_scope)::text = 'ORGANIZATION'::text);


--
-- Name: domain_registry_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_registry_organization_idx ON public.domain_registry USING btree (organization_id);


--
-- Name: domain_registry_scope_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_registry_scope_active_idx ON public.domain_registry USING btree (domain_scope, is_active);


--
-- Name: domain_registry_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_registry_scope_idx ON public.domain_registry USING btree (domain_scope);


--
-- Name: domain_registry_specialization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_registry_specialization_idx ON public.domain_registry USING btree (specialization_id);


--
-- Name: domain_registry_specialized_domain_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_registry_specialized_domain_key_unique ON public.domain_registry USING btree (specialization_id, lower((domain_key)::text)) WHERE ((domain_scope)::text = 'SPECIALIZED'::text);


--
-- Name: domain_registry_universal_domain_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_registry_universal_domain_key_unique ON public.domain_registry USING btree (lower((domain_key)::text)) WHERE ((domain_scope)::text = 'UNIVERSAL'::text);


--
-- Name: field_registry_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_registry_active_idx ON public.field_registry USING btree (is_active);


--
-- Name: field_registry_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_registry_category_idx ON public.field_registry USING btree (category);


--
-- Name: field_registry_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_registry_organization_idx ON public.field_registry USING btree (organization_id);


--
-- Name: field_registry_system_field_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX field_registry_system_field_key_unique ON public.field_registry USING btree (field_key) WHERE (organization_id IS NULL);


--
-- Name: idx_metadata_records_additional_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_records_additional_metadata ON public.metadata_records USING gin (additional_metadata);


--
-- Name: metadata_domain_relationships_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_domain_relationships_domain_idx ON public.metadata_domain_relationships USING btree (domain_id);


--
-- Name: metadata_domain_relationships_metadata_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_domain_relationships_metadata_idx ON public.metadata_domain_relationships USING btree (metadata_record_id);


--
-- Name: metadata_domain_relationships_org_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_domain_relationships_org_domain_idx ON public.metadata_domain_relationships USING btree (organization_id, domain_id);


--
-- Name: metadata_domain_relationships_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_domain_relationships_organization_idx ON public.metadata_domain_relationships USING btree (organization_id);


--
-- Name: metadata_domain_relationships_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_domain_relationships_type_idx ON public.metadata_domain_relationships USING btree (relationship_type);


--
-- Name: metadata_field_profiles_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_field_profiles_enabled_idx ON public.metadata_field_profiles USING btree (organization_id, enabled);


--
-- Name: metadata_field_profiles_field_registry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_field_profiles_field_registry_idx ON public.metadata_field_profiles USING btree (field_registry_id);


--
-- Name: metadata_field_profiles_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_field_profiles_order_idx ON public.metadata_field_profiles USING btree (organization_id, display_order, field_registry_id);


--
-- Name: metadata_field_profiles_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_field_profiles_organization_idx ON public.metadata_field_profiles USING btree (organization_id);


--
-- Name: metadata_records_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_records_organization_idx ON public.metadata_records USING btree (organization_id);


--
-- Name: metadata_records_organization_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX metadata_records_organization_reference_key ON public.metadata_records USING btree (organization_id, lower((reference_code)::text));


--
-- Name: metadata_values_field_registry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_values_field_registry_idx ON public.metadata_values USING btree (field_registry_id);


--
-- Name: metadata_values_metadata_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_values_metadata_record_idx ON public.metadata_values USING btree (metadata_record_id);


--
-- Name: metadata_values_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_values_organization_idx ON public.metadata_values USING btree (organization_id);


--
-- Name: metadata_values_record_field_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_values_record_field_idx ON public.metadata_values USING btree (metadata_record_id, field_registry_id);


--
-- Name: metadata_values_value_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metadata_values_value_gin_idx ON public.metadata_values USING gin (value);


--
-- Name: organization_memberships_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_memberships_active_idx ON public.organization_memberships USING btree (organization_id, is_active);


--
-- Name: organization_memberships_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_memberships_organization_idx ON public.organization_memberships USING btree (organization_id);


--
-- Name: organization_memberships_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_memberships_user_idx ON public.organization_memberships USING btree (user_id);


--
-- Name: organizations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizations_status_idx ON public.organizations USING btree (status);


--
-- Name: sessions_active_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_active_lookup_idx ON public.sessions USING btree (token_hash, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: specializations_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX specializations_active_idx ON public.specializations USING btree (is_active);


--
-- Name: users_email_lower_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_lower_key ON public.users USING btree (lower((email)::text));


--
-- Name: workspaces_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspaces_organization_idx ON public.workspaces USING btree (organization_id);


--
-- Name: workspaces_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspaces_status_idx ON public.workspaces USING btree (organization_id, status);


--
-- Name: metadata_domain_relationships metadata_domain_relationship_scope_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER metadata_domain_relationship_scope_trigger BEFORE INSERT OR UPDATE ON public.metadata_domain_relationships FOR EACH ROW EXECUTE FUNCTION public.validate_metadata_domain_relationship_scope();


--
-- Name: metadata_values metadata_values_validate_organization; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER metadata_values_validate_organization BEFORE INSERT OR UPDATE ON public.metadata_values FOR EACH ROW EXECUTE FUNCTION public.validate_metadata_value_organization();


--
-- Name: metadata_values metadata_values_validate_repeatability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER metadata_values_validate_repeatability BEFORE INSERT OR UPDATE ON public.metadata_values FOR EACH ROW EXECUTE FUNCTION public.validate_metadata_value_repeatability();


--
-- Name: departments departments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: document_audit_logs document_audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_audit_logs document_audit_logs_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: document_audit_logs document_audit_logs_metadata_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_metadata_record_id_fkey FOREIGN KEY (metadata_record_id) REFERENCES public.metadata_records(id) ON DELETE SET NULL;


--
-- Name: document_audit_logs document_audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: document_extractions document_extractions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_extractions
    ADD CONSTRAINT document_extractions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_files document_files_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_files
    ADD CONSTRAINT document_files_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_matches document_matches_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_matches
    ADD CONSTRAINT document_matches_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_matches document_matches_metadata_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_matches
    ADD CONSTRAINT document_matches_metadata_record_id_fkey FOREIGN KEY (metadata_record_id) REFERENCES public.metadata_records(id) ON DELETE SET NULL;


--
-- Name: document_types document_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documents documents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: documents documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id) ON DELETE SET NULL;


--
-- Name: documents documents_metadata_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_metadata_record_id_fkey FOREIGN KEY (metadata_record_id) REFERENCES public.metadata_records(id) ON DELETE SET NULL;


--
-- Name: documents documents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documents documents_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: domain_registry domain_registry_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_registry
    ADD CONSTRAINT domain_registry_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: domain_registry domain_registry_specialization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_registry
    ADD CONSTRAINT domain_registry_specialization_id_fkey FOREIGN KEY (specialization_id) REFERENCES public.specializations(id) ON DELETE RESTRICT;


--
-- Name: field_registry field_registry_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_registry
    ADD CONSTRAINT field_registry_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: metadata_domain_relationships metadata_domain_relationships_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_domain_relationships
    ADD CONSTRAINT metadata_domain_relationships_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domain_registry(id) ON DELETE CASCADE;


--
-- Name: metadata_domain_relationships metadata_domain_relationships_metadata_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_domain_relationships
    ADD CONSTRAINT metadata_domain_relationships_metadata_record_id_fkey FOREIGN KEY (metadata_record_id) REFERENCES public.metadata_records(id) ON DELETE CASCADE;


--
-- Name: metadata_domain_relationships metadata_domain_relationships_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_domain_relationships
    ADD CONSTRAINT metadata_domain_relationships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: metadata_field_profiles metadata_field_profiles_field_registry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_profiles
    ADD CONSTRAINT metadata_field_profiles_field_registry_id_fkey FOREIGN KEY (field_registry_id) REFERENCES public.field_registry(id) ON DELETE CASCADE;


--
-- Name: metadata_field_profiles metadata_field_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_profiles
    ADD CONSTRAINT metadata_field_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: metadata_records metadata_records_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_records
    ADD CONSTRAINT metadata_records_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: metadata_records metadata_records_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_records
    ADD CONSTRAINT metadata_records_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id) ON DELETE SET NULL;


--
-- Name: metadata_records metadata_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_records
    ADD CONSTRAINT metadata_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: metadata_values metadata_values_field_registry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_values
    ADD CONSTRAINT metadata_values_field_registry_id_fkey FOREIGN KEY (field_registry_id) REFERENCES public.field_registry(id) ON DELETE RESTRICT;


--
-- Name: metadata_values metadata_values_metadata_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_values
    ADD CONSTRAINT metadata_values_metadata_record_id_fkey FOREIGN KEY (metadata_record_id) REFERENCES public.metadata_records(id) ON DELETE CASCADE;


--
-- Name: metadata_values metadata_values_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_values
    ADD CONSTRAINT metadata_values_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_specialization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_specialization_id_fkey FOREIGN KEY (specialization_id) REFERENCES public.specializations(id) ON DELETE RESTRICT;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict sWt4NjlLYjXWwWKeyiyW9cRvlhg6jvxRggAmgsqfljYw3UsuJiPw2ljVklbucG8

