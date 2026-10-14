# Progress

## 2026-10-14

- Read the game UI, music-theory helpers, tests, and CI workflow.
- Decided the existing GitHub repo `kennethteh90/piano-picnic` is the project repo, so setup continues here.
- Current difficulty behavior is not distinct: Explorer and Superstar both hide names, and both reshuffle after a full pass (`difficulty !== "seedling"`). Hints exist only in Hear a chord, and Seedling Hear starts with a note already revealed.
- Planned three separate axes: deal order, on-screen names and piano labels, and hint strength. Shortcuts will be C (hear chord), N (hear notes), H (hint), and Enter (check).
