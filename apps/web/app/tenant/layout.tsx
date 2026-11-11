import { Shell } from '@/components/Shell';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <Shell allow={['TENANT']}>{children}</Shell>;
}
