# Story and cutscene status

This is a partial browser port. The executable's native event handlers contain
the story logic; displaying a room from the WAD does not run those handlers.

Currently implemented:

- Boot/title screens, act and scene cards, scene selection and saved progress.
- A scene's configured intro room can be viewed and walked through.
- Enter skips that preview and starts the scene's playable level.
- Level progression and a simplified score screen.

Still missing:

- The original dialogue, dialogue timing, portraits, and interaction conditions.
- Scripted NPC movement, animation changes, cameras, and scene triggers.
- Complete intro/outro and interlude sequences, including branching conditions.
- Verified story order beyond the scene/room mapping currently in `web/menu.js`.

The dialogue and behavior must be recovered from the original executable or
existing REA/Ghidra exports. They cannot be inferred accurately from room artwork,
and no invented replacement dialogue is included.

## Files to use when available

Keep these private in the existing ignored `re/` directory or outside the
checkout; never add them to Git or the Pages upload:

- The original `HotlineMiami2.exe`, preferably with its version and SHA-256.
- The existing REA/Ghidra project and exported scripts/functions referenced by
  the README (`re/py/`, `re/ghidra/`, especially the object event lookup and scene
  setter). Text exports of the relevant handlers are useful too.
- The user's own data WAD for room, object, sprite, font, and localization tables.
  The music WAD is optional for analyzing story control flow.

Start with the prologue's `rmTutorialFloor1` and `rmTutorialFloor2` actors and
triggers. Verify their parent objects, create/step/collision handlers, combat
sprite names, and exit conditions. Then recover each scene's intro, outro,
dialogue state machine, and transition conditions, testing against the original.

## Reporting a room failure now

While the affected room is loaded, open **Settings → Save bug report**. The JSON
contains the room, character, combat/input state, animation names, room instance
metadata, and target states. It contains no WAD archives, artwork, audio,
executable, or credentials. This can
help identify an unsupported actor without transferring the whole game archive.

Combat regression tests use synthetic metadata to exercise the real simulation
and floor handoff without proprietary files. They verify those code paths; they
do not establish that the original tutorial or every scene is faithfully ported.
