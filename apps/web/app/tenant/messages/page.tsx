'use client';
import { Suspense } from 'react';
import { PageHead } from '@/components/Shell';
import { MessagesView } from '@/components/MessagesView';
import { Skeleton } from '@/components/ui';

export default function Page() {
  return (
    <>
      <PageHead title="Messages" sub="Your property manager and owner" />
      <Suspense fallback={<Skeleton h={320} />}><MessagesView basePath="/tenant/messages" /></Suspense>
    </>
  );
}
