# Agape Mobile - API i Servisna Arhitektura

## 📁 Struktura projekta

```
agape-mobile/
├── config/
│   └── api.config.ts          # API endpoints i konfiguracija
├── types/
│   └── api.types.ts           # TypeScript tipovi za API
├── utils/
│   └── httpClient.ts          # HTTP client wrapper
├── services/
│   ├── index.ts               # Export svih servisa
│   └── auth.service.ts        # Auth servis (login/register)
└── components/
    └── examples/
        ├── LoginExample.tsx    # Primjer login komponente
        └── RegisterExample.tsx # Primjer register komponente
```

## 🏗️ Troslojka arhitektura

### 1️⃣ **Config Layer** (`config/`)
Sadrži sve API endpoints i konfiguracije.

**Datoteka:** `config/api.config.ts`

```typescript
import { API_ENDPOINTS, getFullUrl } from '../config/api.config';

// Primjer korištenja
const loginUrl = getFullUrl(API_ENDPOINTS.AUTH.LOGIN);
// Rezultat: "http://localhost:8080/api/v1/auth/login"
```

**Što ovdje staviti:**
- Base URL-ove za različita okruženja (dev, staging, production)
- API endpoint putanje
- API verzije
- Timeout konfiguracije

---

### 2️⃣ **Service Layer** (`services/`)
Biznis logika i API pozivi. Komponente ne smiju direktno pozivati API!

**Datoteka:** `services/auth.service.ts`

```typescript
import { authService } from '../services';

// Primjer korištenja u komponenti
const response = await authService.login({
  email: 'user@example.com',
  password: 'password123'
});

if (response.success) {
  // Uspješna prijava
  console.log('Token:', response.data.token);
} else {
  // Greška
  console.error('Error:', response.error.message);
}
```

**Prednosti:**
- ✅ Jedna točka za sve API pozive
- ✅ Lako testiranje (mockanje servisa)
- ✅ Centralizirano error handling
- ✅ Jednostavna promjena implementacije bez mijenjanja komponenti

---

### 3️⃣ **Component Layer** (`components/`, `app/`)
UI komponente koje koriste servise.

**Primjer:** `components/examples/LoginExample.tsx`

```typescript
import { authService } from '../../services';

const handleLogin = async () => {
  const response = await authService.login({ email, password });
  
  if (response.success) {
    // Navigiraj na home
  } else {
    // Prikaži grešku
    setError(response.error.message);
  }
};
```

---

## 🚀 Kako koristiti

### Primjer 1: Login u komponenti

```typescript
import { useState } from 'react';
import { authService } from '../services';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const response = await authService.login({ email, password });
    
    if (response.success) {
      // Spremi token
      await SecureStore.setItemAsync('token', response.data.token);
      // Navigiraj
      router.replace('/home');
    } else {
      Alert.alert('Greška', response.error.message);
    }
  };

  return (
    // UI...
  );
}
```

### Primjer 2: Registracija u komponenti

```typescript
import { authService } from '../services';

const handleRegister = async () => {
  const response = await authService.register({
    email,
    password,
    name
  });
  
  if (response.success) {
    Alert.alert('Uspjeh', 'Račun je kreiran!');
  }
};
```

---

## 🔧 Dodavanje novih servisa

### 1. Dodaj endpoint u `config/api.config.ts`:

```typescript
export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: `/api/${API_VERSION}/auth/register`,
    LOGIN: `/api/${API_VERSION}/auth/login`,
  },
  USER: {
    PROFILE: `/api/${API_VERSION}/user/profile`,
    UPDATE: `/api/${API_VERSION}/user/update`,
  },
};
```

### 2. Dodaj tipove u `types/api.types.ts`:

```typescript
export interface UserProfile {
  id: string;
  email: string;
  name: string;
}

export interface UpdateUserRequest {
  name?: string;
  avatar?: string;
}
```

### 3. Kreiraj servis u `services/user.service.ts`:

```typescript
import { API_ENDPOINTS, getFullUrl } from '../config/api.config';
import { httpClient } from '../utils/httpClient';

export const userService = {
  async getProfile(token: string) {
    const url = getFullUrl(API_ENDPOINTS.USER.PROFILE);
    return await httpClient.get(url, { token });
  },

  async updateProfile(data: UpdateUserRequest, token: string) {
    const url = getFullUrl(API_ENDPOINTS.USER.UPDATE);
    return await httpClient.put(url, data, { token });
  },
};
```

### 4. Exportaj u `services/index.ts`:

```typescript
export { userService } from './user.service';
```

---

## 🌍 Environment konfiguracija

Za različita okruženja, izmijeni `config/api.config.ts`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080'           // Development (emulator)
  : 'https://api.agape.com';          // Production

// Za testiranje na fizičkom uređaju u istoj mreži:
// const API_BASE_URL = 'http://192.168.1.100:8080';
```

---

## 🛠️ HTTP Client funkcionalnosti

`utils/httpClient.ts` automatski:
- ✅ Dodaje `Content-Type: application/json`
- ✅ Dodaje Authorization header ako je token proslijeđen
- ✅ Parsira JSON odgovore
- ✅ Hvata mrežne greške
- ✅ Vraća konzistentan format (`ApiResponse<T>`)

---

## 📝 TypeScript tipovi

Svi API pozivi su type-safe:

```typescript
// ✅ TypeScript zna što očekuješ
const response = await authService.login({ email, password });

if (response.success) {
  // TypeScript zna da postoji response.data.token
  const token: string = response.data.token;
} else {
  // TypeScript zna da postoji response.error.message
  const error: string = response.error.message;
}
```

---

## 🎯 Best Practices

1. **Nikad ne pozivaj fetch direktno u komponentama** - koristi servise
2. **Dodaj error handling** - provjeravaj `response.success`
3. **Koristi TypeScript** - definiraj sve tipove
4. **Spremi token sigurno** - koristi `expo-secure-store`
5. **Testiraj servise** - lakše je testirati funkcije nego komponente
6. **Loguj greške** - koristi `console.error` ili Sentry

---

## 📦 Potrebni paketi

Za kompletnu implementaciju, možeš dodati:

```bash
# Za spremanje tokena
npx expo install expo-secure-store

# Za state management (opciono)
npm install zustand

# Za error tracking (opciono)
npm install @sentry/react-native
```

---

## 🔐 Spremanje Auth tokena

Primjer sa `expo-secure-store`:

```typescript
import * as SecureStore from 'expo-secure-store';

// Spremi token
await SecureStore.setItemAsync('authToken', token);

// Učitaj token
const token = await SecureStore.getItemAsync('authToken');

// Obriši token
await SecureStore.deleteItemAsync('authToken');
```

---

## 🐛 Debugging

Ako API pozivi ne rade, provjeri:

1. **Base URL** - je li backend pokrenut na tom portu?
2. **Network** - može li aplikacija pristupiti mreži?
3. **CORS** - je li backend konfiguriran za mobile?
4. **Console** - što piše u `console.log`/`console.error`?

Za Android emulator, backend na `localhost` možeš dosegnuti na:
- `http://10.0.2.2:8080` (umjesto `localhost:8080`)

---

## 📚 Primjeri komponenti

Pogledaj gotove primjere u:
- `components/examples/LoginExample.tsx`
- `components/examples/RegisterExample.tsx`

---

## ✅ Zaključak

Ova arhitektura ti omogućava:
- 🎯 Čist, održiv kod
- 🔄 Lako testiranje
- 📈 Skalabilnost
- 🐛 Jednostavno debugiranje
- 🚀 Brz razvoj novih feature-a

Sretno s razvojem! 🎉
