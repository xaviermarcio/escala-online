# 🌹 La Rose · Escala Online

Sistema de gestão de escalas de trabalho para a **La Rose Hortifruti**.  
Painel administrativo completo para o gestor e painel público para consulta pelos colaboradores.

🔗 **Produção:** [larose-escala.web.app](https://larose-escala.web.app)

---

## 📸 Telas do sistema

### Seleção de loja

![Seleção de loja](docs/login.png)

### Painel do colaborador

![Painel colaborador](docs/colaborador.png)

### Painel administrativo

![Painel administrativo](docs/admin.png)

---

## ✨ Funcionalidades

### Painel do colaborador — público
- Seleção de loja a cada acesso (Entre Lagos · Itapoã Parque)
- Calendário mensal com nome e horário de cada turno
- Filtro por colaborador — exibe turnos, folgas e dias livres individuais
- Tap para expandir dia no mobile — revela todos os turnos e horários
- Badges coloridos para ausências: 🏥 Atestado · ✈️ Férias · 📋 Licença · ⚠️ Falta · ⭐ Folga extra
- Feriados nacionais e do DF destacados em vermelho
- Exportar PDF com legenda completa e cores preservadas
- Responsivo: desktop, tablet, portrait e landscape mobile

### Painel administrativo — autenticado
- Login com e-mail e senha (Firebase Authentication)
- Gerenciamento independente das duas lojas
- **Drag & drop** (desktop) e **tap de dois toques** (mobile) para adicionar turnos e folgas
- Copiar dia para outro dia (substituir ou mesclar)
- Copiar escala do mês anterior
- Padrão semanal em massa
- Gerenciar turnos: criar, renomear e deletar com horários personalizados
- Gerenciar equipe: adicionar e remover funcionários com paleta de 12 cores
- Feriados detectados via BrasilAPI + feriados municipais do DF
- Alertas CLT automáticos: folga semanal, descanso mínimo 11h, domingos consecutivos
- Horas extras calculadas por funcionário no mês
- Rascunho salvo automaticamente — publicação manual pelo gestor
- Histórico de alterações com log antes/depois
- Arquivo de escalas anteriores
- Troca de turno entre funcionários com registro
- Exportar PDF com cabeçalho, legenda e cores

---

## 🛠 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 · CSS3 · JavaScript ES Modules |
| Autenticação | Firebase Authentication |
| Banco de dados | Cloud Firestore |
| Hospedagem | Firebase Hosting |
| Fontes | Plus Jakarta Sans (Google Fonts) |
| Feriados | [BrasilAPI](https://brasilapi.com.br) `feriados/v1/{ano}` |
| PWA | `manifest.json` + ícones SVG |

> Projeto **pure vanilla** — sem frameworks, sem bundler, sem build step.  
> Deploy direto da pasta `public/`.

---

## 📁 Estrutura

```
ESCALA-ONLINE/
├── .firebase/               # Cache do Firebase CLI — ignorado pelo Git
├── docs/                    # Screenshots para o README
│   ├── login.png
│   ├── colaborador.png
│   └── admin.png
├── public/
│   ├── css/
│   │   ├── main.css         # Design system: tokens, reset, componentes
│   │   ├── index.css        # Estilos do painel público
│   │   └── admin.css        # Estilos do painel administrativo
│   ├── js/
│   │   ├── firebase-config.js          # ⚠️ NÃO commitar — credenciais
│   │   ├── firebase-config.example.js  # Template para novos ambientes
│   │   ├── app.js           # Lógica do painel público
│   │   └── admin.js         # Lógica do painel administrativo
│   ├── 404.html
│   ├── admin.html           # Painel administrativo
│   ├── index.html           # Painel do colaborador
│   └── manifest.json        # PWA manifest
├── .gitignore
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
└── README.md
```

---

## 🔥 Firestore — coleções

```
escalas_loja1/              # Escalas da Loja 1 — Entre Lagos
  {YYYY-MM}
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

historico_loja1/            # Log de alterações — Loja 1
historico_loja2/            # Log de alterações — Loja 2

configuracoes/
  config_loja1              # Funcionários customizados
  config_loja2
  turnos_loja1              # Turnos customizados
  turnos_loja2
```

---

## ⚙️ Como rodar localmente

### Pré-requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- [Node.js](https://nodejs.org/) — para o Firebase CLI
- [Firebase CLI](https://firebase.google.com/docs/cli)

### 1. Clonar

```bash
git clone https://github.com/seu-usuario/escala-online.git
cd escala-online
```

### 2. Configurar credenciais

```bash
cp public/js/firebase-config.example.js public/js/firebase-config.js
```

Edite `firebase-config.js` com os dados do seu projeto:

> **Firebase Console → Configurações do projeto → Seus aplicativos → Config**

```js
export const FIREBASE_CONFIG = {
  apiKey:            "sua-api-key",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc"
};
```

### 3. Instalar Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 4. Rodar

```bash
firebase serve --only hosting
# Acesse http://localhost:5000
```

> ES Modules exigem servidor HTTP real — abrir via `file://` não funciona.

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

**Autenticação**
1. Firebase Console → **Authentication → Sign-in method** → Ativar **E-mail/senha**
2. **Authentication → Users → Add user** → criar o usuário do gestor

**Firestore rules**
```bash
firebase deploy --only firestore:rules
```

**Restringir API Key** — [Google Cloud Console](https://console.cloud.google.com) → APIs e Serviços → Credenciais → Restrições de aplicativo:
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

> Funcionários são gerenciados pelo botão **Equipe** no admin — salvos no Firestore.

---

## 📋 Regras CLT monitoradas

| Regra | Valor atual |
|---|---|
| Descanso mínimo entre jornadas | 11 horas |
| Máximo de domingos consecutivos | 2 |
| Folgas por semana | 1 |
| Base por turno para h. extra | 500 min (8h20) |

> Quando a legislação mudar (5×2 · 40h), ajuste o objeto `CLT` em `firebase-config.js`.

---

## 📄 Licença

Projeto privado — La Rose Hortifruti. Todos os direitos reservados.
