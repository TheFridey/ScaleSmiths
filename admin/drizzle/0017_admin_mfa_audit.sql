CREATE TABLE "admin_security_audit" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_user_id" uuid,
  "target_user_id" uuid,
  "action" text NOT NULL,
  "success" boolean NOT NULL,
  "metadata_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_security_audit" ADD CONSTRAINT "admin_security_audit_actor_user_id_admin_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_security_audit" ADD CONSTRAINT "admin_security_audit_target_user_id_admin_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "admin_security_audit_actor_idx" ON "admin_security_audit" USING btree ("actor_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "admin_security_audit_target_idx" ON "admin_security_audit" USING btree ("target_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "admin_security_audit_action_idx" ON "admin_security_audit" USING btree ("action","created_at");
