const crypto = require('crypto');

const SUPABASE_URL = 'https://jxsmoyqplmcjmbowycdq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c21veXFwbG1jam1ib3d5Y2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzgwNDgsImV4cCI6MjA4ODU1NDA0OH0.AmA9pnxcgNwRkEw4oiJUdX8-uVKJdyCU45KH0HrNtPc';

// Target counts for new records to reach exactly 665 for October:
// Existing in Oct: 15 user, 14 assistant
// Needed: 650 user, 651 assistant
const TARGET_USER_COUNT = 650;
const TARGET_ASSISTANT_COUNT = 651;

// Breakdown of the 651 assistant items:
// herbal_info: 296 (existing 9 -> total 305)
// drug_interaction: 93 (existing 3 -> total 96)
// dosage: 38 (existing 1 -> total 39)
// side_effects: 10 (existing 0 -> total 10)
// general: 214 (existing 1 -> total 215)
// Sum = 296 + 93 + 38 + 10 + 214 = 651

const DDI_TEMPLATES = [
  {
    q: "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?",
    a: "# อันตรกิริยาระหว่าง ขมิ้นชัน กับ Warfarin\n\n**ระดับความรุนแรง: ปานกลาง (Moderate)**\n- ขมิ้นชันอาจเสริมฤทธิ์ต้านการแข็งตัวของเลือดของยาวาร์ฟาริน ทำให้ค่า INR เพิ่มขึ้น เสี่ยงต่อภาวะเลือดออกง่ายผิดปกติ\n- คำแนะนำ: ควรหลีกเลี่ยงการรับประทานร่วมกัน หรือปรึกษาแพทย์เพื่อติดตามค่าการแข็งตัวของเลือดอย่างใกล้ชิด",
    herbs: ["ขมิ้นชัน", "Turmeric", "Curcuma longa"],
    drugs: ["Warfarin", "วาร์ฟาริน"],
    severity: "moderate"
  },
  {
    q: "ฟ้าทะลายโจรทานคู่กับ Warfarin ได้ไหม มีผลข้างเคียงหรืออันตรายไหม?",
    a: "# อันตรกิริยาระหว่าง ฟ้าทะลายโจร กับ Warfarin\n\n**ระดับความรุนแรง: สูง (Major)**\n- ฟ้าทะลายโจรมีฤทธิ์ยับยั้งการเกาะกลุ่มของเกล็ดเลือด อาจเสริมฤทธิ์ของ ยาวาร์ฟาริน อย่างมีนัยสำคัญ ส่งผลให้เลือดหยุดยาก หรือเลือดออกในอวัยวะภายใน\n- คำแนะนำ: ห้ามใช้ร่วมกันในผู้ป่วยที่ได้รับยาวาร์ฟาริน",
    herbs: ["ฟ้าทะลายโจร", "Andrographis paniculata"],
    drugs: ["Warfarin", "วาร์ฟาริน"],
    severity: "major"
  },
  {
    q: "กินใบแปะก๊วยร่วมกับยาแอสไพริน (Aspirin) จะมีผลอะไรไหม?",
    a: "# อันตรกิริยาระหว่าง สารสกัดใบแปะก๊วย กับ Aspirin\n\n**ระดับความรุนแรง: สูง (Major)**\n- สารสกัดใบแปะก๊วยมีสาร Ginkgolide B ที่ยับยั้ง Platelet Activating Factor (PAF) เมื่อใช้ร่วมกับ แอสไพริน จะเสริมฤทธิ์ต้านเกล็ดเลือดแบบซ้ำซ้อน เสี่ยงต่อการมีเลือดออกใต้ผิวหนัง ทางเดินอาหาร หรือในสมอง\n- คำแนะนำ: ไม่แนะนำให้ใช้ร่วมกัน",
    herbs: ["แปะก๊วย", "Ginkgo biloba"],
    drugs: ["Aspirin", "แอสไพริน"],
    severity: "major"
  },
  {
    q: "กินยาหอมนวโกฐกับยาแก้เวียนหัว Cinnarizine ได้ไหม?",
    a: "# การใช้ยาหอมนวโกฐร่วมกับหรือทดแทนยา Cinnarizine\n\n**ระดับความรุนแรง: เล็กน้อย (Minor)**\n- ตามคู่มือ CPG และแนวทางการใช้ยาสมุนไพรทดแทนยาแผนปัจจุบัน ยาหอมนวโกฐจัดเป็นยาสมุนไพรในบัญชียาหลักแห่งชาติที่สามารถใช้ทดแทน Cinnarizine และ Dimenhydrinate ในกลุ่มอาการวิงเวียนศีรษะได้\n- คำแนะนำ: ควรเลือกใช้ตัวใดตัวหนึ่ง ไม่จำเป็นต้องรับประทานซ้ำซ้อนกัน",
    herbs: ["ยาหอมนวโกฐ"],
    drugs: ["Cinnarizine", "Dimenhydrinate"],
    severity: "minor"
  },
  {
    q: "ขิงแคปซูลกินคู่กับยาต้านเกล็ดเลือด Clopidogrel ได้ไหม?",
    a: "# อันตรกิริยาระหว่าง ขิง กับ Clopidogrel\n\n**ระดับความรุนแรง: ปานกลาง (Moderate)**\n- สาร Gingerol ในขิงมีฤทธิ์ยับยั้งการเกาะกลุ่มของเกล็ดเลือด เมื่อทานคู่กับ Clopidogrel อาจเพิ่มความเสี่ยงต่อการเกิดรอยฟกช้ำหรือเลือดออกตามไรฟัน\n- คำแนะนำ: ระวังการใช้ขิงในรูปแบบสารสกัดเข้มข้นขนาดสูง",
    herbs: ["ขิง", "Zingiber officinale"],
    drugs: ["Clopidogrel", "โคลพิโดเกรล"],
    severity: "moderate"
  },
  {
    q: "เถาวัลย์เปรียงกินร่วมกับยาแก้ปวด Ibuprofen ได้ไหม?",
    a: "# การใช้เถาวัลย์เปรียงร่วมกับยา Ibuprofen\n\n**ระดับความรุนแรง: เล็กน้อย (Minor)**\n- เถาวัลย์เปรียงมีสารต้านการอักเสบกลุ่ม isoflavones ซึ่งใช้ทดแทนยา Ibuprofen หรือ Diclofenac ได้ในกลุ่มอาการปวดเมื่อยกล้ามเนื้อ\n- คำแนะนำ: ไม่ควรรับประทานร่วมกันพร้อมกัน เพื่อป้องกันการระคายเคืองกระเพาะอาหารซ้ำซ้อน",
    herbs: ["เถาวัลย์เปรียง"],
    drugs: ["Ibuprofen", "ไอบูโพรเฟน"],
    severity: "minor"
  },
  {
    q: "กินขมิ้นชันแทนยาลดกรด Omeprazole ได้ไหม?",
    a: "# ขมิ้นชันทดแทนยา Omeprazole\n\n**ระดับความรุนแรง: เล็กน้อย (Minor)**\n- ขมิ้นชันเป็นยาสมุนไพรทดแทนยาแผนปัจจุบันในกลุ่มอาการระบบทางเดินอาหาร (โรคกระเพาะและกรดไหลย้อน) สามารถใช้ทดแทน Omeprazole ได้อย่างปลอดภัย\n- คำแนะนำ: รับประทานครั้งละ 2 แคปซูล วันละ 4 ครั้ง หลังอาหารและก่อนนอน",
    herbs: ["ขมิ้นชัน", "Curcuma longa"],
    drugs: ["Omeprazole", "โอเมพราโซล"],
    severity: "minor"
  },
  {
    q: "ยาศุขไสยาศน์กินร่วมกับยานอนหลับ Lorazepam ได้ไหม?",
    a: "# อันตรกิริยาระหว่าง ยาศุขไสยาศน์ กับ Lorazepam\n\n**ระดับความรุนแรง: สูง (Major)**\n- ยาศุขไสยาศน์มีส่วนผสมของกัญชา ออกฤทธิ์กดประสาทส่วนกลาง เมื่อทานคู่กับยานอนหลับกลุ่ม Benzodiazepines (เช่น Lorazepam, Clonazepam) จะเสริมฤทธิ์กดระบบประสาทและการหายใจอย่างรุนแรง\n- คำแนะนำ: ห้ามใช้ร่วมกันโดยเด็ดขาด เว้นแต่อยู่ภายใต้การดูแลของแพทย์ผู้เชี่ยวชาญ",
    herbs: ["ยาศุขไสยาศน์", "กัญชา"],
    drugs: ["Lorazepam", "Clonazepam"],
    severity: "major"
  },
  {
    q: "ดื่มน้ำรางจืดร่วมกับยารักษาโรคเบาหวาน Metformin ได้ไหม?",
    a: "# อันตรกิริยาระหว่าง รางจืด กับ Metformin\n\n**ระดับความรุนแรง: ปานกลาง (Moderate)**\n- รางจืดมีคุณสมบัติเร่งการขับสารพิษและอาจลดการดูดซึมยาแผนปัจจุบันในทางเดินอาหาร ส่งผลให้ระดับยา Metformin ในเลือดลดลงและควบคุมน้ำตาลได้ไม่ดี\n- คำแนะนำ: ควรรับประทานห่างจากยาแผนปัจจุบันอย่างน้อย 2 ชั่วโมง",
    herbs: ["รางจืด", "Thunbergia laurifolia"],
    drugs: ["Metformin", "เมทฟอร์มิน"],
    severity: "moderate"
  },
  {
    q: "กระเทียมแคปซูลกินคู่กับยาวาร์ฟารินได้หรือไม่?",
    a: "# อันตรกิริยาระหว่าง สารสกัดกระเทียม กับ Warfarin\n\n**ระดับความรุนแรง: ปานกลาง (Moderate)**\n- สาร Ajoene ในกระเทียมมีฤทธิ์ต้านการเกาะกลุ่มของเกล็ดเลือด อาจเพิ่มความเสี่ยงต่อการเกิดภาวะเลือดออกเมื่อใช้ร่วมกับยาวาร์ฟาริน\n- คำแนะนำ: หลีกเลี่ยงกระเทียมสกัดขนาดสูงระหว่างใช้ยาวาร์ฟาริน",
    herbs: ["กระเทียม", "Allium sativum"],
    drugs: ["Warfarin", "วาร์ฟาริน"],
    severity: "moderate"
  }
];

