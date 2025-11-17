import React, { useState } from 'react';
import { View,TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { authService } from '../services/auth.service';
import { LoginRequest } from '../types/api.types';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export default function LoginExample() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Molimo popunite obavezna sva polja');
      return;
    }

    setLoading(true);
    setError(null);

    const credentials: LoginRequest = {
      email: email.trim(),
      password,
    };

    try {
      const response = await authService.login(credentials);

      if (response.success && response.data) {
        const { token, userId, username, name } = response.data.data;
        
        Alert.alert('Uspjeh', `Dobrodošli ${name || username}!`);
        console.log('Auth token:', token);
        console.log('User ID:', userId);
        
        await SecureStore.setItemAsync('authToken', token);
        router.replace('/(tabs)');
      } else {
        // Greška od API-ja
        setError(response.error?.message || 'Neuspješna prijava');
      }
    } catch (err) {
      setError('Došlo je do neočekivane greške');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prijava</Text>
      
      {error && <Text style={styles.error}>{error}</Text>}
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Lozinka"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      
      <Button 
        title={loading ? 'Prijavljivanje...' : 'Prijavi se'}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  error: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
});
