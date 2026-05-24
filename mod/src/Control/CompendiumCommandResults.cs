using System;
using System.Collections.Generic;
using System.IO;
using HotRepl.Control;
using HotRepl.Control.Artifacts;

namespace ArdenfallCompendium.Control;

public static class CompendiumCommandResults
{
    public static ControlCommandResult<TOutput> Ok<TOutput>(TOutput output) =>
        ControlCommandResult.Ok(output);

    public static ControlCommandResult<TOutput> Ok<TOutput>(
        TOutput output,
        IReadOnlyDictionary<string, ArtifactRef> artifacts
    ) => ControlCommandResult.Ok(output, artifacts);

    public static ControlCommandResult<TOutput> Validation<TOutput>(
        string code,
        string message,
        object? details = null
    ) => ControlCommandResult.ValidationFailed<TOutput>(code, message, details);

    public static ControlCommandResult<TOutput> Precondition<TOutput>(
        string code,
        string message,
        object? details = null
    ) => ControlCommandResult.PreconditionFailed<TOutput>(code, message, details);
    public static ControlCommandResult<TOutput>? RequiredString<TOutput>(
        string? value,
        string propertyName
    ) =>
        string.IsNullOrWhiteSpace(value)
            ? Validation<TOutput>(
                propertyName + "Required",
                propertyName + " must be a non-empty string."
            )
            : null;

    public static ArtifactRef FileArtifact(
        string logicalName,
        string path,
        string contentType,
        string sha256
    ) =>
        new(
            logicalName,
            new Uri(Path.GetFullPath(path)).AbsoluteUri,
            path,
            contentType,
            new FileInfo(path).Length,
            sha256,
            true
        );
}