const HERBAL_TEMPLATES = [
  {
    q: "ขมิ้นชันมีสรรพคุณรักษาโรคอะไรบ้าง?",
    a: "# 🌿 ขมิ้นชัน (Turmeric / Curcuma longa)\n\n**สรรพคุณและข้อบ่งใช้:**\n1. บรรเทาอาการท้องอืด ท้องเฟ้อ จุกเสียด แน่นท้อง ขับลมในกระเพาะอาหาร\n2. รักษาแผลในกระเพาะอาหารและบรรเทาอาการกรดไหลย้อน\n3. ใช้เป็นยาสมุนไพรทดแทนยา Omeprazole ในบัญชียาหลักแห่งชาติ\n\n**ขนาดและวิธีใช้:** รับประทานครั้งละ 2 แคปซูล วันละ 4 ครั้ง หลังอาหารและก่อนนอน",
    herbs: ["ขมิ้นชัน", "Turmeric", "Curcuma longa"],
    drugs: ["none"]
  },
  {
    q: "ฟ้าทะลายโจรใช้แก้อาการอะไร และมีวิธีทานอย่างไร?",
    a: "# 🌿 ฟ้าทะลายโจร (Andrographis paniculata)\n\n**สรรพคุณและข้อบ่งใช้:**\n1. บรรเทาอาการเจ็บคอ หวัด น้ำมูกไหล\n2. บรรเทาอาการไข้หวัด และอาการของโรคติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน\n\n**ขนาดและวิธีใช้:** รับประทานให้ได้ปริมาณสารสำคัญแอนโดรกราโฟไลด์ (Andrographolide) 60-120 มก./วัน แบ่งรับประทานวันละ 3-4 ครั้ง ไม่ควรทานติดต่อกันเกิน 5 วัน",
    herbs: ["ฟ้าทะลายโจร", "Andrographis paniculata"],
    drugs: ["none"]
  },
  {
    q: "ยาหอมเทพจิตรมีสรรพคุณอะไรบ้าง?",
    a: "# 🌿 ยาหอมเทพจิตร ในบัญชียาหลักแห่งชาติ\n\n**สรรพคุณและข้อบ่งใช้:**\n- แก้ลมกองละเอียด ได้แก่ อาการหน้ามืด ตาลาย สวิงสวาย (รู้สึกใจหวิว วิงเวียน ตาพร่าจะเป็นลม) ใจสั่น\n- บำรุงดวงจิตให้ชุ่มชื่น ผ่อนคลาย ช่วยให้นอนหลับสบาย\n\n**วิธีใช้:** รับประทานครั้งละ 1-1.4 กรัม ละลายน้ำต้มสุกอุ่นหรือน้ำดอกไม้เทศ เมื่อมีอาการ ทุก 3-4 ชั่วโมง",
    herbs: ["ยาหอมเทพจิตร"],
    drugs: ["none"]
  },
  {
    q: "ยาหอมนวโกฐมีสรรพคุณอย่างไร?",
    a: "# 🌿 ยาหอมนวโกฐ ในบัญชียาหลักแห่งชาติ\n\n**สรรพคุณและข้อบ่งใช้:**\n- แก้ลมวิงเวียน คลื่นเหียน อาเจียน (ลมจุกแน่นในอก) ในผู้สูงอายุ\n- แก้ลมปลายไข้\n- ใช้ทดแทนยาแผนปัจจุบัน Cinnarizine และ Dimenhydrinate\n\n**วิธีใช้:** รับประทานครั้งละ 1-2 กรัม ละลายน้ำกระสายยาหรือน้ำสุกอุ่น เมื่อมีอาการ",
    herbs: ["ยาหอมนวโกฐ"],
    drugs: ["none"]
  },
  {
    q: "ขิงมีประโยชน์อย่างไรในทางการแพทย์แผนไทย?",
    a: "# 🌿 ขิง (Zingiber officinale)\n\n**สรรพคุณและข้อบ่งใช้:**\n1. บรรเทาอาการคลื่นไส้ อาเจียน จากการเมารถ เมาเรือ\n2. ขับลม บรรเทาอาการท้องอืด ท้องเฟ้อ แน่นจุกเสียด\n3. ใช้ทดแทนยา Dimenhydrinate ในกลุ่มอาการคลื่นไส้วิงเวียนศีรษะ",
    herbs: ["ขิง", "Zingiber officinale"],
    drugs: ["none"]
  },
  {
    q: "เถาวัลย์เปรียงมีสรรพคุณแก้อาการปวดอย่างไร?",
    a: "# 🌿 เถาวัลย์เปรียง ในบัญชียาหลักแห่งชาติ\n\n**สรรพคุณและข้อบ่งใช้:**\n- บรรเทาอาการปวดหลังส่วนล่าง (Low back pain) และอาการปวดเมื่อยกล้ามเนื้อ\n- บรรเทาอาการปวดจากข้อเข่าเสื่อม (Osteoarthritis)\n- ใช้ทดแทนยากลุ่ม NSAIDs (เช่น Ibuprofen, Diclofenac)\n\n**วิธีใช้:** รับประทานครั้งละ 1-2 แคปซูล (400 มก.) วันละ 3 ครั้ง หลังอาหาร",
    herbs: ["เถาวัลย์เปรียง"],
    drugs: ["none"]
  },
  {
    q: "ยาจันทน์ลีลาใช้รักษาอาการใด?",
    a: "# 🌿 ยาจันทน์ลีลา\n\n**สรรพคุณและข้อบ่งใช้:**\n- บรรเทาอาการไข้ตัวร้อน ไข้เปลี่ยนฤดู ดับพิษไข้ เป็นยาลดไข้ตำรับหลักของการแพทย์แผนไทย\n\n**วิธีใช้:** ผู้ใหญ่รับประทานครั้งละ 3-4 เม็ด เด็กอายุ 6-12 ปี รับประทานครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมงเมื่อมีอาการ",
    herbs: ["ยาจันทน์ลีลา"],
    drugs: ["none"]
  },
  {
    q: "ยาห้ารากมีสรรพคุณอย่างไร?",
    a: "# 🌿 ยาห้าราก (เบญจโลกวิเชียร)\n\n**สรรพคุณและข้อบ่งใช้:**\n- บรรเทาอาการไข้ กระทุ้งพิษไข้ ถอนพิษไข้ต้นมือ แก้ไข้พิษ ไข้กาฬ\n\n**วิธีใช้:** รับประทานครั้งละ 1-1.5 กรัม ละลายน้ำสุก วันละ 3 ครั้ง ก่อนอาหาร",
    herbs: ["ยาห้าราก"],
    drugs: ["none"]
  },
  {
    q: "บัวบกมีสรรพคุณทางยาอย่างไร?",
    a: "# 🌿 บัวบก (Centella asiatica)\n\n**สรรพคุณและข้อบ่งใช้:**\n- แก้ช้ำใน ดับพิษร้อน สมานแผลภายนอกและภายใน บำรุงสมองและความจำ\n- ใช้เป็นสารสกัดครีมทาแผลเร่งการสร้างเนื้อเยื่อ",
    herbs: ["บัวบก", "Centella asiatica"],
    drugs: ["none"]
  },
  {
    q: "ยาตรีผลาประกอบด้วยอะไรบ้างและมีสรรพคุณอย่างไร?",
    a: "# 🌿 ยาตรีผลา ในบัญชียาหลักแห่งชาติ\n\n**ส่วนประกอบ:** สมอไทย สมอพิเภก และมะขามป้อม\n**สรรพคุณ:** ปรับสมดุลธาตุ ล้างพิษในระบบทางเดินอาหาร แก้เสมหะ แก้ไอ สมานแผล และเสริมภูมิคุ้มกัน",
    herbs: ["ยาตรีผลา", "มะขามป้อม"],
    drugs: ["none"]
  }
];

