import { createHash } from "node:crypto";

export type RichTextV1 = {
  schemaVersion: 1;
  sourceHash: string;
  nodes: RichTextNode[];
  diagnostics: RichTextDiagnostic[];
};

export type RichTextNode =
  | { type: "text"; text: string }
  | { type: "lineBreak" }
  | { type: "strong"; children: RichTextNode[] }
  | { type: "emphasis"; children: RichTextNode[] }
  | { type: "strike"; children: RichTextNode[] }
  | { type: "color"; token: string | null; color: string | null; children: RichTextNode[] }
  | { type: "sprite"; name: string }
  | ({ type: "termLink"; termId: string; label: string } & Partial<TermResolution>);

export type RichTextDiagnostic = {
  severity: "diagnostic";
  code: string;
  field: string;
  message: string;
};

export type TermResolution = {
  termId: string;
  label: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  targetRoutePath: string;
  targetIsPublic: boolean;
};

export type RichTextOptions = {
  tooltipCodes?: Record<string, string>;
  tooltipColors?: Record<string, string>;
  resolveTerm?: (termId: string, label: string) => TermResolution | undefined;
};

type ContainerFrame = {
  tag: "strong" | "emphasis" | "strike" | "color";
  token?: string | null;
  color?: string | null;
  children: RichTextNode[];
  linkTermId?: string;
};

const TAG_PATTERN = /\n|<\/?[^>]+>|\[[A-Za-z][^\]]*\]|\{[A-Za-z0-9_.:-]+\}/g;

export function translateRichTextV1(source: string, options: RichTextOptions = {}): RichTextV1 {
  const diagnostics: RichTextDiagnostic[] = [];
  const root: RichTextNode[] = [];
  const stack: ContainerFrame[] = [];
  const current = () => (stack.length === 0 ? root : stack[stack.length - 1]!.children);
  const pushText = (text: string) => {
    if (text.length === 0) return;
    const nodes = current();
    const last = nodes[nodes.length - 1];
    if (last?.type === "text") last.text += text;
    else nodes.push({ type: "text", text });
  };
  const diagnostic = (code: string, message: string, field = "richText") =>
    diagnostics.push({ severity: "diagnostic", code, field, message });

  let offset = 0;
  for (const match of source.matchAll(TAG_PATTERN)) {
    const token = match[0];
    const index = match.index ?? 0;
    pushText(source.slice(offset, index));
    offset = index + token.length;

    if (token === "\n") {
      current().push({ type: "lineBreak" });
      continue;
    }
    if (token.startsWith("[")) {
      const translated = translateTooltipColor(token, options.tooltipColors, diagnostic);
      if (translated) current().push(translated);
      else pushText(token);
      continue;
    }
    if (token.startsWith("{")) {
      const key = token.slice(1, -1);
      const label = options.tooltipCodes?.[key];
      if (label) current().push({ type: "text", text: label });
      else {
        diagnostic(
          "unresolvedTooltipCode",
          `Tooltip code '${key}' is not present in the master tooltip dictionary.`,
        );
        pushText(token);
      }
      continue;
    }
    handleTag(token, stack, current, pushText, diagnostic, options);
  }
  pushText(source.slice(offset));

  while (stack.length > 0) {
    const frame = stack.pop()!;
    diagnostic("unclosedRichTextTag", `Rich text tag '${frame.tag}' was not closed.`);
    pushText(renderOpenTag(frame));
    for (const node of frame.children) current().push(node);
  }

  return {
    schemaVersion: 1,
    sourceHash: createHash("sha256").update(source).digest("hex"),
    nodes: root,
    diagnostics,
  };
}

