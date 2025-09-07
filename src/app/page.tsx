import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 lg:p-24">
      {/* Header */}
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div className="fixed left-0 top-0 flex w-full justify-center border-b border-border bg-gradient-to-b from-muted pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-muted lg:p-4">
          <span className="bg-gradient-to-r from-primary to-primary-600 bg-clip-text text-transparent font-bold">
            Schools-In Provider System
          </span>
          <Badge variant="secondary" className="ml-2">
            Beta
          </Badge>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative flex flex-col items-center text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary opacity-10 rounded-full blur-3xl"></div>
        </div>
        
        <h1 className="text-4xl lg:text-6xl font-bold mb-4">
          Welcome to{' '}
          <span className="bg-gradient-to-r from-primary to-primary-600 bg-clip-text text-transparent">
            Schools-In
          </span>
        </h1>
        
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
          Streamlined location-based check-in and check-out system for service providers working in educational institutions.
        </p>

        <div className="flex gap-4">
          <Button size="lg">
            Get Started
          </Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
        <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
          <CardHeader>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
              <span className="text-primary-foreground text-xl">📍</span>
            </div>
            <CardTitle>Provider Dashboard</CardTitle>
            <CardDescription>
              Check in and out of assigned schools with GPS location verification.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
          <CardHeader>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
              <span className="text-primary-foreground text-xl">⚙️</span>
            </div>
            <CardTitle>Admin Panel</CardTitle>
            <CardDescription>
              Manage schools, providers, and access comprehensive reporting tools.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
          <CardHeader>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
              <span className="text-primary-foreground text-xl">📊</span>
            </div>
            <CardTitle>Session History</CardTitle>
            <CardDescription>
              Track and review all check-in sessions and work history data.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
          <CardHeader>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
              <span className="text-primary-foreground text-xl">📱</span>
            </div>
            <CardTitle>Mobile PWA</CardTitle>
            <CardDescription>
              Install as a mobile app for offline functionality and GPS access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Demo Section */}
      <div className="w-full max-w-4xl mt-16">
        <Card>
          <CardHeader>
            <CardTitle>shadcn/ui Components Demo</CardTitle>
            <CardDescription>
              Showcasing the installed component library with proper styling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
