const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function parseBackendDate(dateStr: string): Date {
  if (!dateStr) {
    return new Date(NaN);
  }

  const trimmed = dateStr.trim();
  const hasTimeZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  return new Date(hasTimeZone ? trimmed : `${trimmed}Z`);
}

export function formatDateTimeVi(dateStr: string): string {
  const date = parseBackendDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatShortDateVi(dateStr: string): string {
  const date = parseBackendDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function formatRelativeTimeVi(dateStr: string): string {
  const date = parseBackendDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) {
    return "Vừa xong";
  }
  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
