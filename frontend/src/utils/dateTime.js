const BARBADOS_TIME_ZONE = "America/Barbados";

export const formatBarbadosDateTime = (
  value,
  { includeTimeZone = true } = {},
) => {
  if (!value) return "Unknown time";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat("en-BB", {
    timeZone: BARBADOS_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...(includeTimeZone ? { timeZoneName: "short" } : {}),
  }).format(parsed);
};

export { BARBADOS_TIME_ZONE };
