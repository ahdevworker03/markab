import type {
  CreateTaskRequest,
  TaskResponse,
} from "@workspace/api-client-react";
import { formatDate, formatDateInputValue } from "@/lib/format";

export type TaskRecurrenceMode = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
export type TaskRecurrenceEndMode = "NEVER" | "DATE" | "COUNT";
export type TaskRecurrenceUnit = NonNullable<CreateTaskRequest["recurrence_unit"]>;

export interface TaskRecurrenceFormState {
  mode: TaskRecurrenceMode;
  interval: string;
  unit: TaskRecurrenceUnit;
  endMode: TaskRecurrenceEndMode;
  endDate: string;
  endCount: string;
}

export interface TaskRecurrenceErrors {
  interval?: string;
  endDate?: string;
  endCount?: string;
}

export const EMPTY_TASK_RECURRENCE: TaskRecurrenceFormState = {
  mode: "NONE",
  interval: "",
  unit: "DAY",
  endMode: "NEVER",
  endDate: "",
  endCount: "",
};

const PRESET_CONFIG: Record<Exclude<TaskRecurrenceMode, "NONE" | "CUSTOM">, { interval: number; unit: TaskRecurrenceUnit }> = {
  DAILY: { interval: 1, unit: "DAY" },
  WEEKLY: { interval: 1, unit: "WEEK" },
  MONTHLY: { interval: 1, unit: "MONTH" },
};

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

export function validateTaskRecurrence(state: TaskRecurrenceFormState): TaskRecurrenceErrors {
  const errors: TaskRecurrenceErrors = {};

  if (state.mode === "CUSTOM" && !isPositiveInteger(state.interval)) {
    errors.interval = "أدخل عدداً صحيحاً أكبر من صفر.";
  }
  if (state.mode !== "NONE" && state.endMode === "DATE" && !state.endDate) {
    errors.endDate = "أدخل تاريخ انتهاء التكرار.";
  }
  if (state.mode !== "NONE" && state.endMode === "COUNT" && !isPositiveInteger(state.endCount)) {
    errors.endCount = "أدخل عدداً صحيحاً أكبر من صفر.";
  }

  return errors;
}

export function changeTaskRecurrenceMode(
  state: TaskRecurrenceFormState,
  mode: TaskRecurrenceMode,
): TaskRecurrenceFormState {
  if (mode === "NONE") return { ...EMPTY_TASK_RECURRENCE };
  if (mode === "CUSTOM") return { ...state, mode, interval: "", unit: "DAY" };

  const preset = PRESET_CONFIG[mode];
  return { ...state, mode, interval: String(preset.interval), unit: preset.unit };
}

export function changeTaskRecurrenceEndMode(
  state: TaskRecurrenceFormState,
  endMode: TaskRecurrenceEndMode,
): TaskRecurrenceFormState {
  return {
    ...state,
    endMode,
    endDate: endMode === "DATE" ? state.endDate : "",
    endCount: endMode === "COUNT" ? state.endCount : "",
  };
}

export function getTaskRecurrencePayload(
  state: TaskRecurrenceFormState,
): Pick<CreateTaskRequest, "recurrence_interval" | "recurrence_unit" | "recurrence_end_date" | "recurrence_end_count"> {
  if (state.mode === "NONE") {
    return {
      recurrence_interval: null,
      recurrence_unit: null,
      recurrence_end_date: null,
      recurrence_end_count: null,
    };
  }

  const config = state.mode === "CUSTOM"
    ? { interval: Number(state.interval), unit: state.unit }
    : PRESET_CONFIG[state.mode];

  return {
    recurrence_interval: config.interval,
    recurrence_unit: config.unit,
    recurrence_end_date: state.endMode === "DATE" ? state.endDate : null,
    recurrence_end_count: state.endMode === "COUNT" ? Number(state.endCount) : null,
  };
}

export function taskToRecurrenceForm(task: TaskResponse): TaskRecurrenceFormState {
  if (task.recurrenceInterval == null || task.recurrenceUnit == null) {
    return { ...EMPTY_TASK_RECURRENCE };
  }

  const mode = task.recurrenceInterval === 1
    ? ({ DAY: "DAILY", WEEK: "WEEKLY", MONTH: "MONTHLY" } as const)[task.recurrenceUnit]
    : "CUSTOM";

  return {
    mode,
    interval: String(task.recurrenceInterval),
    unit: task.recurrenceUnit,
    endMode: task.recurrenceEndDate ? "DATE" : task.recurrenceEndCount != null ? "COUNT" : "NEVER",
    endDate: task.recurrenceEndDate ?? "",
    endCount: task.recurrenceEndCount == null ? "" : String(task.recurrenceEndCount),
  };
}

export function isRecurringTask(task: TaskResponse): boolean {
  return task.recurrenceInterval != null && task.recurrenceUnit != null;
}

export function formatTaskRecurrence(task: TaskResponse): string {
  const interval = task.recurrenceInterval;
  const unit = task.recurrenceUnit;
  if (interval == null || unit == null) return "بدون تكرار";
  if (interval === 1) return { DAY: "يومي", WEEK: "أسبوعي", MONTH: "شهري" }[unit];

  const isSmallCount = interval >= 3 && interval <= 10;
  if (unit === "DAY") return interval === 2 ? "كل يومين" : `كل ${interval} ${isSmallCount ? "أيام" : "يوم"}`;
  if (unit === "WEEK") return interval === 2 ? "كل أسبوعين" : `كل ${interval} ${isSmallCount ? "أسابيع" : "أسبوع"}`;
  return interval === 2 ? "كل شهرين" : `كل ${interval} ${isSmallCount ? "أشهر" : "شهر"}`;
}

export function formatTaskDateOnly(value: string): string {
  return formatDate(value);
}

function formatOccurrenceCount(count: number): string {
  if (count === 1) return "مرة واحدة";
  if (count === 2) return "مرتين";
  const isSmallCount = count >= 3 && count <= 10;
  return `${count} ${isSmallCount ? "مرات" : "مرة"}`;
}

export function formatTaskRecurrenceEnd(task: TaskResponse): string {
  if (!isRecurringTask(task)) return "—";
  if (task.recurrenceEndDate) return `حتى ${formatTaskDateOnly(task.recurrenceEndDate)}`;
  if (task.recurrenceEndCount != null) return `بعد ${formatOccurrenceCount(task.recurrenceEndCount)}`;
  return "لا ينتهي";
}

export function formatTaskDueDate(value: string): string {
  return formatDate(value);
}

export function taskDueDateInputValue(value: string): string {
  return formatDateInputValue(value);
}
