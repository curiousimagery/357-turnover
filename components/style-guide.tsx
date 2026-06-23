"use client";

import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { CLEANER_TAG_COLORS } from "@/lib/cleaner-tags";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";
import { SyncStatus } from "@/components/sync-status";
import { ScheduleFilter, type ScheduleFilterValue } from "@/components/schedule-filter";
import { TagColorPicker } from "@/components/tag-color-picker";
import {
  TurnoverCard,
  type TurnoverCardData,
} from "@/components/turnover-card";

// Fixed reference time so the relative "synced N ago" demos are deterministic.
const NOW = new Date("2026-06-22T12:00:00");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60000);

const SPACING = [
  { px: 1, w: "w-px" },
  { px: 2, w: "w-0.5" },
  { px: 4, w: "w-1" },
  { px: 8, w: "w-2" },
  { px: 12, w: "w-3" },
  { px: 16, w: "w-4" },
  { px: 20, w: "w-5" },
  { px: 24, w: "w-6" },
  { px: 32, w: "w-8" },
  { px: 40, w: "w-10" },
  { px: 56, w: "w-14" },
  { px: 64, w: "w-16" },
];

const SEMANTIC_COLORS = [
  { label: "background", className: "bg-background" },
  { label: "foreground", className: "bg-foreground" },
  { label: "card", className: "bg-card" },
  { label: "muted", className: "bg-muted" },
  { label: "primary", className: "bg-primary" },
  { label: "secondary", className: "bg-secondary" },
  { label: "accent", className: "bg-accent" },
  { label: "border", className: "bg-background border-2 border-border" },
];

const STATUS_COLORS = [
  { label: "urgent", hint: "same-day", className: "bg-urgent" },
  { label: "success", hint: "covered / paid", className: "bg-success" },
  { label: "warning", hint: "unclaimed / low", className: "bg-warning" },
  { label: "danger", hint: "cancelled", className: "bg-danger" },
];

