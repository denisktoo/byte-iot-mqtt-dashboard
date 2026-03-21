import dynamic from 'next/dynamic';

const MqttDashboard = dynamic(() => import('../components/MqttDashboard'), { ssr: false });

export default function MqttPage() {
  return <MqttDashboard />;
}
