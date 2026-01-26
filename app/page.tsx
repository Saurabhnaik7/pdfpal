import Footer from '@/components/home/Footer';
import Header from '@/components/home/Header';
import Hero from '@/components/home/Hero';
import HowItWorks from '@/components/home/HowItWorks';
import ProudlyOpenSource from '@/components/home/ProudlyOpenSource';

export default function Home() {
  return (
    <main className="sm:p-7 sm:pb-0">
      <Header />
      <Hero />
      <HowItWorks />
      <ProudlyOpenSource />
      <Footer />
    </main>
  );
}
