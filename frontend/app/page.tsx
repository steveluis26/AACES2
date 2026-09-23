import HeroSection from '@/components/landing/hero-section'
import WhySection from '@/components/landing/why-section'
import FeaturesSection from '@/components/landing/features-section'
import PlansSection from '@/components/landing/plans-section'
import HowSection from '@/components/landing/how-section'
import CtaSection from '@/components/landing/cta-section'
import FooterSection from 'src/components/footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeroSection />
      <WhySection />
      <HowSection />
      <FeaturesSection />
      <PlansSection />
      <CtaSection />
      <FooterSection />
    </div>
  )
}