const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const businessDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
});
const businessDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export function pesos(value: string | number | null | undefined) {
  return value == null || value === "" ? "—" : peso.format(Number(value));
}
export function phDate(value: string | Date = new Date()) {
  return businessDate.format(new Date(value));
}
export function phDateTime(value: string | Date) {
  return businessDateTime.format(new Date(value)) + " PHT";
}
