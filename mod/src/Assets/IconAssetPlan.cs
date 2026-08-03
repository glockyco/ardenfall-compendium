using System;
using System.Collections.Generic;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Assets;

public sealed record IconAssetSlot(
    string EntityId,
    string RowId,
    string Slot,
    Sprite Sprite,
    string OutputSubdir,
    string? SourceField = null);

public interface IIconAssetPlanSink
{
    void AttachAssetPlan(IconAssetPlan? assetPlan);
}

public sealed class IconAssetPlan
{
    public List<IconAssetSlot> Slots { get; } = new();
    public List<Diagnostic> Diagnostics { get; } = new();
    public AssetManifest Manifest { get; } = new();
}

public static class IconAssetPlanner
{
    public static void CaptureItem(IconAssetPlan plan, ItemData item, string rowId)
    {
        CaptureSlot(plan, rowId, "displayIcon", global::ArdenfallCompendium.Entities.Item.ItemIconSlots.DisplayIcon(item));
        CaptureSlot(plan, rowId, "secondaryIcon", global::ArdenfallCompendium.Entities.Item.ItemIconSlots.SecondaryIcon(item));
        var secondaryColor = global::ArdenfallCompendium.Entities.Item.ItemIconSlots.SecondaryColor(item);
        plan.Manifest.ItemIconMetadata.Add(new ItemIconMetadataEntry
        {
            EntityId = "item",
            RowId = rowId,
            DisplayIconColor = AssetColorSnapshot.FromColor(global::ArdenfallCompendium.Entities.Item.ItemIconSlots.DisplayColor(item)),
            SecondaryIconColor = secondaryColor.HasValue ? AssetColorSnapshot.FromColor(secondaryColor.Value) : null,
        });
    }

    private static void CaptureSlot(IconAssetPlan plan, string rowId, string slot, Sprite? sprite)
    {
        if (sprite != null) plan.Slots.Add(new IconAssetSlot("item", rowId, slot, sprite, "item"));
    }
}

public sealed class IconAssetManifestWriter
{
    private readonly SpriteAssetExporter _exporter;

    public IconAssetManifestWriter(SpriteAssetExporter exporter)
    {
        _exporter = exporter;
    }

    public void WriteSlots(string outputDir, IconAssetPlan plan)
    {
        foreach (var slot in plan.Slots)
        {
            try
            {
                var exported = _exporter.WriteSpritePng(slot.Sprite, outputDir, slot.OutputSubdir);
                plan.Manifest.Assets.Add(new AssetManifestEntry
                {
                    EntityId = slot.EntityId,
                    RowId = slot.RowId,
                    Slot = slot.Slot,
                    Kind = "image",
                    PngHash = exported.PngHash,
                    SourcePath = exported.SourcePath,
                });
            }
            catch (Exception exception)
            {
                plan.Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "assetExportFailed",
                    Field = slot.Slot,
                    Message = $"{slot.EntityId} '{slot.RowId}' field '{slot.SourceField ?? slot.Slot}' could not export asset slot '{slot.Slot}': {exception.Message}",
                });
            }
        }
    }
}
