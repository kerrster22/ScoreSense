import { Music } from "lucide-react"

export function AppTopNav() {
  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2">
            <Music className="h-6 w-6 text-accent" />
            <span className="font-semibold text-lg text-foreground">ScoreSense</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Feedback
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
