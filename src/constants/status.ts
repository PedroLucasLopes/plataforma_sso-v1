import type { DefaultRoleName, HttpMethod, ProjectStatus } from "@/types/sso";
import type { StatusDefinition } from "@pedrolucaslopes/dotlog-ui";
import { t } from "@/plugins/i18n";

/**
 * Pastilhas de situacao. Tom e icone moram aqui; o rotulo, na traducao.
 *
 * O rotulo e um getter: ele le a lingua na hora em que a pastilha desenha, e
 * troca junto com o resto da tela. O mapa em si e constante, e pode ir direto
 * para o `:map` do `DlStatusChip`.
 */
function labelled<Key extends string>(
  group: string,
  looks: Record<Key, Omit<StatusDefinition, "label">>,
): Record<Key, StatusDefinition> {
  const entries = Object.entries(looks) as [
    Key,
    Omit<StatusDefinition, "label">,
  ][];

  return Object.fromEntries(
    entries.map(([key, look]) => [
      key,
      {
        ...look,
        get label() {
          return t(`status.${group}.${key}`);
        },
      },
    ]),
  ) as Record<Key, StatusDefinition>;
}

/** Situacao do projeto. `PENDING` e o estado de nascimento: existe, mas nao usa o SSO. */
export const PROJECT_STATUS = labelled<ProjectStatus>("project", {
  ACTIVE: { tone: "success", icon: "mdi-check-circle-outline" },
  PENDING: { tone: "warning", icon: "mdi-clock-outline" },
  SUSPENDED: { tone: "error", icon: "mdi-pause-circle-outline" },
});

/**
 * Papel padrao. O de maior privilegio usa o tom de maior contraste, sem cor de
 * alerta. Papel de nome livre segue o mesmo desenho, em tom neutro e com o
 * proprio icone: ver `roleDefinition`.
 */
export const ROLE_STATUS = {
  SUPERADMIN: {
    label: "SUPERADMIN",
    tone: "dark",
    icon: "mdi-shield-crown-outline",
  },
  ADMIN: {
    label: "ADMIN",
    tone: "info",
    icon: "mdi-shield-account-outline",
  },
  MANAGER: {
    label: "MANAGER",
    tone: "neutral",
    icon: "mdi-account-tie-outline",
  },
  VIEWER: { label: "VIEWER", tone: "neutral", icon: "mdi-eye-outline" },
};

/** Icone do papel de nome livre: o escudo dos padrao, com a marca de quem o desenhou. */
export const CUSTOM_ROLE_ICON = "mdi-shield-edit-outline";

export type KeyState = "ACTIVE" | "EXPIRED" | "REVOKED";

export const KEY_STATUS = labelled<KeyState>("key", {
  ACTIVE: { tone: "success", icon: "mdi-key-variant" },
  EXPIRED: { tone: "warning", icon: "mdi-timer-sand-complete" },
  REVOKED: { tone: "dark", icon: "mdi-key-remove" },
});

export type LinkState = "LINKED" | "WAITING";

/** Vinculo com a conta Google, fixado no primeiro login. */
export const LINK_STATUS = labelled<LinkState>("link", {
  LINKED: { tone: "success", icon: "mdi-google" },
  WAITING: { tone: "neutral", icon: "mdi-clock-outline" },
});

/** Os papeis com que todo projeto nasce, do mais amplo ao mais restrito. */
export const DEFAULT_ROLE_NAMES: DefaultRoleName[] = [
  "SUPERADMIN",
  "ADMIN",
  "MANAGER",
  "VIEWER",
];

/** O papel raiz do projeto `SSO`: alcanca tudo, e o SSO nunca fica sem ele. */
export const ROOT_ROLE_NAME: DefaultRoleName = "SUPERADMIN";

export const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

export { httpMethodStatus as METHOD_STATUS } from "@pedrolucaslopes/dotlog-ui";
