ALTER TABLE "invoices" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "service_assignment_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "client_service_assignments_id_client_idx" ON "client_service_assignments" USING btree ("id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_projects_id_client_idx" ON "delivery_projects" USING btree ("id","client_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_client_fk" FOREIGN KEY ("project_id","client_id") REFERENCES "public"."delivery_projects"("id","client_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_assignment_client_fk" FOREIGN KEY ("service_assignment_id","client_id") REFERENCES "public"."client_service_assignments"("id","client_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_project_date_idx" ON "invoices" USING btree ("project_id","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_service_assignment_idx" ON "invoices" USING btree ("service_assignment_id");
