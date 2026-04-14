# HealthGate

O **HealthGate** é um sistema projetado para facilitar a integração dos sistemas desenvolvidos no grupo IF4Health.

Ele permite o cadastro e gerenciamento de rotas existentes nos sistemas FASS-ECG, IF-CLOUD e H2Cloud, funcionando como um **Gateway inteligente** para rotear requisições entre serviços.

🔗 Acesso ao sistema em produção:
https://if4health.charqueadas.ifsul.edu.br/healthgate/login
![Diagrama HealthGate](./assets/GATEWAY.jpg)

---

## 📌 Funcionalidades

- **CRUD de rotas**: Gerencie rotas dos sistemas FASS-ECG, IF-CLOUD e neoFassEcg
- **Autenticação JWT**: Proteção das rotas administrativas
- **Redirecionamento dinâmico**: Proxy inteligente para APIs
- **Logs de requisições**: Armazenamento no MongoDB
- **Suporte HTTP completo**: GET, POST, PUT, PATCH e DELETE

---

## 🧱 Tecnologias Utilizadas

- Node.js
- Express.js
- Axios
- MongoDB
- EJS
- React (parcial/planejado)
- dotenv

---

## ⚙️ Pré-requisitos

- Node.js (>= 14)
- NPM ou Yarn
- MongoDB
- Acesso a um servidor FHIR

---

## 🚀 Instalação

```bash
git clone https://github.com/MariaEduarda004/healthGate.git
cd health-gate
npm install
```

### Configurar `.env`

```env
JWT_SECRET=seu_segredo
FASS_ECG_AUTH_URL=https://if4health.charqueadas.ifsul.edu.br/biofass/auth/token
FASS_ECG_CLIENT_ID=gateway
FASS_ECG_AUTH_CODE=seu_code
```

### Rodar backend

```bash
cd backend
npm start
```

### Rodar MongoDB

```bash
mongod --dbpath "./db/datadb"
```

Acesse:
👉 http://localhost:3001/healthgate/login

---

# 🔐 Cadastro e Login de Usuário

Antes de usar o sistema, é necessário criar um usuário.

## 📌 Registrar usuário

### Endpoint:

```
POST /healthgate/api/auth/register
```

### Exemplo (Postman):

```json
{
  "username": "admin",
  "password": "admin123"
}
```

---

## 🔑 Login

### Endpoint:

```
POST /healthgate/api/auth/login
```

### Exemplo:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Ou via interface:
👉 http://localhost:3001/healthgate/login

---

# 🔀 Cadastro de Rotas

Após login, acesse:

👉 `/healthgate/routes/new`

Preencha os campos para criar uma rota dinâmica.

---

## 🧪 Exemplo 1 — SMART Configuration

### Cadastro

| Campo       | Valor                                                         |
| ----------- | ------------------------------------------------------------- |
| Projeto     | neoFassEcg                                                    |
| Source Path | /smart-config                                                 |
| Method      | GET                                                           |
| Target URL  | http://localhost:8080/biofass/.well-known/smart-configuration |
| Headers     | {"accept": "application/json"}                                |

---

## 🔗 Como acessar após cadastrar

A rota NÃO fica disponível diretamente.

Ela segue o padrão:

```
/healthgate/api/{projeto}/{rota}
```

### Exemplo:

```
http://localhost:3001/healthgate/api/h2cloud/smart-config
```

---

## 📊 Logs

Todas as requisições realizadas via gateway são salvas no MongoDB.

Para acessar manualmente:

```bash
mongosh
use healthgate
show collections
```

Ver logs:

```js
db.logs.find().pretty();
```

---

## ⚠️ Problemas Comuns

### ❌ Cannot GET /

Use:

```
/healthgate/login
```

### ❌ Rota não encontrada

Verifique:

```
/healthgate/api/{projeto}/{rota}
```

### ❌ Token inválido

Authorization Code expira rapidamente.

---

## 📌 Observações

- O HealthGate atua como **proxy dinâmico de APIs FHIR**
- O nome do projeto pode ser normalizado (minúsculas)
- Logs são armazenados mesmo que não apareçam na interface

---

## 🧠 Próximos Passos

- Integração com Patient
- Integração com Observation
- Automação de autenticação SMART

---
