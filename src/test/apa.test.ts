import { describe, it, expect } from "vitest";
import { formatApaPubMed, formatApaThaiJo, formatApaInternal } from "@/lib/apa";

describe("APA 7 formatting", () => {
  it("formats pubmed article", () => {
    expect(
      formatApaPubMed({ pmid: "123", title: "Andrographis for fever", authors: "Smith JA, Doe B", year: "2021", journal: "J Ethnopharmacol" }),
    ).toBe("Smith, J. A., & Doe, B. (2021). Andrographis for fever. J Ethnopharmacol. https://pubmed.ncbi.nlm.nih.gov/123/");
  });
  it("uses n.d. when year missing", () => {
    expect(formatApaThaiJo({ title: "ยาจันทน์ลีลา", authors: "", journal: "วารสารการแพทย์แผนไทย", url: "https://x.test/a" })).toBe(
      "ยาจันทน์ลีลา. (n.d.). วารสารการแพทย์แผนไทย. https://x.test/a",
    );
  });
  it("formats internal source", () => {
    expect(formatApaInternal({ type: "herb", name: "ฟ้าทะลายโจร" }, "https://app.test/herbs?herb=1", 2569)).toContain(
      "(2569). ฟ้าทะลายโจร. [ฐานข้อมูลสมุนไพร]. https://app.test/herbs?herb=1",
    );
  });
});
