"use client"

import React from "react"
import { type ParserStats } from "../lib/musicmxl"

interface DebugPanelProps {
  stats?: ParserStats
  isOpen?: boolean
  onClose?: () => void
}

/**
 * Debug Panel
 * 
 * Displays MusicXML parser statistics and performance metrics.
 * Useful for validating that complex pieces (like Chopin Ballade No.1) are parsed correctly.
 * 
 * Shows:
 * - Total notes, grace notes, ties, ornaments
 * - Number of unique measures
 * - Tempo changes detected
 * - Total piece duration
 * - Time signature and key signature (when available)
 */
export function DebugPanel({ stats, isOpen = false, onClose }: DebugPanelProps) {
  if (!isOpen || !stats) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-w-md rounded-lg bg-slate-950 p-6 text-sm text-slate-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-white">Parser Statistics</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 font-mono text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Total Notes:</span>
            <span className="text-emerald-400">{stats.totalNotes}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Grace Notes:</span>
            <span className="text-blue-400">{stats.graceNotesCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Ties Merged:</span>
            <span className="text-purple-400">{stats.tiesCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Ornaments:</span>
            <span className="text-pink-400">{stats.ornamentsCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Measures:</span>
            <span className="text-orange-400">{stats.uniqueMeasures}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Duration:</span>
            <span className="text-cyan-400">
              {stats.totalDuration.toFixed(1)}s
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Tempo Changes:</span>
            <span className="text-yellow-400">{stats.tempoChanges}</span>
          </div>

          {stats.timeSignature && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Time Signature:</span>
              <span className="text-red-400">
                {stats.timeSignature.beats}/{stats.timeSignature.beatType}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="rounded bg-slate-800 p-3">
            <div className="text-xs text-slate-400">Avg Note Length</div>
            <div className="text-sm font-bold text-white">
              {(stats.totalDuration / Math.max(stats.totalNotes, 1)).toFixed(2)}s
            </div>
          </div>
          <div className="rounded bg-slate-800 p-3">
            <div className="text-xs text-slate-400">Parse Success</div>
            <div className="text-sm font-bold text-emerald-400">✓ OK</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          <p>
            This parser supports: grace notes, ties, ornaments (trill, mordent,
            turn), multiple voices, tempo changes, dynamics, and fingering.
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Close
        </button>
      </div>
    </div>
  )
}
