/**
 * Register Screen - Primjer korištenja auth servisa
 */

import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { authService } from '../../services';
import { RegisterRequest } from '../../types/api.types';

export default function RegisterExample() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    // Validacija
    if (!email || !password || !confirmPassword) {
      setError('Molimo popunite sva obvezna polja');
      return;
    }

    if (password !== confirmPassword) {
      setError('Lozinke se ne poklapaju');
      return;
    }

    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 znakova');
      return;
    }

    setLoading(true);
    setError(null);

    const registerData: RegisterRequest = {
      email: email.trim(),
      password,
      name: name.trim() || undefined,
    };

    try {
      // Poziv auth servisa
      const response = await authService.register(registerData);

      if (response.success && response.data) {
        // Uspješna registracija
        const { token, user } = response.data;
        
        Alert.alert(
          'Uspjeh', 
          `Račun je uspješno kreiran! Dobrodošli ${user.email}!`,
          [
            {
              text: 'OK',
              onPress: () => {
                // TODO: Spremi token i navigiraj na home
                // await SecureStore.setItemAsync('authToken', token);
                // router.replace('/home');
              }
            }
          ]
        );
        
        console.log('Auth token:', token);
      } else {
        // Greška od API-ja
        setError(response.error?.message || 'Neuspješna registracija');
      }
    } catch (err) {
      setError('Došlo je do neočekivane greške');
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registracija</Text>
      
      {error && <Text style={styles.error}>{error}</Text>}
      
      <TextInput
        style={styles.input}
        placeholder="Ime (opciono)"
        value={name}
        onChangeText={setName}
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email *"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Lozinka *"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Potvrdi lozinku *"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />
      
      <Button 
        title={loading ? 'Registracija...' : 'Registriraj se'}
        onPress={handleRegister}
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
