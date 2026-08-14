# CodeQL model packs

Data extensions that teach the CodeQL JavaScript queries about guards written in
this repository. Added 14 Aug 2026.

## Why

The first CodeQL scan of this fork produced 63 alerts and 40 were dismissed by
hand the same day. Most of that was not defects. CodeQL knows the sanitizers
that ship with the libraries it models and knows nothing about ours, so a call
site that is correctly guarded looks identical to one that is not.

Hand dismissal was the wrong long-term answer, because it teaches whoever is
triaging to reach for "false positive" first, and a real finding eventually goes
through with the noise. The same scan found one genuine SSRF, using
`js/request-forgery`, the rule that also produced most of the false positives.
So the rule stays on and the guards get modelled instead.

## How default setup picks this up

This repository uses code scanning **default setup**, not an advanced workflow.
An advanced workflow was deleted on 14 Aug 2026 (commit `14077b3d`) because
GitHub rejects SARIF from an advanced workflow while default setup is enabled,
so the usual route of naming packs in a workflow config file is not available
here.

The route that is available is this directory. Model packs committed under
`.github/codeql/extensions/` are picked up with no workflow change: the CodeQL
CLI stores extension packs found in the analysed codebase into the database at
`database create` time, and `database analyze` applies them unless it is passed
`--no-database-extension-packs`. Nothing needs to be published to a registry.

## The caveat, recorded honestly

GitHub's documentation for default setup says model packs are "currently in
public preview" and lists them as supported for "C/C++, C#, Java/Kotlin, Python,
Ruby, and Rust analysis". **JavaScript and TypeScript are not on that list.**

That list does not match the CodeQL library. At the version default setup is
running (2.26.3), `codeql/javascript-all` declares the extensible predicates
this pack uses, and the JavaScript queries consume them:

| Predicate          | Declared in                    | Consumed by                                              |
| ------------------ | ------------------------------ | -------------------------------------------------------- |
| `barrierModel`     | `ApiGraphModelsExtensions.qll` | `LogInjectionQuery.qll`, `RequestForgeryCustomizations.qll`, `DomBasedXssCustomizations.qll`, `ReflectedXssCustomizations.qll` |
| `barrierGuardModel`| `ApiGraphModelsExtensions.qll` | same, via `ExternalBarrierGuard`                          |

So the mechanism exists and is language agnostic at the CLI level, and the
documented language list is the thing that may lag. Treat this pack as expected
to work but unproven on GitHub's hosted runner until a scan confirms it.

**How to confirm it, after the next scheduled scan:** check whether alerts 72,
73 and 74 (`js/log-injection`) come back. They are dismissed as false positives
today, so a working pack means they are no longer re-raised on new commits to
those files. If they do come back unchanged, the language gate is real, and the
fallback is to keep dismissing them while leaving this pack in place, because it
starts working the moment JavaScript is added to the supported list.

## What is in here

`postiz-guards/` covers `sanitizeForLog` and `escapeHtml`. Which alerts each row
addresses, which guards deliberately are **not** modelled, and why the SSRF
dispatcher cannot be expressed as a data extension at all, are all recorded in
the comments in `postiz-guards/models/postiz-guards.model.yml`. Read that file
before adding rows.

One rule for anyone extending this: a barrier row is a claim that tainted data
is safe afterwards. If that claim is not true, this pack hides real bugs, which
is strictly worse than the noise it was written to remove.
