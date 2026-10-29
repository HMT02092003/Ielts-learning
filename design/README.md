# lặng — IELTS Practice · Design v1.0

The full design (direction C · Calm minimal) for handing to a developer.

```
design/
├── README.md            ← this file
├── design-system.md     ← colour tokens (light/dark), typography, spacing, components, motion
├── canvas.json          ← canvas layout (board positions and sizes)
├── screens/             ← source for each screen (.dc.html)
│   ├── Main.dc.html         Cover + screen index
│   ├── C-Login.dc.html      01 Login
│   ├── C-Dashboard.dc.html  02 Dashboard
│   ├── C-Result.dc.html     03 Result
│   ├── C-Reading.dc.html    04 Reading exam
│   ├── C-Listening.dc.html  05 Listening exam
│   ├── C-Writing.dc.html    06 Writing
│   ├── C-Flashcard.dc.html  07 Vocabulary flashcard
│   ├── C-AdminOCR.dc.html   08 Admin OCR review
│   └── C-Components.dc.html 09 Design system & component states
└── exports/             ← put PNG/PDF files exported from the canvas here
```

## Notes for the developer

- Read `design-system.md` first. It holds all the tokens as CSS variables plus the Tailwind v4 mapping and shadcn/ui aliases.
- The `.dc.html` files are design source. They only render correctly in the Design canvas (they need its runtime). Open them in a text editor to read exact colours, sizes and layout; every style is written inline.
- For images to look at, use the PNG/PDF files in `exports/`.
- Exam screens (Reading, Listening, Writing) must have **no animation**. See section 8 of `design-system.md`.
