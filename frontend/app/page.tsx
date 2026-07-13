import HeroSection from '@/components/landing/hero-section'
import WhySection from '@/components/landing/why-section'
import FeaturesSection from '@/components/landing/features-section'
import PlansSection from '@/components/landing/plans-section'
import FooterSection from 'src/components/footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeroSection />
      <WhySection />
      <FeaturesSection />
      <PlansSection />
      <FooterSection />
    </div>
  )
}