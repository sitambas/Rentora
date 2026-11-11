'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor, useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? homeFor(user.role) : '/login');
  }, [user, loading, router]);
  return <div className="main"><Skeleton h={200} /></div>;
}
