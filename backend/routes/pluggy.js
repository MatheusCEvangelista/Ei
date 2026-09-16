const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware   = require('../middleware/auth');

router.use(authMiddleware);

function db(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const PLUGGY_BASE = 'https://api.pluggy.ai';

// ── Autenticação Pluggy — gera apiKey (válido por 2h) ────────────────────
let cachedApiKey = null;
let apiKeyExpiry = 0;

async function getPluggyKey() {
  if (cachedApiKey && Date.now() < apiKeyExpiry) return cachedApiKey;
  const res = await fetch(`${PLUGGY_BASE}/auth`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId:     process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error('Falha ao autenticar com Pluggy');
  const data   = await res.json();
  cachedApiKey = data.apiKey;
  apiKeyExpiry = Date.now() + 110 * 60 * 1000; // 110min (margem de segurança)
  return cachedApiKey;
}

async function pluggyGet(path) {
  const key = await getPluggyKey();
  const res  = await fetch(`${PLUGGY_BASE}${path}`, {
    headers: { 'X-API-KEY': key },
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || `Pluggy error ${res.status}`);
  }
  return res.json();
}

async function pluggyPost(path, body) {
  const key = await getPluggyKey();
  const res  = await fetch(`${PLUGGY_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || `Pluggy error ${res.status}`);
  }
  return res.json();
}

async function pluggyDelete(path) {
  const key = await getPluggyKey();
  await fetch(`${PLUGGY_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'X-API-KEY': key },
  });
}

// ── Mapeamento de categorias Pluggy → Ei! ─────────────────────────────────
const CATEGORY_MAP = {
  'Food and Drink':       'Alimentação',
  'Restaurants':          'Alimentação',
  'Supermarkets':         'Alimentação',
  'Transport':            'Transporte',
  'Uber':                 'Transporte',
  'Taxi':                 'Transporte',
  'Health':               'Saúde',
  'Pharmacy':             'Saúde',
  'Hospital':             'Saúde',
  'Entertainment':        'Lazer',
  'Streaming':            'Lazer',
  'Shopping':             'Vestuário',
  'Clothing':             'Vestuário',
  'Education':            'Educação',
  'Home':                 'Moradia',
  'Rent':                 'Moradia',
  'Utilities':            'Moradia',
  'Phone':                'Moradia',
  'Investment':           'Investimentos',
  'Transfer':             null, // ignorar
  'Income':               null, // tipo receita
  'Financial':            'Outros',
  'Personal Care':        'Outros',
};

async function mapCategory(pluggyCategory, supabase, userId) {
  if (!pluggyCategory) return null;
  const eiName = CATEGORY_MAP[pluggyCategory];
  if (!eiName) return null;

  const { data } = await supabase.from('categories')
    .select('id').eq('user_id', userId).ilike('name', `%${eiName}%`).limit(1).single();
  return data?.id || null;
}

// ── GET /api/pluggy/banks — lista bancos disponíveis ─────────────────────
router.get('/banks', async (req, res) => {
  try {
    const { country = 'BR', sandbox = false } = req.query;
    const data = await pluggyGet(`/connectors?countries=${country}`);
    const banks = (data.results || [])
      .filter(c => !sandbox ? !c.isSandbox : true)
      .map(c => ({
        id:          c.id,
        name:        c.name,
        logo:        c.imageUrl,
        institution: c.institutionUrl,
        types:       c.type,
        credentials: c.credentials, // campos necessários para conectar
      }));
    res.json(banks);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pluggy/banks/:id — detalhes + formulário de um banco ─────────
router.get('/banks/:id', async (req, res) => {
  try {
    const data = await pluggyGet(`/connectors/${req.params.id}`);
    res.json({
      id:          data.id,
      name:        data.name,
      logo:        data.imageUrl,
      credentials: data.credentials, // array com {name, label, type, placeholder, required}
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pluggy/connect — cria conexão com credenciais do usuário ────
router.post('/connect', async (req, res) => {
  const { connector_id, credentials, bank_name, bank_logo } = req.body;
  if (!connector_id || !credentials)
    return res.status(400).json({ error: 'connector_id e credentials obrigatórios' });

  const supabase = db(req.token);

  try {
    // Cria item na Pluggy
    const item = await pluggyPost('/items', {
      connectorId: connector_id,
      parameters:  credentials,
    });

    // Salva conexão no banco
    const { data: conn, error } = await supabase.from('bank_connections').insert({
      user_id:      req.user.id,
      item_id:      item.id,
      connector_id: connector_id,
      bank_name:    bank_name || item.connector?.name || 'Banco',
      bank_logo:    bank_logo || item.connector?.imageUrl || null,
      status:       item.status || 'UPDATING',
      auto_sync:    false,
    }).select().single();

    if (error) throw new Error(error.message);
    res.status(201).json({ connection: conn, item });

  } catch(err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/pluggy/connections — lista conexões do usuário ───────────────
router.get('/connections', async (req, res) => {
  const supabase = db(req.token);
  const { data, error } = await supabase.from('bank_connections')
    .select('*').eq('user_id', req.user.id).order('created_at',{ascending:false});
  if (error) return res.status(400).json({ error: error.message });

  // Atualiza status em tempo real para conexões em andamento
  const updated = [];
  for (const conn of data || []) {
    if (conn.status === 'UPDATING') {
      try {
        const item = await pluggyGet(`/items/${conn.item_id}`);
        if (item.status !== conn.status) {
          await supabase.from('bank_connections').update({ status: item.status }).eq('id', conn.id);
          updated.push({ ...conn, status: item.status });
        } else { updated.push(conn); }
      } catch { updated.push(conn); }
    } else { updated.push(conn); }
  }
  res.json(updated);
});

// ── POST /api/pluggy/sync/:id — sincronização manual ─────────────────────
router.post('/sync/:id', async (req, res) => {
  const supabase = db(req.token);
  const { data: conn } = await supabase.from('bank_connections')
    .select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

  try {
    const result = await syncConnection(conn, supabase, req.user.id);
    await supabase.from('bank_connections').update({
      last_sync_at: new Date().toISOString(), status: 'LOGIN_SUCCESS', error_msg: null,
    }).eq('id', conn.id);
    res.json(result);
  } catch(err) {
    await supabase.from('bank_connections').update({
      status: 'LOGIN_ERROR', error_msg: err.message,
    }).eq('id', conn.id);
    res.status(400).json({ error: err.message });
  }
});

// ── Função de sincronização ───────────────────────────────────────────────
async function syncConnection(conn, supabase, userId) {
  // Busca contas do item
  const accsData = await pluggyGet(`/accounts?itemId=${conn.item_id}`);
  const accounts = accsData.results || [];

  // Data de início: última sync ou 30 dias atrás
  const since = conn.last_sync_at
    ? conn.last_sync_at.split('T')[0]
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  let imported = 0, duplicates = 0;

  for (const acc of accounts) {
    // Busca transações
    const txData = await pluggyGet(
      `/transactions?accountId=${acc.id}&from=${since}&to=${today}&pageSize=100`
    );
    const txs = txData.results || [];

    for (const tx of txs) {
      // Ignora transferências entre contas
      if (tx.type === 'TRANSFER') continue;

      const amount    = Math.abs(tx.amount);
      const type      = tx.amount < 0 ? 'expense' : 'income';
      const date      = tx.date?.split('T')[0] || today;
      const desc      = tx.description || tx.merchant?.name || 'Importado Pluggy';
      const hash      = Buffer.from(`${date}${desc}${amount}${conn.item_id}`).toString('base64').slice(0,32);
      const categoryId= await mapCategory(tx.category, supabase, userId);

      const { error } = await supabase.from('transactions').insert({
        user_id:      userId,
        type,
        amount,
        description: desc.slice(0, 80),
        date,
        category_id:  categoryId,
        import_hash:  hash,
        status:       'confirmed',
      });

      if (error?.code === '23505') duplicates++;
      else if (!error)              imported++;
    }
  }

  return { imported, duplicates, accounts: accounts.length };
}

// ── PATCH /api/pluggy/connections/:id/auto-sync ───────────────────────────
router.patch('/connections/:id/auto-sync', async (req, res) => {
  const { enabled } = req.body;
  const supabase = db(req.token);
  const { data, error } = await supabase.from('bank_connections')
    .update({ auto_sync: !!enabled })
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/pluggy/connections/:id ───────────────────────────────────
router.delete('/connections/:id', async (req, res) => {
  const supabase = db(req.token);
  const { data: conn } = await supabase.from('bank_connections')
    .select('item_id').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

  try { await pluggyDelete(`/items/${conn.item_id}`); } catch {}
  await supabase.from('bank_connections').delete().eq('id', req.params.id);
  res.json({ message: 'ok' });
});

// ── POST /api/pluggy/sync-all — cron: sincroniza todas com auto_sync=true ─
router.post('/sync-all', async (req, res) => {
  const supabase = db(req.token);
  const { data: conns } = await supabase.from('bank_connections')
    .select('*').eq('user_id', req.user.id).eq('auto_sync', true);

  if (!conns?.length) return res.json({ synced:0, message:'Nenhuma conexão com auto-sync ativo' });

  let total = { imported:0, duplicates:0 };
  for (const conn of conns) {
    try {
      const r = await syncConnection(conn, supabase, req.user.id);
      total.imported   += r.imported;
      total.duplicates += r.duplicates;
      await supabase.from('bank_connections').update({
        last_sync_at: new Date().toISOString(), status:'LOGIN_SUCCESS', error_msg:null,
      }).eq('id', conn.id);
    } catch(err) {
      await supabase.from('bank_connections').update({
        status:'LOGIN_ERROR', error_msg:err.message,
      }).eq('id', conn.id);
    }
  }

  // Notifica usuário se importou algo
  if (total.imported > 0) {
    await supabase.from('notifications').insert({
      user_id: req.user.id, type:'sync_complete',
      title:   '🔄 Sincronização concluída',
      body:    `${total.imported} nova${total.imported!==1?'s':''} transação${total.imported!==1?'ões':''} importada${total.imported!==1?'s':''}.`,
      read:    false,
    }).catch(()=>{});
  }

  res.json({ ...total, connections: conns.length });
});

module.exports = router;
