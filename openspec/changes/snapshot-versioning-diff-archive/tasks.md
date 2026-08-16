## 1. Release digest contract

- [ ] 1.1 Define the committed release digest schema beside the release manifest contract.
- [ ] 1.2 Generate the digest from the validated release manifest without recalculating family counts.
- [ ] 1.3 Validate that the digest identifies the release, source snapshot, game build, extractor, counts, and output hashes.
- [ ] 1.4 Extend artifact staging tests to reject a missing or mismatched digest.

## 2. Cross-release comparison

- [ ] 2.1 Define comparison rows from canonical family identity and deterministic canonical content.
- [ ] 2.2 Implement appeared, disappeared, changed, and unchanged classification across two validated releases.
- [ ] 2.3 Add human-readable and machine-readable comparison output with both release identities and source builds.
- [ ] 2.4 Add behavioral tests for additions, removals, changes, equal releases, invalid manifests, and unavailable archives.

## 3. Command-line archive comparison

- [ ] 3.1 Add a command-line entry point that accepts two archived release references.
- [ ] 3.2 Make the command validate both manifests before comparing their canonical SQLite artifacts.
- [ ] 3.3 Return a non-success status with the release reference when an archive is missing or incomplete.
- [ ] 3.4 Exercise the command against two temporary archived releases in a CLI smoke test.

## 4. Archive record and retrieval

- [ ] 4.1 Define a backend-neutral archive record for the manifest, digest, raw snapshot, and canonical SQLite artifact.
- [ ] 4.2 Implement archive store, list, retrieve, and verify operations behind the record contract.
- [ ] 4.3 Restore a release into a temporary directory that existing validation and comparison commands can read.
- [ ] 4.4 Test retrieval after pruning the original release directory.

## 5. Pull request review output

- [ ] 5.1 Add a CI step that generates the digest and comparison for extraction changes against a configured prior archive.
- [ ] 5.2 Publish the generated digest and appeared, disappeared, and changed summary in a stable pull request section.
- [ ] 5.3 Make reruns replace the marked section instead of appending duplicate summaries.
- [ ] 5.4 Add a workflow check that fails when extraction changes have no comparison output.

## 6. Retention and operator guidance

- [ ] 6.1 Document archive retrieval and verification through the backend-neutral command interface.
- [ ] 6.2 Add retention metadata and a prune-safe verification record without selecting a backend.
- [ ] 6.3 Record the selected archive backend and its retention policy when the open decision is closed.
