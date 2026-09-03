/** ตัวช่วยจัดรูปแบบการอ้างอิงตามหลัก APA 7 */

export type ApaPubMed = { pmid: string; title: string; authors: string; year: string; journal: string };
export type ApaThaiJo = { title: string; authors: string; journal: string; url: string; year?: string };
export type ApaInternal = { type: "herb" | "formula"; name: string };

const ORG_NAME = "กลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก";

function hasThai(s: string): boolean {
  return /[\u0E00-\u0E7F]/.test(s);
}

/** "Smith J" / "Smith JA" → "Smith, J. A." (ชื่อไทยคงเดิม) */
export function formatAuthorName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (/^et\.? al\.?$/i.test(name)) return "et al.";
  if (hasThai(name)) return name;

  const parts = name.split(" ");
  if (parts.length < 2) return name;
  const initialsPart = parts[parts.length - 1];
  // รูปแบบ PubMed: นามสกุลตามด้วยอักษรย่อ เช่น "Smith JA"
  if (/^[A-Z]{1,3}$/.test(initialsPart)) {
    const surname = parts.slice(0, -1).join(" ");
    const initials = initialsPart.split("").map((c) => `${c}.`).join(" ");
    return `${surname}, ${initials}`;
  }
  // รูปแบบ "John Smith" → "Smith, J."
  const surname = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(" ");
  return `${surname}, ${initials}`;
}

/** รวมรายชื่อผู้แต่งตามกติกา APA 7 (ใช้ & หน้าคนสุดท้าย, เกิน 20 คนใช้ ...) */
export function formatAuthorList(authorsRaw: string): string {
  const raw = (authorsRaw || "").trim();
  if (!raw || /^unknown$/i.test(raw)) return "";

  let hasEtAl = false;
  let names = raw
    .split(/,(?![^(]*\))|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => {
      if (/^et\.? al\.?$/i.test(n)) {
        hasEtAl = true;
        return false;
      }
      return true;
    })
    .map(formatAuthorName)
    .filter(Boolean);

  if (names.length === 0) return "";

  if (names.length > 20) {
    names = [...names.slice(0, 19), "...", names[names.length - 1]];
  }

  let list: string;
  if (names.length === 1) {
    list = names[0];
  } else if (names.includes("...")) {
    list = names.join(", ");
  } else {
    list = `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  }

  if (hasEtAl) list = `${names.length === 1 ? names[0] : names.join(", ")}, et al.`;
  return list;
}

function endWithPeriod(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

function yearPart(year?: string): string {
  const y = (year || "").trim();
  return y ? `(${y}).` : "(n.d.).";
}

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/** APA 7 — บทความวารสารจาก PubMed */
export function formatApaPubMed(p: ApaPubMed): string {
  const authors = formatAuthorList(p.authors);
  const head = authors ? `${endWithPeriod(authors)} ${yearPart(p.year)}` : `${endWithPeriod(p.title)} ${yearPart(p.year)}`;
  const title = authors ? ` ${endWithPeriod(p.title)}` : "";
  const journal = p.journal ? ` ${endWithPeriod(p.journal)}` : "";
  return `${head}${title}${journal} ${pubmedUrl(p.pmid)}`.replace(/\s+/g, " ").trim();
}

/** APA 7 — บทความวารสารไทยจาก ThaiJO */
export function formatApaThaiJo(t: ApaThaiJo): string {
  const authors = formatAuthorList(t.authors);
  const head = authors ? `${endWithPeriod(authors)} ${yearPart(t.year)}` : `${endWithPeriod(t.title)} ${yearPart(t.year)}`;
  const title = authors ? ` ${endWithPeriod(t.title)}` : "";
  const journal = t.journal ? ` ${endWithPeriod(t.journal)}` : "";
  return `${head}${title}${journal} ${t.url}`.replace(/\s+/g, " ").trim();
}

/** APA 7 — รายการจากฐานข้อมูลภายในของหน่วยงาน */
export function formatApaInternal(s: ApaInternal, url: string, year = new Date().getFullYear() + 543): string {
  const kind = s.type === "herb" ? "ฐานข้อมูลสมุนไพร" : "ฐานข้อมูลตำรับยาแผนไทย";
  return `${ORG_NAME}. (${year}). ${endWithPeriod(s.name)} [${kind}]. ${url}`;
}