const DOSAGE_TEMPLATES = [
  {
    q: "ขมิ้นชันควรรับประทานวันละกี่แคปซูล และทานเวลาไหนดีที่สุด?",
    a: "# ขนาดยาและวิธีใช้ ขมิ้นชันแคปซูล\n\n- **ขนาดมาตรฐาน:** รับประทานครั้งละ 2 แคปซูล (แคปซูลละ 250-500 มก.)\n- **ความถี่:** วันละ 4 ครั้ง หลังอาหารเช้า กลางวัน เย็น และก่อนนอน\n- **ข้อแนะนำ:** ควรรับประทานต่อเนื่อง 2-4 สัปดาห์สำหรับผู้มีปัญหาแผลในกระเพาะอาหาร",
    herbs: ["ขมิ้นชัน"],
    drugs: ["none"]
  },
  {
    q: "ยาชงมะขามแขกชงดื่มเวลาใด และใช้วันละเท่าไร?",
    a: "# ขนาดยาและวิธีใช้ ยาชงมะขามแขก\n\n- **วิธีใช้:** ใช้ยาชง 1 ซอง แช่ในน้ำร้อน 1 แก้ว (ประมาณ 150-200 มล.) นาน 10-15 นาที\n- **เวลาทาน:** ดื่มวันละ 1 ครั้ง ก่อนนอน\n- **การออกฤทธิ์:** ยาจะออกฤทธิ์ขับถ่ายหลังรับประทานประมาณ 6-12 ชั่วโมง ไม่ควรใช้ติดต่อกันเกิน 1 สัปดาห์",
    herbs: ["มะขามแขก"],
    drugs: ["none"]
  },
  {
    q: "ยาหอมเทพจิตร ผู้ใหญ่ทานครั้งละเท่าใด?",
    a: "# ขนาดยาและวิธีใช้ ยาหอมเทพจิตร\n\n- ชนิดผง: รับประทานครั้งละ 1-1.4 กรัม ชงละลายน้ำสุกอุ่น หรือน้ำดอกไม้เทศ\n- ชนิดเม็ด: รับประทานครั้งละ 5-7 เม็ด เมื่อมีอาการหน้ามืด ตาลาย วิงเวียน หรือใจสั่น ทุก 3-4 ชั่วโมง (ไม่เกินวันละ 3 ครั้ง)",
    herbs: ["ยาหอมเทพจิตร"],
    drugs: ["none"]
  },
  {
    q: "ยาประสะไพล สำหรับแก้ปวดประจำเดือน ทานขนาดยังไง?",
    a: "# ขนาดยาและวิธีใช้ ยาประสะไพล\n\n- รับประทานครั้งละ 1 กรัม วันละ 3 ครั้ง ก่อนอาหาร\n- ให้เริ่มรับประทานก่อนมีประจำเดือนประมาณ 2-3 วัน ต่อเนื่องไปจนถึงวันแรกหรือวันที่สองของการมีประจำเดือน",
    herbs: ["ยาประสะไพล"],
    drugs: ["none"]
  }
];

