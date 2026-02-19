import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log("[KIWIFY-WEBHOOK] Payload recebido:", JSON.stringify(body, null, 2));

    // Kiwify usa PascalCase (Customer, Product) em vez de camelCase
    const customer = body.Customer || body.customer;
    const product = body.Product || body.product;
    const subscription = body.Subscription || body.subscription;
    
    const status = (body.status || body.order_status || "").toLowerCase();
    const email = customer?.email?.toLowerCase();

    if (!email) {
      console.error("[KIWIFY-WEBHOOK] Erro: Email do cliente não encontrado no payload.");
      return new Response(JSON.stringify({ error: "No customer email found" }), { status: 400 });
    }

    // Status de ATIVAÇÃO
    const activeStatuses = ["paid", "approved", "active", "completed"];
    // Status de BLOQUEIO
    const inactiveStatuses = ["refunded", "canceled", "charged_back", "disputed", "refused"];

    let targetStatus: 'active' | 'inactive' = 'inactive';
    if (activeStatuses.includes(status)) {
      targetStatus = 'active';
    }

    console.log(`[KIWIFY-WEBHOOK] Processando e-mail: ${email} | Status Kiwify: ${status} | Ação: ${targetStatus}`);

    // 1. Sincronizar na whitelist (authorized_users)
    const { error: authError } = await supabase.from("authorized_users").upsert({
      email: email,
      status: targetStatus,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (authError) {
      console.error("[KIWIFY-WEBHOOK] Erro ao atualizar authorized_users:", authError.message);
    }

    // 2. Localizar usuário no Auth do Supabase para aplicar benefícios
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existingUser = users.find(u => u.email?.toLowerCase() === email);

    if (existingUser) {
      if (targetStatus === 'active') {
        console.log(`[KIWIFY-WEBHOOK] Ativando benefícios para: ${existingUser.id}`);
        
        await supabase.from("entitlements").upsert({
          user_id: existingUser.id,
          plan: "community",
          status: "active",
          updated_at: new Date().toISOString(),
        });

        await supabase.from("credit_wallet").upsert({
          user_id: existingUser.id,
          credits_balance: 999999,
          monthly_allowance: 999999,
          updated_at: new Date().toISOString(),
        });
      } else {
        console.log(`[KIWIFY-WEBHOOK] Revogando benefícios para: ${existingUser.id}`);
        
        await supabase.from("entitlements").update({
          status: "inactive",
          is_blocked: true,
          blocked_reason: `Kiwify: ${status}`,
          updated_at: new Date().toISOString(),
        }).eq("user_id", existingUser.id);

        await supabase.from("credit_wallet").update({
          credits_balance: 0,
          monthly_allowance: 0,
        }).eq("user_id", existingUser.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed_status: targetStatus, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[KIWIFY-WEBHOOK] Erro Crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
