const https = require('https');
const {
  validateCPF,
  validatePhone,
  validateEmail,
  validateName,
  validateCEP,
  maskCPF,
  maskKey,
  calculateOrderAmount
} = require('./_utils');
const { saveOrder } = require('./_orders');

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Formato JSON inválido na requisição.'));
      }
    });
    req.on('error', reject);
  });
}

function callElevyPay(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'app.elevypay.com',
      port: 443,
      path: '/api/v1/transaction',
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CasaLuce-Store/1.0',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          parsed = { raw_response: raw };
        }
        resolve({
          statusCode: res.statusCode,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      success: false,
      error: 'Método não permitido. Utilize POST.'
    }));
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const body = await parseRequestBody(req);
    const { customer, address, items, tracking } = body;

    // 1. Validação de Cliente
    if (!customer) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Dados do cliente são obrigatórios.' }));
    }

    if (!validateName(customer.name)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Por favor, informe seu nome completo (nome e sobrenome).' }));
    }

    if (!validateEmail(customer.email)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Formato de e-mail inválido.' }));
    }

    if (!validatePhone(customer.phone)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' }));
    }

    if (!validateCPF(customer.document)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'CPF inválido. Verifique os números informados.' }));
    }

    // 2. Validação de Endereço
    if (!address || !validateCEP(address.zipcode)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'CEP inválido ou não informado.' }));
    }

    if (!address.street || !address.street.trim()) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Logradouro/Rua é obrigatório.' }));
    }

    if (!address.number || !address.number.trim()) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Número de endereço é obrigatório.' }));
    }

    // 3. Validação e Cálculo Seguro do Carrinho
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: 'Seu carrinho está vazio.' }));
    }

    let orderCalculation;
    try {
      orderCalculation = calculateOrderAmount(items);
    } catch (calcErr) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: calcErr.message }));
    }

    // 4. Verificação da Chave de API da ElevyPay
    const apiKey = process.env.ELEVYPAY_API_KEY;
    if (!apiKey) {
      console.error('[ERRO ELEVYPAY] Variável de ambiente ELEVYPAY_API_KEY não configurada no servidor.');
      res.statusCode = 500;
      return res.end(JSON.stringify({
        success: false,
        error: 'Configuração do gateway pendente: a chave ELEVYPAY_API_KEY não foi configurada nas variáveis de ambiente do servidor.'
      }));
    }

    // 5. Montagem do Pedido para ElevyPay
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const reference = `PEDIDO-${timestamp}-${randomSuffix}`;

    // Determina URL pública do webhook
    let postbackUrl = process.env.WEBHOOK_URL;
    if (!postbackUrl && req.headers) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'https';
      if (host) {
        postbackUrl = `${proto}://${host}/api/webhook/elevypay`;
      }
    }

    const cleanPhone = String(customer.phone).replace(/\D/g, '');
    const cleanCPF = String(customer.document).replace(/\D/g, '');
    const cleanZip = String(address.zipcode).replace(/\D/g, '');

    const elevyPayload = {
      amount: orderCalculation.amountInCents,
      description: orderCalculation.description,
      reference: reference,
      source: 'api_externa',
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim().toLowerCase(),
        phone: cleanPhone,
        document: cleanCPF
      },
      address: {
        street: address.street.trim(),
        number: address.number.trim(),
        complement: (address.complement || '').trim(),
        neighborhood: (address.neighborhood || '').trim(),
        city: (address.city || '').trim(),
        state: (address.state || '').trim().toUpperCase(),
        zipcode: cleanZip
      }
    };

    if (postbackUrl) {
      elevyPayload.postback_url = postbackUrl;
    }

    if (tracking && typeof tracking === 'object') {
      elevyPayload.tracking = tracking;
    }

    console.log(`[PIX CREATE] Criando cobrança para ${reference} - Valor: R$ ${(orderCalculation.amountInCents / 100).toFixed(2)} - Cliente: ${customer.name.trim()} (CPF: ${maskCPF(cleanCPF)}) - API Key: ${maskKey(apiKey)}`);

    // 6. Chamada à API ElevyPay
    const elevyRes = await callElevyPay(elevyPayload, apiKey);

    console.log(`[PIX ELEVY RESPONSE] Status HTTP: ${elevyRes.statusCode} - Data:`, JSON.stringify(elevyRes.data));

    const data = elevyRes.data || {};

    if (elevyRes.statusCode >= 200 && elevyRes.statusCode < 300 && (data.status === 'success' || data.transaction_id || data.qr_code)) {
      // Salva no registro em memória/servidor
      const orderRecord = {
        transaction_id: data.transaction_id || data.id,
        id: data.id || reference,
        reference: reference,
        amount: orderCalculation.amountInCents,
        status: 'pending',
        customer: {
          name: customer.name.trim(),
          email: customer.email.trim().toLowerCase(),
          document: maskCPF(cleanCPF),
          phone: cleanPhone
        },
        address: elevyPayload.address,
        items: orderCalculation.items,
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        expires_at: data.expires_at || null,
        createdAt: new Date().toISOString()
      };

      saveOrder(orderRecord);

      res.statusCode = 200;
      return res.end(JSON.stringify({
        success: true,
        transaction_id: orderRecord.transaction_id,
        id: orderRecord.id,
        reference: orderRecord.reference,
        amount: orderCalculation.amountInCents,
        amount_formatted: (orderCalculation.amountInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        expires_at: data.expires_at || null
      }));
    } else {
      // Resposta com erro da adquirente/ElevyPay
      const errorMessage = data.message || data.error || (data.errors && JSON.stringify(data.errors)) || 'Não foi possível gerar a cobrança PIX na ElevyPay. Verifique os dados informados.';
      res.statusCode = elevyRes.statusCode || 400;
      return res.end(JSON.stringify({
        success: false,
        error: errorMessage
      }));
    }

  } catch (err) {
    console.error('[ERRO PIX HANDLER]', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({
      success: false,
      error: 'Ocorreu um erro interno ao processar a solicitação de pagamento. Tente novamente em instantes.'
    }));
  }
};
