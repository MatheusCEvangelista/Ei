const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware   = require('../middleware/auth');

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ── Dicionário built-in — mapeado para as categorias padrão do sistema ──────
const BUILT_IN = [
  // Alimentação
  { re: /supermercado|mercado|carrefour|extra\b|pão de açúcar|atacadão|savegnago|big comp|hortifruti|açougue|panificadora|padaria|colher de pau|mercearia/i, cat: 'Alimentação' },
  { re: /restaurante|lanchonete|pizzaria|ifood|rappi|burger|mcdonalds|mcdonald|subway|habib|china in box|bobs|giraffas|madero|outback|arena cafe|food shop|lanches/i, cat: 'Alimentação' },
  { re: /day2day|café\b|cafeteria|cantina|sushi|delivery.*comida|lanche|snack|açaí/i, cat: 'Alimentação' },

  // Moradia
  { re: /energia|cemig|enel|cpfl|light\b|celesc|elektro|coelba|coelce|celpe/i, cat: 'Moradia' },
  { re: /\bágua\b|saae|saneamento|copasa|sabesp|cedae|cagece|sanear/i, cat: 'Moradia' },
  { re: /aluguel|condomínio|imobiliária|taxa condominial|administradora imov/i, cat: 'Moradia' },
  { re: /\btim\b|\bclaro\b|\bvivo\b|\boi\b|net combo|banda larga|fibra|aliansce|travessia/i, cat: 'Moradia' },

  // Transporte
  { re: /posto\b|gasolina|combustível|shell|ipiranga|petrobras|br distribuidora|candial|monte belo|paulo vi|galo branco/i, cat: 'Transporte' },
  { re: /uber|99pop|99taxi|99app|cabify|blablacar|estacionamento|zona azul|rotativo/i, cat: 'Transporte' },
  { re: /onibus|ônibus|metro|metrô|trem|bilhete único|cartão transporte|passagem.*ibus/i, cat: 'Transporte' },

  // Saúde
  { re: /farmácia|drogaria|droga\w*|ultrafarma|pacheco|raia\d*|pague menos|drogasil|drogafarma|grupo fartura/i, cat: 'Saúde' },
  { re: /hospital|clínica|médico|plano de saúde|unimed|bradesco saúde|amil|convenio|sulamerica/i, cat: 'Saúde' },
  { re: /academia|smartfit|bodytech|bluefit|total pass|crossfit|gym\b|pilates|yoga/i, cat: 'Saúde' },

  // Educação
  { re: /escola|faculdade|universidade|curso\b|mensalidade.*ens|uni-|facef|fundação|colégio|colegio/i, cat: 'Educação' },
  { re: /livraria|cultura\b|fnac|submarino livros|livros|papelaria/i, cat: 'Educação' },

  // Lazer
  { re: /cinema|teatro|show\b|ingresso|ticketmaster|eventim|sympla|parque|diversão/i, cat: 'Lazer' },
  { re: /hotel|pousada|airbnb|booking|hostel|resort/i, cat: 'Lazer' },
  { re: /passagem.*aére|latam|\bgol\b|\bazul\b|avianca|decolar|embarque/i, cat: 'Lazer' },
  { re: /pub\b|bar\b|balada|boate|miguelzinho|snook/i, cat: 'Lazer' },

  // Vestuário
  { re: /\bcea\b|c&a|renner|riachuelo|marisa|\bzara\b|h&m\b|\bnike\b|\badidas\b|via marte|brooks\b/i, cat: 'Vestuário' },

  // Compras
  { re: /americanas|magazine luiza|casas bahia|shoptime|\bamazon\b|mercadolivre|b2w|extra eletro|shopee/i, cat: 'Compras' },
  { re: /pereira e macedo|franca point|mania\b|atacado|hiper/i, cat: 'Compras' },

  // Assinaturas
  { re: /netflix|spotify|amazon prime|disney\+|hbo\b|globoplay|youtube premium|deezer|apple music|paramount|mp\*pastelarclube/i, cat: 'Assinaturas' },
  { re: /icloud|microsoft 365|adobe|canva|dropbox|google one|antivirus/i, cat: 'Assinaturas' },

  // Beleza
  { re: /salão|salon|cabelereiro|barbearia|beleza|estética|manicure|spa\b|depilação|perfum/i, cat: 'Beleza' },

  // Pets
  { re: /petshop|pet shop|\bvet\b|veterinário|veterinaria|ração|banho e tosa|\bpet\b/i, cat: 'Pets' },

  // Financeiro
  { re: /pagamento.*cartão|pgto.*cartão|fatura.*cartão|pagamento.*mastercard|pagamento.*visa|pagamento.*a\.m\.a/i, cat: 'Financeiro' },
  { re: /empréstimo|financiamento|parcela.*emprés|empréstimos mercado|pagamento de parcela/i, cat: 'Financeiro' },
  { re: /deb\.pgto\.boleto|pagamento boleto/i, cat: 'Financeiro' },

  // Salário (receitas)
  { re: /salário|salario|pagamento.*empresa|folha.*pagamento|holerite|pro-labore|remuner/i, cat: 'Salário' },

  // Investimentos (receitas)
  { re: /rendimento|cdb\b|lci\b|lca\b|tesouro direto|juros recebido|disponibilizacao de beneficio|dividendo/i, cat: 'Investimentos' },

  // Renda Extra (receitas)
  { re: /pix receb|pix.*recebido|transferencia recebida|ted recebido|tev recebido|freelance|freela/i, cat: 'Renda Extra' },
];

