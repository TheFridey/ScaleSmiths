CREATE TABLE IF NOT EXISTS "public_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "approved_wording" text NOT NULL,
  "claim_type" text NOT NULL,
  "source_name" text,
  "attribution_name" text,
  "attribution_business" text,
  "client_approval_status" text DEFAULT 'pending' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "verified_by" text,
  "verified_at" timestamp with time zone,
  "review_expires_at" timestamp with time zone,
  "permitted_routes" text[] DEFAULT '{}'::text[] NOT NULL,
  "permitted_components" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "public_claims_status_check" CHECK ("status" IN ('draft', 'verified', 'expired', 'rejected')),
  CONSTRAINT "public_claims_approval_check" CHECK ("client_approval_status" IN ('pending', 'approved', 'declined', 'not_required')),
  CONSTRAINT "public_claims_type_check" CHECK ("claim_type" IN ('numerical', 'revenue', 'retention', 'project_count', 'customer_result', 'testimonial', 'attributed_quote', 'paid_for_itself', 'timeline', 'performance', 'pricing')),
  CONSTRAINT "public_claims_verified_evidence_check" CHECK (
    "status" <> 'verified' OR (
      "verified_by" IS NOT NULL AND
      "verified_at" IS NOT NULL AND
      "review_expires_at" IS NOT NULL AND
      "client_approval_status" IN ('approved', 'not_required') AND
      cardinality("permitted_routes") > 0 AND
      cardinality("permitted_components") > 0
    )
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_claims_status_review_idx" ON "public_claims" USING btree ("status", "review_expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_claims_type_idx" ON "public_claims" USING btree ("claim_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_claim_evidence" (
  "id" serial PRIMARY KEY NOT NULL,
  "claim_id" text NOT NULL REFERENCES "public_claims"("id") ON DELETE CASCADE,
  "evidence_description" text NOT NULL,
  "evidence_reference" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "public_claim_evidence_claim_idx" ON "public_claim_evidence" USING btree ("claim_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_claim_audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "claim_id" text NOT NULL REFERENCES "public_claims"("id") ON DELETE CASCADE,
  "actor_user_id" text NOT NULL,
  "action" text NOT NULL,
  "previous_status" text,
  "new_status" text,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_claim_audit_claim_idx" ON "public_claim_audit_logs" USING btree ("claim_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_claim_audit_actor_idx" ON "public_claim_audit_logs" USING btree ("actor_user_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE VIEW "public_verified_claims" WITH (security_barrier = true) AS
SELECT
  "id",
  "approved_wording",
  "claim_type",
  "attribution_name",
  "attribution_business",
  "permitted_routes",
  "permitted_components",
  "verified_at",
  "review_expires_at"
FROM "public_claims"
WHERE
  "status" = 'verified'
  AND "client_approval_status" IN ('approved', 'not_required')
  AND "verified_at" IS NOT NULL
  AND "verified_at" <= now()
  AND "review_expires_at" IS NOT NULL
  AND "review_expires_at" > now()
  AND EXISTS (
    SELECT 1 FROM "public_claim_evidence" evidence
    WHERE evidence."claim_id" = "public_claims"."id"
  );
--> statement-breakpoint
REVOKE ALL ON "public_claims", "public_claim_evidence", "public_claim_audit_logs", "public_verified_claims" FROM PUBLIC;
--> statement-breakpoint
INSERT INTO "public_claims" ("id", "approved_wording", "claim_type", "source_name", "attribution_name", "attribution_business", "permitted_routes", "permitted_components") VALUES
  ('hero.projects-delivered', '12+ Projects Delivered', 'project_count', 'ScaleSmiths portfolio records', NULL, NULL, ARRAY['/'], ARRAY['hero_stats']),
  ('hero.revenue-generated', 'GBP 300k+ Revenue Generated', 'revenue', 'Client outcome records', NULL, NULL, ARRAY['/'], ARRAY['hero_stats']),
  ('hero.retainer-retention-rate', '100% Retainer Retention Rate', 'retention', 'ScaleSmiths client records', NULL, NULL, ARRAY['/'], ARRAY['hero_stats']),
  ('testimonial.glow-tanning.tom', 'Completely transformed how we look online. The booking integration alone has paid for itself twice over.', 'paid_for_itself', 'Glow Tanning', 'Tom M.', 'Glow Tanning', ARRAY['/'], ARRAY['testimonials']),
  ('testimonial.pinkys-prints.beth', 'Went from a basic Shopify store to a fully custom site that actually feels like our brand. Outstanding work.', 'testimonial', 'Pinkys Prints', 'Beth C.', 'Pinkys Prints', ARRAY['/'], ARRAY['testimonials']),
  ('testimonial.csds.chris', 'Professional, fast, and the admin panel makes everything easy to manage ourselves. Exactly what we needed.', 'testimonial', 'CSDS', 'Chris S.', 'CSDS', ARRAY['/'], ARRAY['testimonials']),
  ('project.glow-tanning.outcome.bookings-first-week', 'Bookings started coming through the website within the first week of launch', 'customer_result', 'Glow Tanning', NULL, NULL, ARRAY['/', '/work/glow-tanning'], ARRAY['project_outcomes']),
  ('project.glow-tanning.outcome.review-display', 'Google and Facebook reviews combined into a single credibility display', 'customer_result', 'Glow Tanning', NULL, NULL, ARRAY['/', '/work/glow-tanning'], ARRAY['project_outcomes']),
  ('project.glow-tanning.outcome.self-managed', 'The client can complete routine content updates without developer assistance', 'customer_result', 'Glow Tanning', NULL, NULL, ARRAY['/', '/work/glow-tanning'], ARRAY['project_outcomes']),
  ('project.pinkys-prints.catalogue-size', 'A catalogue of more than 120 products with variant support', 'numerical', 'Pinkys Prints', NULL, NULL, ARRAY['/', '/work/pinkys-prints'], ARRAY['project_outcomes']),
  ('project.pinkys-prints.outcome.zero-downtime', 'The cloud-to-self-hosted migration completed with no customer-visible downtime', 'performance', 'Pinkys Prints', NULL, NULL, ARRAY['/', '/work/pinkys-prints'], ARRAY['project_outcomes']),
  ('project.pinkys-prints.outcome.monthly-saving', 'The self-hosted platform produced a significant monthly saving compared with the previous services', 'customer_result', 'Pinkys Prints', NULL, NULL, ARRAY['/', '/work/pinkys-prints'], ARRAY['project_outcomes']),
  ('project.csds.outcome.distinctive', 'The design created an immediately distinctive presence in a commodity market', 'customer_result', 'CSDS', NULL, NULL, ARRAY['/', '/work/csds'], ARRAY['project_outcomes']),
  ('project.csds.outcome.less-friction', 'The quote system reduced back-and-forth phone and email friction', 'customer_result', 'CSDS', NULL, NULL, ARRAY['/', '/work/csds'], ARRAY['project_outcomes']),
  ('project.csds.outcome.self-managed', 'The owner can manage all enquiries from one interface', 'customer_result', 'CSDS', NULL, NULL, ARRAY['/', '/work/csds'], ARRAY['project_outcomes']),
  ('project.business-circle.outcome.billing-day-one', 'The production SaaS handled live subscription billing from launch', 'performance', 'The Business Circle', NULL, NULL, ARRAY['/work/the-business-circle'], ARRAY['project_outcomes']),
  ('project.business-circle.outcome.native-video', 'Members can use video rooms without leaving the platform', 'customer_result', 'The Business Circle', NULL, NULL, ARRAY['/work/the-business-circle'], ARRAY['project_outcomes']),
  ('project.business-circle.outcome.roles', 'The multi-tier role system provides granular community access control', 'customer_result', 'The Business Circle', NULL, NULL, ARRAY['/work/the-business-circle'], ARRAY['project_outcomes']),
  ('project.prymal.agent-count', '14 specialist AI agents are packaged into a coordinated business workspace', 'numerical', 'Prymal', NULL, NULL, ARRAY['/work/prymal'], ARRAY['project_outcomes']),
  ('project.prymal.outcome.integrated-platform', 'Knowledge retrieval, workflow orchestration, billing, teams and admin controls are integrated into one product', 'customer_result', 'Prymal', NULL, NULL, ARRAY['/work/prymal'], ARRAY['project_outcomes']),
  ('project.prymal.outcome.production-model', 'The production deployment model includes Docker Compose, Nginx, logging, monitoring and API documentation', 'customer_result', 'Prymal', NULL, NULL, ARRAY['/work/prymal'], ARRAY['project_outcomes']),
  ('project.veteranfinder.outcome.monorepo', 'Separate web, admin and API applications are organised in one maintained repository', 'customer_result', 'VeteranFinder', NULL, NULL, ARRAY['/work/veteranfinder'], ARRAY['project_outcomes']),
  ('project.veteranfinder.outcome.auth', 'The browser session model covers member and admin authentication surfaces', 'customer_result', 'VeteranFinder', NULL, NULL, ARRAY['/work/veteranfinder'], ARRAY['project_outcomes']),
  ('project.veteranfinder.outcome.deployment', 'Deployment runbooks cover both single-server and container-based hosting', 'customer_result', 'VeteranFinder', NULL, NULL, ARRAY['/work/veteranfinder'], ARRAY['project_outcomes']),
  ('service.projects-across-uk', 'ScaleSmiths has delivered projects for local businesses, e-commerce brands and SaaS founders across the UK.', 'project_count', 'ScaleSmiths portfolio records', NULL, NULL, ARRAY['/'], ARRAY['services_intro']),
  ('service.most-clients-retain-30-days', 'Most clients retain within 30 days of launch.', 'retention', 'ScaleSmiths client records', NULL, NULL, ARRAY['/'], ARRAY['retainer_summary']),
  ('process.built-on-time', 'Your site, system or platform is built to the agreed specification and delivered on time.', 'timeline', 'ScaleSmiths delivery records', NULL, NULL, ARRAY['/'], ARRAY['process']),
  ('process.most-clients-retain', 'Most clients convert to a retainer after launch.', 'retention', 'ScaleSmiths client records', NULL, NULL, ARRAY['/'], ARRAY['process']),
  ('portal.every-active-client', 'Every active client gets a private workspace from day one.', 'customer_result', 'ScaleSmiths portal records', NULL, NULL, ARRAY['/'], ARRAY['client_portal']),
  ('delivery.weekly-portal-updates', 'Projects receive weekly updates through the client portal.', 'timeline', 'ScaleSmiths delivery records', NULL, NULL, ARRAY['/'], ARRAY['faq']),
  ('delivery.enquiry-response-one-working-day', 'ScaleSmiths replies to enquiries within one working day.', 'timeline', 'ScaleSmiths enquiry response records', NULL, NULL, ARRAY['/quote/thanks'], ARRAY['enquiry_response']),
  ('portal.support-response-one-working-day', 'Client support requests receive a response within one working day.', 'timeline', 'ScaleSmiths support response records', NULL, NULL, ARRAY['/portal/*'], ARRAY['portal_response']),
  ('timeline.foundation', 'Foundation sites typically take 4-6 weeks.', 'timeline', 'ScaleSmiths delivery records', NULL, NULL, ARRAY['/'], ARRAY['faq']),
  ('timeline.growth', 'Growth builds typically take 8-12 weeks.', 'timeline', 'ScaleSmiths delivery records', NULL, NULL, ARRAY['/'], ARRAY['faq']),
  ('timeline.forge', 'Forge builds typically take 12-24 weeks.', 'timeline', 'ScaleSmiths delivery records', NULL, NULL, ARRAY['/'], ARRAY['faq']),
  ('price.one-page', 'Starting from GBP 2,500', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/pricing'], ARRAY['pricing_card']),
  ('price.foundation', 'Typical range GBP 4,500-6,500', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/', '/pricing'], ARRAY['service_pricing', 'pricing_card', 'faq']),
  ('price.growth', 'Typical range GBP 8,000-15,000', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/', '/pricing'], ARRAY['service_pricing', 'pricing_card', 'faq']),
  ('price.forge', 'Typical range GBP 18,000-35,000+', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/', '/pricing'], ARRAY['service_pricing', 'pricing_card', 'faq']),
  ('price.care-plan', 'From GBP 450/month', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/pricing'], ARRAY['pricing_card']),
  ('price.maintenance-retainer', 'GBP 450-650/month', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/'], ARRAY['retainer_pricing']),
  ('price.growth-retainer', 'GBP 950-1,500/month', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/'], ARRAY['retainer_pricing']),
  ('price.ecosystem-retainer', 'GBP 2,000-3,500/month', 'pricing', 'Current ScaleSmiths rate card', NULL, NULL, ARRAY['/'], ARRAY['retainer_pricing']),
  ('build-log.scalesmiths-platform-build.business-value', 'The site now works as a sales asset and an operations base rather than a static brochure.', 'customer_result', 'ScaleSmiths product review records', NULL, NULL, ARRAY['/work/scalesmiths-platform-build'], ARRAY['build_log_claims']),
  ('build-log.quote-system-hardening.business-value', 'Sales conversations start with better context while the public endpoint stays production-safe.', 'customer_result', 'ScaleSmiths enquiry and security records', NULL, NULL, ARRAY['/work/quote-system-hardening'], ARRAY['build_log_claims']),
  ('build-log.portal-foundation.business-value', 'Prospects can see delivery discipline without being misled by fake SaaS depth.', 'customer_result', 'ScaleSmiths user research records', NULL, NULL, ARRAY['/work/portal-foundation'], ARRAY['build_log_claims']),
  ('build-log.seo-aeo-page-architecture.business-value', 'Search pages now qualify buyers before they reach the quote form.', 'customer_result', 'ScaleSmiths analytics records', NULL, NULL, ARRAY['/work/seo-aeo-page-architecture'], ARRAY['build_log_claims']),
  ('build-log.admin-dashboard-foundation.business-value', 'The team can review leads and client status from one private surface.', 'customer_result', 'ScaleSmiths admin acceptance records', NULL, NULL, ARRAY['/work/admin-dashboard-foundation'], ARRAY['build_log_claims']),
  ('build-log.security-hardening-pass.business-value', 'Security posture becomes part of the sales proof, not just hidden implementation detail.', 'customer_result', 'ScaleSmiths product review records', NULL, NULL, ARRAY['/work/security-hardening-pass'], ARRAY['build_log_claims']),
  ('build-log.scalesmiths-platform-build.outcome', 'Verified production builds for both public and admin apps, with sitemap, metadata, quote handling, and portal foundations in place.', 'performance', 'ScaleSmiths CI and release records', NULL, NULL, ARRAY['/work/scalesmiths-platform-build'], ARRAY['build_log_claims']),
  ('build-log.quote-system-hardening.outcome', 'Unit tests cover validation, honeypot behaviour, rate limiting, generic errors and lead scoring.', 'performance', 'ScaleSmiths CI records', NULL, NULL, ARRAY['/work/quote-system-hardening'], ARRAY['build_log_claims']),
  ('build-log.portal-foundation.outcome', 'Demo access is environment-gated, logout clears the cookie and portal routes redirect unauthenticated users.', 'performance', 'ScaleSmiths implementation records', NULL, NULL, ARRAY['/work/portal-foundation'], ARRAY['build_log_claims']),
  ('build-log.seo-aeo-page-architecture.outcome', 'Landing metadata and schema helpers are unit-tested and the approved landing pages are included in the sitemap.', 'performance', 'ScaleSmiths CI records', NULL, NULL, ARRAY['/work/seo-aeo-page-architecture'], ARRAY['build_log_claims']),
  ('build-log.admin-dashboard-foundation.outcome', 'The admin production build passes with database-backed client and lead pages.', 'performance', 'ScaleSmiths CI records', NULL, NULL, ARRAY['/work/admin-dashboard-foundation'], ARRAY['build_log_claims']),
  ('build-log.security-hardening-pass.outcome', 'Builds and tests verify the documented hardened surfaces without weakening the content security policy.', 'performance', 'ScaleSmiths CI and security records', NULL, NULL, ARRAY['/work/security-hardening-pass'], ARRAY['build_log_claims'])
ON CONFLICT ("id") DO NOTHING;
