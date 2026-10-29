import type { Ref } from "react";
import {
  RATING_LABELS,
  RUBRIC_DIMENSIONS,
  type Feedback,
  type FeedbackListId,
} from "../shared/feedback.ts";
import { UI_MESSAGES } from "../shared/strings.ts";
import { OWL } from "./owl.ts";

// Headings for each list section, shown in this order (docs/spec.md, Feedback Output Format).
// A Record, so a new section in shared/feedback.ts fails typecheck until it has a heading here.
const LIST_SECTIONS: Record<FeedbackListId, { heading: string; ordered: boolean }> = {
  strengths: { heading: "Strengths", ordered: false },
  improvements: { heading: "Areas to improve", ordered: false },
  practiceSteps: { heading: "Practice next", ordered: true },
};

type Props = {
  feedback: Feedback;
  // On the heading, so the session can move focus here when feedback arrives.
  headingRef: Ref<HTMLHeadingElement>;
};

export function FeedbackView({ feedback, headingRef }: Props) {
  return (
    <section className="feedback" aria-labelledby="feedback-heading">
      <pre className="owl" aria-hidden="true">
        {OWL}
      </pre>
      <h2 id="feedback-heading" ref={headingRef} tabIndex={-1}>
        Your feedback
      </h2>
      <p className="notice">{UI_MESSAGES.feedback_intro}</p>
      <p>{feedback.summary}</p>

      <h3>Rubric</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Rating</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {RUBRIC_DIMENSIONS.map(({ id, label }) => {
            const { rating, evidence } = feedback.dimensions[id];
            return (
              <tr key={id}>
                <th scope="row">{label}</th>
                <td>{rating === null ? "Not observed" : `${rating} of 4 · ${RATING_LABELS[rating]}`}</td>
                <td>{evidence}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(Object.keys(LIST_SECTIONS) as FeedbackListId[]).map((id) => {
        const { heading, ordered } = LIST_SECTIONS[id];
        const List = ordered ? "ol" : "ul";
        return (
          <div key={id}>
            <h3>{heading}</h3>
            <List>
              {feedback[id].map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </List>
          </div>
        );
      })}
    </section>
  );
}
