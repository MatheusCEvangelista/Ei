# 🚀 Guia de Deploy — FinanceApp

Stack gratuita: **Vercel** (frontend) + **Render** (backend) + **Supabase** (banco)

---

## Pré-requisito: subir o código no GitHub

```bash
cd financeapp
git init
git add .
git commit -m "chore: initial commit"
# Crie um repositório no github.com e conecte:
git remote add origin https://github.com/SEU_USUARIO/financeapp.git
git push -u origin main
```

---

## 1. Deploy do Backend → Render

1. Acesse [render.com](https://render.com) e faça login com GitHub
2. Clique em **New → Web Service**
3. Conecte o repositório `financeapp`
4. Configure:
   | Campo | Valor |
   |-------|-------|
   | Name | `financeapp-api` |
   | Root Directory | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |
   | Instance Type | **Free** |

5. Em **Environment Variables**, adicione:
   | Chave | Valor |
   |-------|-------|
   | `SUPABASE_URL` | URL do seu projeto Supabase |
   | `SUPABASE_ANON_KEY` | Anon key do Supabase |
   | `JWT_SECRET` | Uma string aleatória longa (ex: `minha-chave-super-secreta-123`) |
   | `FRONTEND_URL` | Deixe em branco por enquanto (preenche após deploy do frontend) |
   | `PORT` | `3001` |

6. Clique em **Create Web Service** e aguarde o deploy (~2 min)
7. Anote a URL gerada: `https://financeapp-api.onrender.com`

> ⚠️ No plano free o Render "dorme" após 15min de inatividade. O primeiro request pode demorar ~30s para acordar.

---

## 2. Deploy do Frontend → Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **Add New → Project**
3. Importe o repositório `financeapp`
4. Configure:
   | Campo | Valor |
   |-------|-------|
   | Root Directory | `frontend` |
   | Framework Preset | `Vite` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

5. Em **Environment Variables**, adicione:
   | Chave | Valor |
   |-------|-------|
   | `VITE_API_URL` | `https://financeapp-api.onrender.com` (URL do Render) |

6. Clique em **Deploy** e aguarde (~1 min)
7. Anote a URL gerada: `https://financeapp.vercel.app`

---

## 3. Conectar frontend ↔ backend

Após ter a URL do Vercel, volte ao **Render**:

1. Vá em seu serviço → **Environment**
2. Edite `FRONTEND_URL` e coloque: `https://financeapp.vercel.app`
3. Clique em **Save Changes** — o Render fará redeploy automático

---

## 4. Configurar Supabase para produção

No painel do Supabase:

1. **Authentication → URL Configuration**:
   - Site URL: `https://financeapp.vercel.app`
   - Redirect URLs: `https://financeapp.vercel.app/*`

2. **Settings → API → CORS**:
   Adicione `https://financeapp-api.onrender.com`

---

## ✅ Checklist final

- [ ] Backend rodando em `https://financeapp-api.onrender.com/health` (deve retornar `{"status":"ok"}`)
- [ ] Frontend abrindo em `https://financeapp.vercel.app`
- [ ] Cadastro de usuário funcionando
- [ ] Login funcionando
- [ ] Criar transação funcionando

---

## Deploy futuro (atualizações)

Após qualquer mudança no código, basta fazer push:

```bash
git add .
git commit -m "feat: minha atualização"
git push
```

Vercel e Render detectam o push e fazem redeploy automático. ✨
