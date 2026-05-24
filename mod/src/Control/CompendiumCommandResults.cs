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
        ControlCommandContext<TOutput> context,
        string code,
        string message,
        object? details = null
    ) => context.ValidationFailed(code, message, details);

    public static ControlCommandResult<TOutput> Precondition<TOutput>(
        ControlCommandContext<TOutput> context,
        string code,
        string message,
        object? details = null
    ) => context.PreconditionFailed(code, message, details);

    public static ControlCommandResult<TOutput>? RequiredString<TOutput>(
        ControlCommandContext<TOutput> context,
        string? value,
        string propertyName
    ) =>
        string.IsNullOrWhiteSpace(value)
            ? Validation(
                context,
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