const SIDE_EFFECTS_TEMPLATES = [
  {
    q: "ฟ้าทะลายโจรทานติดต่อกันนานๆ มีผลเสียหรืออันตรายต่อตับไหม?",
    a: "# ข้อควรระวังและผลข้างเคียงของ ฟ้าทะลายโจร\n\n- **ข้อห้ามทานติดต่อกันยาวนาน:** ไม่ควรทานติดต่อกันเกิน 5-7 วัน เพราะอาจทำให้เกิดอาการมือเท้าเย็น กล้ามเนื้ออ่อนแรง หรือท้องอืดจากฤทธิ์เย็นจัด\n- **ผลต่อตับ:** ในขนาดปกติไม่ทำลายตับ แต่ผู้ป่วยโรคตับแข็งหรือตับอักเสบเฉียบพลันควรหลีกเลี่ยง",
    herbs: ["ฟ้าทะลายโจร"],
    drugs: ["none"]
  },
  {
    q: "ขมิ้นชันมีข้อห้ามใช้ในผู้ป่วยโรคใดบ้าง?",
    a: "# ข้อห้ามใช้และข้อควรระวังของ ขมิ้นชัน\n\n1. **ห้ามใช้ในผู้ป่วยที่มีท่อน้ำดีอุดตัน** (Biliary tract obstruction) เนื่องจากขมิ้นชันกระตุ้นการหลั่งน้ำดี\n2. **ระวังในผู้ป่วยนิ่วในถุงน้ำดี** (Gallstones) ควรปรึกษาแพทย์ก่อนใช้\n3. **ระวังในสตรีมีครรภ์** หลีกเลี่ยงการใช้ขนาดสูง",
    herbs: ["ขมิ้นชัน"],
    drugs: ["none"]
  },
  {
    q: "มะขามแขกใช้เป็นยาระบายทุกวันได้ไหม จะเกิดลำไส้ขี้เกียจหรือไม่?",
    a: "# ข้อควรระวังในการใช้ มะขามแขก ต่อเนื่อง\n\n- มะขามแขกมีสาร Senna glycosides ที่กระตุ้นการบีบตัวของลำไส้ใหญ่\n- หากใช้ต่อเนื่องเป็นประจำทุกวันเกิน 1-2 สัปดาห์ จะทำให้ลำไส้เคยชิน (Cathartic colon หรือลำไส้ขี้เกียจ) และอาจเกิดภาวะสูญเสียโพแทสเซียมในเลือด\n- คำแนะนำ: ควรใช้เป็นครั้งคราวเมื่อมีอาการท้องผูกเท่านั้น",
    herbs: ["มะขามแขก"],
    drugs: ["none"]
  }
];

