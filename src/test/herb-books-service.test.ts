import { describe, it, expect } from 'vitest';
import {
  HERB_BOOKS_DATA,
  HERB_BOOK_CATEGORIES,
  searchHerbBooks,
  searchHerbBooksTiered,
  formatHerbBooksForAiContext,
  isHerbDrugInteractionQuery,
  searchCpgHerbDrugInteractions,
  classifyQueryIntent,
} from '../lib/herb-books-service';

describe('Herb Books & CPG Guidelines Service (7 Tiers Hierarchy with Short-Circuit Retrieval)', () => {
  it('loads all 55 clinical reference items across 7 priority tiers', () => {
    expect(HERB_BOOKS_DATA.length).toBe(55);
    expect(HERB_BOOK_CATEGORIES.length).toBe(7);

    const categories = new Set(HERB_BOOKS_DATA.map((b) => b.bookCategory));
    expect(categories.size).toBe(7);

    const tiers = new Set(HERB_BOOKS_DATA.map((b) => b.tier));
    expect(tiers.size).toBe(7);
  });

  it('contains Tier 1: 25680421113642AM_คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ.pdf (26 items)', () => {
    const tier1Items = HERB_BOOKS_DATA.filter((b) => b.tier === 1);
    expect(tier1Items.length).toBe(26);
    expect(tier1Items.every((b) => b.sourceFile === '25680421113642AM_คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ.pdf')).toBe(true);
    expect(tier1Items.every((b) => b.apaCitation.includes('กรมการแพทย์. (2568)'))).toBe(true);
  });

  it('contains Tier 2: สมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจ 11-12-67.pdf (13 items)', () => {
    const tier2Items = HERB_BOOKS_DATA.filter((b) => b.tier === 2);
    expect(tier2Items.length).toBe(13);
    expect(tier2Items.every((b) => b.sourceFile === 'สมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจ 11-12-67.pdf')).toBe(true);

    const curcumaSub = tier2Items.find((b) => b.herbs.includes('ขมิ้นชัน'));
    expect(curcumaSub).toBeDefined();
    expect(curcumaSub?.modernDrugs).toContain('Omeprazole');
  });

  it('contains Tier 3: แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร.pdf (3 items)', () => {
    const tier3Items = HERB_BOOKS_DATA.filter((b) => b.tier === 3);
    expect(tier3Items.length).toBe(3);
    expect(tier3Items.every((b) => b.sourceFile === 'แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร.pdf')).toBe(true);
    expect(tier3Items.every((b) => (b.icdCodes || []).length > 0)).toBe(true);
  });

  it('contains Tier 4: 2568_2.pdf และ 2568_2_summary.pdf (1 item)', () => {
    const tier4Items = HERB_BOOKS_DATA.filter((b) => b.tier === 4);
    expect(tier4Items.length).toBe(1);
    expect(tier4Items[0].sourceFile).toBe('2568_2.pdf และ 2568_2_summary.pdf');
    expect(tier4Items[0].apaCitation).toContain('ราชกิจจานุเบกษา');
  });

  it('contains Tier 5: CD 10 กลุ่มโรค (10 items)', () => {
    const tier5Items = HERB_BOOKS_DATA.filter((b) => b.tier === 5);
    expect(tier5Items.length).toBe(10);
    expect(tier5Items.every((b) => b.sourceFile === 'CD 10 กลุ่มโรค')).toBe(true);
  });

  it('contains Tier 6: CD 10 กลุ่มอาการ A5.png (1 item)', () => {
    const tier6Items = HERB_BOOKS_DATA.filter((b) => b.tier === 6);
    expect(tier6Items.length).toBe(1);
    expect(tier6Items[0].sourceFile).toBe('CD 10 กลุ่มอาการ A5.png');
    expect(tier6Items[0].apaCitation).toContain('สำนักงานสาธารณสุขจังหวัดบุรีรัมย์');
    expect(tier6Items[0].herbs).toContain('เถาวัลย์เปรียง');
  });

  it('contains Tier 7: ยาทดแทน 19 รายการ A5.png (1 item)', () => {
    const tier7Items = HERB_BOOKS_DATA.filter((b) => b.tier === 7);
    expect(tier7Items.length).toBe(1);
    expect(tier7Items[0].sourceFile).toBe('ยาทดแทน 19 รายการ A5.png');
    expect(tier7Items[0].apaCitation).toContain('สำนักงานสาธารณสุขจังหวัดบุรีรัมย์');
    expect(tier7Items[0].modernDrugs).toContain('Omeprazole');
    expect(tier7Items[0].modernDrugs).toContain('Daflon');
  });

  it('searchHerbBooksTiered: stops immediately at Tier 1 for DDI questions and does not search Tier 2-7', () => {
    const result = searchHerbBooksTiered('ขมิ้นชันกินร่วมกับ warfarin ได้ไหม', 3);
    expect(result.matchedTier).toBe(1);
    expect(result.sourceFile).toBe('25680421113642AM_คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ.pdf');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.tier === 1)).toBe(true);
    expect(result.items[0].apaCitation).toContain('กรมการแพทย์. (2568)');
  });

  it('searchHerbBooksTiered: stops at Tier 2 for modern drug substitution questions', () => {
    const result = searchHerbBooksTiered('สมุนไพรทดแทนยา omeprazole หรือ simvastatin', 3);
    expect(result.matchedTier).toBe(2);
    expect(result.sourceFile).toBe('สมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจ 11-12-67.pdf');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.tier === 2)).toBe(true);
  });

  it('searchHerbBooksTiered: stops at Tier 3 for primary care decision flowcharts and ICD-10 questions', () => {
    const result = searchHerbBooksTiered('แผนภูมิปฐมภูมิ รหัสโรค icd-10 และเกณฑ์ส่งต่อ', 3);
    expect(result.matchedTier).toBe(3);
    expect(result.sourceFile).toBe('แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร.pdf');
    expect(result.items.every((i) => i.tier === 3)).toBe(true);
  });

  it('searchHerbBooksTiered: stops at Tier 4 for NLEM 2568 update queries', () => {
    const result = searchHerbBooksTiered('ประกาศบัญชียาหลักแห่งชาติด้านสมุนไพร 2568 ฉบับที่ 2 มีรายการปรับปรุงใหม่อะไรบ้าง', 3);
    expect(result.matchedTier).toBe(4);
    expect(result.sourceFile).toBe('2568_2.pdf และ 2568_2_summary.pdf');
    expect(result.items.every((i) => i.tier === 4)).toBe(true);
  });

  it('searchHerbBooksTiered: stops at Tier 5 for CD 10 disease cards', () => {
    const result = searchHerbBooksTiered('ชุดความรู้ cd 10 บัตรความรู้โรคท้องผูกและริดสีดวงทวารหนัก', 3);
    expect(result.matchedTier).toBe(5);
    expect(result.sourceFile).toBe('CD 10 กลุ่มโรค');
    expect(result.items.every((i) => i.tier === 5)).toBe(true);
  });

  it('searchHerbBooksTiered: stops at Tier 6 for CD 10 symptoms poster A5', () => {
    const result = searchHerbBooksTiered('แผ่นภาพ A5 cd 10 กลุ่มอาการ บุรีรัมย์', 3);
    expect(result.matchedTier).toBe(6);
    expect(result.sourceFile).toBe('CD 10 กลุ่มอาการ A5.png');
    expect(result.items.every((i) => i.tier === 6)).toBe(true);
  });

  it('searchHerbBooksTiered: stops at Tier 7 for substitution 19 remedies poster A5', () => {
    const result = searchHerbBooksTiered('แผ่นภาพโปสเตอร์ ยาทดแทน 19 รายการ a5 บุรีรัมย์', 3);
    expect(result.matchedTier).toBe(7);
    expect(result.sourceFile).toBe('ยาทดแทน 19 รายการ A5.png');
    expect(result.items.every((i) => i.tier === 7)).toBe(true);
  });

  it('formats herb books context clearly for AI generation', () => {
    const results = searchHerbBooks('omeprazole', 1);
    const context = formatHerbBooksForAiContext(results);
    expect(context).toContain('[หนังสือและเอกสารข้อมูลความรู้ด้านยาและเวชปฏิบัติ');
    expect(context).toContain('ขมิ้นชัน');
    expect(context).toContain('Omeprazole');
    expect(context).toContain('เอกสารอ้างอิง (APA 7th Edition):');
  });

  it('isHerbDrugInteractionQuery correctly detects DDI queries', () => {
    expect(isHerbDrugInteractionQuery('ขมิ้นชันกินร่วมกับ warfarin ได้ไหม')).toBe(true);
    expect(isHerbDrugInteractionQuery('ฟ้าทะลายโจรมีอันตรกิริยากับยาอะไรบ้าง')).toBe(true);
    expect(isHerbDrugInteractionQuery('กินขิงพร้อมยาแอสไพรินตีกันไหม')).toBe(true);
    expect(isHerbDrugInteractionQuery('คนกิน warfarin ห้ามกินกับยาสมุนไพรอะไร')).toBe(true);
    expect(isHerbDrugInteractionQuery('สรรพคุณของขมิ้นชันมีอะไรบ้าง')).toBe(false);
    expect(isHerbDrugInteractionQuery('คนไข้มีอาการน้ำเหลืองเสีย ผื่นคัน เรามียาอะไรบ้าง')).toBe(false);
  });

  it('searchCpgHerbDrugInteractions searches exclusively in CPG 2568 monographs', () => {
    const curcumaDdi = searchCpgHerbDrugInteractions('ขมิ้นชันกับ warfarin', 2);
    expect(curcumaDdi.length).toBeGreaterThan(0);
    expect(curcumaDdi[0].bookCategory).toBe('cpg_medical_services_2568');
    expect(curcumaDdi[0].herbs).toContain('ขมิ้นชัน');
    expect(curcumaDdi[0].modernDrugs).toContain('Warfarin');
    expect(curcumaDdi[0].apaCitation).toBe('กรมการแพทย์. (2568). คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ. กระทรวงสาธารณสุข.');

    const andrographisDdi = searchCpgHerbDrugInteractions('ฟ้าทะลายโจร', 1);
    expect(andrographisDdi.length).toBeGreaterThan(0);
    expect(andrographisDdi[0].herbs).toContain('ฟ้าทะลายโจร');
    expect(andrographisDdi[0].modernDrugs).toContain('Warfarin');
  });

  it('searchHerbBooks prioritizes CPG monograph DDI item when asked about DDI', () => {
    const results = searchHerbBooks('ขมิ้นชันกินร่วมกับ warfarin ได้ไหม', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].bookCategory).toBe('cpg_medical_services_2568');
    expect(results[0].herbs).toContain('ขมิ้นชัน');
    expect(results[0].title).toContain('อันตรกิริยา');
  });

  describe('Intent-Driven Query Routing & All-Source APA Citations', () => {
    it('classifyQueryIntent correctly categorizes queries by clinical intent', () => {
      expect(classifyQueryIntent('ขมิ้นชันกินร่วมกับ warfarin ได้ไหม')).toBe('ddi');
      expect(classifyQueryIntent('สมุนไพรทดแทนยา omeprazole')).toBe('substitution');
      expect(classifyQueryIntent('แผนภูมิปฐมภูมิ รหัสโรค icd-10')).toBe('clinical_flowchart');
      expect(classifyQueryIntent('ประกาศบัญชียาหลักแห่งชาติด้านสมุนไพร 2568 ฉบับที่ 2 ปรับปรุงใหม่ 29 รายการ')).toBe('nlem_update');
      expect(classifyQueryIntent('ชุดความรู้ cd 10 บัตรความรู้โรคท้องผูก')).toBe('disease_education');
      expect(classifyQueryIntent('แผ่นภาพ A5 cd 10 กลุ่มอาการ บุรีรัมย์')).toBe('poster_symptoms');
      expect(classifyQueryIntent('แผ่นภาพโปสเตอร์ ยาทดแทน 19 รายการ a5 บุรีรัมย์')).toBe('poster_substitution');
      expect(classifyQueryIntent('สรรพคุณของขมิ้นชัน')).toBe('general');
    });

    it('searchHerbBooksTiered: for substitution intent, returns Tier 2 primary + Tier 7 supplementary with both APA citations', () => {
      const result = searchHerbBooksTiered('สมุนไพรทดแทนยา omeprazole', 3);
      expect(result.intent).toBe('substitution');
      expect(result.matchedTier).toBe(2);
      expect(result.primaryItems.length).toBeGreaterThan(0);
      expect(result.primaryItems.every((i) => i.tier === 2)).toBe(true);
      expect(result.allMatchedTiers).toContain(2);
      expect(result.allMatchedTiers).toContain(7);
      expect(result.supplementaryItems.length).toBeGreaterThan(0);
      expect(result.supplementaryItems.every((i) => i.tier === 7)).toBe(true);

      // ตรวจสอบการอ้างอิงทุกแหล่งข้อมูล (แหล่งหลักอยู่อันดับแรก ตามด้วยแหล่งเสริม)
      expect(result.allApaCitations.length).toBe(2);
      expect(result.allApaCitations[0]).toContain('แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบัน');
      expect(result.allApaCitations[1]).toContain('ยาทดแทน 19 รายการ');
    });

    it('searchHerbBooksTiered: for DDI intent, strictly returns ONLY Tier 1 with no supplementary book items', () => {
      const result = searchHerbBooksTiered('ขมิ้นชันกินร่วมกับ warfarin ได้ไหม', 3);
      expect(result.intent).toBe('ddi');
      expect(result.matchedTier).toBe(1);
      expect(result.primaryItems.every((i) => i.tier === 1)).toBe(true);
      expect(result.supplementaryItems.length).toBe(0);
      expect(result.allMatchedTiers).toEqual([1]);
      expect(result.allApaCitations.length).toBe(1);
      expect(result.allApaCitations[0]).toContain('กรมการแพทย์. (2568)');
    });

    it('searchHerbBooksTiered: for clinical flowchart intent, returns Tier 3 primary and supplementary items with all citations', () => {
      const result = searchHerbBooksTiered('แผนภูมิปฐมภูมิ รหัสโรค icd-10 และเกณฑ์ส่งต่อ', 3);
      expect(result.intent).toBe('clinical_flowchart');
      expect(result.matchedTier).toBe(3);
      expect(result.primaryItems.every((i) => i.tier === 3)).toBe(true);
      expect(result.allApaCitations[0]).toContain('แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพรในระบบบริการปฐมภูมิ');
    });

    it('searchHerbs97ByName correctly identifies ยาห้าราก with antipyretic indication', async () => {
      const { searchHerbs97ByName } = await import('@/lib/herbs97-service');
      const h97 = searchHerbs97ByName('ยาห้ารากใช้ในกรณีใด และมีวิธีใช้อย่างไร?');
      expect(h97.length).toBeGreaterThan(0);
      const haRak = h97.find((h) => h.name.includes('ยาห้าราก'));
      expect(haRak).toBeDefined();
      expect(haRak?.indication).toContain('บรรเทาอาการไข้');
      expect(haRak?.indication).not.toContain('ท้องอืด');
    });
  });
});

