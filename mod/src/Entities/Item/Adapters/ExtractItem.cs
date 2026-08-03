using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractItem
{
    public static (Dictionary<string, object?> fields, Dictionary<string, Provenance> provenance, List<Diagnostic> diagnostics, List<string> tags)
        Extract(ItemData asset, RefResolver refs, string id)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);
        var diagnostics = new List<Diagnostic>();
        var tags = new List<string>();

        fields["id"] = id;

        var (nameResolved, nameSource) = GetItemNameSafe(asset);
        var nameIsSet = asset.itemName.IsSet;
        fields["name"] = nameResolved;
        provenance["name"] = ProvenanceCapture.ForParameter<string>(nameSource, nameIsSet, inherited: !nameIsSet);

        var weightResolved = asset.weight.Get();
        var weightIsSet = asset.weight.IsSet;
        fields["weight"] = weightResolved;
        provenance["weight"] = ProvenanceCapture.ForParameter<float>("weight.Get()", weightIsSet, inherited: !weightIsSet);

        var valueResolved = asset.moneyValue.Get();
        var valueIsSet = asset.moneyValue.IsSet;
        fields["value"] = valueResolved;
        provenance["value"] = ProvenanceCapture.ForParameter<int>("moneyValue.Get()", valueIsSet, inherited: !valueIsSet);

        var descResolved = asset.description?.Get() ?? "";
        var descIsSet = asset.description?.IsSet ?? false;
        fields["description"] = descResolved;
        provenance["description"] = ProvenanceCapture.ForParameter<string>("description.Get()", descIsSet, inherited: !descIsSet);

        var stackableResolved = asset.stackable.Get();
        var stackableIsSet = asset.stackable.IsSet;
        fields["stackable"] = stackableResolved;
        provenance["stackable"] = ProvenanceCapture.ForParameter<bool>("stackable.Get()", stackableIsSet, inherited: !stackableIsSet);

        var hideInGuiResolved = asset.hideInGUI.Get();
        var hideInGuiIsSet = asset.hideInGUI.IsSet;
        fields["hideInGui"] = hideInGuiResolved;
        provenance["hideInGui"] = ProvenanceCapture.ForParameter<bool>("hideInGUI.Get()", hideInGuiIsSet, inherited: !hideInGuiIsSet);

        var questItemResolved = asset.questItem.Get();
        var questItemIsSet = asset.questItem.IsSet;
        fields["questItem"] = questItemResolved;
        provenance["questItem"] = ProvenanceCapture.ForParameter<bool>("questItem.Get()", questItemIsSet, inherited: !questItemIsSet);

        var notLootableChanceResolved = asset.notLootableChance.Get();
        var notLootableChanceIsSet = asset.notLootableChance.IsSet;
        fields["notLootableChance"] = notLootableChanceResolved;
        provenance["notLootableChance"] = ProvenanceCapture.ForParameter<float>("notLootableChance.Get()", notLootableChanceIsSet, inherited: !notLootableChanceIsSet);

        var cannotBeOwnedResolved = asset.cannotBeOwned.Get();
        var cannotBeOwnedIsSet = asset.cannotBeOwned.IsSet;
        fields["cannotBeOwned"] = cannotBeOwnedResolved;
        provenance["cannotBeOwned"] = ProvenanceCapture.ForParameter<bool>("cannotBeOwned.Get()", cannotBeOwnedIsSet, inherited: !cannotBeOwnedIsSet);

        var quickslotIconResolved = asset.quickslotIcon.Get();
        fields["quickslotIconRef"] = quickslotIconResolved == null
            ? null
            : refs.ResolveAsset(
                quickslotIconResolved,
                "quickslotIconRef",
                id,
                MissingPolicy.Diagnostic,
                source: "ItemData.quickslotIcon",
                diagnosticCode: "itemQuickslotIconRefMissing");
        if (quickslotIconResolved != null)
        {
            provenance["quickslotIconRef"] = (fields["quickslotIconRef"] as SnapshotRef)?.Kind == "missing"
                ? ProvenanceCapture.ForMissing("ItemData.quickslotIcon", inherited: false)
                : ProvenanceCapture.ForLookupAsset("ItemData.quickslotIcon", isSet: true, inherited: false);
        }

        var categoryResolved = asset.category.Get();
        fields["categoryName"] = CategoryNameForFallback(categoryResolved);
        fields["categoryRef"] = categoryResolved == null
            ? null
            : refs.ResolveAsset(
                categoryResolved,
                "categoryRef",
                id,
                MissingPolicy.Diagnostic,
                source: "ItemData.category",
                diagnosticCode: "itemCategoryRefMissing");
        if (categoryResolved != null)
        {
            provenance["categoryRef"] = (fields["categoryRef"] as SnapshotRef)?.Kind == "missing"
                ? ProvenanceCapture.ForMissing("ItemData.category", inherited: false)
                : ProvenanceCapture.ForLookupAsset("ItemData.category", isSet: true, inherited: false);
            provenance["categoryName"] = ProvenanceCapture.ForParameter<string>(
                "ItemData.category.Get().categoryName",
                isSet: true,
                inherited: false);
        }

        var isIllegalResolved = asset.isIllegal.Get();
        var isIllegalIsSet = asset.isIllegal.IsSet;
        fields["isIllegal"] = isIllegalResolved;
        provenance["isIllegal"] = ProvenanceCapture.ForParameter<bool>("isIllegal.Get()", isIllegalIsSet, inherited: !isIllegalIsSet);

        fields["iconRef"] = refs.ResolveAsset(
            asset.icon?.Get(),
            "iconRef",
            id,
            MissingPolicy.Diagnostic,
            source: "ItemData.icon",
            diagnosticCode: "itemIconRefMissing");
        provenance["iconRef"] = (fields["iconRef"] as SnapshotRef)?.Kind == "missing"
            ? ProvenanceCapture.ForMissing("ItemData.icon", inherited: false)
            : ProvenanceCapture.ForLookupAsset("ItemData.icon", isSet: true, inherited: false);

        var tagListResolved = asset.tags.Get();
        var tagIsSet = asset.tags.IsSet;
        provenance["tags"] = ProvenanceCapture.ForSmartList<object>("tags.Get()", tagIsSet, inherited: !tagIsSet);
        if (tagListResolved != null)
        {
            foreach (var tag in tagListResolved)
            {
                if (tag == null) continue;
                var tagId = ResolveTagRef(tag, refs, id);
                if (tagId != null) tags.Add(tagId);
            }
        }
        diagnostics.AddRange(refs.Diagnostics);
        refs.Diagnostics.Clear();
        return (fields, provenance, diagnostics, tags);
    }

    public static string? CategoryNameForFallback(Ardenfall.ItemCategory? category) =>
        string.IsNullOrWhiteSpace(category?.categoryName) ? null : category.categoryName;

    public static string? ResolveTagRef(
        Ardenfall.Item.ItemTag tag,
        RefResolver refs,
        string id,
        Func<Ardenfall.Item.ItemTag, string?>? getGuid = null)
    {
        var guid = getGuid != null ? getGuid(tag) : BuiltLookupTable.Instance?.GetGuid(tag);
        if (!string.IsNullOrWhiteSpace(guid)) return guid;

        refs.Diagnostics.Add(new Diagnostic
        {
            Severity = "diagnostic",
            Code = "itemTagRefMissing",
            Field = "tags",
            Message = $"missing ref 'tags' on {id}",
        });
        return null;
    }

    private static (string Name, string Source) GetItemNameSafe(ItemData asset)
    {
        if (asset is PotionRecipeItemData potionRecipe)
        {
            var recipe = potionRecipe.recipe.Get();
            if (ReferenceEquals(recipe, null) || !HasPotionNameSource(recipe))
            {
                return (potionRecipe.itemName.Get() ?? "", "itemName.Get()");
            }
        }

        if (asset is SlateSpellItemData slateSpell)
        {
            var spell = slateSpell.spellData.Get();
            if (ReferenceEquals(spell, null) || ReferenceEquals(spell.spellData, null))
            {
                return (slateSpell.itemName.Get() ?? "", "itemName.Get()");
            }
        }

        if (asset is ThrowingPotionData throwingPotion)
        {
            var effects = throwingPotion.areaOfEffect.Get();
            if (effects == null ||
                effects.Length == 0 ||
                effects[0] == null ||
                ReferenceEquals(effects[0].StatusEffect, null))
            {
                return (throwingPotion.itemName.Get() ?? "", "itemName.Get()");
            }
        }

        return (asset.GetItemName(), "GetItemName()");
    }

    private static bool HasPotionNameSource(PotionRecipe recipe) =>
        (recipe.drinkablePotions != null && recipe.drinkablePotions.Count > 0 && !ReferenceEquals(recipe.drinkablePotions[0], null)) ||
        (recipe.throwingPotions != null && recipe.throwingPotions.Count > 0 && !ReferenceEquals(recipe.throwingPotions[0], null));
}
