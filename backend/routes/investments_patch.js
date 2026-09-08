// PATCH para o endpoint de aporte — adicionar ao investments.js
// substitui o router.post('/:id/entries', ...) existente

router.post('/:id/entries', async (req, res) => {
  const { quantity, price, date, account_id } = req.body;
  if (!quantity || !price || !date)
    return res.status(400).json({ error: 'Quantidade, preço e data são obrigatórios' });

  const supabase  = db(req.token);
  const qty       = Number(quantity);
  const prc       = Number(price);
  const totalCost = qty * prc;

  // Cria o aporte
  const { data: entry, error } = await supabase.from('investment_entries').insert({
    investment_id: req.params.id,
    user_id:       req.user.id,
    quantity: qty, price: prc, date,
    account_id: account_id || null,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  // Recalcula quantidade total e preço médio ponderado
  const { data: allEntries } = await supabase
    .from('investment_entries')
    .select('quantity,price')
    .eq('investment_id', req.params.id);

  const totalQty = allEntries.reduce((s,e) => s + Number(e.quantity), 0);
  const totalVal = allEntries.reduce((s,e) => s + Number(e.quantity) * Number(e.price), 0);
  const avgPrice = totalQty > 0 ? totalVal / totalQty : 0;

  // Busca o investment para checar se é renda fixa
  const { data: inv } = await supabase
    .from('investments')
    .select('type,name,initial_amount')
    .eq('id', req.params.id).single();

  const isFixed = ['fixed_income','treasury'].includes(inv?.type);

  // Atualiza investment
  const updatePayload = {
    quantity:  isFixed ? 1       : Math.round(totalQty * 1000000) / 1000000,
    avg_price: isFixed ? totalVal : Math.round(avgPrice * 100) / 100,
  };

  // Para renda fixa, soma ao initial_amount
  if (isFixed) {
    updatePayload.initial_amount = Math.round(totalVal * 100) / 100;
  }

  await supabase.from('investments')
    .update(updatePayload)
    .eq('id', req.params.id);

  // Se conta vinculada, debita da conta
  let linkedTransaction = null;
  if (account_id) {
    const { data: cat } = await supabase.from('categories')
      .select('id').eq('user_id', req.user.id)
      .ilike('name', '%investimento%').limit(1).single().catch(()=>({data:null}));

    const { data: tx } = await supabase.from('transactions').insert({
      user_id:     req.user.id,
      type:        'expense',
      amount:      isFixed ? prc : totalCost, // renda fixa: valor único; variável: qty × preço
      description: `Aporte — ${inv?.name || 'Investimento'}`,
      date, account_id,
      category_id: cat?.id || null,
      status:      'confirmed',
    }).select().single().catch(()=>({data:null}));
    linkedTransaction = tx;
  }

  res.status(201).json({
    entry,
    updated_investment: { quantity: updatePayload.quantity, avg_price: updatePayload.avg_price },
    linked_transaction: linkedTransaction,
  });
});
