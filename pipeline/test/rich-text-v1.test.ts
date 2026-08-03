import { describe, expect, it } from "bun:test";
import { translateRichTextV1 } from "$pipeline/rich-text/rich-text-v1";

describe("translateRichTextV1", () => {
  it("translates plain text and line breaks into typed nodes", () => {
    const rich = translateRichTextV1("Line one\nLine two");

    expect(rich.schemaVersion).toBe(1);
    expect(rich.nodes).toEqual([
      { type: "text", text: "Line one" },
      { type: "lineBreak" },
      { type: "text", text: "Line two" },
    ]);
    expect(rich.diagnostics).toEqual([]);
  });

  it("translates supported TMP formatting without emitting HTML", () => {
    const rich = translateRichTextV1("A <b>sharp</b> <color=#7CFF8A>blade</color>");

    expect(rich.nodes).toEqual([
      { type: "text", text: "A " },
      { type: "strong", children: [{ type: "text", text: "sharp" }] },
      { type: "text", text: " " },
      {
        type: "color",
        token: null,
        color: "#7CFF8A",
        children: [{ type: "text", text: "blade" }],
      },
    ]);
    expect(JSON.stringify(rich.nodes)).not.toContain("<strong>");
  });

  it("keeps unknown tags as escaped text plus diagnostics", () => {
    const rich = translateRichTextV1("A <shake>volatile</shake> flask");

    expect(JSON.stringify(rich.nodes)).toContain("<shake>");
    expect(JSON.stringify(rich.nodes)).toContain("</shake>");
    expect(rich.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unsupportedRichTextTag", severity: "diagnostic" }),
    );
  });

  it("preserves nested formatting as a nested node tree", () => {
    const rich = translateRichTextV1("<b>bold <i>and italic</i></b>");

    expect(rich.nodes).toEqual([
      {
        type: "strong",
        children: [
          { type: "text", text: "bold " },
          { type: "emphasis", children: [{ type: "text", text: "and italic" }] },
        ],
      },
    ]);
    expect(rich.diagnostics).toEqual([]);
  });

  it("recovers unterminated tags by preserving the opening tag and parsed children", () => {
    const rich = translateRichTextV1("Before <b>unfinished");

    expect(rich.nodes).toEqual([
      { type: "text", text: "Before <b>" },
      { type: "text", text: "unfinished" },
    ]);
    expect(rich.diagnostics).toEqual([
      {
        severity: "diagnostic",
        code: "unclosedRichTextTag",
        field: "richText",
        message: "Rich text tag 'strong' was not closed.",
      },
    ]);
  });

  it("keeps an unmatched opening tag as text and retains the inner emphasis for crossed tags", () => {
    const rich = translateRichTextV1("<b><i>crossed</b></i>");

    // Crossed recovery is lossy: the unmatched <b> is emitted as literal text,
    // while </b> remains literal text inside the recovered emphasis node.
    expect(rich.nodes).toEqual([
      { type: "text", text: "<b>" },
      {
        type: "emphasis",
        children: [{ type: "text", text: "crossed</b>" }],
      },
    ]);
    expect(rich.diagnostics).toEqual([
      {
        severity: "diagnostic",
        code: "mismatchedRichTextTag",
        field: "richText",
        message: "Unexpected rich text closing tag '</b>'.",
      },
      {
        severity: "diagnostic",
        code: "unclosedRichTextTag",
        field: "richText",
        message: "Rich text tag 'strong' was not closed.",
      },
    ]);
  });

  it("preserves HTML-significant text characters without escaping or dropping them", () => {
    const rich = translateRichTextV1("5 < 6 & 7 > 3");

    expect(rich.nodes).toEqual([{ type: "text", text: "5 < 6 & 7 > 3" }]);
    expect(rich.diagnostics).toEqual([
      {
        severity: "diagnostic",
        code: "unsupportedRichTextTag",
        field: "richText",
        message: "Unsupported rich text tag '< 6 & 7 >'.",
      },
    ]);
  });

  it("translates empty and whitespace-only input into text nodes without diagnostics", () => {
    expect(translateRichTextV1("").nodes).toEqual([]);
    expect(translateRichTextV1("").diagnostics).toEqual([]);

    const whitespace = translateRichTextV1(" \t  ");
    expect(whitespace.nodes).toEqual([{ type: "text", text: " \t  " }]);
    expect(whitespace.diagnostics).toEqual([]);
  });

  it("translates tooltip links to term links", () => {
    const rich = translateRichTextV1('<link="tooltip_stamina">Stamina</link>');

    expect(rich.nodes).toEqual([{ type: "termLink", termId: "stamina", label: "Stamina" }]);
  });

  it("expands known tooltip color/code dictionaries and diagnoses unknown keys", () => {
    const rich = translateRichTextV1("[p +10] {stamina}", {
      tooltipColors: { p: { color: "#6FCF6F", text: "positive" } },
      tooltipCodes: { stamina: "Stamina" },
    });

    expect(rich.nodes).toContainEqual(
      expect.objectContaining({ type: "color", token: "positive", color: "#6FCF6F" }),
    );
    expect(JSON.stringify(rich.nodes)).toContain("Stamina");
    expect(translateRichTextV1("{missing_code}").diagnostics).toContainEqual(
      expect.objectContaining({ code: "unresolvedTooltipCode", severity: "diagnostic" }),
    );
  });

  it("resolves term links through the generated graph contract when a resolver is supplied", () => {
    const rich = translateRichTextV1('<link="tooltip_stamina">Stamina</link>', {
      resolveTerm: (termId, label) => ({
        termId,
        label,
        targetType: "term",
        targetId: termId,
        targetLabel: label,
        targetRoutePath: "/terms/stamina",
        targetHasPage: true,
      }),
    });

    expect(rich.nodes).toEqual([
      {
        type: "termLink",
        termId: "stamina",
        label: "Stamina",
        targetType: "term",
        targetId: "stamina",
        targetLabel: "Stamina",
        targetRoutePath: "/terms/stamina",
        targetHasPage: true,
      },
    ]);
  });
});
