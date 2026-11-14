# Practice Room

A small, dependency-free mock test site. Open `index.html` in a modern browser, or serve this folder with any static web server. Your settings, question bank, and active attempt are saved in that browser's local storage; nothing is uploaded to a server.

Use the header toggle to switch between light and dark mode. The selected theme is remembered in this browser.

## Create a question bank

Add questions from the setup screen, or import a `.json` file. JSON may organize questions by section:

```json
{
  "title": "Science practice",
  "durationMinutes": 20,
  "marks": { "correct": 1, "incorrect": 0.25 },
  "sections": [
    {
      "name": "Biology",
      "timeLimitMinutes": 15,
      "questions": [
        {
          "question": "Which part of a plant cell carries out photosynthesis?",
          "options": ["Nucleus", "Chloroplast", "Ribosome", "Vacuole"],
          "answer": "Chloroplast",
          "explanation": "Chloroplasts contain chlorophyll and are where photosynthesis takes place."
        }
      ]
    }
  ]
}
```

You can also use a flat `questions` array, with a `section` value on each question, and a top-level `sectionTimes` object such as `{ "Biology": 15, "Chemistry": 20 }`. The answer may be the exact option text, a letter (`A`–`H`), or an option index (0-based). `durationMinutes`, `marks.correct`, and `marks.incorrect` are optional. Set `timeLimitMinutes` (or `durationMinutes`) on every section to enable sequential section timers; each section locks when its time ends, and the final section submits the test. Leave every section time blank to use the overall duration instead. Partial section timing is rejected at test start so sections can’t accidentally become untimed. On import, choose whether to replace the current bank or append to it.

## Take a test

Set the test name, overall time limit, and points for correct and wrong answers. Sections can be renamed, reordered, and given individual time limits. During an overall-timed test, switch sections freely. During a section-timed test, work through sections in order; earlier sections lock when their timers end, and you can move to the next section early after confirming. Navigate questions, mark them for review, or submit the whole test early. The test submits automatically when the final section or overall timer expires. A running test resumes with its saved answers and remaining time if you reopen the page.