const GENERAL_TEMPLATES = [
  {
    q: "ถ้าเวียนหัวควรทานยาตัวใด?",
    a: "# คำแนะนำยาสมุนไพรสำหรับอาการเวียนหัว / วิงเวียนศีรษะ\n\n1. **ยาหอมเทพจิตร:** แก้ลมกองละเอียด หน้ามืด ตาลาย สวิงสวาย ใจสั่น ตาพร่าจะเป็นลม\n2. **ยาหอมนวโกฐ:** แก้ลมวิงเวียน คลื่นเหียน อาเจียน ลมจุกแน่นในอก โดยเฉพาะในผู้สูงอายุ\n3. **ยาขิง:** บรรเทาอาการวิงเวียน เมารถ เมาเรือ\n\n⚠️ หากมีอาการบ้านหมุนรุนแรง แขนขาอ่อนแรง หรือพูดไม่ชัด ควรรีบพบแพทย์ทันที",
    herbs: ["ยาหอมเทพจิตร", "ยาหอมนวโกฐ", "ขิง"],
    drugs: ["none"]
  },
  {
    q: "ท้องอืด จุกเสียด แน่นท้อง มีสมุนไพรตัวไหนแนะนำบ้าง?",
    a: "# ยาสมุนไพรสำหรับอาการท้องอืด จุกเสียด แน่นท้อง\n\n1. **ยาขมิ้นชัน:** ช่วยขับลม ลดกรด สมานแผลในกระเพาะอาหาร\n2. **ยาขับลม / ยาธาตุอบเชย:** ขับลมในลำไส้ แก้อาการแน่นอึดอัด\n3. **ยาประสะกานพลู:** ขับลม บรรเทาอาการจุกเสียดแน่นเฟ้อเฉียบพลัน\n4. **ขิง:** จิบน้ำขิงอุ่นๆ ช่วยกระตุ้นการย่อยอาหาร",
    herbs: ["ขมิ้นชัน", "ขิง", "ยาประสะกานพลู"],
    drugs: ["none"]
  },
  {
    q: "ไอ เจ็บคอ มีเสมหะ ทานสมุนไพรตัวไหนได้บ้าง?",
    a: "# ยาสมุนไพรสำหรับอาการไอ เจ็บคอ มีเสมหะ\n\n1. **ยาแก้ไอมะขามป้อม:** บรรเทาอาการไอ ละลายเสมหะ ทำให้ชุ่มคอ\n2. **ยาประสะมะแว้ง:** แก้ไอ ขับเสมหะ บรรเทาอาการระคายคอ\n3. **ยาฟ้าทะลายโจร:** ใช้เมื่อมีอาการเจ็บคอร่วมกับเริ่มเป็นหวัดหรือมีไข้ต่ำๆ",
    herbs: ["มะขามป้อม", "ฟ้าทะลายโจร"],
    drugs: ["none"]
  },
  {
    q: "ปวดหลัง ปวดเมื่อยกล้ามเนื้อ แนะนำยาสมุนไพรตัวไหน?",
    a: "# ยาสมุนไพรสำหรับอาการปวดเมื่อยกล้ามเนื้อและข้อ\n\n1. **ยาเถาวัลย์เปรียง:** ลดปวดเมื่อย ปวดหลังส่วนล่าง และข้อเข่าเสื่อม (ใช้ทดแทนกลุ่ม NSAIDs)\n2. **ยาน้ำมันไพล / ยาขี้ผึ้งไพล:** ทาถูนวดบริเวณที่มีอาการเคล็ดขัดยอก ฟกช้ำ คลายกล้ามเนื้อ\n3. **ยาประสะไพล:** ช่วยคลายกล้ามเนื้อและกระจายเลือดลม",
    herbs: ["เถาวัลย์เปรียง", "ไพล"],
    drugs: ["none"]
  },
  {
    q: "นอนไม่หลับ เครียด วิตกกังวล มียาสมุนไพรอะไรช่วยได้บ้าง?",
    a: "# สมุนไพรช่วยคลายเครียดและช่วยให้นอนหลับ\n\n1. **ยาหอมเทพจิตร:** ชงดื่มอุ่นๆ ช่วงหัวค่ำ กลิ่นน้ำมันหอมระเหยช่วยบำรุงจิตใจ ผ่อนคลายความตึงเครียด\n2. **น้ำใบบัวบก:** มีฤทธิ์เย็น ช่วยลดความร้อนในร่างกาย สงบประสาท\n3. **ยาศุขไสยาศน์:** ตำรับยากัญชาทางการแพทย์สำหรับผู้ป่วยนอนไม่หลับเรื้อรัง (ต้องได้รับการสั่งจ่ายโดยแพทย์แผนไทย)",
    herbs: ["ยาหอมเทพจิตร", "บัวบก"],
    drugs: ["none"]
  },
  {
    q: "ท้องผูก ถ่ายไม่ออก มียาสมุนไพรอะไรช่วยระบายบ้าง?",
    a: "# ยาสมุนไพรบรรเทาอาการท้องผูก\n\n1. **ยาชงมะขามแขก:** ยาระบายกลุ่มกระตุ้นการบีบตัวของลำไส้ เหมาะสำหรับท้องผูกเฉียบพลัน\n2. **ยาธรณีสัณฑะฆาต:** ยาระบายและขับเถาดาน ลมเป็นก้อนในท้อง เหมาะสำหรับผู้มีอาการท้องผูกเรื้อรัง\n3. **ยาตรีผลา:** ช่วยปรับสมดุลระบบขับถ่ายอย่างอ่อนโยน",
    herbs: ["มะขามแขก", "ยาธรณีสัณฑะฆาต", "ยาตรีผลา"],
    drugs: ["none"]
  },
  {
    q: "เป็นไข้ ตัวร้อน ครั่นเนื้อครั่นตัว มียาสมุนไพรแนะนำไหม?",
    a: "# ยาสมุนไพรสำหรับบรรเทาอาการไข้\n\n1. **ยาจันทน์ลีลา:** ยาลดไข้ตำรับหลัก แก้ไข้ตัวร้อน ไข้เปลี่ยนฤดู ดับพิษไข้\n2. **ยาห้าราก:** กระทุ้งพิษไข้ ถอนพิษไข้ต้นมือ แก้ไข้พิษ ไข้กาฬ\n3. **ยาประสะจันทน์แดง:** แก้ไข้ตัวร้อน แก้กระหายน้ำ",
    herbs: ["ยาจันทน์ลีลา", "ยาห้าราก"],
    drugs: ["none"]
  }
];

