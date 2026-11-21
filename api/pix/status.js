const https = require('https');
const url = require('url');
const { getOrder, updateOrderStatus } = require('../_orders');
const { maskKey } = require('../_utils');

function queryElevyPay(queryUrl, apiKey) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(queryUrl);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'CasaLuce-Store/1.0'
      }
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(raw)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: { raw }
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const reqUrl = new URL(req.url, 'http://localhost');
    const id = req.query?.id || reqUrl.searchParams.get('id') || reqUrl.searchParams.get('transaction_id');
    const reference = req.query?.reference || reqUrl.searchParams.get('reference') || reqUrl.searchParams.get('external_id');

    if (!id && !reference) {
      res.statusCode = 400;
      return res.end(JSON.stringify({
        success: false,
        error: 'Parâmetro "id" ou "reference" é obrigatório para consulta.'
      }));
    }

    // 1. Verifica cache local do pedido (se já tiver sido aprovado via Webhook ou polling)
    const localOrder = getOrder(id, reference);
    if (localOrder && (localOrder.status === 'approved' || localOrder.status === 'APPROVED')) {
      return res.end(JSON.stringify({
        success: true,
        id: id || localOrder.transaction_id,
        reference: reference || localOrder.reference,
        status: 'approved',
        approved: true,
        source: 'local_confirmed'
      }));
    }

    // 2. Consulta oficial na API da ElevyPay
    const apiKey = process.env.ELEVYPAY_API_KEY;
    if (!apiKey) {
      // Se a chave não estiver configurada, responde com status local
      return res.end(JSON.stringify({
        success: true,
        status: localOrder ? localOrder.status : 'pending',
        approved: localOrder ? (localOrder.status === 'approved') : false,
        warning: 'ELEVYPAY_API_KEY não configurada no servidor.'
      }));
    }

    let queryUrl;
    if (id) {
      queryUrl = `https://app.elevypay.com/api/v1/query?action=get_transaction&id=${encodeURIComponent(id)}`;
    } else {
      queryUrl = `https://app.elevypay.com/api/v1/query?action=list_transactions&external_id=${encodeURIComponent(reference)}`;
    }

    const elevyRes = await queryElevyPay(queryUrl, apiKey);
    const data = elevyRes.data || {};

    let currentStatus = 'pending';

    if (Array.isArray(data) && data.length > 0) {
      // Retorno de list_transactions
      currentStatus = data[0].status || data[0].raw_status || 'pending';
    } else if (data.status || data.raw_status) {
      // Retorno de get_transaction
      currentStatus = data.status || data.raw_status || 'pending';
    }

    const isApproved = String(currentStatus).toLowerCase() === 'approved';

    if (isApproved) {
      updateOrderStatus(id || reference, 'approved', { elevyData: data });
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      id: id || reference,
      reference: reference || id,
      status: currentStatus.toLowerCase(),
      approved: isApproved
    }));

  } catch (err) {
    console.error('[ERRO PIX STATUS]', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({
      success: false,
      error: 'Erro ao consultar status da transação.'
    }));
  }
};
