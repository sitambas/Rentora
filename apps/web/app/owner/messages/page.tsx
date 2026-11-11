'use client';
import { Suspense } from 'react';
import { PageHead } from '@/components/Shell';
import { MessagesView } from '@/components/MessagesView';
import { Skeleton } from '@/components/ui';

export default function Page() {
  return (
    <>
      <PageHead title="Messages" sub="Talk to your tenants and co-managers" />
      <Suspense fallback={<Skeleton h={320} />}><MessagesView basePath="/owner/messages" /></Suspense>
    </>
  );
}
