# 🌹 La Rose · Escala Online

Sistema de gestão de escalas de trabalho para a **La Rose Hortifruti**, com painel administrativo completo e painel público para consulta pelos colaboradores.

---

## 📸 Screenshots

### Tela de seleção de loja
![Seleção de loja](/public/assets/images/login.png)

### Painel do colaborador
![Painel do colaborador](/public/assets/images/colaborador.png)

### Painel administrativo
![Painel administrativo](/public/assets/images/admin.png)

---

## ✨ Funcionalidades

### Painel do colaborador (público)
- Seleção de loja a cada acesso (Entre Lagos e Itapoã Parque)
- Calendário mensal com turnos por funcionário
- Filtro por nome — exibe turno, folgas e dias livres individuais
- Badges coloridos para ausências: 🏥 Atestado, ✈️ Férias, 📋 Licença, ⚠️ Falta, ⭐ Folga extra
- Tap para expandir dia no mobile (exibe horários completos)
- Exportar PDF com legenda completa e cores preservadas
- Feriados nacionais e municipais do DF destacados em vermelho
- Responsivo para desktop, tablet e celular

### Painel administrativo (autenticado)
- Login com Firebase Authentication (e-mail + senha)
- Gerenciamento de duas lojas com identidade visual separada
- Calendário com **drag and drop** (desktop) e **tap de dois toques** (mobile)
- Arrastar funcionário → dia → escolher turno
- Arrastar turno → dia → escolher funcionário
- Arrastar folga / ausência → dia → escolher funcionário
- Modo clique alternativo ao drag and drop
- Copiar dia de um dia para outro (substituir ou mesclar)
- Copiar escala do mês anterior
- Padrão semanal (atribuir turnos por dia da semana em massa)
- Gerenciar turnos: criar, renomear e deletar turnos personalizados
- Gerenciar equipe: adicionar e remover funcionários com paleta de 12 cores
- Feriados detectados automaticamente via BrasilAPI + feriados municipais do DF
- Alertas CLT: folga semanal, descanso mínimo de 11h, domingos consecutivos
- Horas extras calculadas automaticamente por funcionário no mês
- Rascunho salvo automaticamente; publicação manual para os colaboradores
- Histórico de alterações com log antes/depois
- Arquivo de escalas anteriores com visualização
- Troca de turno entre funcionários com registro
- Exportar PDF do calendário admin com legenda e cabeçalho

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES Modules) — sem frameworks |
| Autenticação | Firebase Authentication |
| Banco de dados | Cloud Firestore |
| Hospedagem | Firebase Hosting |
| Fontes | Plus Jakarta Sans (Google Fonts) |
| Feriados | BrasilAPI `feriados/v1/{ano}` |
| PWA | `manifest.json` + ícones SVG |

> O projeto é **pure vanilla** — sem Node.js, sem bundler, sem build step. O deploy é direto da pasta `public/`.

---

## 📁 Estrutura de arquivos

```
ESCALA-ONLINE/
├── public/
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   │          ├── admin.png
│   │          ├── colaborador.png
│   │          └── login.png
│   │  
│   ├── css/
│   │   ├── main.css          # Design system: tokens, reset, componentes compartilhados
│   │   ├── index.css         # Estilos do painel público
│   │   └── admin.css         # Estilos do painel administrativo
│   ├── js/
│   │   ├── firebase-config.js         # ⚠️ NÃO commitar — credenciais + config das lojas
│   │   ├── firebase-config.example.js # Template para novos ambientes
│   │   ├── app.js            # Lógica do painel público
│   │   └── admin.js          # Lógica do painel administrativo
│   ├── index.html            # Painel do colaborador
│   ├── admin.html            # Painel administrativo
│   ├── 404.html              # Página de erro
│   └── manifest.json         # PWA manifest
│      
├── .gitignore
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
└── README.md
```

---

## 🔥 Estrutura do Firestore

