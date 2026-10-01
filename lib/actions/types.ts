export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  tempPassword?: string;
}

export const PLAN_LIMIT_CODES = new Set(["SW001", "SW002", "SW003", "SW004"]);

export const INITIAL_ACTION_STATE: ActionState = {};
