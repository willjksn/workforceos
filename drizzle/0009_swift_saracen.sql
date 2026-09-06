DELETE FROM "in_app_notifications" AS a
USING "in_app_notifications" AS b
WHERE a."record_id" IS NOT NULL
  AND a."user_id" = b."user_id"
  AND a."kind" = b."kind"
  AND a."record_id" = b."record_id"
  AND a."created_at" < b."created_at";
--> statement-breakpoint
CREATE UNIQUE INDEX "in_app_notifications_user_kind_record_uq" ON "in_app_notifications" USING btree ("user_id","kind","record_id");
