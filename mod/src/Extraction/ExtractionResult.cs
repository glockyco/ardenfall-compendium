using System.Collections.Generic;
using ArdenfallArchives.Dtos;

namespace ArdenfallArchives.Extraction;

public sealed class ExtractionResult
{
    public bool Success { get; set; }
    public string? PublishedDir { get; set; }
    public int ItemCount { get; set; }
    public int DiagnosticCount { get; set; }
    public PreflightReport Preflight { get; set; } = new();
    public List<Diagnostic> Diagnostics { get; } = new();
}
