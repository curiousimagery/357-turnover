/**
 * Starter content for the two admin-editable cheat sheets (Phase 4). These are
 * the "before you leave" closeout list and the inventory refills list — NOT the
 * full cleaning checklist (that stays in docs/content as reference). The admin
 * loads these once, then edits them in-app. Source:
 * docs/content/closeout-and-inventory.md.
 */
export type DefaultItem = {
  name: string;
  description: string;
  helper?: string;
};

export const CHECKLIST_DEFAULTS: DefaultItem[] = [
  {
    name: "Laundry",
    description:
      "Check the washer and dryer (and lint trap) for finished or unfinished loads; pack up anything to be washed off-site.",
  },
  {
    name: "Cabinet lights",
    description: "Put the under-cabinet lights back in place.",
    helper: "Make sure the switch is set to “G.”",
  },
  {
    name: "Test the lamps",
    description:
      "Use the remotes (living area + each bedroom) to turn every lamp on and off, including the salt lamps.",
    helper:
      "If a light doesn’t respond, find its power switch and turn it on, then turn it off again with the remote.",
  },
  {
    name: "Coffee",
    description: "Set out a fresh bag of coffee for the next guest.",
    helper: "If a guest left an open bag, leave it on the airlock shelf for me.",
  },
  {
    name: "Flowers",
    description:
      "Replace the fresh flowers by the coffee if any are available in the garden.",
  },
  {
    name: "Windows",
    description: "Set the windows for the next guest.",
    helper:
      "Same-day check-in & 60–75°F with no rain → leave open. Below ~55°F → close and leave a space heater on in the living room set to 70°F. No one coming same day → close.",
  },
  {
    name: "Power down",
    description:
      "Turn everything off except the air purifier (turn it on if it’s off).",
  },
  {
    name: "Outside",
    description:
      "Tidy the exterior entry — pick up any garbage and check if anything needs attention.",
  },
  {
    name: "Text Daniel",
    description:
      "Text me how clean the guest left it, anything broken, and any low or missing inventory.",
  },
];

export const INVENTORY_DEFAULTS: DefaultItem[] = [
  {
    name: "Coffee",
    description: "A fresh bag for every guest.",
    helper: "If a guest left an open bag, leave it on the airlock shelf for me.",
  },
  { name: "Kitchen drawer", description: "Coffee filters, ziplocks, a variety of tea." },
  { name: "Cooking basics", description: "Oil, salt, pepper, sugar." },
  {
    name: "Under the sink",
    description: "Dish soap, dishwasher tablets, clean sponges, compost bags, trash bags.",
  },
  { name: "Paper towels", description: "Restock." },
  { name: "Hand soap", description: "Kitchen and bathroom." },
  { name: "Toilet paper", description: "Restock." },
  { name: "Shower", description: "Shampoo, conditioner, body wash, face wash." },
  {
    name: "Guest cleaning supplies",
    description: "Antibacterial wipes, all-purpose cleaner, toilet cleaner, glass cleaner.",
  },
  { name: "Laundry detergent", description: "Restock." },
];

export const LIST_DEFAULTS = {
  checklist: CHECKLIST_DEFAULTS,
  inventory: INVENTORY_DEFAULTS,
} as const;

export type ListKind = keyof typeof LIST_DEFAULTS;
