"use client"

import { useRef } from "react"
import { Music, Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { downloadProgressExport, importProgressData } from "../lib/exportImport"

export function AppTopNav() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = () => {
    try {
      downloadProgressExport()
      toast.success("Progress exported")
    } catch {
      toast.error("Couldn't export progress")
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const result = importProgressData(text)
      if (!result.ok) {
        toast.error("Import failed", { description: result.error })
        return
      }
      toast.success(`Imported ${result.importedCount} record${result.importedCount !== 1 ? "s" : ""}`, {
        description: "Reload the page to see restored progress.",
      })
    } catch {
      toast.error("Couldn't read that file")
    }
  }

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2">
            <Music className="h-6 w-6 text-accent" />
            <span className="font-semibold text-lg text-foreground">ScoreSense</span>
          </a>
          <div className="hidden sm:flex items-center gap-6">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Download all local practice progress as a JSON file"
            >
              <Download className="h-3.5 w-3.5" />
              Export progress
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Restore practice progress from a previously exported file"
            >
              <Upload className="h-3.5 w-3.5" />
              Import progress
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
              aria-label="Import progress file"
            />
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="https://github.com/kerrster22/ScoreSense/issues" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Feedback
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
