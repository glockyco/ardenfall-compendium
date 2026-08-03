using System;
using System.Collections.Generic;
using System.Reflection;
using Ardenfall;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Character;

public sealed class BuiltLookupTableCharacterAssetSource : ICharacterAssetSource
{
    private static FieldInfo? _characterNameField;

    private static FieldInfo CharacterNameField =>
        _characterNameField ??= typeof(CharacterData).GetField(
            "charName",
            BindingFlags.Instance | BindingFlags.NonPublic) ?? throw new MissingFieldException(
                typeof(CharacterData).FullName,
                "charName");

    public IEnumerable<CharacterAsset> EnumerateCharacters()
    {
        _ = CharacterNameField;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<CharacterData>())
        {
            if (asset == null) continue;

            // CharacterData.CharName is intentionally not used. Its getter may assign
            // a random name while the game is playing. Read the authored parameter.
            var parameter = CharacterNameField.GetValue(asset) as CharacterRandomNameParameter;
            var storedName = parameter?.Get()?.name;
            yield return new CharacterAsset(
                AssetName: asset.name,
                CharacterName: NullIfEmpty(storedName),
                ItemLists: asset.itemLists.Get(),
                AdditionalItems: asset.additionalItems.Get());
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