// Gera hash determinístico para deduplicação
function makeHash(userId, date, amount, description, type) {
  const str = [userId, date, Number(amount).toFixed(2), (description||'').toLowerCase().trim(), type].join('|');
  return crypto.createHash('md5').update(str).digest('hex');
}

// ── Rota: categorizar lista de transações ─────────────────────────────────
router.post('/categorize', async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions)) return res.status(400).json({ error: 'transactions[] obrigatório' });

  const supabase = db(req.token);

  // Busca categorias do usuário e regras customizadas em paralelo
  const [{ data: userCats }, { data: userRules }] = await Promise.all([
    supabase.from('categories').select('id,name').eq('user_id', req.user.id),
    supabase.from('category_rules').select('pattern,category_id').eq('user_id', req.user.id),
  ]);

  // Monta mapa nome→id para as categorias do usuário (case insensitive)
  const catByName = {};
  (userCats||[]).forEach(c => { catByName[c.name.toLowerCase()] = c.id; });

  const result = transactions.map(tx => {
    const desc = (tx.description||'').toLowerCase();
    let suggested_category_id   = null;
    let suggested_category_name = null;
    let suggestion_source       = null; // 'user_rule' | 'built_in'

    // 1. Regras do próprio usuário têm prioridade
    for (const rule of (userRules||[])) {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(desc)) {
          suggested_category_id   = rule.category_id;
          suggestion_source       = 'user_rule';
          // Busca nome da categoria para exibir
          const cat = (userCats||[]).find(c=>c.id===rule.category_id);
          suggested_category_name = cat?.name || null;
          break;
        }
      } catch(_) {}
    }

    // 2. Dicionário built-in (se não achou regra do usuário)
    if (!suggested_category_id) {
      for (const entry of BUILT_IN) {
        if (entry.re.test(desc)) {
          const catId = catByName[entry.cat.toLowerCase()];
          if (catId) {
            suggested_category_id   = catId;
            suggested_category_name = entry.cat;
            suggestion_source       = 'built_in';
          }
          break;
        }
      }
    }

    return {
      ...tx,
      suggested_category_id,
      suggested_category_name,
      suggestion_source,
    };
  });

  res.json(result);
});

// ── Rota: verificar duplicatas antes de importar ───────────────────────────
router.post('/check-duplicates', async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions)) return res.status(400).json({ error: 'transactions[] obrigatório' });

  const supabase = db(req.token);

  // Gera hashes para todas as transações candidatas
  const withHashes = transactions.map(tx => ({
    ...tx,
    import_hash: makeHash(req.user.id, tx.date, tx.amount, tx.description, tx.type),
  }));

  const hashes = withHashes.map(t => t.import_hash);

  // Busca quais hashes já existem
  const { data: existing } = await supabase.from('transactions')
    .select('import_hash')
    .eq('user_id', req.user.id)
    .in('import_hash', hashes);

  const existingSet = new Set((existing||[]).map(t => t.import_hash));

  const result = withHashes.map(tx => ({
    ...tx,
    is_duplicate: existingSet.has(tx.import_hash),
  }));

  res.json({
    transactions: result,
    total:      result.length,
    new:        result.filter(t=>!t.is_duplicate).length,
    duplicates: result.filter(t=>t.is_duplicate).length,
  });
});

// ── CRUD de regras customizadas ───────────────────────────────────────────
router.get('/rules', async (req, res) => {
  const { data, error } = await db(req.token).from('category_rules')
    .select('*, categories(id,name,color)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/rules', async (req, res) => {
  const { pattern, category_id } = req.body;
  if (!pattern || !category_id) return res.status(400).json({ error: 'Padrão e categoria obrigatórios' });
  // Valida se é regex válida
  try { new RegExp(pattern, 'i'); } catch { return res.status(400).json({ error: 'Padrão regex inválido' }); }
  const { data, error } = await db(req.token).from('category_rules')
    .insert({ pattern, category_id, user_id: req.user.id })
    .select('*, categories(id,name,color)').single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.delete('/rules/:id', async (req, res) => {
  const { error } = await db(req.token).from('category_rules')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'ok' });
});

// Exporta helper de hash para uso no route de transactions
router.makeHash = makeHash;
module.exports = router;
