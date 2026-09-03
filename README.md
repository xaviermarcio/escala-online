# 🌹 La Rose · Escala Online

Sistema de gestão de escalas de trabalho para a **La Rose Hortifruti** — duas lojas, painel público para colaboradores e painel administrativo completo para o gestor.

🔗 **Produção:** [larose-escala.web.app](https://larose-escala.web.app)

---

## 📸 Telas do sistema

### Seleção de loja
> Colaborador escolhe a loja a cada acesso — sem memorização automática

![Seleção de loja](docs/login.png)

### Painel do colaborador — visão geral
> Calendário com todos os funcionários, horários e folgas do mês

![Visão geral](docs/colaborador.png)

### Painel do colaborador — filtro por nome
> Clicando no nome o colaborador vê só seus turnos, folgas e um resumo do mês

![Filtro colaborador](docs/filtro-colaborador.png)

### Painel administrativo
> Drag & drop para montar a escala, sidebar com funcionários e turnos

![Painel administrativo](docs/admin.png)

---

## ✨ Funcionalidades

### Painel do colaborador — público
- Seleção de loja a cada acesso (Entre Lagos · Itapoã Parque)
- Calendário mensal com nome e horário de cada turno
- Filtro por colaborador — resumo individual com total de turnos, folgas e dias livres
- **Mobile:** toque para expandir o dia e ver todos os horários
- Feriados nacionais e do DF com destaque vermelho
- Ausências com badges coloridos: 🏥 Atestado · ✈️ Férias · 📋 Licença · ⚠️ Falta · ⭐ Folga extra
- Exportar PDF com legenda completa e cores preservadas
- Responsivo: desktop, tablet e mobile (portrait + landscape)

### Painel administrativo — autenticado
- Login com e-mail e senha (Firebase Authentication)
- Gerenciamento independente por loja
- **Drag & drop** no desktop — arrastar funcionário ou turno para o dia
- **Tap de dois toques** no mobile — selecionar item e depois o dia
- Copiar dia para outro dia (substituir ou mesclar conteúdo)
- Copiar escala do mês anterior
- Padrão semanal — preencher semana inteira de uma vez
- Copiar dia para outro
- Gerenciar turnos: criar, renomear e deletar com horários personalizados
- Gerenciar equipe: adicionar e remover funcionários com paleta de 12 cores
- Feriados detectados via BrasilAPI + feriados municipais do DF
- Alertas CLT automáticos: folga semanal, descanso mínimo 11h, domingos consecutivos
- Horas extras calculadas por funcionário no mês
- Rascunho salvo automaticamente — publicação manual
- Histórico de alterações com log antes/depois
- Arquivo de escalas anteriores
- Troca de turno entre funcionários com registro
- Exportar PDF com cabeçalho, legenda e cores

---

## 🛠 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 · CSS3 · JavaScript ES Modules — sem frameworks |
| Autenticação | Firebase Authentication |
| Banco de dados | Cloud Firestore |
| Hospedagem | Firebase Hosting |
| Fontes | Plus Jakarta Sans (Google Fonts) |
| Feriados | [BrasilAPI](https://brasilapi.com.br) `feriados/v1/{ano}` |
| PWA | `manifest.json` + ícones SVG |

> **Pure vanilla** — sem Node.js runtime, sem bundler, sem build step. Deploy direto da pasta `public/`.

---

## 📁 Estrutura de arquivos

```
ESCALA-ONLINE/
├── .firebase/                       # Cache do Firebase CLI — ignorado pelo Git
├── docs/                            # Screenshots para o README
│   ├── login.png
│   ├── colaborador.png
│   ├── filtro-colaborador.png
│   └── admin.png
├── public/
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   ├── css/
│   │   ├── main.css                 # Design system: tokens, reset, componentes
│   │   ├── index.css                # Estilos do painel público
│   │   └── admin.css                # Estilos do painel administrativo
│   ├── js/
│   │   ├── firebase-config.js       # ⚠️ NÃO commitar — credenciais + config
│   │   ├── firebase-config.example.js  # Template para novos ambientes
│   │   ├── app.js                   # Lógica do painel público
│   │   └── admin.js                 # Lógica do painel administrativo
│   ├── 404.html
│   ├── admin.html                   # Painel administrativo
│   ├── index.html                   # Painel do colaborador
│   └── manifest.json                # PWA manifest
├── .gitignore
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
└── README.md
```

---

## 🔥 Estrutura do Firestore

```
escalas_loja1/              # Escalas da Loja 1 — Entre Lagos
  {YYYY-MM}/
    days: {
      1: { shifts: [{key, time}], folgam: [key], ausencias: [{key, tipo}] }
      ...
    }
    published: boolean
    updatedAt: string
    year: number
    month: number

escalas_loja2/              # Escalas da Loja 2 — Itapoã Parque
  (mesma estrutura)

historico_loja1/2           # Log de alterações
configuracoes/
  config_loja1/2            # Funcionários customizados por loja
  turnos_loja1/2            # Turnos customizados por loja
```

---

## ⚙️ Como rodar localmente

### Pré-requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- [Node.js](https://nodejs.org/) — para o Firebase CLI
- [Firebase CLI](https://firebase.google.com/docs/cli)

### Passo a passo

```bash
# 1. Clonar
git clone https://github.com/seu-usuario/escala-online.git
cd escala-online

# 2. Credenciais — copiar template e preencher
cp public/js/firebase-config.example.js public/js/firebase-config.js
# Edite firebase-config.js com os dados do Firebase Console

# 3. Instalar CLI
npm install -g firebase-tools
firebase login

# 4. Rodar localmente
firebase serve --only hosting
# → http://localhost:5000
```

> ES Modules exigem servidor HTTP real — abrir via `file://` não funciona por CORS.

---

## 🚀 Deploy

```bash
firebase deploy
# Ou só o hosting:
firebase deploy --only hosting
```

| Painel | URL |
|---|---|
| Colaboradores | `https://larose-escala.web.app` |
| Administrativo | `https://larose-escala.web.app/admin.html` |

---

## 🔐 Firebase — configuração inicial

**1. Autenticação**
```
Firebase Console → Authentication → Sign-in method → E-mail/senha → Ativar
Authentication → Users → Add user → criar o gestor
```

**2. Firestore rules**
```bash
firebase deploy --only firestore:rules
```

**3. Restringir API Key** — [Google Cloud Console](https://console.cloud.google.com) → APIs e Serviços → Credenciais:
```
https://larose-escala.web.app/*
https://larose-escala.firebaseapp.com/*
```

---

## 👥 Lojas e funcionários padrão

| Loja | Cor | Funcionários |
|---|---|---|
| Loja 1 · Entre Lagos | Verde `#16a34a` | Michele Moreira, Rosanea, Rosilene, Ítalo |
| Loja 2 · Itapoã Parque | Azul `#2563eb` | Amanda, Maria Paula, Gardênia, Ygor |

> Funcionários são gerenciados pelo botão **Equipe** no admin — dados salvos no Firestore por loja.

---

## 📋 Regras CLT monitoradas

| Regra | Valor atual |
|---|---|
| Descanso mínimo entre jornadas | 11 horas |
| Máximo de domingos consecutivos | 2 |
| Folgas por semana | 1 |
| Base por turno para h. extra | 500 min (8h20) |

> Quando a legislação mudar (5×2 · 40h semanais), ajuste o objeto `CLT` em `firebase-config.js`.

---

## 💡 Sugestões de próximos passos

| Melhoria | Impacto | Esforço |
|---|---|---|
| **Notificações push** quando a escala é publicada | Alto | Médio |
| **Histórico de trocas** de turno visível pelo colaborador | Médio | Baixo |
| **Export XLSX** da escala para o RH | Médio | Baixo |
| **Separar admin.js em módulos** (auth, data, render, modals) | Manutenção | Alto |
| **Dark mode** automático por preferência do sistema | UX | Médio |
| **Publicação agendada** — escala vai ao ar em data programada | Alto | Médio |

---

## 📄 Licença

Projeto privado — La Rose Hortifruti. Todos os direitos reservados.
