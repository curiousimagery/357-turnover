/**
 * Local ESLint plugin that enforces the design-token contract (Section 7.2).
 *
 * It inspects class strings — inside `className`/`class` JSX attributes and
 * inside class-helper calls (cn/clsx/cva/twMerge) — and flags anything outside
 * the defined vocabulary. It is scoped (in eslint.config.mjs) to our own code
 * and deliberately NOT applied to the vendored `components/ui/**` primitives.
 *
 * Two rules:
 *   - class-tokens  (error): no arbitrary values, no raw text-size utilities,
 *                            no raw color-palette utilities.
 *   - spacing-scale (warn) : spacing utilities must use the base-8 scale.
 */

const CLASS_FNS = new Set([
  "cn",
  "clsx",
  "cva",
  "twMerge",
  "classNames",
  "tw",
]);

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const COLOR_PREFIX =
  "text|bg|border|ring|ring-offset|from|via|to|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder";

// An arbitrary VALUE like `w-[12px]` or `bg-[#fff]`. Excludes arbitrary
// VARIANTS / selectors like `data-[state=open]:` and `[&_svg]:` (followed by `:`).
const ARBITRARY_VALUE = /\[[^\]]+\](?!:)/;

const RAW_TEXT_SIZE = new RegExp(
  `(?:^|[\\s:])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?=$|[\\s])`,
);

const RAW_PALETTE = new RegExp(
  `(?:^|[\\s:])(?:${COLOR_PREFIX})-(?:${PALETTE})(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?(?=$|[\\s/])`,
);

// base-8 scale -> the Tailwind spacing keys that produce the allowed px values,
// plus 0. Allowed px: 1,2,4,8,12,16,20,24,32,40,56,64. (Section 6.2)
const ALLOWED_SPACING_KEYS = new Set([
  "0",
  "px",
  "0.5",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "8",
  "10",
  "14",
  "16",
]);
const SPACING_PREFIXES =
  "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y";
const SPACING_TOKEN = new RegExp(
  `^(?:[^\\s]*:)?-?(?:${SPACING_PREFIXES})-(\\S+)$`,
);
const NUMERIC = /^\d+(?:\.\d+)?$/;

function makeRule(check) {
  return {
    meta: { type: "problem", schema: [] },
    create(context) {
      function checkString(value, node) {
        if (typeof value !== "string" || value.length === 0) return;
        check(value, node, context);
      }

      // Walk an expression that resolves to class strings. Does not descend
      // into nested CallExpressions — those are visited on their own.
      function walk(node) {
        if (!node) return;
        switch (node.type) {
          case "Literal":
            if (typeof node.value === "string") checkString(node.value, node);
            break;
          case "TemplateLiteral":
            for (const q of node.quasis) checkString(q.value.cooked, q);
            break;
          case "JSXExpressionContainer":
            walk(node.expression);
            break;
          case "ConditionalExpression":
            walk(node.consequent);
            walk(node.alternate);
            break;
          case "LogicalExpression":
            walk(node.left);
            walk(node.right);
            break;
          case "ArrayExpression":
            node.elements.forEach(walk);
            break;
          case "ObjectExpression":
            for (const prop of node.properties) {
              if (prop.type !== "Property") continue;
              if (prop.key && prop.key.type === "Literal")
                checkString(prop.key.value, prop.key);
              walk(prop.value);
            }
            break;
          default:
            break;
        }
      }

      return {
        JSXAttribute(node) {
          const name = node.name && node.name.name;
          if (name !== "className" && name !== "class") return;
          walk(node.value);
        },
        CallExpression(node) {
          const callee = node.callee;
          let fn = null;
          if (callee.type === "Identifier") fn = callee.name;
          else if (
            callee.type === "MemberExpression" &&
            callee.property.type === "Identifier"
          )
            fn = callee.property.name;
          if (!fn || !CLASS_FNS.has(fn)) return;
          node.arguments.forEach(walk);
        },
      };
    },
  };
}

const classTokens = makeRule((value, node, context) => {
  if (ARBITRARY_VALUE.test(value)) {
    context.report({
      node,
      message:
        "Arbitrary Tailwind value is not allowed. Use a defined token (see DESIGN_TOKENS.md).",
    });
  }
  if (RAW_TEXT_SIZE.test(value)) {
    context.report({
      node,
      message:
        "Raw text-size utility is not allowed. Use text-display/heading/body/caption.",
    });
  }
  if (RAW_PALETTE.test(value)) {
    context.report({
      node,
      message:
        "Raw color-palette utility is not allowed. Use a semantic/status color token.",
    });
  }
});

const spacingScale = makeRule((value, node, context) => {
  for (const token of value.split(/\s+/)) {
    const m = token.match(SPACING_TOKEN);
    if (!m) continue;
    const v = m[1];
    if (!NUMERIC.test(v)) continue; // auto, full, screen, fractions -> fine
    if (!ALLOWED_SPACING_KEYS.has(v)) {
      context.report({
        node,
        message: `Spacing "${token}" is off the base-8 scale. Allowed: 1,2,4,8,12,16,20,24,32,40,56,64 px.`,
      });
    }
  }
});

const plugin = {
  rules: {
    "class-tokens": classTokens,
    "spacing-scale": spacingScale,
  },
};

export default plugin;
