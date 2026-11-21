const { updateOrderStatus } = require('../_orders');

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
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Método não permitido. Utilize POST.' }));
  }

  try {
    const payload = await parseRequestBody(req);

    const transactionId = payload.transaction_id || payload.id;
    const reference = payload.external_id || payload.store_reference;
    const status = (payload.status || payload.raw_status || 'unknown').toLowerCase();

    console.log(`[WEBHOOK ELEVYPAY] Recebido evento para transação ${transactionId || 'N/A'} (Ref: ${reference || 'N/A'}) - Novo Status: ${status}`);

    if (transactionId || reference) {
      updateOrderStatus(transactionId || reference, status, {
        e2e_id: payload.e2e_id,
        amount: payload.amount,
        payment_method: payload.payment_method,
        webhookPayload: payload
      });
    }

    // A documentação oficial da ElevyPay exige resposta com HTTP 200 OK
    res.statusCode = 200;
    return res.end(JSON.stringify({
      received: true,
      status: 'processed',
      transaction_id: transactionId,
      order_status: status
    }));

  } catch (err) {
    console.error('[ERRO WEBHOOK ELEVYPAY]', err);
    res.statusCode = 200; // Sempre 200 para evitar retries desnecessários da adquirente em payload malformado
    return res.end(JSON.stringify({ received: true, error: err.message }));
  }
};
