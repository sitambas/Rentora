import { Shell } from '@/components/Shell';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <Shell allow={['OWNER', 'MANAGER']}>{children}</Shell>;
}
