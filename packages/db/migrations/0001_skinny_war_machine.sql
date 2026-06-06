CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_workspace_task_created" ON "ai_suggestions" USING btree ("workspace_id","task_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_workspace_status" ON "ai_suggestions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_workspace_created" ON "task_activity_events" USING btree ("workspace_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_workspace_task_created" ON "task_activity_events" USING btree ("workspace_id","task_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_assignees_task" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checklist_workspace_task_position" ON "task_checklist_items" USING btree ("workspace_id","task_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_workspace_task_created" ON "task_comments" USING btree ("workspace_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_labels_task" ON "task_labels" USING btree ("task_id");