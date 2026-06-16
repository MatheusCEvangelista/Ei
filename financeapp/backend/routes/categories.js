const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const auth = require('../middleware/auth');
router.use(auth);
function db(t){ return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); }

router.get('/', async (req,res) => {
  const {data,error} = await db(req.token).from('categories').select('*').eq('user_id',req.user.id).order('is_fixed',{ascending:false});
  if(error) return res.status(400).json({error:error.message});
  res.json(data);
});
router.post('/', async (req,res) => {
  const {name,color} = req.body;
  if(!name) return res.status(400).json({error:'Nome é obrigatório'});
  const {data,error} = await db(req.token).from('categories').insert({name,color:color||'#6b7280',is_fixed:false,user_id:req.user.id}).select().single();
  if(error) return res.status(400).json({error:error.message});
  res.status(201).json(data);
});
router.put('/:id', async (req,res) => {
  const {name,color} = req.body;
  const {data:cat} = await db(req.token).from('categories').select('is_fixed').eq('id',req.params.id).single();
  if(cat?.is_fixed) return res.status(400).json({error:'Não é possível editar categorias fixas'});
  const {data,error} = await db(req.token).from('categories').update({name,color}).eq('id',req.params.id).eq('user_id',req.user.id).select().single();
  if(error) return res.status(400).json({error:error.message});
  res.json(data);
});
router.delete('/:id', async (req,res) => {
  const {data:cat} = await db(req.token).from('categories').select('is_fixed').eq('id',req.params.id).single();
  if(cat?.is_fixed) return res.status(400).json({error:'Não é possível excluir categorias fixas'});
  const {error} = await db(req.token).from('categories').delete().eq('id',req.params.id).eq('user_id',req.user.id);
  if(error) return res.status(400).json({error:error.message});
  res.json({message:'ok'});
});
module.exports = router;
