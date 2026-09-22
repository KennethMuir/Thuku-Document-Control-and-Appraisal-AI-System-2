BEGIN;

WITH catalogue (
    field_key,
    display_name,
    description,
    category,
    data_type,
    aliases,
    repeatable,
    searchable,
    filterable,
    sortable,
    ai_extractable,
    user_editable,
    sensitive,
    validation_rule,
    controlled_vocabulary,
    unit
) AS (
    VALUES

    -- ORGANIZATIONS / PEOPLE
    ('organization_name','Organization Name','Name of the organization associated with the record.','Organizations','text','["company name","institution name","organization"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('organization_code','Organization Code','Internal or official code identifying an organization.','Organizations','text','["org code","organization identifier"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('person_id','Person Identifier','Identifier assigned to a person referenced by the record.','People','text','["employee id","person identifier","staff number"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('person_role','Person Role','Role or capacity in which a person is associated with the record.','People','text','["role","position","capacity"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('department_code','Department Code','Code identifying the responsible department or organizational unit.','Organizations','text','["unit code","department identifier"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('author','Author','Person or organization responsible for creating the content.','People','text','["creator","writer","originator"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('recipient','Recipient','Person or organization receiving the record or communication.','People','text','["addressee","receiver","to"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('approver','Approver','Person responsible for approving the record or associated action.','People','text','["approval authority","authorizing officer"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- RECORDS MANAGEMENT
    ('record_number','Record Number','Official number assigned to the record.','Records Management','text','["record id","record identifier"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('record_series','Record Series','Record series to which the record belongs.','Records Management','text','["series","records series"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('file_number','File Number','Number identifying the physical or electronic file.','Records Management','text','["file reference","file id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('classification_code','Classification Code','Code used to classify the record within an organizational records scheme.','Records Management','text','["records classification","class code"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('retention_period','Retention Period','Period for which the record should be retained.','Records Management','integer','["retention","retention duration"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{"minimum":0}'::jsonb,'{}'::jsonb,'days'),
    ('disposal_action','Disposal Action','Action to be taken when the retention period expires.','Records Management','controlled_vocabulary','["disposition","disposal method"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["DESTROY","TRANSFER","ARCHIVE","REVIEW"]}'::jsonb,NULL),
    ('disposal_date','Disposal Date','Date on which the record is scheduled for disposal or transfer.','Records Management','date','["disposition date","destruction date"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('record_status','Record Status','Current records-management status of the record.','Records Management','controlled_vocabulary','["records status"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["ACTIVE","CLOSED","INACTIVE","ARCHIVED","DISPOSED"]}'::jsonb,NULL),

    -- ADMINISTRATIVE / GOVERNANCE
    ('subject','Subject','Primary subject or topic of the record.','Subject / Classification','text','["topic","subject matter"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('keywords','Keywords','Keywords describing the content of the record.','Subject / Classification','text','["tags","search terms"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('business_function','Business Function','Business function supported or documented by the record.','Governance','text','["function","business activity"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('business_process','Business Process','Business process associated with the record.','Operations','text','["process","workflow process"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('policy_reference','Policy Reference','Policy, procedure, or directive referenced by the record.','Governance','text','["policy id","policy number"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('meeting_date','Meeting Date','Date on which a meeting or formal session occurred.','Administrative','date','["session date"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('meeting_type','Meeting Type','Type or classification of meeting.','Administrative','controlled_vocabulary','["session type"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('action_item','Action Item','Action or task arising from the record.','Workflow / Approval','text','["task","follow-up action"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- DATES / LIFECYCLE
    ('created_date','Created Date','Date on which the record or content was created.','Dates','date','["creation date"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('received_date','Received Date','Date on which the record was received.','Dates','date','["date received"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('effective_date','Effective Date','Date on which the document or decision becomes effective.','Dates','date','["commencement date"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('expiry_date','Expiry Date','Date on which the document, agreement, authorization, or status expires.','Dates','date','["expiration date","valid until"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('review_date','Review Date','Date scheduled for review.','Dates','date','["next review","review due date"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('version_number','Version Number','Version identifier for the record or document.','Dates','text','["version","revision number"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- LEGAL / COMPLIANCE / SECURITY
    ('legal_reference','Legal Reference','Reference to legislation, regulation, case, or legal instrument.','Legal / Regulatory','text','["legal citation","law reference"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('regulatory_reference','Regulatory Reference','Reference to a regulatory requirement or authority.','Legal / Regulatory','text','["regulation","regulatory requirement"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('compliance_status','Compliance Status','Status of compliance associated with the record.','Compliance','controlled_vocabulary','["compliance state"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["COMPLIANT","NON_COMPLIANT","PARTIALLY_COMPLIANT","UNDER_REVIEW"]}'::jsonb,NULL),
    ('risk_level','Risk Level','Risk classification associated with the record.','Risk','controlled_vocabulary','["risk rating","risk category"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{"values":["LOW","MEDIUM","HIGH","CRITICAL"]}'::jsonb,NULL),
    ('security_classification','Security Classification','Security classification assigned to the record.','Security','controlled_vocabulary','["security level","classification level"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{"values":["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED","SECRET"]}'::jsonb,NULL),
    ('access_restriction','Access Restriction','Restriction governing access to the record.','Security','text','["access control","access limitation"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('legal_hold','Legal Hold','Indicates whether the record is subject to a legal hold.','Legal / Regulatory','boolean','["litigation hold"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- FINANCIAL
    ('amount','Amount','Monetary amount associated with the record.','Financial','decimal','["value","total amount"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{"minimum":0}'::jsonb,'{}'::jsonb,NULL),
    ('currency','Currency','Currency associated with a monetary value.','Financial','controlled_vocabulary','["currency code"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["KES","USD","EUR","GBP","UGX","TZS","RWF","GHS","NGN"]}'::jsonb,NULL),
    ('cost_center','Cost Center','Financial cost center associated with the record.','Financial','text','["cost centre","financial unit"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('budget_code','Budget Code','Budget or financial allocation code.','Financial','text','["budget reference","budget identifier"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('invoice_number','Invoice Number','Invoice number associated with the record.','Financial','text','["invoice id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- PROCUREMENT / CONTRACTS
    ('supplier_name','Supplier Name','Name of the supplier or vendor.','Procurement','text','["vendor","supplier"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('purchase_order_number','Purchase Order Number','Purchase order identifier.','Procurement','text','["PO number","purchase order"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('contract_number','Contract Number','Identifier assigned to a contract.','Contracts','text','["agreement number","contract id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('contract_type','Contract Type','Type of contract or agreement.','Contracts','text','["agreement type"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('contract_start_date','Contract Start Date','Start date of a contract or agreement.','Contracts','date','["agreement start"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('contract_end_date','Contract End Date','End date of a contract or agreement.','Contracts','date','["agreement end"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- HUMAN RESOURCES
    ('employee_number','Employee Number','Identifier of an employee associated with the record.','Human Resources','text','["staff number","employee id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('job_title','Job Title','Official job title associated with a person.','Human Resources','text','["position title","designation"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('employment_status','Employment Status','Employment status of the person referenced by the record.','Human Resources','controlled_vocabulary','["staff status"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{"values":["ACTIVE","INACTIVE","CONTRACT","TEMPORARY","FORMER"]}'::jsonb,NULL),
    ('employment_start_date','Employment Start Date','Date employment commenced.','Human Resources','date','["hire date","start date"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- PROJECTS / OPERATIONS
    ('project_name','Project Name','Name of the project associated with the record.','Projects','text','["project"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('project_code','Project Code','Identifier assigned to a project.','Projects','text','["project id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('milestone','Milestone','Project milestone associated with the record.','Projects','text','["project milestone"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('location','Location','Location associated with the record or event.','Geographic','text','["place","site"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('country','Country','Country associated with the record.','Geographic','text','["nation"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('city','City','City associated with the record.','Geographic','text','["town"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('facility','Facility','Facility, building, station, or site associated with the record.','Operations','text','["site","installation"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- ENGINEERING / AVIATION
    ('asset_id','Asset Identifier','Identifier of an asset, equipment item, or system.','Engineering','text','["equipment id","asset number"]'::jsonb,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('equipment_type','Equipment Type','Type of equipment or technical asset.','Engineering','text','["equipment class"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('serial_number','Serial Number','Manufacturer or organizational serial number.','Technical','text','["serial","serial id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('manufacturer','Manufacturer','Manufacturer of equipment or product referenced by the record.','Engineering','text','["maker","OEM"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('aircraft_registration','Aircraft Registration','Aircraft registration identifier.','Aviation','text','["registration","tail number"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('aircraft_type','Aircraft Type','Aircraft model or type associated with the record.','Aviation','text','["aircraft model"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('flight_number','Flight Number','Flight identifier associated with the record.','Aviation','text','["flight id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('airport_code','Airport Code','ICAO or IATA airport identifier.','Aviation','text','["ICAO code","IATA code"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- MEDICAL / RESEARCH / EDUCATION
    ('patient_identifier','Patient Identifier','Identifier for a patient associated with a healthcare record.','Medical / Healthcare','text','["patient id","medical record number"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('case_number','Case Number','Identifier assigned to a case or investigation.','Medical / Healthcare','text','["case id","case reference"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('study_id','Study Identifier','Identifier assigned to a research study.','Research / Scientific','text','["research id","study number"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('researcher','Researcher','Person responsible for research or scientific work.','Research / Scientific','text','["principal investigator","scientist"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('course_code','Course Code','Code identifying an educational course or programme.','Education','text','["subject code","programme code"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('student_identifier','Student Identifier','Identifier for a student associated with the record.','Education','text','["student id","registration number"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- TECHNICAL / DIGITAL
    ('file_name','File Name','Name of the digital file containing the record.','Technical','text','["filename","digital filename"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('file_format','File Format','Format of the digital file.','Technical','text','["format","MIME type"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('file_size','File Size','Size of the digital file.','Technical','integer','["size","file length"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{"minimum":0}'::jsonb,'{}'::jsonb,'bytes'),
    ('checksum','Checksum','Checksum used to verify digital file integrity.','Technical','text','["hash","file hash","digest"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('source_system','Source System','System from which the record originated.','Technical','text','["origin system","system of record"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('language','Language','Primary language of the record content.','Technical','text','["document language"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('page_count','Page Count','Number of pages in the digital or physical document.','Technical','integer','["pages","number of pages"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{"minimum":0}'::jsonb,'{}'::jsonb,'pages'),

    -- MEDIA / AUDIOVISUAL
    ('media_type','Media Type','Type of media represented by the record.','Media / Audiovisual','controlled_vocabulary','["content type","media format"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["DOCUMENT","IMAGE","AUDIO","VIDEO","AUDIOVISUAL"]}'::jsonb,NULL),
    ('duration','Duration','Duration of an audio or video record.','Media / Audiovisual','integer','["length","runtime"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{"minimum":0}'::jsonb,'{}'::jsonb,'seconds'),
    ('creator','Creator','Person or organization responsible for creating a media item.','Media / Audiovisual','text','["producer","originator"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- ARCHIVAL / PRESERVATION
    ('archival_level','Archival Level','Level at which the record is represented in an archival hierarchy.','Archival','controlled_vocabulary','["aggregation level","archival hierarchy"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["FONDS","SERIES","FILE","ITEM"]}'::jsonb,NULL),
    ('archive_reference','Archive Reference','Reference assigned by an archive or repository.','Archival','text','["archival reference","archive id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('preservation_status','Preservation Status','Current digital or physical preservation status.','Preservation','controlled_vocabulary','["preservation state"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["STABLE","AT_RISK","PRESERVATION_REQUIRED","PRESERVED"]}'::jsonb,NULL),
    ('preservation_action','Preservation Action','Preservation action performed or required.','Preservation','text','["preservation treatment"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- RELATIONSHIPS / WORKFLOW
    ('parent_record','Parent Record','Identifier of the parent record in a record hierarchy.','Relationships','reference','["parent","parent record id"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('related_record','Related Record','Reference to another related record.','Relationships','reference','["related document","linked record"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('supersedes_record','Supersedes Record','Record or document superseded by the current record.','Relationships','reference','["replaces","superseded record"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('workflow_status','Workflow Status','Current workflow state of the record.','Workflow / Approval','controlled_vocabulary','["workflow state","process status"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{"values":["DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","REJECTED","COMPLETED","CANCELLED"]}'::jsonb,NULL),
    ('approval_date','Approval Date','Date on which the record or associated action was approved.','Workflow / Approval','date','["date approved"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),

    -- ENVIRONMENTAL
    ('environmental_location','Environmental Location','Geographic or operational location associated with an environmental record.','Environmental','text','["site","sampling location"]'::jsonb,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('measurement_type','Measurement Type','Type of environmental, scientific, or technical measurement.','Environmental','text','["measurement"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL),
    ('measurement_value','Measurement Value','Numeric value of a measurement.','Environmental','decimal','["reading","measurement"]'::jsonb,TRUE,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,'{}'::jsonb,'{}'::jsonb,NULL)

)
INSERT INTO field_registry (
    field_key,
    display_name,
    description,
    category,
    data_type,
    aliases,
    repeatable,
    searchable,
    filterable,
    sortable,
    ai_extractable,
    user_editable,
    sensitive,
    validation_rule,
    controlled_vocabulary,
    unit,
    organization_id,
    is_active
)
SELECT
    c.field_key,
    c.display_name,
    c.description,
    c.category,
    c.data_type,
    c.aliases,
    c.repeatable,
    c.searchable,
    c.filterable,
    c.sortable,
    c.ai_extractable,
    c.user_editable,
    c.sensitive,
    c.validation_rule,
    c.controlled_vocabulary,
    c.unit,
    NULL,
    TRUE
FROM catalogue c
WHERE NOT EXISTS (
    SELECT 1
    FROM field_registry f
    WHERE f.field_key = c.field_key
      AND f.organization_id IS NULL
);

COMMIT;
