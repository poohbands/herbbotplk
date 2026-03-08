import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();

    if (action === 'overview') {
      // Get overall stats
      const { data: stats } = await supabase
        .from('chat_statistics')
        .select('*')
        .single();

      // Get daily counts for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: dailyMessages } = await supabase
        .from('chat_messages')
        .select('created_at, category, role')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('role', 'user');

      // Group by day
      const dailyMap: Record<string, { questions: number; interactions: number }> = {};
      const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyMap[key] = { questions: 0, interactions: 0 };
      }

      (dailyMessages || []).forEach((msg: any) => {
        const key = msg.created_at.split('T')[0];
        if (dailyMap[key]) {
          dailyMap[key].questions++;
          if (msg.category === 'drug_interaction') {
            dailyMap[key].interactions++;
          }
        }
      });

      const dailyData = Object.entries(dailyMap).map(([date, data]) => {
        const d = new Date(date);
        return {
          date: dayNames[d.getDay()],
          questions: data.questions,
          interactions: data.interactions,
        };
      });

      // Top herbs
      const { data: allMessages } = await supabase
        .from('chat_messages')
        .select('herbs_mentioned, drugs_mentioned')
        .not('herbs_mentioned', 'is', null);

      const herbCount: Record<string, number> = {};
      const drugCount: Record<string, number> = {};

      (allMessages || []).forEach((msg: any) => {
        (msg.herbs_mentioned || []).forEach((h: string) => {
          herbCount[h] = (herbCount[h] || 0) + 1;
        });
        (msg.drugs_mentioned || []).forEach((d: string) => {
          drugCount[d] = (drugCount[d] || 0) + 1;
        });
      });

      const topHerbs = Object.entries(herbCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({ name, count }));

      const topDrugs = Object.entries(drugCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Category breakdown
      const categoryData = [
        { name: 'ข้อมูลสมุนไพร', value: stats?.herbal_info_count || 0 },
        { name: 'Drug Interaction', value: stats?.drug_interaction_count || 0 },
        { name: 'วิธีใช้/ขนาดยา', value: stats?.dosage_count || 0 },
        { name: 'ผลข้างเคียง', value: stats?.side_effects_count || 0 },
        { name: 'อื่นๆ', value: stats?.general_count || 0 },
      ];

      return new Response(JSON.stringify({
        totalQuestions: stats?.total_questions || 0,
        totalSessions: stats?.total_sessions || 0,
        drugInteractionCount: stats?.drug_interaction_count || 0,
        dailyData,
        topHerbs,
        topDrugs,
        categoryData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-stats error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