```
escalas_loja1/          # Escalas da Loja 1 — Entre Lagos
  {YYYY-MM}/
    days: { 1: { shifts, folgam, ausencias, type, label }, ... }
    published: boolean
    updatedAt: string
    year: number
    month: number

escalas_loja2/          # Escalas da Loja 2 — Itapoã Parque
  (mesma estrutura)

historico_loja1/        # Log de alterações da Loja 1
historico_loja2/        # Log de alterações da Loja 2

configuracoes/
  config_loja1          # Funcionários customizados da Loja 1
  config_loja2          # Funcionários customizados da Loja 2
  turnos_loja1          # Turnos customizados da Loja 1
  turnos_loja2          # Turnos customizados da Loja 2
```

---

## ⚙️ Como rodar localmente

### Pré-requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- [Node.js](https://nodejs.org/) — apenas para o servidor local e CLI do Firebase
- [Firebase CLI](https://firebase.google.com/docs/cli)

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/escala-online.git
cd escala-online
```

### 2. Configurar as credenciais do Firebase

O arquivo `firebase-config.js` **não está no repositório** por segurança. Crie-o a partir do template:

```bash
cp public/js/firebase-config.example.js public/js/firebase-config.js
```

Abra o arquivo e preencha com as credenciais do seu projeto Firebase:

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

> As credenciais estão em: **Firebase Console → Configurações do projeto → Seus aplicativos → Config**

### 3. Instalar o Firebase CLI (se necessário)

```bash
npm install -g firebase-tools
firebase login
```

### 4. Servir localmente

```bash
firebase serve --only hosting
```

Acesse em: `http://localhost:5000`

> **Por que `firebase serve` e não `Live Server`?** O projeto usa ES Modules (`type="module"`), que requerem um servidor HTTP real — abrir o HTML diretamente pelo sistema de arquivos (`file://`) não funciona devido às restrições de CORS.

---

## 🚀 Deploy para produção

```bash
firebase deploy
```

Ou para fazer deploy apenas do hosting (sem Firestore rules):

```bash
firebase deploy --only hosting
```

A URL pública após o deploy será:
- **Colaboradores:** `https://larose-escala.web.app`
- **Admin:** `https://larose-escala.web.app/admin.html`

---

## 🔐 Firebase — configuração inicial

### Autenticação
1. Firebase Console → **Authentication** → Ativar provedor **E-mail/senha**
2. Criar o usuário administrador em **Authentication → Users → Add user**

### Firestore
1. Firebase Console → **Firestore Database** → Criar banco em modo de produção
2. Aplicar as regras de segurança:

```bash
firebase deploy --only firestore:rules
```

As regras em `firestore.rules` garantem que:
- Escalas publicadas são **leitura pública**
- Toda **escrita exige autenticação**
- A coleção `configuracoes` tem leitura pública e escrita autenticada

### Restrição da API Key (recomendado)
No [Google Cloud Console](https://console.cloud.google.com):
1. **APIs e Serviços → Credenciais**
2. Clique na chave API → **Restrições de aplicativo**
3. Adicione os referenciadores:
   ```
   https://larose-escala.web.app/*
   https://larose-escala.firebaseapp.com/*
   ```

---

## 👥 Lojas e funcionários

As lojas e funcionários padrão estão definidos em `firebase-config.js`. Funcionários podem ser adicionados e removidos diretamente pelo painel admin (botão **Equipe**) — os dados ficam salvos no Firestore e sobrepõem a configuração do arquivo.

| Loja | Cor | Funcionários padrão |
|---|---|---|
| Loja 1 · Entre Lagos | Verde `#16a34a` | Michele, Rosanea, Rosilene, Ítalo |
| Loja 2 · Itapoã Parque | Azul `#2563eb` | Amanda, Maria Paula, Gardênia, Ygor |

---

## 📋 Regras CLT monitoradas

O sistema valida automaticamente e exibe alertas para:

| Regra | Valor atual |
|---|---|
| Descanso mínimo entre jornadas | 11 horas |
| Máximo de domingos seguidos | 2 |
| Folgas por semana | 1 |
| Base de horas por turno (para h. extra) | 8h20 (500 min) |

> Quando a legislação mudar (5x2, 40h semanais), basta ajustar os valores no objeto `CLT` em `firebase-config.js`.

---

## 📄 Licença

Projeto privado — La Rose Hortifruti. Todos os direitos reservados.
