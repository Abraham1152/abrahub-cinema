const axios = require('axios');

async function simulateWebhook() {
  const url = 'https://vajxjtrztwfolhnkewnq.supabase.co/functions/v1/stripe-webhook';
  
  // Dados simulados baseados no payload real do Stripe
  const payload = {
    id: "evt_test_simulation",
    object: "event",
    type: "customer.subscription.created",
    data: {
      object: {
        id: "sub_test_123",
        customer: "cus_simulated_monique",
        customer_email: "monique_britoo@hotmail.com", // Forçando o email no payload
        status: "active",
        items: {
          data: [{
            price: { id: "price_1SrPtuLkjsnhi7NmaKqqGaCP" } // Plano Comunidade
          }]
        }
      }
    }
  };

  console.log("Simulando envio de Webhook do Stripe para o Supabase...");
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
        // Nota: Como desabilitamos o JWT e estamos simulando, o bypass da assinatura 
        // vai depender se a função valida o header stripe-signature.
      }
    });
    console.log("Resposta do Supabase:", response.status, response.data);
  } catch (error) {
    console.error("Erro na simulação:", error.response?.status, error.response?.data || error.message);
  }
}

simulateWebhook();
