import type { DefaultRoleName, ProjectOverview } from "@/types/sso";
import type { StatusDefinition } from "@pedrolucaslopes/dotlog-ui";
import {
  CUSTOM_ROLE_ICON,
  DEFAULT_ROLE_NAMES,
  ROLE_STATUS,
} from "@/constants/status";
import { t } from "@/plugins/i18n";

export type ProjectRoute = ProjectOverview["routes"][number];
export type ProjectRole = ProjectOverview["roles"][number];

/** Rota do projeto no formato da arvore de `@pedrolucaslopes/dotlog-ui`. */
export interface RouteEntry extends ProjectRoute {
  /** Marca no no da arvore. */
  warning?: string;
}

/**
 * Rotas do projeto para a arvore. A que nenhum papel alcanca responde 404 a
 * todo mundo, como se nao existisse, e sai marcada: e o tipo de coisa que so se
 * descobre quando alguem reclama.
 */
export function routeEntries(project: ProjectOverview): RouteEntry[] {
  const granted = new Set(
    project.roles.flatMap((role) =>
      role.permissions.map((permission) => permission.routeId),
    ),
  );

  return project.routes.map((route) =>
    granted.has(route.id)
      ? { ...route }
      : { ...route, warning: t("routes.noRoleGranted") },
  );
}

/** Papeis com permissao para a rota. */
export function rolesGranted(
  project: ProjectOverview,
  routeId: string,
): ProjectRole[] {
  return project.roles.filter((role) =>
    role.permissions.some((permission) => permission.routeId === routeId),
  );
}

export function isDefaultRole(name: string): name is DefaultRoleName {
  return (DEFAULT_ROLE_NAMES as string[]).includes(name);
}

/**
 * Nome livre escrito como os padrao aparecem: so a primeira letra maiuscula, e
 * `_` vira espaco. `GESTOR_FINANCEIRO` vira "Gestor financeiro". O nome gravado
 * continua o mesmo, em maiusculas: e ele que o catalogo e o token carregam.
 */
export function customRoleLabel(name: string): string {
  const words = name.replaceAll("_", " ").trim().toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Pastilha do papel. O padrao tem desenho proprio; o de nome livre, o icone de personalizado. */
export function roleDefinition(name: string): StatusDefinition {
  return isDefaultRole(name)
    ? { ...ROLE_STATUS[name], label: customRoleLabel(ROLE_STATUS[name].label) }
    : { label: customRoleLabel(name), tone: "neutral", icon: CUSTOM_ROLE_ICON };
}

/**
 * Mapa de pastilhas para os papeis dados. `ROLE_STATUS` so conhece os padrao, e o
 * `DlStatusChip` desenha o que nao acha como texto cru, sem icone.
 */
export function roleChips(
  names: readonly string[],
): Record<string, StatusDefinition> {
  return Object.fromEntries(names.map((name) => [name, roleDefinition(name)]));
}

export const roleLabel = (name: string): string => roleDefinition(name).label;

/** Os padrao primeiro, do mais amplo ao mais restrito; depois os de nome livre, em ordem alfabetica. */
export function compareRoleNames(a: string, b: string): number {
  const rank = (name: string): number => {
    const index = DEFAULT_ROLE_NAMES.indexOf(name as DefaultRoleName);

    return index === -1 ? DEFAULT_ROLE_NAMES.length : index;
  };

  return rank(a) - rank(b) || a.localeCompare(b);
}

export function sortRoles<Role extends { name: string }>(
  roles: Role[],
): Role[] {
  return roles.toSorted((a, b) => compareRoleNames(a.name, b.name));
}
