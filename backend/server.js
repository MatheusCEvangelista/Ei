require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes         = require('./routes/auth');
const transactionRoutes  = require('./routes/transactions');
const categoryRoutes     = require('./routes/categories');
const summaryRoutes      = require('./routes/summary');
const goalRoutes         = require('./routes/goals');
const accountRoutes      = require('./routes/accounts');
const recurringRoutes    = require('./routes/recurring');
const investmentRoutes   = require('./routes/investments');
const budgetRoutes       = require('./routes/budgets');
const aiRoutes           = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');
const projectionRoutes   = require('./routes/projections');
const debtRoutes         = require('./routes/debts');
const creditCardRoutes   = require('./routes/credit_cards');
const transferRoutes     = require('./routes/transfers');
const insightRoutes      = require('./routes/insights');
const leonRoutes         = require('./routes/leon');
const importRoutes       = require('./routes/import');
const calendarRoutes     = require('./routes/calendar');
const networthRoutes     = require('./routes/networth');
const annualRoutes = require('./routes/annual');
const reportRoutes = require('./routes/reports');
const planningRoutes = require('./routes/planning');
const searchRoutes = require('./routes/search'); 
const healthRoutes = require('./routes/health');
const customAlertsRoutes = require('./routes/custom_alerts');
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
    callback(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/auth',          authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/transactions',  transactionRoutes);
app.use('/api/categories',    categoryRoutes);
app.use('/api/summary',       summaryRoutes);
app.use('/api/goals',         goalRoutes);
app.use('/api/accounts',      accountRoutes);
app.use('/api/recurring',     recurringRoutes);
app.use('/api/investments',   investmentRoutes);
app.use('/api/budgets',       budgetRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projections',   projectionRoutes);
app.use('/api/debts',         debtRoutes);
app.use('/api/credit-cards',  creditCardRoutes);
app.use('/api/transfers',     transferRoutes);
app.use('/api/insights',      insightRoutes);
app.use('/api/leon',          leonRoutes);
app.use('/api/import',        importRoutes);
app.use('/api/calendar',      calendarRoutes);
app.use('/api/networth',      networthRoutes);
app.use('/api/annual', annualRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/custom-alerts', customAlertsRoutes);
app.locals.createNotification = notificationRoutes.createNotification;

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
