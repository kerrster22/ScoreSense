'use client';

import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X } from "lucide-react"
import type { UploadedFile } from "@/types/practice"

interface UploadCardProps {
  file: UploadedFile | null
  isDragging: boolean
  isConverting: boolean
  isComplete: boolean
  /** True once "My Uploads" is at the account's cap — blocks adding a new piece until one is deleted. */
  uploadLimitReached?: boolean
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onFileRemove: () => void
  onStartConversion: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadCard({
  file,
  isDragging,
  isConverting,
  isComplete,
  uploadLimitReached = false,
  onFileSelect,
  onFileDrop,
  onDragOver,
  onDragLeave,
  onFileRemove,
  onStartConversion,
}: UploadCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-accent" />
          Upload Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            uploadLimitReached
              ? "pointer-events-none border-border opacity-50"
              : isDragging
              ? "border-accent bg-accent/10"
              : "border-border hover:border-muted-foreground"
          }`}
          onDragOver={uploadLimitReached ? undefined : onDragOver}
          onDragLeave={uploadLimitReached ? undefined : onDragLeave}
          onDrop={uploadLimitReached ? undefined : onFileDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop your MIDI or MusicXML file here
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            MIDI or MusicXML (.mid, .midi, .musicxml, .mxl)
          </p>
          <label>
            <input
              type="file"
              accept=".mid,.midi,.musicxml,.mxl,.xml"
              onChange={onFileSelect}
              disabled={uploadLimitReached}
              className="hidden"
            />
            <Button variant="outline" size="sm" disabled={uploadLimitReached} asChild>
              <span className="cursor-pointer">Choose file</span>
            </Button>
          </label>
        </div>

        {uploadLimitReached && (
          <p className="text-xs text-center text-muted-foreground">
            You&apos;ve reached your 25-piece upload limit. Delete a piece from My Uploads to add a new
            one, or contact us for more.
          </p>
        )}

        {file && (
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <FileText className="h-5 w-5 text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onFileRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          className="w-full"
          disabled={!file || isConverting || isComplete || uploadLimitReached}
          onClick={onStartConversion}
        >
          Load piece
        </Button>
      </CardContent>
    </Card>
  )
}
