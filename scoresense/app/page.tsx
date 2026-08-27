"use client";

import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AuthNavLinks } from "@/components/auth/AuthNavLinks";

type FallingNote = { left: number; delay: number; duration: number }

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Rounded to a few decimal places so the SSR-rendered style string matches
// what the browser re-serializes into the CSSOM after parsing — full-
// precision floats here round-trip to a different string and trip a
// hydration mismatch even though the underlying value is identical.
const round = (n: number) => Math.round(n * 1000) / 1000

const FALLING_NOTES: FallingNote[] = Array.from({ length: 20 }, (_, i) => ({
  left: round(seededRandom(i) * 100),
  delay: round(seededRandom(i + 100) * 10),
  duration: round(10 + seededRandom(i + 200) * 10),
}))

function FallingNotes() {
  const notes = FALLING_NOTES

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {notes.map((n, i) => (
        <div
          key={i}
          className="absolute h-8 w-1 rounded-full bg-accent/20 animate-fall"
          style={{
            left: `${n.left}%`,
            animationDelay: `${n.delay}s`,
            animationDuration: `${n.duration}s`,
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
        <div className="flex items-center gap-4">
          <AuthNavLinks />
          <Link href="/try">
            <Button size="sm" variant="outline">
              Try it now
            </Button>
          </Link>
        </div>
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
          Turn any MIDI or MusicXML file into a learnable piano tutorial.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
          Upload a MIDI or MusicXML file and get an interactive piano tutorial
          with practice loops, hand separation, and repeat-aware guidance.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/try">
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
      description: "Drop your MIDI or MusicXML file",
      bullets: [
        "Supports MIDI and MusicXML formats",
        "Drag & drop or browse files",
        "Secure local processing",
      ],
    },
    {
      icon: Music,
      title: "Parse",
      description: "Instant note-accurate parsing",
      bullets: [
        "Reads MIDI and MusicXML natively",
        "Note-accurate with hand separation",
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
      title: "Upload MIDI/MusicXML",
      description: "Import your score in any standard format",
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
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See it in action
          </h2>
          <p className="mt-4 text-muted-foreground">
            A real screenshot of the practice interface — mid-playback, falling notes, the 88-key keyboard, and the piece library, exactly as it looks.
          </p>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-accent/5">
          <Image
            src="/screenshots/app-demo.png"
            alt="ScoreSense practice interface playing Liszt's La Campanella, showing falling notes above an 88-key keyboard, the practice timeline, transport controls, and the piece library"
            width={3200}
            height={1760}
            className="h-auto w-full"
            sizes="(min-width: 1024px) 1024px, 100vw"
          />
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      question: "What file formats are supported?",
      answer:
        "ScoreSense supports MIDI (.mid, .midi) and MusicXML (.musicxml, .mxl, .xml) files. These are the standard formats exported by notation software like MuseScore, Finale, Sibelius, and most DAWs.",
    },
    {
      question: "Is this accurate?",
      answer:
        "Playback is note-perfect — the notes come directly from the file with no recognition step. MusicXML files also preserve hand assignments, dynamics, and repeats. MIDI files get automatic hand separation from the file's own track/channel structure when it's available, falling back to pitch-based separation when it isn't.",
    },
    {
      question: "Can I back up my practice progress?",
      answer:
        "Yes — your XP, streaks, loop points, and practice history are stored locally in your browser. Use the export/import buttons in the app to download a JSON backup and restore it on another device.",
    },
    {
      question: "Is my music private?",
      answer:
        "Yes, your privacy is our priority. All processing happens locally in your browser — your files never leave your device. We don't store, share, or have access to any of your uploaded files.",
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