const SEED_TURNOVERS: TurnoverCardData[] = [
  {
    id: "1",
    date: "2026-06-25",
    isSameDay: true,
    status: "scheduled",
    source: "airbnb",
    assignee: null,
  },
  {
    id: "2",
    date: "2026-06-28",
    isSameDay: false,
    status: "claimed",
    source: "airbnb",
    assignee: { name: "Breanna", color: "emerald" },
  },
  {
    id: "3",
    date: "2026-07-02",
    isSameDay: false,
    status: "completed",
    source: "airbnb",
    assignee: { name: "Tiffany", color: "violet" },
  },
  {
    id: "4",
    date: "2026-07-05",
    isSameDay: false,
    status: "scheduled",
    source: "manual",
    assignee: null,
  },
  {
    id: "5",
    date: "2026-07-10",
    isSameDay: true,
    status: "cancelled",
    source: "airbnb",
    assignee: null,
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading">{title}</h2>
        {description ? (
          <p className="text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StyleGuide() {
  const [filter, setFilter] = useState<ScheduleFilterValue>("all");
  const [tag, setTag] = useState<string>("sky");
  const [cleanliness, setCleanliness] = useState<number[]>([4]);

  const visibleTurnovers = SEED_TURNOVERS.filter((t) => {
    if (filter === "unclaimed")
      return t.status === "scheduled" && !t.assignee;
    if (filter === "mine") return t.assignee?.name === "Breanna";
    return true;
  });

  return (
    <div className="flex flex-col gap-16">
      {/* Type ramp */}
      <Section
        title="Type ramp"
        description="Four styles only. Size / line-height / weight are baked into each token."
      >
        <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-display">Display — 24 / 32 / 600</p>
            <span className="text-caption text-muted-foreground">
              text-display · page and date headlines
            </span>
          </div>
          <Separator />
          <div className="flex flex-col gap-1">
            <p className="text-heading">Heading — 18 / 24 / 600</p>
            <span className="text-caption text-muted-foreground">
              text-heading · section and card titles
            </span>
          </div>
          <Separator />
          <div className="flex flex-col gap-1">
            <p className="text-body">Body — 16 / 24 / 400</p>
            <span className="text-caption text-muted-foreground">
              text-body · default text
            </span>
          </div>
          <Separator />
          <div className="flex flex-col gap-1">
            <p className="text-caption">Caption — 13 / 16 / 500</p>
            <span className="text-caption text-muted-foreground">
              text-caption · meta, labels, timestamps
            </span>
          </div>
        </div>
      </Section>

      {/* Spacing */}
      <Section
        title="Spacing scale"
        description="Base-8. The only permitted values: 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 64 px."
      >
        <div className="flex flex-col gap-2 rounded-lg border border-border p-6">
          {SPACING.map((s) => (
            <div key={s.px} className="flex items-center gap-4">
              <span className="w-16 shrink-0 text-caption text-muted-foreground">
                {s.px}px
              </span>
              <span className={cn("h-4 rounded-sm bg-primary", s.w)} />
            </div>
          ))}
        </div>
      </Section>

      {/* Colors */}
      <Section
        title="Color tokens"
        description="Semantic CSS variables. Status colors do real work; cleaner tags are separate."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SEMANTIC_COLORS.map((c) => (
            <div key={c.label} className="flex flex-col gap-1">
              <div className={cn("h-14 w-full rounded-md border border-border", c.className)} />
              <span className="text-caption text-foreground">{c.label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATUS_COLORS.map((c) => (
            <div key={c.label} className="flex flex-col gap-1">
              <div className={cn("h-14 w-full rounded-md", c.className)} />
              <span className="text-caption text-foreground">{c.label}</span>
              <span className="text-caption text-muted-foreground">
                {c.hint}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Cleaner tag palette */}
      <Section
        title="Cleaner tag palette"
        description="A small, closed, user-chosen set. Never overrides status colors."
      >
        <div className="flex flex-wrap gap-4">
          {CLEANER_TAG_COLORS.map((c) => (
            <div key={c.value} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "inline-flex h-14 w-14 items-center justify-center rounded-md text-caption font-semibold",
                  c.className,
                )}
              >
                {c.label.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-caption text-muted-foreground">
                {c.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <CleanerTag name="Breanna" color="emerald" withName />
          <CleanerTag name="Tiffany Lopez" color="violet" withName />
          <CleanerTag name="Dianna" color="amber" withName />
        </div>
      </Section>

      {/* Radius + elevation */}
      <Section title="Radius & elevation" description="One radius token, one card shadow.">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="h-16 w-16 rounded-lg border border-border bg-card" />
            <span className="text-caption text-muted-foreground">rounded-lg</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-16 w-16 rounded-lg bg-card shadow-card" />
            <span className="text-caption text-muted-foreground">shadow-card</span>
          </div>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons" description="Variants and sizes. Touch is 56px for primary mobile actions.">
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="touch">Touch (56px)</Button>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges & status" description="shadcn Badge plus the token-driven StatusBadge.">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="urgent">Same-day</StatusBadge>
          <StatusBadge tone="warning">Unclaimed</StatusBadge>
          <StatusBadge tone="success">Completed</StatusBadge>
          <StatusBadge tone="danger">Cancelled</StatusBadge>
          <StatusBadge tone="neutral">Relaxed</StatusBadge>
          <StatusBadge tone="outline">Manual</StatusBadge>
        </div>
      </Section>

      {/* Sync status */}
      <Section title="Sync status" description="Visible staleness. Flags past one and two poll cycles.">
        <div className="flex flex-wrap gap-2">
          <SyncStatus lastSyncedAt={minutesAgo(8)} now={NOW} />
          <SyncStatus lastSyncedAt={minutesAgo(80)} now={NOW} />
          <SyncStatus lastSyncedAt={minutesAgo(200)} now={NOW} />
          <SyncStatus lastSyncedAt={null} now={NOW} />
        </div>
      </Section>

      {/* Form controls */}
      <Section title="Form controls">
        <div className="flex flex-col gap-6 rounded-lg border border-border p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sg-input">Input</Label>
            <Input id="sg-input" placeholder="you@example.com" className="h-14 text-body" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sg-textarea">Textarea</Label>
            <Textarea id="sg-textarea" placeholder="A note for the admin…" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Select</Label>
            <Select>
              <SelectTrigger className="h-14">
                <SelectValue placeholder="Pick a cleaner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breanna">Breanna</SelectItem>
                <SelectItem value="tiffany">Tiffany</SelectItem>
                <SelectItem value="dianna">Dianna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="sg-check" />
            <Label htmlFor="sg-check">Started the laundry</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="sg-switch" />
            <Label htmlFor="sg-switch">Running low on supplies</Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Cleanliness — {cleanliness[0]} / 5</Label>
            <Slider
              value={cleanliness}
              onValueChange={setCleanliness}
              min={1}
              max={5}
              step={1}
            />
          </div>
        </div>
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <Tabs defaultValue="checklist">
          <TabsList>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="laundry">Laundry</TabsTrigger>
          </TabsList>
          <TabsContent value="checklist" className="text-body text-muted-foreground">
            The quick &ldquo;before you leave&rdquo; checklist.
          </TabsContent>
          <TabsContent value="feedback" className="text-body text-muted-foreground">
            Rate how the guest left the unit.
          </TabsContent>
          <TabsContent value="laundry" className="text-body text-muted-foreground">
            Record which bedding set you took.
          </TabsContent>
        </Tabs>
      </Section>

      {/* Schedule filter */}
      <Section title="Schedule filter" description="All / Mine / Unclaimed. The cleaner's primary lens.">
        <ScheduleFilter value={filter} onValueChange={setFilter} />
        <p className="text-caption text-muted-foreground">
          Showing: {filter}
        </p>
      </Section>

      {/* Turnover cards */}
      <Section title="Turnover cards" description="The schedule's first-class object. Same-day is unmistakable.">
        <div className="flex flex-col gap-4">
          {visibleTurnovers.map((t) => (
            <TurnoverCard key={t.id} turnover={t} />
          ))}
          {visibleTurnovers.length === 0 ? (
            <Card className="p-6">
              <p className="text-body text-muted-foreground">
                Nothing here for this filter.
              </p>
            </Card>
          ) : null}
        </div>
      </Section>

      {/* Tag color picker */}
      <Section title="Tag color picker" description="Used in Settings. Live preview of your tag.">
        <TagColorPicker value={tag} onChange={setTag} />
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted-foreground">Preview</span>
          <CleanerTag name="Breanna" color={tag} withName />
        </div>
      </Section>

      {/* Card, dialog, toast, skeleton */}
      <Section title="Overlays & feedback">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-heading">Remove yourself?</DialogTitle>
                <DialogDescription className="text-caption">
                  This turnover is in 5 days. Removing yourself leaves a gap to
                  fill. Continue?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep it</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Remove me</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => toast.success("Turnover claimed")}>
            Show toast
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-heading">Card</CardTitle>
            <CardDescription className="text-caption">
              The base surface for grouped content.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
