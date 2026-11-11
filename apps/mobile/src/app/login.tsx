import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/api';
import { Button, Field, Icon, T, useColors } from '@/components/ui';


export default function Login() {
  const c = useColors();
  const router = useRouter();
  const { user, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/" />;

  const submit = async () => {
    if (!phone.trim() || !password) { setError('Enter your mobile number and password.'); return; }
    setBusy(true); setError('');
    try {
      const u = await login(phone, password);
      router.replace(u.role === 'TENANT' ? '/home' : '/overview');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 16, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="home" size={28} color={c.brandInk} />
            </View>
            <T v="h1">Rentora</T>
            <T v="muted">Rent management for owners and tenants</T>
          </View>
          <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="98765 43210" />
          <View>
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="password" textContentType="password" placeholder="Your password" onSubmitEditing={() => submit()} />
            <Pressable onPress={() => setShow(s => !s)} style={{ position: 'absolute', right: 12, top: 36 }} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'eye-off-outline' : 'eye-outline'} color={c.muted} />
            </Pressable>
          </View>
          {!!error && <T v="sm" color={c.bad}>{error}</T>}
          <Button title={busy ? 'Signing in…' : 'Sign in'} icon="arrow-forward" onPress={() => submit()} disabled={busy} />
          <T v="sm" style={{ textAlign: 'center' }}>Tenants get their login from their landlord or manager. Owners can sign up on the Rentora website.</T>
          {__DEV__ && <T v="sm" style={{ textAlign: 'center' }}>Server: {API_URL}</T>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
