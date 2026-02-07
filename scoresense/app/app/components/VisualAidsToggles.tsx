import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Eye } from "lucide-react"

interface VisualAidsTogglesProps {
  showNoteNames: boolean
  showKeyLabels: boolean
  onShowNoteNamesChange: (value: boolean) => void
  onShowKeyLabelsChange: (value: boolean) => void
}

export function VisualAidsToggles({
  showNoteNames,
  showKeyLabels,
  onShowNoteNamesChange,
  onShowKeyLabelsChange,
}: VisualAidsTogglesProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <Label className="text-sm text-muted-foreground flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Visual Aids
      </Label>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="show-note-names"
            checked={showNoteNames}
            onCheckedChange={onShowNoteNamesChange}
          />
          <Label htmlFor="show-note-names" className="text-sm text-foreground">
            Show note names on notes
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-key-labels"
            checked={showKeyLabels}
            onCheckedChange={onShowKeyLabelsChange}
          />
          <Label htmlFor="show-key-labels" className="text-sm text-foreground">
            Show note names on keys
          </Label>
        </div>
      </div>
    </div>
  )
}
