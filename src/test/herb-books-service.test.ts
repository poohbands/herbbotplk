import { describe, it, expect } from 'vitest';
import {
  HERB_BOOKS_DATA,
  HERB_BOOK_CATEGORIES,
  searchHerbBooks,
  formatHerbBooksForAiContext,
} from '../lib/herb-books-service';

describe('Herb Books & CPG Guidelines Service (5th Category)', () => {
  it('loads all 36 clinical reference items across 5 subcategories', () => {
    expect(HERB_BOOKS_DATA.length).toBe(36);
    expect(HERB_BOOK_CATEGORIES.length).toBe(5);

    const categories = new Set(HERB_BOOKS_DATA.map((b) => b.bookCategory));
    expect(categories.size).toBe(5);
  });

  it('contains CPG Department of Medical Services 2568 items with evidence grades', () => {
    const cpgItems = HERB_BOOKS_DATA.filter(
      (b) => b.bookCategory === 'cpg_medical_services_2568'
    );
    expect(cpgItems.length).toBe(9);
    expect(cpgItems.some((b) => b.evidenceLevel?.includes('ก') || b.content.includes('ก1') || b.content.includes('ก2'))).toBe(true);
    expect(cpgItems.every((b) => b.apaCitation.includes('กรมการแพทย์. (2568)'))).toBe(true);
  });

  it('contains drug substitution items with modern drug equivalents', () => {
    const subItems = HERB_BOOKS_DATA.filter(
      (b) => b.bookCategory === 'substitution_modern_drugs_2567'
    );
    expect(subItems.length).toBe(13);

    const curcumaSub = subItems.find((b) => b.herbs.includes('ขมิ้นชัน'));
    expect(curcumaSub).toBeDefined();
    expect(curcumaSub?.modernDrugs).toContain('Omeprazole');

    const thaoWanSub = subItems.find((b) => b.herbs.includes('เถาวัลย์เปรียง'));
    expect(thaoWanSub).toBeDefined();
    expect(thaoWanSub?.modernDrugs).toContain('Diclofenac');
  });

  it('contains primary care flowcharts with ICD-10 and ICD-10-TM codes', () => {
    const flowItems = HERB_BOOKS_DATA.filter(
      (b) => b.bookCategory === 'primary_care_flowchart_icd10'
    );
    expect(flowItems.length).toBe(3);
    expect(flowItems.every((b) => (b.icdCodes || []).length > 0)).toBe(true);
  });

  it('contains NLEM 2566 & 2568 (No.2) items with official APA citations', () => {
    const nlemItems = HERB_BOOKS_DATA.filter(
      (b) => b.bookCategory === 'nlem_updates_2568'
    );
    expect(nlemItems.length).toBe(1);
    expect(nlemItems.every((b) => b.apaCitation.includes('ราชกิจจานุเบกษา'))).toBe(true);
  });

  it('contains common diseases knowledge items', () => {
    const commonItems = HERB_BOOKS_DATA.filter(
      (b) => b.bookCategory === 'common_diseases_10'
    );
    expect(commonItems.length).toBe(10);
  });

  it('accurately searches for drug substitution queries (e.g. Omeprazole)', () => {
    const results = searchHerbBooks('คนไข้กินยา omeprazole อยู่ อยากได้สมุนไพรทดแทน', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].herbs).toContain('ขมิ้นชัน');
    expect(results[0].modernDrugs).toContain('Omeprazole');
  });

  it('accurately searches for CPG queries (e.g. เข่าเสื่อก ข้อเข่าเสื่อม)', () => {
    const results = searchHerbBooks('ข้อเข่าเสื่อม กรมการแพทย์ แนะนำยาสมุนไพรอะไร', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.chapter.includes('ข้อเข่าเสื่อม'))).toBe(true);
  });

  it('formats herb books context clearly for AI generation', () => {
    const results = searchHerbBooks('omeprazole', 1);
    const context = formatHerbBooksForAiContext(results);
    expect(context).toContain('[หนังสือข้อมูลความรู้ด้านยาและแนวทางเวชปฏิบัติ');
    expect(context).toContain('ขมิ้นชัน');
    expect(context).toContain('Omeprazole');
    expect(context).toContain('เอกสารอ้างอิง (APA 7th Edition):');
  });
});
