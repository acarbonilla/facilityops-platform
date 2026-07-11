# Prompt Engineering

## Goal

Write prompts that let Codex execute accurately with minimal waste.

## Prompt Engineering Standards

- State exact scope and exact non-scope.
- Name the target branch when branch context matters.
- Include validation commands and stop conditions.
- Prefer repository-specific wording over abstract requests.

## Recommended Prompt Structure

- project
- branch
- goal
- required work
- out of scope
- file targets
- validation commands
- definition of done
- stop conditions

This structure is the working form of Master Context v2.x.

## Good Prompt Characteristics

- concrete
- bounded
- file-aware
- validation-aware
- explicit about what not to do

## Bad Prompt Characteristics

- vague goals
- hidden scope changes
- missing stop conditions
- no validation criteria
- no file or module anchors

## Prompt Hygiene

- Reference exact files when possible.
- State whether the task is code, docs, or mixed.
- State whether the assistant should stop after the slice is done.
