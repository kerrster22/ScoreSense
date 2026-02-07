"use client";

import Link from "next/link";
import {
  Upload,
  Music,
  Play,
  Repeat,
  Hand,
  Tag,
  Layers,
  FileImage,
  Gauge,
  ChevronRight,
  Pause,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function FallingNotes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute h-8 w-1 rounded-full bg-accent/20 animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${10 + Math.random() * 10}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(100vh) rotate(15deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  );
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Music className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold tracking-tight">
            ScoreSense
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
          <a
            href="#features"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#faq"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            FAQ
          </a>
        </nav>
        <Link href="/app">
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            Try it now
          </Button>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-16">
      <FallingNotes />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent" />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Turn sheet music into a learnable piano tutorial.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
          Upload a PDF or image. We convert it to MIDI and generate practice
          loops, hand separation, and repeat-aware guidance.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/app">
            <Button
              size="lg"
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Try it now
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="outline" size="lg">
              See how it works
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload",
      description: "Drop your sheet music",
      bullets: [
        "Supports PDF and image formats",
        "Drag & drop or browse files",
        "Secure local processing",
      ],
    },
    {
      icon: Music,
      title: "Convert",
      description: "AI-powered recognition",
      bullets: [
        "Advanced OMR technology",
        "Note-accurate MIDI output",
        "Preserves tempo & dynamics",
      ],
    },
    {
      icon: Play,
      title: "Practice",
      description: "Interactive learning",
      bullets: [
        "Adjustable playback speed",
        "Hand separation mode",
        "Loop specific sections",
      ],
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative border-t border-border/50 bg-card/30 py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-muted-foreground">
            Three simple steps to master any piece
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-border/50 bg-card p-8 transition-all hover:border-accent/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="text-5xl font-bold text-muted-foreground/20">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
              <ul className="mt-4 space-y-2">
                {step.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="h-1 w-1 rounded-full bg-accent" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: FileImage,
      title: "Upload PDF/JPG",
      description: "Import sheet music in any common format",
    },
    {
      icon: Music,
      title: "MIDI Playback",
      description: "Hear your music with realistic piano sounds",
    },
    {
      icon: Gauge,
      title: "Tempo Control",
      description: "Slow down to 25% or speed up to 200%",
    },
    {
      icon: Repeat,
      title: "Loop 1/2/4 Bars",
      description: "Practice difficult sections on repeat",
    },
    {
      icon: Hand,
      title: "LH/RH Toggle",
      description: "Isolate left or right hand parts",
    },
    {
      icon: Tag,
      title: "Note Labels",
      description: "Display note names for easier reading",
    },
    {
      icon: Layers,
      title: "Pattern Detector",
      description: "Repeating patterns highlighted automatically",
    },
  ];

  return (
    <section id="features" className="relative border-t border-border/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Powerful features
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need to accelerate your piano practice
          </p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-all hover:border-accent/50 hover:bg-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoPreview() {
  return (
    <section className="relative border-t border-border/50 bg-card/30 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See it in action
          </h2>
          <p className="mt-4 text-muted-foreground">
            A preview of the practice interface
          </p>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-accent/5">
          {/* Track Title */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Moonlight Sonata</h3>
              <p className="text-sm text-muted-foreground">
                Ludwig van Beethoven
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs text-accent">
              <Repeat className="h-3 w-3" />
              Repeat detected
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-8">
            <div className="relative h-16 rounded-lg bg-secondary">
              {/* Progress bar */}
              <div className="absolute left-0 top-0 h-full w-1/3 rounded-l-lg bg-accent/20" />
              {/* Playhead */}
              <div className="absolute left-1/3 top-0 h-full w-0.5 bg-accent" />
              {/* Note visualization */}
              <div className="absolute inset-0 flex items-center px-4">
                {[...Array(24)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col gap-1 px-0.5"
                  >
                    {[...Array(Math.floor(Math.random() * 3) + 1)].map(
                      (_, j) => (
                        <div
                          key={j}
                          className={`h-2 rounded-sm ${
                            i < 8
                              ? "bg-accent/60"
                              : i < 16
                                ? "bg-muted-foreground/30"
                                : "bg-accent/30"
                          }`}
                          style={{
                            marginTop: `${Math.random() * 20}px`,
                          }}
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
              {/* Repeat marker */}
              <div className="absolute right-1/4 top-0 h-full w-px border-l-2 border-dashed border-accent" />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>0:00</span>
              <span>1:24</span>
              <span>2:48</span>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-8 flex items-center justify-between">
            {/* Playback controls */}
            <div className="flex items-center gap-4">
              <button type="button" className="text-muted-foreground transition-colors hover:text-foreground">
                <SkipBack className="h-5 w-5" />
              </button>
              <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105">
                <Play className="h-5 w-5 ml-0.5" />
              </button>
              <button type="button" className="text-muted-foreground transition-colors hover:text-foreground">
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Tempo slider */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Tempo</span>
              <div className="relative h-2 w-32 rounded-full bg-secondary">
                <div className="absolute left-0 top-0 h-full w-1/2 rounded-full bg-accent" />
                <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-background" />
              </div>
              <span className="w-12 text-sm font-medium">100%</span>
            </div>

            {/* Hand toggles */}
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
                LH
              </button>
              <button type="button" className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground">
                RH
              </button>
              <button type="button" className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground">
                Both
              </button>
            </div>
          </div>

          {/* Loop controls */}
          <div className="mt-6 flex items-center gap-4 border-t border-border pt-6">
            <span className="text-sm text-muted-foreground">Loop:</span>
            <div className="flex items-center gap-2">
              {["1 bar", "2 bars", "4 bars", "Section"].map((loop, i) => (
                <button
                  key={loop}
                  type="button"
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    i === 1
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {loop}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      question: "Does it work with photos?",
      answer:
        "Yes! ScoreSense supports both high-quality scans (PDF) and photos (JPG, PNG). For best results, ensure your photo is well-lit and the sheet music is flat. Our AI is trained to handle various image qualities.",
    },
    {
      question: "Is this accurate?",
      answer:
        "Our OMR (Optical Music Recognition) technology achieves over 95% accuracy on clean, printed sheet music. Handwritten scores and complex arrangements may have lower accuracy. You can always manually correct any misrecognized notes.",
    },
    {
      question: "Can I export MIDI?",
      answer:
        "Absolutely! Once your sheet music is converted, you can export the MIDI file to use in any DAW, notation software, or other music applications. The export includes all tempo markings and dynamics.",
    },
    {
      question: "Is my music private?",
      answer:
        "Yes, your privacy is our priority. All processing happens locally in your browser—your sheet music never leaves your device. We don't store, share, or have access to any of your uploaded files.",
    },
  ];

  return (
    <section
      id="faq"
      className="relative border-t border-border/50 py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need to know about ScoreSense
          </p>
        </div>
        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-accent" />
            <span className="font-semibold">ScoreSense</span>
          </div>
          <nav className="flex items-center gap-8">
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Product
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Contact
            </a>
          </nav>
          <p className="text-sm text-muted-foreground">
            © 2026 ScoreSense. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <DemoPreview />
      <FAQ />
      <Footer />
    </main>
  );
}
