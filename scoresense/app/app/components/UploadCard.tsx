'use client';

import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X } from "lucide-react"
import type { UploadedFile } from "./types"

interface UploadCardProps {
  file: UploadedFile | null
  isDragging: boolean
  isConverting: boolean
  isComplete: boolean
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
            isDragging
              ? "border-accent bg-accent/10"
              : "border-border hover:border-muted-foreground"
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onFileDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop your file here
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            PDF, JPG, or PNG
          </p>
          <label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={onFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Choose file</span>
            </Button>
          </label>
        </div>

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
          disabled={!file || isConverting || isComplete}
          onClick={onStartConversion}
        >
          Start conversion
        </Button>
      </CardContent>
    </Card>
  )
}
