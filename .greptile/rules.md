# Review rules for resumezip

- Resumes are saved only in the browser's localStorage. There are no accounts and no copy on a server. Flag anything that could overwrite, drop or corrupt saved resumes, including when something fails.
- Every downloaded PDF carries its resume as an attached `resumezip.json` (`frontend/src/lib/resumeFile.ts`). Changes must still open PDFs made by older versions.
- Nothing a person types may leave their browser. Flag new network requests, analytics or third-party scripts.
- Resume templates (`frontend/src/lib/typst/templates`) must stay ATS-friendly: no icons, and links printed as text.
- Site copy is short and plain, and the name is always lowercase "resumezip".
