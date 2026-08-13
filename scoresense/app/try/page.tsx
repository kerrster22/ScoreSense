import type { Metadata } from "next"
import { PracticeApp } from "../app/PracticeApp"

export const metadata: Metadata = {
  title: "Try ScoreSense free",
  description:
    "Try ScoreSense with three preloaded pieces — easy, intermediate, and advanced — no account required.",
}

export default function TryPage() {
  return <PracticeApp mode="demo" />
}
