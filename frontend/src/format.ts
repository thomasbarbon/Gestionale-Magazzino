// Auto-format a tire size while the user types. Accepts things like
// "165 55 14", "1655514", "165/55 R14 91V" and returns a formatted
// "165/55 R14 [91V]" string with the mandatory separators ("/", " R", " ")
// inserted automatically.
export function formatSize(raw: string): string {
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const digits = upper.replace(/[^0-9]/g, "");
  const trailingLetters = upper.match(/[A-Z]+$/)?.[0] ?? "";
  // Count the "intent" of separators the user typed (space, slash, dash, R, etc.)
  const sepCount = (upper.match(/[^0-9A-Z]+/g) || []).length;

  const width = digits.slice(0, 3);
  const ratio = digits.slice(3, 5);
  const rim = digits.slice(5, 7);
  const indexNum = digits.slice(7);
  const indexFull = indexNum + trailingLetters;

  const pastWidth =
    width.length === 3 &&
    (digits.length > 3 || sepCount >= 1 || trailingLetters.length > 0);
  const pastRatio =
    ratio.length === 2 &&
    (digits.length > 5 || sepCount >= 2 || trailingLetters.length > 0);

  let out = width;
  if (pastWidth) out = `${width}/${ratio}`;
  if (pastRatio) out += ` R${rim}`;
  if (indexFull) out += ` ${indexFull}`;
  return out;
}
