import { describe, it, expect } from "vitest";
import {
  searchHerbs97ByName,
  getCannabisMedicines,
  normalizePhoneticThai,
} from "../lib/herbs97-service";

describe("Cannabis Medicines Retrieval Engine", () => {
  it("returns exactly 11 cannabis medicines from getCannabisMedicines", () => {
    const list = getCannabisMedicines();
    expect(list.length).toBe(11);
    const names = list.map((i) => i.name);
    expect(names.some((n) => n.includes("ศุขไสยาศน์"))).toBe(true);
    expect(names.some((n) => n.includes("ประสะกัญชา"))).toBe(true);
    expect(names.some((n) => n.includes("1:1"))).toBe(true);
    expect(names.some((n) => n.includes("20:1"))).toBe(true);
  });

  it("returns all 11 cannabis medicines when asked broad cannabis queries", () => {
    const res = searchHerbs97ByName("ยากัญชา มีอะไรบ้าง");
    expect(res.length).toBe(11);
    const indices = res.map((r) => r.index);
    expect(indices).toContain(26);
    expect(indices).toContain(31);
    expect(indices).toContain(58);
    expect(indices).toContain(64);
    expect(indices).toContain(66);
    expect(indices).toContain(67);
    expect(indices).toContain(79);
    expect(indices).toContain(94);
    expect(indices).toContain(95);
    expect(indices).toContain(96);
    expect(indices).toContain(97);
  });

  it("finds Item 67 (น้ำมันกัญชา 1:1) as top match for 'น้ำมันกัญชา 1:1' and 'กัญชา 1 ต่อ 1'", () => {
    const res1 = searchHerbs97ByName("น้ำมันกัญชา 1:1");
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].index).toBe(67);

    const res2 = searchHerbs97ByName("กัญชา 1 ต่อ 1 สรรพคุณอะไร");
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].index).toBe(67);
  });

  it("finds Item 94 (CBD 20:1) as top match for 'น้ำมันกัญชา CBD 20:1' and 'กัญชา 20 ต่อ 1'", () => {
    const res1 = searchHerbs97ByName("น้ำมันกัญชา CBD 20:1");
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].index).toBe(94);

    const res2 = searchHerbs97ByName("กัญชา 20 ต่อ 1");
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].index).toBe(94);
  });

  it("handles spelling and phonetic variations like 'สุขไสยาศน์' and 'สุขไสยาสน์'", () => {
    // Phonetic normalization check
    expect(normalizePhoneticThai("ศุขไสยาศน์")).toBe("สุขไสยาส");
    expect(normalizePhoneticThai("สุขไสยาสน์")).toBe("สุขไสยาส");

    const res1 = searchHerbs97ByName("สุขไสยาศน์ มีข้อห้ามอะไรบ้าง");
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].index).toBe(97);

    const res2 = searchHerbs97ByName("ยาสุขไสยาสน์");
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].index).toBe(97);
  });

  it("handles 'อมฤตโอสถ' variation to match Item 79 (ยาอัมฤตย์โอสถ)", () => {
    const res = searchHerbs97ByName("ยาอมฤตโอสถ มีส่วนประกอบอะไร");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].index).toBe(79);
  });

  it("finds Item 95 (ช่อดอก) when querying 'น้ำมันกัญชาช่อดอก'", () => {
    const res = searchHerbs97ByName("น้ำมันกัญชาช่อดอก");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].index).toBe(95);
  });

  it("finds Item 58 (ยาแก้ลมแก้เส้น) when querying 'ลมแก้เส้น'", () => {
    const res = searchHerbs97ByName("ลมแก้เส้น");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].index).toBe(58);
  });

  it("finds Item 64 (ยาทำลายพระสุเมรุ) when querying 'ทำลายพระสุเมรุ'", () => {
    const res = searchHerbs97ByName("ทำลายพระสุเมรุ");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].index).toBe(64);
  });
});
