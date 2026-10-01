export type AppRole = "admin" | "coach";

export const APP_ROLES: AppRole[] = ["admin", "coach"];

export const OWNER_HOME = "/admin/klub";

export function roleHome(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "coach":
      return "/coach";
  }
}
