## MODIFIED Requirements

### Requirement: Reference identity preserves its concrete domain

`mod/src/Dtos/SnapshotRef.cs` MUST preserve lookup-asset, named-asset, and record references as distinct kinds. `mod/src/Walker/RefResolver.cs` MUST keep engine resources outside the catalogue.

A game record MUST be identified by the guid its `RecordID` carries and by nothing else. A record reference MUST be `{ kind: "record", id, recordType }`, and a record row id MUST be that guid. The main game's `RecordID` holds one `id`; the table and subtable of the discontinued Demo do not exist and MUST NOT be carried as empty strings. A record whose guid is empty MUST fail its family with a fatal diagnostic rather than publish under a synthetic id.

#### Scenario: A lookup asset resolves

- **WHEN** an Ardenfall asset has a lookup GUID
- **THEN** `RefResolver.ResolveAsset` emits a `lookupAsset` reference with that GUID
- **AND** the reference does not become a named-asset or record identity

#### Scenario: A named asset resolves

- **WHEN** a registered named-asset type has a non-empty asset name
- **THEN** `NamedAssetIdentity.TryCreate` emits `named;<entity>;<asset>` as its canonical identity
- **AND** `SnapshotRef.NamedAsset` preserves the entity and asset name

#### Scenario: A record resolves

- **WHEN** `mod/src/Entities/Portal/PortalExtractor.cs` reads a record with a non-empty guid
- **THEN** it emits a record reference carrying that guid and the record type
- **AND** the row id equals the guid

#### Scenario: A record reference resolves in the pipeline

- **WHEN** a read model resolves a `record` reference
- **THEN** it looks the target up by the guid alone
- **AND** it does not compose a table-qualified key

#### Scenario: A record has no guid

- **WHEN** a record's `RecordID` is empty
- **THEN** the family emits a fatal diagnostic naming the record type
- **AND** the snapshot fails the completeness gate

#### Scenario: An engine resource resolves

- **WHEN** a referenced Unity object is outside the `Ardenfall` namespace
- **THEN** `RefResolver.ResolveAsset` emits a missing reference with reason `engineResource`
- **AND** it emits no missing-reference diagnostic for that out-of-scope resource
