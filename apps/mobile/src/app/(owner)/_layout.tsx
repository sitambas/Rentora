import { TabsShell } from '@/components/TabsShell';

export default function OwnerTabs() {
  return (
    <TabsShell allow={['OWNER', 'MANAGER']} tabs={[
      { name: 'overview', title: 'Overview', icon: 'grid-outline' },
      { name: 'properties', title: 'Properties', icon: 'business-outline' },
      { name: 'tenants', title: 'Tenants', icon: 'people-outline' },
      { name: 'payments', title: 'Payments', icon: 'card-outline' },
      { name: 'more', title: 'More', icon: 'ellipsis-horizontal-circle-outline' }
    ]} />
  );
}
