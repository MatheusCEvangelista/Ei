# 💰 FinanceApp

App de controle financeiro pessoal com React + Node.js + Supabase.

---

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta no [Vercel](https://vercel.com) (gratuita) — deploy do frontend
- Conta no [Render](https://render.com) (gratuita) — deploy do backend

---

## 1. Configurando o Supabase

1. Crie um projeto em supabase.com
2. Vá em **SQL Editor** e rode o script abaixo:

```sql
create table categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  is_fixed boolean default false,
  created_at timestamptz default now()
);

create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  type text check (type in ('income', 'expense')) not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  date date not null,
  created_at timestamptz default now()
);

alter table categories enable row level security;
alter table transactions enable row level security;

create policy "users veem só suas categorias"
  on categories for all using (auth.uid() = user_id);

create policy "users veem só suas transações"
  on transactions for all using (auth.uid() = user_id);
```

3. Vá em **Settings → API** e copie:
   - `Project URL`
   - `anon/public key`

---

## 2. Rodando o backend localmente

```bash
cd backend
npm install

# Copie e preencha o .env
cp .env.example .env
# Edite com seu editor: SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET

npm run dev
# Servidor rodando em http://localhost:3001
```

---

## 3. Rodando o frontend localmente

```bash
cd frontend
npm install

# Copie e preencha o .env
cp .env.example .env
# VITE_API_URL=http://localhost:3001

npm run dev
# App rodando em http://localhost:5173
```

---

## 4. Deploy gratuito

### Frontend → Vercel
1. Faça push do projeto para o GitHub
2. Importe o repositório no [vercel.com](https://vercel.com)
3. Configure a pasta raiz como `frontend`
4. Adicione a variável de ambiente: `VITE_API_URL=https://sua-api.onrender.com`

### Backend → Render
1. Importe o repositório no [render.com](https://render.com)
2. Configure: Root Directory = `backend`, Build Command = `npm install`, Start Command = `node server.js`
3. Adicione as variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `FRONTEND_URL`

---

## Estrutura do projeto

```
financeapp/
├── frontend/
│   └── src/
│       ├── components/   ← SummaryCards, Charts, TransactionList, Modal...
│       ├── pages/        ← LoginPage, Dashboard
│       ├── context/      ← AuthContext
│       └── lib/          ← api.js (axios)
└── backend/
    ├── routes/           ← auth, transactions, categories, summary
    ├── middleware/        ← auth.js (JWT via Supabase)
    └── lib/              ← supabase.js
```
