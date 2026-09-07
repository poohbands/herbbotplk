import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callProvider, clearProviderCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, password } = body as { action?: string; password?: string };

    const adminPassword = Deno.env.get("ADMIN_PASSWORD") || "sakura4923";
    if (!password || password !== adminPassword) {
      return json({ error: "รหัสผ่านผู้ดูแลไม่ถูกต้อง" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "list") {
      const { data, error } = await supabase
        .from("ai_providers")
        .select("id,name,provider_key,base_url,model_name,is_active,priority,api_key,updated_at")
        .order("priority", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      const providers = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        provider_key: p.provider_key,
        base_url: p.base_url,
        model_name: p.model_name,
        is_active: p.is_active,
        priority: p.priority,
        has_key: !!p.api_key,
        updated_at: p.updated_at,
      }));
      return json({ providers });
    }

    if (action === "save") {
      const rows = Array.isArray((body as any).providers) ? (body as any).providers : [];
      if (rows.length === 0) return json({ error: "ไม่มีข้อมูลที่จะบันทึก" }, 400);

      for (const r of rows) {
        if (!r) continue;
        const patch: Record<string, unknown> = {
          model_name: String(r.model_name || "").trim() || "gemini-2.5-flash",
          base_url: String(r.base_url || "").trim() || null,
          is_active: r.is_active === true,
          priority: Number.isFinite(Number(r.priority)) ? Math.max(1, Number(r.priority)) : 1,
        };
        // คีย์ว่าง = ไม่เปลี่ยนของเดิม / "__CLEAR__" = ลบคีย์
        if (typeof r.api_key === "string" && r.api_key.trim().length > 0) {
          patch.api_key = r.api_key.trim() === "__CLEAR__" ? null : r.api_key.trim();
        }
        
        let query = supabase.from("ai_providers").update(patch);
        if (r.provider_key) {
          query = query.eq("provider_key", r.provider_key);
        } else if (r.id) {
          query = query.eq("id", r.id);
        } else {
          continue;
        }
        const { error } = await query;
        if (error) console.error("[ai-providers-admin] update row error:", error.message);
      }
      clearProviderCache();
      return json({ success: true });
    }

    if (action === "test") {
      const { id, api_key, base_url, model_name } = body as any;
      let key: string | null = typeof api_key === "string" && api_key.trim() ? api_key.trim() : null;
      let url: string | null = typeof base_url === "string" && base_url.trim() ? base_url.trim() : null;
      let model: string | null = typeof model_name === "string" && model_name.trim() ? model_name.trim() : null;

      if (id) {
        const { data } = await supabase.from("ai_providers").select("*").eq("id", id).maybeSingle();
        if (data) {
          key = key || data.api_key;
          url = url || data.base_url;
          model = model || data.model_name;
        }
      }
      if (!key) return json({ success: false, message: "ยังไม่ได้ใส่กุญแจ API" }, 200);
      if (!url) return json({ success: false, message: "ยังไม่ได้ระบุที่อยู่ปลายทาง (Base URL)" }, 200);

      try {
        const text = await callProvider(
          { name: "test", api_key: key, base_url: url, model_name: model || "" },
          {
            messages: [{ role: "user", content: "ตอบกลับสั้น ๆ ว่า OK" }],
            max_tokens: 20,
            timeoutMs: 20_000,
          },
        );
        return json({ success: true, message: `เชื่อมต่อสำเร็จ — ตอบกลับ: ${text.slice(0, 80)}` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ success: false, message: `เชื่อมต่อไม่สำเร็จ: ${msg}` });
      }
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("[ai-providers-admin] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
