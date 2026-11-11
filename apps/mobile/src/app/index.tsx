import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={user.role === 'TENANT' ? '/home' : '/overview'} />;
}
