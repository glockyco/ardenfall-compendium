## Purpose

Defines the concrete identities and missing-reference outcomes that the existing entity identity contract must add.

## ADDED Requirements

### Requirement: Reference identity preserves its concrete domain

`mod/src/Dtos/SnapshotRef.cs` MUST preserve lookup-asset, named-asset, and record references as distinct kinds. `mod/src/Walker/RefResolver.cs` MUST keep engine resources outside the catalogue.

#### Scenario: A lookup asset resolves

- **WHEN** an Ardenfall asset has a lookup GUID
- **THEN** `RefResolver.ResolveAsset` emits a `lookupAsset` reference with that GUID
- **AND** the reference does not become a named-asset or record identity

#### Scenario: A named asset resolves

- **WHEN** a registered named-asset type has a non-empty asset name
- **THEN** `NamedAssetIdentity.TryCreate` emits `named;<entity>;<asset>` as its canonical identity
- **AND** `SnapshotRef.NamedAsset` preserves the entity and asset name

#### Scenario: A record resolves

- **WHEN** `mod/src/Entities/Portal/PortalExtractor.cs` reads a complete record identity
- **THEN** it emits a record reference containing the table, subtable, and record id tuple
- **AND** it does not fold the instance into an asset identity

#### Scenario: An engine resource resolves

- **WHEN** a referenced Unity object is outside the `Ardenfall` namespace
- **THEN** `RefResolver.ResolveAsset` emits a missing reference with reason `engineResource`
- **AND** it emits no missing-reference diagnostic for that out-of-scope resource

### Requirement: Missing references preserve reason and apply field policy

`mod/src/Walker/RefResolver.cs` MUST preserve each missing reference reason and source. Its `EmitMissing` function MUST apply the field policy as fatal, diagnostic, or optional-empty.

#### Scenario: A catalogue reference has no lookup GUID

- **WHEN** an Ardenfall asset lacks a lookup GUID
- **THEN** the resolver emits reason `lookupAssetGuidMissing`
- **AND** it applies the caller policy to the diagnostic severity

#### Scenario: A required reference is missing

- **WHEN** a field calls `ResolveAsset` with `MissingPolicy.Fatal` and the asset is absent
- **THEN** the resolver emits a fatal diagnostic naming the field and entity row
- **AND** the returned missing reference retains its reason and source

#### Scenario: An optional reference is missing

- **WHEN** a field calls `ResolveAsset` with `MissingPolicy.OptionalEmpty` and the asset is absent
- **THEN** the resolver returns a missing reference with its reason and source
- **AND** it emits no diagnostic for that field
