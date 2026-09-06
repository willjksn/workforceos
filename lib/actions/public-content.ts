"use server";

import { redirect } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  archivePublicContentItem,
  createPublicContentItem,
  setPublicContentActive,
  updatePublicContentItem,
} from "@/lib/public-content/service";
import { PublicContentError } from "@/lib/public-content/validation";
import { PUBLIC_CONTENT_PLACEMENTS, PUBLIC_CONTENT_STYLES, PUBLIC_CONTENT_TYPES } from "@/lib/public-content/types";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string };

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function optionalDate(formData: FormData, name: string) {
  const value = optionalText(formData, name);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseForm(formData: FormData) {
  const contentType = String(formData.get("contentType") ?? "");
  const placement = String(formData.get("placement") ?? "home");
  const style = optionalText(formData, "styleVariant");
  return {
    contentType: PUBLIC_CONTENT_TYPES.includes(contentType as (typeof PUBLIC_CONTENT_TYPES)[number])
      ? (contentType as (typeof PUBLIC_CONTENT_TYPES)[number])
      : null,
    title: String(formData.get("title") ?? ""),
    body: optionalText(formData, "body"),
    ctaLabel: optionalText(formData, "ctaLabel"),
    ctaUrl: optionalText(formData, "ctaUrl"),
    linkedJobId: optionalText(formData, "linkedJobId"),
    industryCode: optionalText(formData, "industryCode"),
    placement: PUBLIC_CONTENT_PLACEMENTS.includes(placement as (typeof PUBLIC_CONTENT_PLACEMENTS)[number])
      ? (placement as (typeof PUBLIC_CONTENT_PLACEMENTS)[number])
      : "home",
    styleVariant: style && PUBLIC_CONTENT_STYLES.includes(style as (typeof PUBLIC_CONTENT_STYLES)[number])
      ? (style as (typeof PUBLIC_CONTENT_STYLES)[number])
      : null,
    featureImageKey: optionalText(formData, "featureImageKey"),
    priority: Number(formData.get("priority") ?? 100),
    startsAt: optionalDate(formData, "startsAt"),
    endsAt: optionalDate(formData, "endsAt"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}

export async function createPublicContentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("public_content.manage");
    const parsed = parseForm(formData);
    if (!parsed.contentType) return { error: "Choose a content type." };
    await createPublicContentItem({
      principal,
      data: { ...parsed, contentType: parsed.contentType },
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof PublicContentError) {
      return { error: error.message };
    }
    return { error: "Unable to save public content." };
  }
  redirect("/app/public-content");
}

export async function updatePublicContentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("public_content.manage");
    const id = String(formData.get("id") ?? "");
    const parsed = parseForm(formData);
    if (!id || !parsed.contentType) return { error: "Invalid public content." };
    await updatePublicContentItem({
      principal,
      id,
      data: { ...parsed, contentType: parsed.contentType },
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof PublicContentError) {
      return { error: error.message };
    }
    return { error: "Unable to update public content." };
  }
  redirect("/app/public-content");
}

export async function togglePublicContentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("public_content.publish");
    const id = String(formData.get("id") ?? "");
    const isActive = formData.get("isActive") === "true";
    await setPublicContentActive({ principal, id, isActive });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof PublicContentError) {
      return { error: error.message };
    }
    return { error: "Unable to change publishing state." };
  }
  redirect("/app/public-content");
}

export async function archivePublicContentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("public_content.manage");
    await archivePublicContentItem({ principal, id: String(formData.get("id") ?? "") });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof PublicContentError) {
      return { error: error.message };
    }
    return { error: "Unable to archive public content." };
  }
  redirect("/app/public-content");
}
