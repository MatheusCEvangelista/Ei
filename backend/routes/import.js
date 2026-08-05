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

// ── Dicionário built-in (regex → nome de categoria padrão) ────────────────
const BUILT_IN = [
  // Alimentação — mercados e delivery
  { re: /supermercado|mercado|carrefour|extra\b|pão de açúcar|atacadão|savegnago|big comp|hortifruti|açougue|panificadora|padaria|colher de pau/i, cat: 'Alimentação' },
  { re: /restaurante|lanchonete|pizzaria|ifood|rappi|burger|mcdonalds|mcdonald|subway|habib|china in box|bobs|giraffas|madero|outback|arena cafe|food shop/i, cat: 'Alimentação' },
  { re: /day2day|café\b|cafeteria|cantina|sushi|delivery|lanche|snack/i, cat: 'Alimentação' },

  // Transporte — combustível
  { re: /posto\b|gasolina|combustível|shell|ipiranga|petrobras|br distribuidora|candial|monte belo|paulo vi|galo branco/i, cat: 'Transporte' },
  // Transporte — app e estacionamento
  { re: /uber|99pop|99taxi|99app|cabify|blablacar|estacionamento|zona azul|rotativo/i, cat: 'Transporte' },
  // Transporte — público
  { re: /onibus|ônibus|metro|metrô|trem|bilhete único|cartão transporte/i, cat: 'Transporte' },

  // Saúde — farmácia
  { re: /farmácia|drogaria|droga\w*|ultrafarma|pacheco|raia\d+|raia\b|pague menos|drogasil|drogafarma|grupo fartura/i, cat: 'Saúde' },
  // Saúde — plano e clínica
  { re: /hospital|clínica|médico|plano de saúde|unimed|bradesco saúde|amil|convenio|sulamerica/i, cat: 'Saúde' },
  // Saúde — academia
  { re: /academia|smartfit|bodytech|bluefit|total pass|crossfit|gym\b/i, cat: 'Saúde' },

  // Moradia — energia
  { re: /energia|cemig|enel|cpfl|light\b|celesc|elektro|coelba|coelce|celpe|elektro/i, cat: 'Moradia' },
  // Moradia — água
  { re: /\bágua\b|saae|saneamento|copasa|sabesp|cedae|cagece|sanear/i, cat: 'Moradia' },
  // Moradia — aluguel/condomínio
  { re: /aluguel|condomínio|imobiliária|taxa condominial|administradora imov/i, cat: 'Moradia' },
  // Moradia — internet/telefone
  { re: /\btim\b|\bclaro\b|\bvivo\b|\boi\b|net combo|banda larga|fibra optica|aliansce|travessia/i, cat: 'Moradia' },

  // Assinaturas/Streaming
  { re: /netflix|spotify|amazon prime|disney\+|hbo\b|globoplay|youtube premium|deezer|apple music|paramount|mp\*pastelarclube/i, cat: 'Assinaturas' },
  { re: /icloud|microsoft 365|adobe|canva|dropbox|google one/i, cat: 'Assinaturas' },

  // Educação
  { re: /escola|faculdade|universidade|curso\b|mensalidade\b|uni-|facef|fundação|colegio|colégio/i, cat: 'Educação' },
  { re: /livraria|cultura\b|fnac|submarino livros|amazon livros/i, cat: 'Educação' },

  // Lazer
  { re: /cinema|teatro|show\b|ingresso|ticketmaster|eventim|sympla/i, cat: 'Lazer' },
  { re: /hotel|pousada|airbnb|booking|hostel/i, cat: 'Lazer' },
  { re: /passagem|latam|gol\b|azul\b|avianca|decolar|companhia aérea/i, cat: 'Lazer' },

  // Vestuário / Compras
  { re: /\bcea\b|c&a|renner|riachuelo|marisa|\bzara\b|h&m\b|nike\b|adidas\b|via marte/i, cat: 'Vestuário' },
  { re: /americanas|magazine luiza|casas bahia|shoptime|amazon\b|mercadolivre|b2w/i, cat: 'Compras' },
  { re: /pereira e macedo|franca point|mania\b|loja\b/i, cat: 'Compras' },

  // Financeiro
  { re: /pagamento.*cartão|pgto.*cartão|fatura.*cartão|pagamento.*mastercard|pagamento.*visa/i, cat: 'Financeiro' },
  { re: /empréstimo|financiamento|parcela.*emprés|empréstimos mercado/i, cat: 'Financeiro' },

  // Salário / Receitas
  { re: /salário|salario|pagamento.*empresa|folha.*pagamento|holerite|pro-labore/i, cat: 'Salário' },
  { re: /pix receb|pix.*recebido|transferencia recebida|ted recebido|tev recebido/i, cat: 'Receitas' },
  { re: /rendimento|cdb\b|lci\b|lca\b|tesouro direto|juros recebido|disponibilizacao de beneficio/i, cat: 'Investimentos' },

  // Animais
  { re: /petshop|pet shop|vet\b|veterinário|ração|banho e tosa/i, cat: 'Animais' },
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
