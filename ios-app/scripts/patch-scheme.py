#!/usr/bin/env python3
"""
Post-xcodegen patch: populates the KlondikePro scheme's Testables section
with the KlondikeProTests target reference.

xcodegen 2.x does not reliably emit Testables when test targets are defined
in project.yml (tracked upstream). Run this script immediately after
`xcodegen generate` to restore the test configuration.

Usage:
    python3 scripts/patch-scheme.py
    # or from ios-app/:
    python3 scripts/patch-scheme.py
"""
import re
import subprocess
import sys
from pathlib import Path

SCHEME_PATH = Path(__file__).parent.parent / "KlondikePro.xcodeproj/xcshareddata/xcschemes/KlondikePro.xcscheme"
PBXPROJ_PATH = Path(__file__).parent.parent / "KlondikePro.xcodeproj/project.pbxproj"
TEST_TARGET_NAME = "KlondikeProTests"


def find_target_guid(pbxproj: Path, target_name: str) -> str:
    """Extract the PBXNativeTarget GUID for the given target name."""
    text = pbxproj.read_text()
    # Match: <GUID> /* <target_name> */ = { isa = PBXNativeTarget;
    pattern = rf"([A-F0-9]{{24}}) /\* {re.escape(target_name)} \*/ = \{{\s*isa = PBXNativeTarget"
    m = re.search(pattern, text)
    if not m:
        raise RuntimeError(f"Could not find PBXNativeTarget GUID for '{target_name}'")
    return m.group(1)


def patch_scheme(scheme: Path, guid: str, target_name: str) -> bool:
    """Inject Testables XML if the section is currently empty. Returns True if patched."""
    content = scheme.read_text()

    empty_testables = "      <Testables>\n      </Testables>"
    if empty_testables not in content:
        print(f"  Testables already populated — no patch needed.")
        return False

    populated = f"""      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "NO"
            randomExecutionOrder = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{guid}"
               BuildableName = "{target_name}.xctest"
               BlueprintName = "{target_name}"
               ReferencedContainer = "container:KlondikePro.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>"""

    scheme.write_text(content.replace(empty_testables, populated))
    return True


if __name__ == "__main__":
    if not SCHEME_PATH.exists():
        print(f"ERROR: scheme not found at {SCHEME_PATH}", file=sys.stderr)
        sys.exit(1)

    guid = find_target_guid(PBXPROJ_PATH, TEST_TARGET_NAME)
    print(f"  {TEST_TARGET_NAME} GUID: {guid}")

    patched = patch_scheme(SCHEME_PATH, guid, TEST_TARGET_NAME)
    if patched:
        print(f"  Patched {SCHEME_PATH.name} — Testables populated.")
    print("  Done.")
