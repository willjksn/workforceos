import { relations } from "drizzle-orm";
import { index, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./_common";
import { userStatusEnum } from "./enums";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("organizations_slug_uq").on(table.slug),
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  clerkUserId: text("clerk_user_id"),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  status: userStatusEnum("status").notNull().default("invited"),
  ...timestamps(),
}, (table) => [
  index("users_organization_id_idx").on(table.organizationId),
  uniqueIndex("users_clerk_user_id_uq").on(table.clerkUserId),
  uniqueIndex("users_organization_email_uq").on(table.organizationId, table.email),
]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  index("roles_organization_id_idx").on(table.organizationId),
  uniqueIndex("roles_organization_slug_uq").on(table.organizationId, table.slug),
]);

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("permissions_slug_uq").on(table.slug),
]);

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, {
    onDelete: "cascade",
  }),
  ...timestamps(),
}, (table) => [
  index("role_permissions_role_id_idx").on(table.roleId),
  index("role_permissions_permission_id_idx").on(table.permissionId),
  unique("role_permissions_role_permission_uq").on(table.roleId, table.permissionId),
]);

export const userRoles = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  ...timestamps(),
}, (table) => [
  index("user_roles_user_id_idx").on(table.userId),
  index("user_roles_role_id_idx").on(table.roleId),
  unique("user_roles_user_role_uq").on(table.userId, table.roleId),
]);

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  status: text("status").notNull().default("disabled"),
  ...timestamps(),
}, (table) => [
  index("agents_organization_id_idx").on(table.organizationId),
  uniqueIndex("agents_organization_slug_uq").on(table.organizationId, table.slug),
]);

export const systemSettings = pgTable("system_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("system_settings_key_uq").on(table.key),
]);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  roles: many(roles),
  agents: many(agents),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  userRoles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organizationId],
    references: [organizations.id],
  }),
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one }) => ({
  organization: one(organizations, {
    fields: [agents.organizationId],
    references: [organizations.id],
  }),
}));
