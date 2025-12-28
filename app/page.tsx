import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            🚑 Welcome to <span className="text-primary">RescueMe</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Emergency assistance platform connecting people in need with rescue service providers
          </p>

          <div className="flex gap-4 justify-center mb-12">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8 py-6">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Login
              </Button>
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-xl font-semibold mb-2">For Users</h3>
              <p className="text-gray-600">
                Request emergency assistance anytime, anywhere
              </p>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🚑</div>
              <h3 className="text-xl font-semibold mb-2">For Providers</h3>
              <p className="text-gray-600">
                Offer rescue services and help people in need
              </p>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Fast Response</h3>
              <p className="text-gray-600">
                Connect instantly with verified rescue providers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Sign Up</h3>
              <p className="text-gray-600">
                Create your account as a User or Provider
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Request or Offer</h3>
              <p className="text-gray-600">
                Users request help, Providers offer services
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Connected</h3>
              <p className="text-gray-600">
                Instant matching with nearby rescue services
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to get started?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Join RescueMe today and be part of a life-saving community
          </p>
          <Link href="/register">
            <Button size="lg" className="text-lg px-8 py-6">
              Create Account Now
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
