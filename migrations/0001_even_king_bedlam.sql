CREATE TYPE "public"."saga_status" AS ENUM('STARTED', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."saga_type" AS ENUM('SUBSCRIBE', 'UNSUBSCRIBE');--> statement-breakpoint
CREATE TABLE "sagas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "saga_type" NOT NULL,
	"status" "saga_status" DEFAULT 'STARTED' NOT NULL,
	"payload" jsonb NOT NULL,
	"steps_done" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
