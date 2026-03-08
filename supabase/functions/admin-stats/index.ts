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

      const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const dailyMap: Record<string, { questions: number; interactions: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap[d.toISOString().split('T')[0]] = { questions: 0, interactions: 0 };
      }

      (dailyMessages || []).forEach((msg: any) => {
        const key = msg.created_at.split('T')[0];
        if (dailyMap[key]) {
          dailyMap[key].questions++;
          if (msg.category === 'drug_interaction') dailyMap[key].interactions++;
        }
      });

      const dailyData = Object.entries(dailyMap).map(([date, data]) => ({
        date: dayNames[new Date(date).getDay()],
        questions: data.questions,
        interactions: data.interactions,
      }));

      // All messages with metadata
      const { data: allMessages } = await supabase
        .from('chat_messages')
        .select('herbs_mentioned, drugs_mentioned, category, severity, created_at, role')
        .eq('role', 'assistant');

      const herbCount: Record<string, number> = {};
      const drugCount: Record<string, number> = {};
      const interactionPairs: Record<string, number> = {};
      const severityCount: Record<string, number> = { major: 0, moderate: 0, minor: 0 };
      const monthlyMap: Record<string, { total: number; interaction: number; dosage: number; herbal: number; side_effects: number }> = {};

      (allMessages || []).forEach((msg: any) => {
        // Herb/drug counts
        (msg.herbs_mentioned || []).forEach((h: string) => {
          herbCount[h] = (herbCount[h] || 0) + 1;
        });
        (msg.drugs_mentioned || []).forEach((d: string) => {
          drugCount[d] = (drugCount[d] || 0) + 1;
        });

        // Interaction pairs: herb × drug
        if (msg.category === 'drug_interaction' && msg.herbs_mentioned?.length && msg.drugs_mentioned?.length) {
          for (const herb of msg.herbs_mentioned) {
            for (const drug of msg.drugs_mentioned) {
              const pair = `${herb} × ${drug}`;
              interactionPairs[pair] = (interactionPairs[pair] || 0) + 1;
            }
          }
        }

        // Severity breakdown
        if (msg.severity && severityCount[msg.severity] !== undefined) {
          severityCount[msg.severity]++;
        }

        // Monthly trends
        const month = msg.created_at?.substring(0, 7); // YYYY-MM
        if (month) {
          if (!monthlyMap[month]) monthlyMap[month] = { total: 0, interaction: 0, dosage: 0, herbal: 0, side_effects: 0 };
          monthlyMap[month].total++;
          if (msg.category === 'drug_interaction') monthlyMap[month].interaction++;
          if (msg.category === 'dosage') monthlyMap[month].dosage++;
          if (msg.category === 'herbal_info') monthlyMap[month].herbal++;
          if (msg.category === 'side_effects') monthlyMap[month].side_effects++;
        }
      });

      const topHerbs = Object.entries(herbCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
      const topDrugs = Object.entries(drugCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
      const topInteractionPairs = Object.entries(interactionPairs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([pair, count]) => ({ pair, count }));

      const monthNames: Record<string, string> = {
        '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
        '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
        '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.',
      };

      const monthlyData = Object.entries(monthlyMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([month, data]) => ({
          month: monthNames[month.split('-')[1]] || month,
          ...data,
        }));

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
        topInteractionPairs,
        severityBreakdown: severityCount,
        monthlyData,
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
