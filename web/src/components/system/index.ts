// UX2 primitives (use these for new screens)
export { Screen, type ScreenProps } from "./screen";
export { QuietActions, type QuietAction, type QuietActionsProps } from "./quiet-actions";
export { Reveal, type RevealProps } from "./reveal";
export { ChoiceGroup, type ChoiceGroupProps, type ChoiceOption } from "./choice-group";
export { Answer, type AnswerProps } from "./answer";
export { SelectableRows, type SelectableRow, type SelectableRowsProps } from "./selectable-rows";
export { Note, type NoteProps, type NoteTone } from "./note";
export { SourceLink, type SourceLinkProps } from "./source-link";

// Kept for existing call sites (screens are moving to the primitives above)
export { Disclosure, type DisclosureProps } from "./disclosure";
export {
  Container,
  EmptyNote,
  FadeIn,
  Insight,
  KeyFigure,
  PageIntro,
  PrimaryAction,
  SecondaryLink,
  Section,
  type InsightProps,
  type InsightTone,
  type KeyFigureProps,
  type PageIntroProps,
  type PrimaryActionProps,
} from "./primitives";
export { JourneyIndicator, SetupProgress, RESULTS_JOURNEY, SETUP_STEPS, isResultsPath, type JourneyStep } from "./journey";
