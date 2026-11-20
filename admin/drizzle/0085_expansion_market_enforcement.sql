-- Operation Intelligence checkpoint 5 (forward-only): three distinct markets.
--  * applicant residence  — where the applicant lives; informational, never authorises anything
--  * partner operating market — where the partner may operate; gates invitation, activation and commercial progression
--  * customer commercial market — expansion_opportunities.customer_country (existing); gates progression, scope approval and acceptance
-- The default 'GB' is the programme's only candidate market. It authorises nothing: the market must still be founder-approved
-- (legal, accounting, privacy and operations reviewed) and every gate fails closed while it is not.
ALTER TABLE expansion_partners ADD COLUMN operating_country text NOT NULL DEFAULT 'GB' CHECK (operating_country ~ '^[A-Z]{2}$');
ALTER TABLE partner_applications ADD COLUMN residence_country text CHECK (residence_country IS NULL OR residence_country ~ '^[A-Z]{2}$');
