import { TabsShell } from '@/components/TabsShell';

export default function TenantTabs() {
  return (
    <TabsShell allow={['TENANT']} tabs={[
      { name: 'home', title: 'Home', icon: 'home-outline' },
      { name: 'my-payments', title: 'Payments', icon: 'card-outline' },
      { name: 'requests', title: 'Requests', icon: 'construct-outline' },
      { name: 'inbox', title: 'Messages', icon: 'chatbubble-outline' },
      { name: 'me', title: 'Account', icon: 'person-outline' }
    ]} />
  );
}
