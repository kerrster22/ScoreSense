'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, Circle } from "lucide-react"
import type { ConversionStep } from "./types"

interface ConversionStatusCardProps {
  steps: ConversionStep[]
  currentStep: number
  progress: number
  isConverting: boolean
  isComplete: boolean
  onCancel: () => void
}

export function ConversionStatusCard({
  steps,
  currentStep,
  progress,
  isConverting,
  isComplete,
  onCancel,
}: ConversionStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          {isComplete ? (
            <Check className="h-5 w-5 text-green-500" />
          ) : (
            <Loader2
              className={`h-5 w-5 text-accent ${isConverting ? "animate-spin" : ""}`}
            />
          )}
          Conversion Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {currentStep > step.id || isComplete ? (
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-background" />
                  </div>
                ) : currentStep === step.id && isConverting ? (
                  <Loader2 className="h-5 w-5 text-accent animate-spin" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <span
                className={`text-sm ${
                  currentStep >= step.id || isComplete
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {progress}%
          </p>
        </div>

        {isConverting && (
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-transparent"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}

        {isComplete && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500 font-medium">
              Tutorial ready
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
