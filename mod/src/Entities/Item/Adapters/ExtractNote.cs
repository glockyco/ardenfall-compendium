using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractNote
{
    public static ItemAdapterResult Extract(NoteItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);

        var noteTextAsset = asset.noteTextContents.Get();
        var noteTextIsSet = asset.noteTextContents.IsSet;
        fields["noteTextRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, noteTextAsset, "noteTextRef", rowId, "NoteItemData.noteTextContents");
        fields["noteText"] = noteTextAsset?.text;
        provenance["noteTextRef"] = ProvenanceCapture.ForParameter<object>("noteTextContents.Get()", noteTextIsSet, inherited: !noteTextIsSet);
        provenance["noteText"] = ProvenanceCapture.ForParameter<string>("noteTextContents.Get().text", noteTextIsSet, inherited: !noteTextIsSet);

        var noteContents = asset.noteContents.Get();
        var noteContentsIsSet = asset.noteContents.IsSet;
        fields["noteSectionsJson"] = ItemAdapterHelpers.SnapshotNoteSections(noteContents, refs, rowId);
        provenance["noteSectionsJson"] = ProvenanceCapture.ForParameter<NoteItem.NoteContents>("noteContents.Get().sections", noteContentsIsSet, inherited: !noteContentsIsSet);

        var font = asset.fontAsset.Get();
        var fontIsSet = asset.fontAsset.IsSet;
        fields["fontRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, font, "fontRef", rowId, "NoteItemData.fontAsset");
        provenance["fontRef"] = ProvenanceCapture.ForParameter<object>("fontAsset.Get()", fontIsSet, inherited: !fontIsSet);

        var gainStat = asset.gainStat.Get();
        var gainStatIsSet = asset.gainStat.IsSet;
        fields["gainStatRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, gainStat, "gainStatRef", rowId, "NoteItemData.gainStat");
        provenance["gainStatRef"] = ProvenanceCapture.ForParameter<object>("gainStat.Get()", gainStatIsSet, inherited: !gainStatIsSet);

        var gainStatCount = asset.gainStatCount.Get();
        var gainStatCountIsSet = asset.gainStatCount.IsSet;
        fields["gainStatCount"] = gainStatCount;
        provenance["gainStatCount"] = ProvenanceCapture.ForParameter<int>("gainStatCount.Get()", gainStatCountIsSet, inherited: !gainStatCountIsSet);

        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs));
    }
}