function handleTag(
  token: string,
  stack: ContainerFrame[],
  current: () => RichTextNode[],
  pushText: (text: string) => void,
  diagnostic: (code: string, message: string, field?: string) => void,
  options: RichTextOptions,
) {
  const closing = /^<\/\s*([A-Za-z0-9_-]+)\s*>$/.exec(token);
  if (closing) {
    closeTag(closing[1]!.toLowerCase(), token, stack, current, pushText, diagnostic, options);
    return;
  }

  const simple = /^<\s*([A-Za-z0-9_-]+)(?:\s*=\s*([^>]+))?\s*>$/.exec(token);
  if (!simple) {
    const link = /^<link="tooltip_([A-Za-z0-9_.:-]+)">$/.exec(token);
    if (link) {
      stack.push({ tag: "emphasis", linkTermId: link[1]!, children: [] });
      return;
    }
    const standaloneLink = /^<link="tooltip_([A-Za-z0-9_.:-]+)">([^<]*)<\/link>$/.exec(token);
    if (standaloneLink) {
      current().push(resolveTermLink(standaloneLink[1]!, standaloneLink[2]!, options));
      return;
    }
    diagnostic("unsupportedRichTextTag", `Unsupported rich text tag '${token}'.`);
    pushText(token);
    return;
  }

  const name = simple[1]!.toLowerCase();
  if (name === "b") stack.push({ tag: "strong", children: [] });
  else if (name === "i") stack.push({ tag: "emphasis", children: [] });
  else if (name === "s" || name === "strikethrough") stack.push({ tag: "strike", children: [] });
  else if (name === "color") {
    const color = normalizeColor(simple[2] ?? "");
    stack.push({ tag: "color", color, token: null, children: [] });
  } else if (name === "sprite") {
    current().push({ type: "sprite", name: normalizeAttribute(simple[2] ?? "") });
  } else if (name === "link") {
    const attr = normalizeAttribute(simple[2] ?? "");
    if (attr.startsWith("tooltip_")) {
      stack.push({ tag: "emphasis", linkTermId: attr.slice("tooltip_".length), children: [] });
    } else {
      diagnostic("unsupportedRichTextTag", `Unsupported rich text tag '${token}'.`);
      pushText(token);
    }
  } else {
    diagnostic("unsupportedRichTextTag", `Unsupported rich text tag '${token}'.`);
    pushText(token);
  }
}

function closeTag(
  name: string,
  token: string,
  stack: ContainerFrame[],
  current: () => RichTextNode[],
  pushText: (text: string) => void,
  diagnostic: (code: string, message: string, field?: string) => void,
  options: RichTextOptions,
) {
  if (name === "link") {
    const frame = stack[stack.length - 1];
    if (frame?.linkTermId) {
      stack.pop();
      const label = frame.children.map(nodeText).join("");
      current().push(resolveTermLink(frame.linkTermId, label, options));
      return;
    }
  }

  const expected = normalizeTagName(name);
  if (!expected || stack[stack.length - 1]?.tag !== expected) {
    diagnostic("mismatchedRichTextTag", `Unexpected rich text closing tag '${token}'.`);
    pushText(token);
    return;
  }
  const frame = stack.pop()!;
  current().push(frameToNode(frame));
}

function frameToNode(frame: ContainerFrame): RichTextNode {
  if (frame.tag === "color") {
    return {
      type: "color",
      token: frame.token ?? null,
      color: frame.color ?? null,
      children: frame.children,
    };
  }
  return { type: frame.tag, children: frame.children } as RichTextNode;
}

function renderOpenTag(frame: ContainerFrame): string {
  if (frame.tag === "strong") return "<b>";
  if (frame.tag === "emphasis") return "<i>";
  if (frame.tag === "strike") return "<s>";
  return `<color=${frame.color ?? frame.token ?? ""}>`;
}

function normalizeTagName(name: string): ContainerFrame["tag"] | null {
  if (name === "b") return "strong";
  if (name === "i") return "emphasis";
  if (name === "s" || name === "strikethrough") return "strike";
  if (name === "color") return "color";
  return null;
}

function normalizeColor(raw: string): string {
  return normalizeAttribute(raw).trim();
}

function normalizeAttribute(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function translateTooltipColor(
  token: string,
  tooltipColors: Record<string, string> | undefined,
  diagnostic: (code: string, message: string, field?: string) => void,
): RichTextNode | null {
  const match = /^\[([A-Za-z])\s+([^\]]+)\]$/.exec(token);
  if (!match) return null;
  const code = match[1]!;
  const label = tooltipColors?.[code];
  if (!label) {
    diagnostic(
      "unresolvedTooltipColor",
      `Tooltip color code '${code}' is not present in the master tooltip dictionary.`,
    );
    return null;
  }
  return {
    type: "color",
    token: label,
    color: null,
    children: [{ type: "text", text: match[2]! }],
  };
}

function resolveTermLink(termId: string, label: string, options: RichTextOptions): RichTextNode {
  const resolution = options.resolveTerm?.(termId, label);
  return resolution
    ? { type: "termLink", termId, label, ...resolution }
    : { type: "termLink", termId, label };
}

function nodeText(node: RichTextNode): string {
  if (node.type === "text") return node.text;
  if ("children" in node) return node.children.map(nodeText).join("");
  if (node.type === "lineBreak") return "\n";
  if (node.type === "termLink") return node.label;
  return "";
}
