# Agape Mobile - Quick Start

## 🎯 API Endpoints

Backend servisi koji su dostupni:
- **Registracija:** `/api/v1/auth/register`
- **Prijava:** `/api/v1/auth/login`

## 📦 Kreirana struktura

```
agape-mobile/
├── 📁 config/
│   └── api.config.ts              ← API putanje i konfiguracija
│
├── 📁 types/
│   └── api.types.ts               ← TypeScript tipovi
│
├── 📁 utils/
│   └── httpClient.ts              ← HTTP wrapper (fetch)
│
├── 📁 services/
│   ├── index.ts                   ← Export svih servisa
│   └── auth.service.ts            ← Login/Register funkcije
│
├── 📁 components/examples/
│   ├── LoginExample.tsx           ← Primjer login forme
│   └── RegisterExample.tsx        ← Primjer register forme
│
└── 📁 docs/
    └── API_ARCHITECTURE.md        ← Detaljna dokumentacija
```

## 🚀 Kako koristiti u komponentama

### Import servisa
```typescript
import { authService } from '../services';
```

### Login
```typescript
const response = await authService.login({
  email: 'user@example.com',
  password: 'password123'
});

if (response.success) {
  console.log('Token:', response.data.token);
  // Spremi token i navigiraj
} else {
  console.error('Error:', response.error.message);
}
```

### Registracija
```typescript
const response = await authService.register({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe'
});

if (response.success) {
  console.log('User registered!');
}
```

## 🏗️ Arhitektura (3 sloja)

```
┌─────────────────────────────────────┐
│      COMPONENT LAYER (UI)           │
│  LoginScreen, RegisterScreen, etc.  │
└────────────┬────────────────────────┘
             │ koristi
             ▼
┌─────────────────────────────────────┐
│      SERVICE LAYER (Logic)          │
│   authService.login()                │
│   authService.register()             │
└────────────┬────────────────────────┘
             │ koristi
             ▼
┌─────────────────────────────────────┐
│     CONFIG + HTTP CLIENT             │
│  API endpoints + fetch wrapper       │
└─────────────────────────────────────┘
             │
             ▼
        🌐 Backend API
```

## ⚙️ Konfiguracija

Izmijeni `config/api.config.ts` za svoj backend URL:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080'      // Development
  : 'https://api.agape.com';     // Production
```

## 📖 Detaljna dokumentacija

Vidi: `docs/API_ARCHITECTURE.md`

## ✅ Prednosti ove arhitekture

✅ **Jasna separacija** - UI, logika i konfiguracija odvojeni  
✅ **Lako testiranje** - servisi se lako mockaju  
✅ **Type-safe** - TypeScript zna sve tipove  
✅ **Održivo** - lako dodavanje novih servisa  
✅ **Reusable** - servisi se mogu koristiti svugdje  

## 🔥 Sljedeći koraci

1. Prilagodi `types/api.types.ts` prema backend response-ima
2. Implementiraj spremanje tokena (SecureStore)
3. Dodaj auth context za global state
4. Kreiraj prave login/register screene
5. Dodaj error handling UI

Sretno! 🎉
