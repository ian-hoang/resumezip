# The AI review

Check mode can ask Claude, Anthropic's AI, to read a resume the way a
recruiter skims one, and mark two kinds of words on it: highlights, the
words that stick, and red flags, the ones that make a recruiter move on.
It's the one thing in resumezip that sends what someone wrote anywhere, so
it only happens when they choose "Get AI feedback", and the panel says where
the text goes before they do.

## What's sent

- `pieces.ts` picks the text that's sent: what's printed in the entries,
  piece by piece (a field, or one bullet), each with an id ("t4") and where it
  is ("Experience → Amazon · bullet 2"). The profile (name, email, phone,
  location and links) isn't sent, nor are the entries' links, places, or a
  paper's authors. `quotedNow` finds a note's words on the resume as it is
  now, so a note follows its bullet when bullets move and goes once its
  words are fixed.
- `review.ts` has the limits and the checks on both ends. `readRequest` is
  what the server accepts; `readReview` keeps only the notes whose quoted
  words are in the piece they name, quoted as the piece has them. The server
  runs it on Claude's answer and the browser runs it again on the server's.

## The server function

`app/api/review/route.ts` is resumezip's only server code. It takes a
request from the site itself (by its `Origin`), checks it, counts it
(`limit.ts`: five every ten minutes and twenty a day from one address, in
memory, so it slows people down rather than stopping them), and asks Claude
(`claude.ts`). Nothing that was sent is logged or kept, and errors are logged
without it.

`claude.ts` holds the prompt and the model. Claude answers in a JSON schema
(structured outputs) with an id, a quote and a note for each mark. If the
request is declined, the API tries it again on the model Anthropic
recommends (`fallbacks: "default"`).

It needs `ANTHROPIC_API_KEY`, set in the host's environment. Without it, as
when running resumezip yourself, the server says the review isn't available
and everything else works as before.

## Drawing it on the preview

`match.ts` finds a quote in text the way it prints: letters and digits only,
without case or accents, so line breaks, hyphenated words, ligatures and
bold marks don't count, and says where it is in the text as it was.
`components/editor/ReviewMarks.tsx` reads the text pdf.js lays invisibly over
each page, finds each note's words there (in their piece first, as the same
words can be printed twice), and draws a pen stroke under the lines they're
on. It measures again whenever the preview's text is drawn again, as after
typing or zooming.

`components/editor/AiReview.tsx` keeps the review while the editor's open,
and `ReviewPanel.tsx` lists it in Check, which is also how a keyboard or a
screen reader gets to it: the marks on the preview are hidden from them.
