require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes        = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes    = require('./routes/categories');
const summaryRoutes     = require('./routes/summary');
const goalRoutes        = require('./routes/goals');
const accountRoutes     = require('./routes/accounts');
const recurringRoutes   = require('./routes/recurring');
const aiRoutes          = require('./routes/ai');
const investmentRoutes  = require('./routes/investments');
const budgetRoutes      = require('./routes/budgets');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  (process.env.FRONTEND_URL || '').replace(/\/$/, ''),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.split('/').slice(0, 3).join('/');
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories',   categoryRoutes);
app.use('/api/summary',      summaryRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/accounts',     accountRoutes);
app.use('/api/recurring',    recurringRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/investments',  investmentRoutes);
app.use('/api/budgets',      budgetRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
