const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const auth = require('../middleware/auth');
router.use(auth);
function db(t){ return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); }

router.get('/', async (req,res) => {
  const {month,year,account_id} = req.query;
  let q = db(req.token).from('transactions').select('*,categories(id,name,color),accounts(id,name,color,icon)').eq('user_id',req.user.id).order('date',{ascending:false});
  if(month&&year){
    const start=`${year}-${String(month).padStart(2,'0')}-01`;
    const end=new Date(year,month,0).toISOString().split('T')[0];
    q=q.gte('date',start).lte('date',end);
  }
  if(account_id) q=q.eq('account_id',account_id);
  const {data,error}=await q;
  if(error) return res.status(400).json({error:error.message});
  res.json(data);
});
router.post('/', async (req,res) => {
  const {amount,type,description,category_id,date,account_id}=req.body;
  if(!amount||!type||!date) return res.status(400).json({error:'Valor, tipo e data são obrigatórios'});
  const {data,error}=await db(req.token).from('transactions').insert({amount,type,description,category_id,date,account_id:account_id||null,user_id:req.user.id}).select('*,categories(id,name,color),accounts(id,name,color,icon)').single();
  if(error) return res.status(400).json({error:error.message});
  res.status(201).json(data);
});
router.put('/:id', async (req,res) => {
  const {amount,type,description,category_id,date,account_id}=req.body;
  const {data,error}=await db(req.token).from('transactions').update({amount,type,description,category_id,date,account_id:account_id||null}).eq('id',req.params.id).eq('user_id',req.user.id).select('*,categories(id,name,color),accounts(id,name,color,icon)').single();
  if(error) return res.status(400).json({error:error.message});
  res.json(data);
});
router.delete('/:id', async (req,res) => {
  const {error}=await db(req.token).from('transactions').delete().eq('id',req.params.id).eq('user_id',req.user.id);
  if(error) return res.status(400).json({error:error.message});
  res.json({message:'ok'});
});
module.exports = router;
