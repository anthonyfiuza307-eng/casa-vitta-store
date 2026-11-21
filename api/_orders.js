// Armazenamento em memória (persiste durante o ciclo de vida da instância serverless/Node)
// Com fallback para cache seguro

const orders = new Map();
const ordersByReference = new Map();

function saveOrder(order) {
  if (!order) return;
  const key = String(order.transaction_id || order.id);
  orders.set(key, {
    ...order,
    updatedAt: new Date().toISOString()
  });
  if (order.reference) {
    ordersByReference.set(order.reference, key);
  }
}

function getOrder(id, reference) {
  if (id && orders.has(String(id))) {
    return orders.get(String(id));
  }
  if (reference && ordersByReference.has(reference)) {
    const key = ordersByReference.get(reference);
    return orders.get(key);
  }
  return null;
}

function updateOrderStatus(id, status, extraData = {}) {
  const existing = getOrder(id, extraData.external_id || extraData.reference) || {};
  const updated = {
    ...existing,
    ...extraData,
    transaction_id: existing.transaction_id || extraData.transaction_id || id,
    id: existing.id || extraData.id || id,
    reference: existing.reference || extraData.external_id || extraData.reference || (existing.reference),
    status: status,
    updatedAt: new Date().toISOString()
  };
  saveOrder(updated);
  return updated;
}

module.exports = {
  saveOrder,
  getOrder,
  updateOrderStatus
};
