const fs = require('fs');
const path = require('path');

let productsCache = null;

function getProducts() {
  if (productsCache) return productsCache;
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'products.json');
    if (fs.existsSync(jsonPath)) {
      productsCache = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return productsCache;
    }
  } catch (err) {
    console.warn('Could not read data/products.json:', err.message);
  }

  try {
    global.window = global;
    require('../products.js');
    productsCache = global.CASALUCE_PRODUCTS || {};
    return productsCache;
  } catch (err) {
    console.warn('Could not require products.js:', err.message);
    return {};
  }
}

/**
 * Validação oficial dos dígitos verificadores de CPF (módulo 11)
 */
function validateCPF(cpf) {
  if (!cpf) return false;
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação de Telefone brasileiro (10 ou 11 dígitos, DDD válido)
 */
function validatePhone(phone) {
  if (!phone) return false;
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length !== 10 && clean.length !== 11) return false;

  const validDDDs = new Set([
    '11','12','13','14','15','16','17','18','19',
    '21','22','24','27','28',
    '31','32','33','34','35','37','38',
    '41','42','43','44','45','46','47','48','49',
    '51','53','54','55',
    '61','62','63','64','65','66','67','68','69',
    '71','73','74','75','77','79',
    '81','82','83','84','85','86','87','88','89',
    '91','92','93','94','95','96','97','98','99'
  ]);

  const ddd = clean.substring(0, 2);
  if (!validDDDs.has(ddd)) return false;

  // Celular (11 dígitos) no Brasil deve ter 9 após o DDD
  if (clean.length === 11 && clean.charAt(2) !== '9') return false;

  return true;
}

/**
 * Validação de E-mail
 */
function validateEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(String(email).trim().toLowerCase());
}

/**
 * Validação de Nome Completo (mínimo nome + sobrenome)
 */
function validateName(name) {
  if (!name) return false;
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every(p => p.length >= 2);
}

/**
 * Validação de CEP (8 dígitos numéricos)
 */
function validateCEP(cep) {
  if (!cep) return false;
  const clean = String(cep).replace(/\D/g, '');
  return clean.length === 8 && !/^(\d)\1{7}$/.test(clean);
}

/**
 * Mascarar CPF para não logar dado sensível
 */
function maskCPF(cpf) {
  if (!cpf) return '';
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return '***';
  return `***.***.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
}

/**
 * Mascarar API Key para segurança
 */
function maskKey(key) {
  if (!key) return '(não configurada)';
  if (key.length <= 8) return '****';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Cálculo do Amount NO SERVIDOR a partir dos itens do carrinho
 * Retorna em CENTAVOS inteiros com base no valor dos produtos
 */
function calculateOrderAmount(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('O carrinho está vazio.');
  }

  const catalog = getProducts();
  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const handle = (item.handle || item.id || '').toString();
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

    // Busca no catálogo oficial do servidor
    let product = catalog[handle];
    if (!product) {
      // Busca por aproximação
      const key = Object.keys(catalog).find(k => k === handle || k.includes(handle) || handle.includes(k));
      if (key) product = catalog[key];
    }

    let officialPrice = 96.90; // fallback seguro
    let productTitle = item.title || 'Produto Casa Luce';

    if (product) {
      productTitle = product.title || productTitle;
      // Se tiver variantes e variante foi selecionada
      if (item.variantTitle && Array.isArray(product.variants) && product.variants.length > 0) {
        const v = product.variants.find(v => v.title === item.variantTitle);
        if (v && v.price) {
          officialPrice = parseFloat(v.price);
        } else if (product.price) {
          officialPrice = parseFloat(product.price);
        }
      } else if (product.price) {
        officialPrice = parseFloat(product.price);
      }
    } else if (item.price && !isNaN(parseFloat(item.price))) {
      // Se não encontrou no catálogo mas veio preço razoável do item
      officialPrice = Math.max(10, parseFloat(item.price));
    }

    const itemTotal = officialPrice * qty;
    subtotal += itemTotal;

    verifiedItems.push({
      handle,
      title: productTitle,
      variantTitle: item.variantTitle || '',
      quantity: qty,
      unitPrice: officialPrice,
      total: itemTotal
    });
  }

  // Sem desconto de 5% no PIX - Valor integral
  const discount = 0;
  const total = subtotal;
  const amountInCents = Math.round(total * 100);

  const mainItemName = verifiedItems[0].title;
  const extraCount = verifiedItems.length - 1;
  const description = extraCount > 0 
    ? `${mainItemName} (+${extraCount} itens) · Casa Luce`
    : `${mainItemName} · Casa Luce`;

  return {
    subtotal,
    discount,
    total: total,
    amountInCents,
    description: description.substring(0, 100),
    items: verifiedItems
  };
}

module.exports = {
  validateCPF,
  validatePhone,
  validateEmail,
  validateName,
  validateCEP,
  maskCPF,
  maskKey,
  calculateOrderAmount
};
