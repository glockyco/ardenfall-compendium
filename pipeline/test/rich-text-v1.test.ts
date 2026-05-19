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

  it("translates tooltip links to term links", () => {
    const rich = translateRichTextV1('<link="tooltip_stamina">Stamina</link>');

    expect(rich.nodes).toEqual([{ type: "termLink", termId: "stamina", label: "Stamina" }]);
  });

  it("expands known tooltip color/code dictionaries and diagnoses unknown keys", () => {
    const rich = translateRichTextV1("[p +10] {stamina}", {
      tooltipColors: { p: "positive" },
      tooltipCodes: { stamina: "Stamina" },
    });

    expect(rich.nodes).toContainEqual(
      expect.objectContaining({ type: "color", token: "positive", color: null }),
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
        targetIsPublic: true,
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
        targetIsPublic: true,
      },
    ]);
  });
});
