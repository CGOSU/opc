import { cn } from "../lib/utils";
import {
  disclosureLabels,
  relationshipLabels,
  statusLabels,
  type JobDisclosureType,
  type JobStatus,
  type SourceRelationship,
} from "./api";

const basePill =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap border";

export function DisclosureBadge({
  type,
  className,
}: {
  type: JobDisclosureType;
  className?: string;
}) {
  const styles: Record<JobDisclosureType, string> = {
    curated_public: "border-teal-200 bg-teal-50 text-teal-800",
    author_submitted: "border-blue-200 bg-blue-50 text-blue-700",
    sponsored: "border-warning-border bg-warning-surface text-warning",
  };
  return (
    <span className={cn(basePill, styles[type], className)}>
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      <span>{disclosureLabels[type]}</span>
    </span>
  );
}

export function JobStatusBadge({
  status,
  needsReview = false,
  daysSinceVerified,
  className,
}: {
  status: JobStatus;
  needsReview?: boolean;
  daysSinceVerified?: number;
  className?: string;
}) {
  if (status === "open" && needsReview) {
    return (
      <span
        className={cn(
          basePill,
          "border-warning-border bg-warning-surface text-warning",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
        <span>
          待复核{daysSinceVerified !== undefined ? ` · ${daysSinceVerified}天` : ""}
        </span>
      </span>
    );
  }
  const styles: Record<JobStatus, string> = {
    open: "border-success-border bg-success-surface text-success",
    draft: "border-border bg-muted text-muted-foreground",
    expired: "border-border bg-muted text-muted-foreground",
    closed: "border-border bg-muted text-muted-foreground",
    removed:
      "border-destructive-border bg-destructive-surface text-destructive",
  };
  return (
    <span className={cn(basePill, styles[status], className)}>
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      <span>{statusLabels[status]}</span>
    </span>
  );
}

export function SourceStatusBadge({
  relationship,
  optOut,
  className,
}: {
  relationship: SourceRelationship;
  optOut: boolean;
  className?: string;
}) {
  if (optOut) {
    return (
      <span
        className={cn(
          basePill,
          "border-destructive-border bg-destructive-surface text-destructive",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
        <span>拒收名单 opt_out</span>
      </span>
    );
  }
  const styles: Record<SourceRelationship, string> = {
    public: "border-teal-200 bg-teal-50 text-teal-800",
    partner: "border-blue-200 bg-blue-50 text-blue-700",
    sponsored: "border-warning-border bg-warning-surface text-warning",
  };
  return (
    <span className={cn(basePill, styles[relationship], className)}>
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      <span>{relationshipLabels[relationship]}</span>
    </span>
  );
}
