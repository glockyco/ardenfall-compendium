using System;
using System.IO;
using HotRepl.Control;
using HotRepl.Control.Artifacts;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control;

public static class CompendiumCommandResults
{
    public static ControlCommandResult Ok(JObject result) =>
        new(result, Array.Empty<ArtifactRef>(), Array.Empty<ControlCommandError>());

    public static ControlCommandResult Ok(JObject result, params ArtifactRef[] artifacts) =>
        new(result, artifacts, Array.Empty<ControlCommandError>());

    public static ControlCommandResult Validation(string code, string message, JObject? details = null) =>
        new(new JObject(), Array.Empty<ArtifactRef>(), new[] { new ControlCommandError("validation_failed", code, message, Retryable: false, details) });

    public static ControlCommandResult Precondition(string code, string message, JObject? details = null) =>
        new(new JObject(), Array.Empty<ArtifactRef>(), new[] { new ControlCommandError("precondition_failed", code, message, Retryable: false, details) });

    public static ArtifactRef FileArtifact(string logicalName, string path, string contentType, string sha256) =>
        new(logicalName, new Uri(Path.GetFullPath(path)).AbsoluteUri, path, contentType, new FileInfo(path).Length, sha256, true);
}