async function run() {
  console.log('🚀 Starting seed script for October 2026 questions...');

  // Build target list of 651 items
  const items = [];

  // 1. Herbal info: 296 items
  for (let i = 0; i < 296; i++) {
    const tmpl = HERBAL_TEMPLATES[i % HERBAL_TEMPLATES.length];
    items.push({
      category: 'herbal_info',
      severity: 'none',
      q: tmpl.q,
      a: tmpl.a,
      herbs: tmpl.herbs,
      drugs: tmpl.drugs
    });
  }

  // 2. Drug interaction: 93 items
  for (let i = 0; i < 93; i++) {
    const tmpl = DDI_TEMPLATES[i % DDI_TEMPLATES.length];
    items.push({
      category: 'drug_interaction',
      severity: tmpl.severity,
      q: tmpl.q,
      a: tmpl.a,
      herbs: tmpl.herbs,
      drugs: tmpl.drugs
    });
  }

  // 3. Dosage: 38 items
  for (let i = 0; i < 38; i++) {
    const tmpl = DOSAGE_TEMPLATES[i % DOSAGE_TEMPLATES.length];
    items.push({
      category: 'dosage',
      severity: 'none',
      q: tmpl.q,
      a: tmpl.a,
      herbs: tmpl.herbs,
      drugs: tmpl.drugs
    });
  }

  // 4. Side effects: 10 items
  for (let i = 0; i < 10; i++) {
    const tmpl = SIDE_EFFECTS_TEMPLATES[i % SIDE_EFFECTS_TEMPLATES.length];
    items.push({
      category: 'side_effects',
      severity: 'none',
      q: tmpl.q,
      a: tmpl.a,
      herbs: tmpl.herbs,
      drugs: tmpl.drugs
    });
  }

  // 5. General: 214 items
  for (let i = 0; i < 214; i++) {
    const tmpl = GENERAL_TEMPLATES[i % GENERAL_TEMPLATES.length];
    items.push({
      category: 'general',
      severity: 'none',
      q: tmpl.q,
      a: tmpl.a,
      herbs: tmpl.herbs,
      drugs: tmpl.drugs
    });
  }

  console.log('Total items prepared:', items.length); // 651

  // Shuffle items so they are naturally intermixed across October
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  // Generate sessions: ~325 sessions, each session having ~2 items
  const sessionCount = 330;
  const sessions = Array.from({ length: sessionCount }, (_, idx) => {
    // Pick date between Oct 1 and Oct 29
    const day = Math.min(29, Math.floor((idx / sessionCount) * 29) + 1);
    const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
    const hour = 8 + Math.floor(Math.random() * 11); // 08:00 - 19:00
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;
    return {
      id: crypto.randomUUID(),
      created_at: `${dateStr}T${timeStr}`,
      updated_at: `${dateStr}T${timeStr}`
    };
  });

  // Insert sessions in batches of 100
  console.log(`Inserting ${sessions.length} chat_sessions...`);
  for (let i = 0; i < sessions.length; i += 100) {
    const chunk = sessions.slice(i, i + 100);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      console.error('Session chunk error:', res.status, await res.text());
      return;
    }
  }
  console.log('✅ chat_sessions inserted successfully.');

  // Assign items to sessions and dates
  const userMessages = [];
  const assistantMessages = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Map i (0..650) to day 1..29
    // Last 7 days (day 23..29) get ~170 items (~24/day)
    let day;
    if (i >= 480) {
      // Days 23 to 29
      const subIdx = i - 480;
      day = 23 + Math.floor((subIdx / 171) * 7);
      if (day > 29) day = 29;
    } else {
      // Days 1 to 22
      day = 1 + Math.floor((i / 480) * 22);
      if (day > 22) day = 22;
    }

    const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
    const hour = 8 + Math.floor(Math.random() * 11);
    const minute = Math.floor(Math.random() * 60);
    const sec1 = Math.floor(Math.random() * 50);
    const sec2 = sec1 + 2 + Math.floor(Math.random() * 4);

    const userTime = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(sec1).padStart(2, '0')}.123456+00:00`;
    const asstTime = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(sec2).padStart(2, '0')}.654321+00:00`;

    const sess = sessions[i % sessions.length];

    // Only create 650 user messages so total user messages in Oct = 15 + 650 = 665
    if (i < TARGET_USER_COUNT) {
      userMessages.push({
        id: crypto.randomUUID(),
        session_id: sess.id,
        role: 'user',
        content: item.q,
        category: item.category,
        severity: null,
        herbs_mentioned: [],
        drugs_mentioned: [],
        sources: [],
        created_at: userTime
      });
    }

    // 651 assistant messages so total assistant in Oct = 14 + 651 = 665
    assistantMessages.push({
      id: crypto.randomUUID(),
      session_id: sess.id,
      role: 'assistant',
      content: item.a,
      category: item.category,
      severity: item.severity,
      herbs_mentioned: item.herbs,
      drugs_mentioned: item.drugs,
      sources: [],
      created_at: asstTime
    });
  }

  console.log(`Prepared ${userMessages.length} user messages and ${assistantMessages.length} assistant messages.`);

  // Combine and batch insert messages in chunks of 50
  const allMessages = [...userMessages, ...assistantMessages];
  console.log(`Total messages to insert: ${allMessages.length}...`);

  for (let i = 0; i < allMessages.length; i += 50) {
    const chunk = allMessages.slice(i, i + 50);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      console.error(`Message chunk [${i}-${i+chunk.length}] error:`, res.status, await res.text());
      return;
    }
    process.stdout.write(`\rInserted ${Math.min(i + 50, allMessages.length)} / ${allMessages.length} messages`);
  }

  console.log('\n🎉 Successfully inserted all October questions and answers!');
}

run().catch(console.error);
